"""BenchFlow SDK backend — delegates execution to benchflow.SDK.run().

This is the MVP execution backend. It wraps BenchFlow's proven pipeline
(Docker build → ACP agent → pytest verifier) behind SkillForge's
ExecutionBackend interface.

When we need deeper control (real-time trajectory interception, custom
agent protocols, etc.), we'll write a new backend implementing the same
ExecutionBackend interface — no changes to orchestrator or API needed.
"""

import asyncio
import json
import logging
import os
import subprocess
from datetime import datetime
from pathlib import Path

from skillforge.engine import (
    ExecutionBackend,
    RunConfig,
    RunPhase,
    RunResult,
    StatusCallback,
    StatusUpdate,
)

logger = logging.getLogger(__name__)


def _build_agent_env() -> dict[str, str]:
    """Collect agent credentials from host environment."""
    env = {}
    keys_to_forward = [
        "ANTHROPIC_API_KEY",
        "ANTHROPIC_AUTH_TOKEN",
        "ANTHROPIC_BASE_URL",
        "ANTHROPIC_CUSTOM_HEADERS",
        "OPENAI_API_KEY",
        "GOOGLE_API_KEY",
        "GEMINI_API_KEY",
    ]
    for key in keys_to_forward:
        val = os.environ.get(key)
        if val:
            env[key] = val
    return env


def _emit(callback: StatusCallback, phase: RunPhase, message: str = "") -> None:
    """Emit a status update if callback is provided."""
    if callback:
        callback(StatusUpdate(phase=phase, message=message))


