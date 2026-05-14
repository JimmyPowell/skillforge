"""Execution engine interfaces — abstract base classes.

All concrete runners (BenchFlow, custom Docker, etc.) implement these interfaces.
Upper layers (API, services) only depend on these abstractions, never on concrete implementations.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Callable


class RunPhase(str, Enum):
    PENDING = "pending"
    BUILDING = "building"
    RUNNING = "running"
    VERIFYING = "verifying"
    ANALYZING = "analyzing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class RunConfig:
    """Input configuration for a single evaluation run."""

    task_path: str  # Absolute path to task directory
    agent: str  # Agent identifier (e.g., "claude-agent-acp")
    model: str  # Model identifier (e.g., "claude-sonnet-4-6")
    skills_dir: str | None = None  # Path to skills directory, None = baseline
    timeout_sec: int = 600
    env_vars: dict[str, str] = field(default_factory=dict)  # Extra env vars for agent
    sandbox_user: str | None = "agent"


@dataclass
class RunResult:
    """Output of a completed evaluation run."""

    reward: float | None = None
    passed: bool | None = None
    error: str | None = None
    verifier_output: str | None = None
    tool_calls_count: int = 0
    timing: dict[str, float] = field(default_factory=dict)
    trajectory: list[dict] = field(default_factory=list)
    trial_dir: str | None = None  # Path to artifacts on disk


@dataclass
class StatusUpdate:
    """Real-time status update emitted during a run."""

    phase: RunPhase
    message: str = ""
    timestamp: datetime = field(default_factory=datetime.now)


# Type alias for status callback
StatusCallback = Callable[[StatusUpdate], None] | None


class ExecutionBackend(ABC):
    """Abstract execution backend — the contract between SkillForge and any runner.

    To swap BenchFlow for a custom implementation, just implement this interface.
    """

    @abstractmethod
    async def execute(
        self,
        config: RunConfig,
        on_status: StatusCallback = None,
    ) -> RunResult:
        """Execute a single evaluation run.

        Args:
            config: Run configuration (task, agent, model, skills, etc.)
            on_status: Optional callback for real-time status updates.

        Returns:
            RunResult with reward, timing, trajectory, etc.
        """
        ...

    @abstractmethod
    async def cancel(self, run_id: str) -> bool:
        """Cancel a running evaluation. Returns True if successfully cancelled."""
        ...

    @abstractmethod
    async def health_check(self) -> dict:
        """Check if the backend is healthy and ready to accept runs."""
        ...
