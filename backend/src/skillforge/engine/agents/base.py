"""Agent adapter base classes."""

from __future__ import annotations

import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class AgentConfig:
    """Configuration for a supported AI agent."""

    name: str  # "claude-code", "codex", "gemini-cli"
    display_name: str  # "Claude Code", "OpenAI Codex", "Gemini CLI"
    supported_models: list[str] = field(default_factory=list)
    required_env: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "display_name": self.display_name,
            "supported_models": self.supported_models,
            "required_env": self.required_env,
        }


class AgentAdapter(ABC):
    """Abstract adapter — every Agent CLI implements these methods.

    To add a new Agent, subclass this and register via register_adapter().
    The execution engine only calls these methods — it knows nothing about
    specific Agent implementations.
    """

    @abstractmethod
    def config(self) -> AgentConfig:
        """Return the agent's static configuration."""
        ...

    @abstractmethod
    def install_commands(self) -> list[str]:
        """Shell commands to install the Agent inside a Docker container."""
        ...

    @abstractmethod
    def run_command(self, instruction_path: str, model: str | None = None) -> str:
        """Shell command to execute a task.
        instruction_path: path to instruction.md inside the container.
        The agent reads it, works autonomously, then exits."""
        ...

    @abstractmethod
    def skill_target_dirs(self) -> list[str]:
        """Absolute paths inside the container where skill directories go."""
        ...

    @abstractmethod
    def env_vars(self) -> dict[str, str]:
        """Environment variables to inject. Reads from host os.environ."""
        ...

    def _env_from_host(self, keys: list[str]) -> dict[str, str]:
        """Helper: collect env vars from host os.environ."""
        env = {}
        for key in keys:
            val = os.environ.get(key)
            if val:
                env[key] = val
        return env
