"""Docker client — thin wrapper around `docker` CLI commands.

Supports `sg docker -c` wrapping for environments where the user
isn't in the docker group. All methods are async (subprocess-based).
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import shlex
from pathlib import Path

logger = logging.getLogger(__name__)


class DockerClient:
    """Async Docker CLI wrapper."""

    def __init__(self, use_sg: bool = False):
        self.use_sg = use_sg
        # Image cache: tag → dockerfile hash (skip rebuild if unchanged)
        self._image_cache: dict[str, str] = {}

    # ------------------------------------------------------------------
    # Core operations
    # ------------------------------------------------------------------

    async def build(self, context_dir: str, tag: str, dockerfile: str = "Dockerfile") -> str:
        """Build a Docker image. Returns stdout."""
        cmd = f"docker build -t {shlex.quote(tag)} -f {shlex.quote(dockerfile)} {shlex.quote(context_dir)}"
        return await self._run(cmd, timeout=600)

    async def run(
        self,
        image: str,
        name: str,
        env: dict[str, str] | None = None,
        cpus: int = 4,
        memory_mb: int = 4096,
    ) -> str:
        """Start a detached container. Returns container ID."""
        parts = [
            "docker run -d",
            f"--name {shlex.quote(name)}",
            f"--cpus={cpus}",
            f"--memory={memory_mb}m",
            "--network=none",  # No network access for isolation
        ]
        for key, val in (env or {}).items():
            parts.append(f"-e {shlex.quote(f'{key}={val}')}")
        parts.append(shlex.quote(image))
        parts.append("sh -c 'sleep infinity'")

        cmd = " ".join(parts)
        output = await self._run(cmd, timeout=30)
        container_id = output.strip()[:12]
        logger.info("Container started: %s (image=%s)", container_id, image)
        return name  # Return name, more reliable for subsequent commands

    async def exec(
        self,
        container: str,
        command: str,
        env: dict[str, str] | None = None,
        user: str | None = None,
        timeout: int = 600,
        workdir: str | None = None,
    ) -> tuple[int, str, str]:
        """Execute a command inside a running container.
        Returns (return_code, stdout, stderr).
        """
        parts = ["docker exec"]
        if user:
            parts.append(f"-u {shlex.quote(user)}")
        if workdir:
            parts.append(f"-w {shlex.quote(workdir)}")
        for key, val in (env or {}).items():
            parts.append(f"-e {shlex.quote(f'{key}={val}')}")
        parts.append(shlex.quote(container))
        parts.append(f"bash -c {shlex.quote(command)}")

        cmd = " ".join(parts)
        return await self._run_full(cmd, timeout=timeout)

    async def cp_to(self, container: str, src: str, dst: str) -> None:
        """Copy a file/directory from host to container."""
        cmd = f"docker cp {shlex.quote(src)} {shlex.quote(container)}:{shlex.quote(dst)}"
        await self._run(cmd, timeout=60)

    async def cp_from(self, container: str, src: str, dst: str) -> None:
        """Copy a file/directory from container to host."""
        cmd = f"docker cp {shlex.quote(container)}:{shlex.quote(src)} {shlex.quote(dst)}"
        await self._run(cmd, timeout=60)

    async def rm(self, container: str) -> None:
        """Force-remove a container."""
        cmd = f"docker rm -f {shlex.quote(container)}"
        try:
            await self._run(cmd, timeout=15)
            logger.info("Container removed: %s", container)
        except Exception as e:
            logger.warning("Failed to remove container %s: %s", container, e)

    async def logs(self, container: str, tail: int = 200) -> str:
        """Get container logs."""
        cmd = f"docker logs --tail {tail} {shlex.quote(container)}"
        try:
            return await self._run(cmd, timeout=10)
        except Exception:
            return ""

    # ------------------------------------------------------------------
    # Image caching
    # ------------------------------------------------------------------

    def should_rebuild(self, dockerfile_path: str, tag: str) -> bool:
        """Check if we need to rebuild (Dockerfile content changed)."""
        path = Path(dockerfile_path)
        if not path.exists():
            return True
        current_hash = hashlib.sha256(path.read_bytes()).hexdigest()
        cached_hash = self._image_cache.get(tag)
        return cached_hash != current_hash

    def update_cache(self, dockerfile_path: str, tag: str) -> None:
        """Record that an image was built from this Dockerfile."""
        path = Path(dockerfile_path)
        if path.exists():
            self._image_cache[tag] = hashlib.sha256(path.read_bytes()).hexdigest()

    async def image_exists(self, tag: str) -> bool:
        """Check if an image with this tag exists locally."""
        cmd = f"docker image inspect {shlex.quote(tag)}"
        try:
            await self._run(cmd, timeout=10)
            return True
        except Exception:
            return False

    # ------------------------------------------------------------------
    # Health check
    # ------------------------------------------------------------------

    async def health_check(self) -> dict:
        """Check Docker daemon accessibility."""
        try:
            output = await self._run("docker info --format '{{.ServerVersion}}'", timeout=10)
            return {"status": "ok", "version": output.strip().strip("'")}
        except Exception as e:
            return {"status": "error", "detail": str(e)[:200]}

    # ------------------------------------------------------------------
    # Internal: command execution
    # ------------------------------------------------------------------

    async def _run(self, cmd: str, timeout: int = 120) -> str:
        """Run a docker command, return stdout. Raises on non-zero exit."""
        rc, stdout, stderr = await self._run_full(cmd, timeout)
        if rc != 0:
            raise RuntimeError(f"Docker command failed (rc={rc}): {stderr[:500]}")
        return stdout

    async def _run_full(self, cmd: str, timeout: int = 120) -> tuple[int, str, str]:
        """Run a docker command, return (rc, stdout, stderr)."""
        if self.use_sg:
            full_cmd = f"sg docker -c {shlex.quote(cmd)}"
        else:
            full_cmd = cmd

        logger.debug("Docker: %s", full_cmd[:200])

        proc = await asyncio.create_subprocess_shell(
            full_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(), timeout=timeout
            )
        except asyncio.TimeoutError:
            proc.kill()
            raise RuntimeError(f"Docker command timed out after {timeout}s: {cmd[:100]}")

        stdout = stdout_bytes.decode("utf-8", errors="replace") if stdout_bytes else ""
        stderr = stderr_bytes.decode("utf-8", errors="replace") if stderr_bytes else ""
        return proc.returncode or 0, stdout, stderr