class BenchFlowBackend(ExecutionBackend):
    """Execute evaluations via BenchFlow SDK.

    Uses `sg docker -c` wrapper if docker_use_sg=True (for environments
    where the user isn't in the docker group).
    """

    def __init__(self, docker_use_sg: bool = False, jobs_dir: str = "jobs"):
        self.docker_use_sg = docker_use_sg
        self.jobs_dir = jobs_dir
        self._active_processes: dict[str, asyncio.subprocess.Process] = {}

    async def execute(
        self,
        config: RunConfig,
        on_status: StatusCallback = None,
    ) -> RunResult:
        """Execute via BenchFlow SDK in a subprocess.

        We run BenchFlow in a subprocess rather than in-process because:
        1. BenchFlow patches global state at import time (_patch_harbor_dind)
        2. Docker operations may need `sg docker -c` wrapping
        3. Isolation — a stuck run doesn't block the FastAPI event loop
        """
        _emit(on_status, RunPhase.BUILDING, "Preparing evaluation environment...")

        # Build the command
        cmd_parts = self._build_command(config)
        env = self._build_env(config)

        logger.info("Starting BenchFlow run: task=%s agent=%s model=%s skills=%s",
                     config.task_path, config.agent, config.model, config.skills_dir)

        _emit(on_status, RunPhase.RUNNING, "Agent executing task...")

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd_parts,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
                cwd=str(Path(config.task_path).parent.parent),  # project root
            )

            stdout, stderr = await asyncio.wait_for(
                proc.communicate(),
                timeout=config.timeout_sec + 300,  # extra buffer for build + verify
            )

            stdout_str = stdout.decode("utf-8", errors="replace") if stdout else ""
            stderr_str = stderr.decode("utf-8", errors="replace") if stderr else ""

            logger.info("BenchFlow process exited with code %s", proc.returncode)

            if proc.returncode != 0 and not stdout_str.strip():
                return RunResult(
                    error=f"BenchFlow exited with code {proc.returncode}: {stderr_str[:2000]}",
                    timing={},
                )

            _emit(on_status, RunPhase.VERIFYING, "Checking results...")

            return self._parse_output(stdout_str, stderr_str, config)

        except asyncio.TimeoutError:
            return RunResult(
                error=f"Run timed out after {config.timeout_sec + 300}s",
                timing={},
            )
        except Exception as e:
            logger.exception("BenchFlow execution failed")
            return RunResult(error=str(e), timing={})

    async def cancel(self, run_id: str) -> bool:
        proc = self._active_processes.pop(run_id, None)
        if proc and proc.returncode is None:
            proc.terminate()
            return True
        return False

    async def health_check(self) -> dict:
        """Check Docker is accessible."""
        try:
            if self.docker_use_sg:
                result = subprocess.run(
                    ["sg", "docker", "-c", "docker info --format '{{.ServerVersion}}'"],
                    capture_output=True, text=True, timeout=10,
                )
            else:
                result = subprocess.run(
                    ["docker", "info", "--format", "{{.ServerVersion}}"],
                    capture_output=True, text=True, timeout=10,
                )
            if result.returncode == 0:
                return {"status": "ok", "docker_version": result.stdout.strip()}
            return {"status": "error", "detail": result.stderr.strip()}
        except Exception as e:
            return {"status": "error", "detail": str(e)}

    def _build_command(self, config: RunConfig) -> list[str]:
        """Build the shell command to invoke BenchFlow."""
        # We call `uv run bench run` which is the BenchFlow CLI
        bench_cmd = (
            f"uv run bench run {config.task_path}"
            f" --agent {config.agent}"
            f" --model {config.model}"
            f" --jobs-dir {self.jobs_dir}"
        )
        if config.skills_dir:
            bench_cmd += f" --skills-dir {config.skills_dir}"
        if config.sandbox_user:
            bench_cmd += f" --sandbox-user {config.sandbox_user}"

        if self.docker_use_sg:
            return ["sg", "docker", "-c", f"bash -c 'export PATH=$HOME/.local/bin:$PATH && {bench_cmd}'"]
        else:
            return ["bash", "-c", f"export PATH=$HOME/.local/bin:$PATH && {bench_cmd}"]

    def _build_env(self, config: RunConfig) -> dict[str, str]:
        """Build environment variables for the subprocess."""
        env = dict(os.environ)
        # Merge host agent credentials
        env.update(_build_agent_env())
        # Merge run-specific overrides
        env.update(config.env_vars)
        return env

    def _parse_output(self, stdout: str, stderr: str, config: RunConfig) -> RunResult:
        """Parse BenchFlow CLI output into RunResult.

        BenchFlow CLI prints summary like:
            Task: weighted-gdp-calc
            Agent: claude-agent-acp (claude-sonnet-4-6)
            Reward: 1.0
            Tool calls: 15
        """
        result = RunResult()

        # Parse reward from stdout
        for line in stdout.split("\n"):
            line = line.strip()
            if line.startswith("Reward:"):
                val = line.split(":", 1)[1].strip()
                try:
                    result.reward = float(val)
                    result.passed = result.reward > 0
                except ValueError:
                    result.reward = None
                    result.passed = False
            elif line.startswith("Tool calls:"):
                try:
                    result.tool_calls_count = int(line.split(":", 1)[1].strip())
                except ValueError:
                    pass
            elif line.startswith("Error:"):
                result.error = line.split(":", 1)[1].strip()

        # Try to find and parse result.json from the jobs directory
        result_json = self._find_latest_result_json(config)
        if result_json:
            result.timing = result_json.get("timing", {})
            result.trial_dir = str(Path(result_json.get("_trial_dir", "")))
            if result.reward is None:
                rewards = result_json.get("rewards", {})
                if isinstance(rewards, dict):
                    result.reward = rewards.get("reward")
                    result.passed = result.reward is not None and result.reward > 0
            if not result.error:
                result.error = result_json.get("error")
            result.verifier_output = result_json.get("verifier_error")
            result.tool_calls_count = result_json.get("n_tool_calls", result.tool_calls_count)

        # Try to load trajectory
        if result.trial_dir:
            traj_path = Path(result.trial_dir) / "trajectory" / "acp_trajectory.jsonl"
            if traj_path.exists():
                try:
                    result.trajectory = [
                        json.loads(line)
                        for line in traj_path.read_text().strip().split("\n")
                        if line.strip()
                    ]
                except Exception:
                    pass

        return result

    def _find_latest_result_json(self, config: RunConfig) -> dict | None:
        """Find the most recent result.json for this task in jobs_dir."""
        jobs_path = Path(config.task_path).parent.parent / self.jobs_dir
        if not jobs_path.exists():
            return None

        task_name = Path(config.task_path).name
        latest_result = None
        latest_time = None

        for job_dir in sorted(jobs_path.iterdir(), reverse=True):
            if not job_dir.is_dir():
                continue
            for trial_dir in job_dir.iterdir():
                if not trial_dir.is_dir() or not trial_dir.name.startswith(task_name):
                    continue
                result_file = trial_dir / "result.json"
                if result_file.exists():
                    try:
                        data = json.loads(result_file.read_text())
                        data["_trial_dir"] = str(trial_dir)
                        mtime = result_file.stat().st_mtime
                        if latest_time is None or mtime > latest_time:
                            latest_time = mtime
                            latest_result = data
                    except Exception:
                        continue
            if latest_result:
                break  # Found in most recent job dir

        return latest_result
