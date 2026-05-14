"""Custom Docker execution backend — our own implementation.

Replaces BenchFlowBackend. Directly controls Docker containers:
  1. docker build    → build task image
  2. docker run -d   → start container
  3. docker cp       → inject skills + instruction
  4. docker exec     → install agent CLI
  5. docker exec     → run agent with instruction (non-interactive -p mode)
  6. docker exec     → run pytest verifier
  7. docker cp       → extract results
  8. docker rm       → cleanup

No ACP protocol, no Docker Compose, no Harbor. Just docker commands.
"""

from __future__ import annotations

import json
import logging
import uuid
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
from skillforge.engine.agents import get_adapter
from skillforge.engine.docker_client import DockerClient

logger = logging.getLogger(__name__)


def _emit(callback: StatusCallback, phase: RunPhase, msg: str = "") -> None:
    if callback:
        callback(StatusUpdate(phase=phase, message=msg))


class CustomDockerBackend(ExecutionBackend):
    """Execute evaluations using direct Docker commands."""

    def __init__(self, docker_use_sg: bool = False, artifacts_dir: str = "./data/runs"):
        self.docker = DockerClient(use_sg=docker_use_sg)
        self.artifacts_dir = Path(artifacts_dir)
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)
        self._active_containers: dict[str, str] = {}  # run_id → container_name

    async def execute(
        self,
        config: RunConfig,
        on_status: StatusCallback = None,
    ) -> RunResult:
        """Full evaluation lifecycle."""
        task_path = Path(config.task_path)
        task_name = task_path.name
        run_id = uuid.uuid4().hex[:8]
        container_name = f"skillforge-{task_name}-{run_id}"
        image_tag = f"skillforge/{task_name}:latest"
        timing: dict[str, float] = {}
        trial_dir = self.artifacts_dir / f"{task_name}__{run_id}"
        trial_dir.mkdir(parents=True, exist_ok=True)

        # Get agent adapter
        adapter = get_adapter(config.agent)
        if not adapter:
            return RunResult(error=f"Unknown agent: {config.agent}")

        try:
            # ── PHASE 1: BUILD ──
            _emit(on_status, RunPhase.BUILDING, f"Building Docker image for {task_name}...")
            t0 = datetime.now()

            dockerfile_path = task_path / "environment" / "Dockerfile"
            if not dockerfile_path.exists():
                dockerfile_path = task_path / "Dockerfile"
            if not dockerfile_path.exists():
                return RunResult(error=f"No Dockerfile found in {task_path}")

            context_dir = str(dockerfile_path.parent)

            # Check cache
            if not self.docker.should_rebuild(str(dockerfile_path), image_tag):
                if await self.docker.image_exists(image_tag):
                    logger.info("Image cache hit for %s", image_tag)
                    _emit(on_status, RunPhase.BUILDING, "Using cached image")
                else:
                    await self.docker.build(context_dir, image_tag, str(dockerfile_path))
                    self.docker.update_cache(str(dockerfile_path), image_tag)
            else:
                await self.docker.build(context_dir, image_tag, str(dockerfile_path))
                self.docker.update_cache(str(dockerfile_path), image_tag)

            timing["build_sec"] = (datetime.now() - t0).total_seconds()

            # ── PHASE 2: START CONTAINER ──
            _emit(on_status, RunPhase.BUILDING, "Starting container...")

            agent_env = adapter.env_vars()
            agent_env.update(config.env_vars)

            await self.docker.run(
                image=image_tag,
                name=container_name,
                env=agent_env,
            )
            self._active_containers[config.task_path] = container_name

            # ── PHASE 3: INJECT SKILLS + INSTRUCTION ──
            _emit(on_status, RunPhase.BUILDING, "Injecting skills and instruction...")

            # Copy instruction.md
            instruction_src = task_path / "instruction.md"
            if instruction_src.exists():
                await self.docker.cp_to(container_name, str(instruction_src), "/tmp/instruction.md")

            # Copy skills if provided
            if config.skills_dir and Path(config.skills_dir).is_dir():
                for skill_dir in sorted(Path(config.skills_dir).iterdir()):
                    if skill_dir.is_dir() and (skill_dir / "SKILL.md").exists():
                        for target_base in adapter.skill_target_dirs():
                            target = f"{target_base}/{skill_dir.name}"
                            # Create target dir and copy
                            await self.docker.exec(
                                container_name,
                                f"mkdir -p {target}",
                            )
                            await self.docker.cp_to(
                                container_name,
                                str(skill_dir) + "/.",
                                target,
                            )

            # ── PHASE 4: INSTALL AGENT ──
            _emit(on_status, RunPhase.BUILDING, f"Installing {adapter.config().display_name}...")
            t0 = datetime.now()

            for cmd in adapter.install_commands():
                rc, stdout, stderr = await self.docker.exec(
                    container_name, cmd, env=agent_env, timeout=300,
                )
                if rc != 0:
                    logger.warning("Agent install cmd returned rc=%d: %s", rc, stderr[:200])
                    # Don't fail — some install steps are optional

            timing["agent_install_sec"] = (datetime.now() - t0).total_seconds()

            # ── PHASE 5: RUN AGENT ──
            _emit(on_status, RunPhase.RUNNING, "Agent executing task...")
            t0 = datetime.now()

            agent_cmd = adapter.run_command("/tmp/instruction.md", config.model)
            rc, agent_stdout, agent_stderr = await self.docker.exec(
                container_name,
                agent_cmd,
                env=agent_env,
                timeout=config.timeout_sec,
                workdir="/root",
            )

            timing["agent_sec"] = (datetime.now() - t0).total_seconds()

            # Save agent output
            (trial_dir / "agent_stdout.txt").write_text(agent_stdout)
            (trial_dir / "agent_stderr.txt").write_text(agent_stderr)
            logger.info(
                "Agent finished: rc=%d, stdout=%d chars, stderr=%d chars",
                rc, len(agent_stdout), len(agent_stderr),
            )

            # ── PHASE 6: VERIFY ──
            _emit(on_status, RunPhase.VERIFYING, "Running verifier...")
            t0 = datetime.now()

            reward, verifier_output, test_passed = await self._run_verifier(
                container_name, task_path, agent_env
            )

            timing["verify_sec"] = (datetime.now() - t0).total_seconds()

            # Save verifier output
            (trial_dir / "verifier_output.txt").write_text(verifier_output)

            # ── PHASE 7: COLLECT TRAJECTORY ──
            _emit(on_status, RunPhase.ANALYZING, "Collecting results...")

            trajectory = self._parse_agent_output(agent_stdout)

            # Save trajectory
            if trajectory:
                (trial_dir / "trajectory.jsonl").write_text(
                    "\n".join(json.dumps(e) for e in trajectory)
                )

            timing["total_sec"] = sum(timing.values())

            return RunResult(
                reward=reward,
                passed=test_passed,
                error=None if test_passed or reward is not None else f"Agent exited with rc={rc}",
                verifier_output=verifier_output,
                tool_calls_count=len([e for e in trajectory if e.get("type") == "tool_call"]),
                timing=timing,
                trajectory=trajectory,
                trial_dir=str(trial_dir),
            )

        except Exception as e:
            logger.exception("Run failed: %s", e)
            return RunResult(
                error=str(e),
                timing=timing,
                trial_dir=str(trial_dir),
            )

        finally:
            # ── CLEANUP ──
            try:
                await self.docker.rm(container_name)
            except Exception:
                pass
            self._active_containers.pop(config.task_path, None)

    async def cancel(self, run_id: str) -> bool:
        """Cancel by removing the container."""
        container = self._active_containers.pop(run_id, None)
        if container:
            await self.docker.rm(container)
            return True
        return False

    async def health_check(self) -> dict:
        return await self.docker.health_check()

    # ------------------------------------------------------------------
    # Verifier
    # ------------------------------------------------------------------

    async def _run_verifier(
        self,
        container: str,
        task_path: Path,
        env: dict[str, str],
    ) -> tuple[float | None, str, bool]:
        """Run pytest verifier inside the container. Returns (reward, output, passed)."""

        # Copy test files to container
        test_dir = task_path / "tests"
        if not test_dir.exists():
            return None, "No tests directory found", False

        await self.docker.cp_to(container, str(test_dir), "/tests")

        # Copy solution for reference (locked — agent can't access during run)
        solution_dir = task_path / "solution"
        if solution_dir.exists():
            await self.docker.cp_to(container, str(solution_dir), "/solution")

        # Check for test.sh (standard SkillsBench verifier)
        test_sh = task_path / "tests" / "test.sh"
        if test_sh.exists():
            # Run test.sh which handles pytest + reward.txt
            rc, stdout, stderr = await self.docker.exec(
                container,
                "cd / && bash /tests/test.sh",
                env=env,
                timeout=120,
            )
            verifier_output = stdout + stderr

            # Read reward.txt
            rc2, reward_str, _ = await self.docker.exec(
                container,
                "cat /logs/verifier/reward.txt 2>/dev/null || cat /reward.txt 2>/dev/null || echo ''",
                timeout=10,
            )
            reward_str = reward_str.strip()
            try:
                reward = float(reward_str) if reward_str else None
            except ValueError:
                reward = None

            passed = reward is not None and reward > 0
            return reward, verifier_output, passed

        # Fallback: run pytest directly
        rc, stdout, stderr = await self.docker.exec(
            container,
            "pip install -q pytest 2>/dev/null; pytest /tests/test_outputs.py -v 2>&1",
            env=env,
            timeout=120,
        )
        verifier_output = stdout + stderr
        passed = rc == 0
        reward = 1.0 if passed else 0.0
        return reward, verifier_output, passed

    # ------------------------------------------------------------------
    # Trajectory parsing
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_agent_output(stdout: str) -> list[dict]:
        """Parse agent stdout into trajectory events.

        Claude Code with --output-format json outputs one JSON object.
        We also handle plain text output as a fallback.
        """
        trajectory: list[dict] = []

        # Try to parse as JSON (Claude Code --output-format json)
        try:
            data = json.loads(stdout)
            if isinstance(data, dict):
                # Claude Code JSON output
                if "result" in data:
                    trajectory.append({
                        "type": "agent_message",
                        "text": data.get("result", ""),
                    })
                if "messages" in data and isinstance(data["messages"], list):
                    for i, msg in enumerate(data["messages"]):
                        trajectory.append({
                            "type": msg.get("role", "unknown"),
                            "text": str(msg.get("content", ""))[:2000],
                            "step": i,
                        })
                return trajectory if trajectory else [{"type": "agent_message", "text": stdout[:5000]}]
            elif isinstance(data, list):
                return [{"type": "event", "data": item} for item in data[:100]]
        except (json.JSONDecodeError, TypeError):
            pass

        # Try line-by-line JSONL
        for i, line in enumerate(stdout.strip().split("\n")):
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
                event.setdefault("step", i)
                trajectory.append(event)
            except (json.JSONDecodeError, TypeError):
                # Plain text line
                if len(line) > 10:  # Skip very short lines
                    trajectory.append({
                        "type": "agent_message",
                        "text": line[:2000],
                        "step": i,
                    })

        return trajectory[:500]  # Cap at 500 events
