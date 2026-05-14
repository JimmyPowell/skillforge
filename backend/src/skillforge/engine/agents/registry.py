"""Agent registry — built-in adapters and lookup functions.

Adding a new Agent:
  1. Create a class implementing AgentAdapter (in this file or a separate module)
  2. Call register_adapter("my-agent", MyAgentAdapter()) below
"""

from __future__ import annotations

import shlex

from skillforge.engine.agents.base import AgentAdapter, AgentConfig


# ---------------------------------------------------------------------------
# Built-in adapters
# ---------------------------------------------------------------------------


class ClaudeCodeAdapter(AgentAdapter):
    """Claude Code — Anthropic's coding agent CLI."""

    def config(self) -> AgentConfig:
        return AgentConfig(
            name="claude-code",
            display_name="Claude Code",
            supported_models=["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5"],
            required_env=["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"],
        )

    def install_commands(self) -> list[str]:
        return [
            # Install Node.js 22 if not present
            "export DEBIAN_FRONTEND=noninteractive && "
            "( command -v node >/dev/null 2>&1 || ("
            "  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - 2>/dev/null && "
            "  apt-get install -y -qq nodejs 2>/dev/null || "
            "  dnf install -y nodejs 2>/dev/null || true"
            ") )",
            # Install Claude Code
            "npm install -g @anthropic-ai/claude-code@latest 2>&1 | tail -3",
        ]

    def run_command(self, instruction_path: str, model: str | None = None) -> str:
        cmd = (
            f"cat {shlex.quote(instruction_path)} | "
            f"claude -p "
            f"--dangerously-skip-permissions "
            f"--output-format json "
            f"--verbose"
        )
        if model:
            cmd += f" --model {shlex.quote(model)}"
        return cmd

    def skill_target_dirs(self) -> list[str]:
        return ["/root/.claude/skills", "/home/agent/.claude/skills"]

    def env_vars(self) -> dict[str, str]:
        env = self._env_from_host([
            "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN",
            "ANTHROPIC_BASE_URL", "ANTHROPIC_CUSTOM_HEADERS",
        ])
        env.setdefault("CLAUDE_CODE_MAX_OUTPUT_TOKENS", "128000")
        env.setdefault("CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "1")
        return env


class CodexAdapter(AgentAdapter):
    """OpenAI Codex CLI."""

    def config(self) -> AgentConfig:
        return AgentConfig(
            name="codex",
            display_name="OpenAI Codex",
            supported_models=["gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano"],
            required_env=["OPENAI_API_KEY"],
        )

    def install_commands(self) -> list[str]:
        return [
            "export DEBIAN_FRONTEND=noninteractive && "
            "( command -v node >/dev/null 2>&1 || ("
            "  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - 2>/dev/null && "
            "  apt-get install -y -qq nodejs 2>/dev/null || true"
            ") )",
            "npm install -g @openai/codex@latest 2>&1 | tail -3",
        ]

    def run_command(self, instruction_path: str, model: str | None = None) -> str:
        cmd = f"cat {shlex.quote(instruction_path)} | codex -q --approval-mode full-auto"
        if model:
            cmd += f" --model {shlex.quote(model)}"
        return cmd

    def skill_target_dirs(self) -> list[str]:
        return ["/root/.agents/skills", "/home/agent/.agents/skills"]

    def env_vars(self) -> dict[str, str]:
        return self._env_from_host(["OPENAI_API_KEY", "OPENAI_BASE_URL"])


class GeminiCLIAdapter(AgentAdapter):
    """Gemini CLI — Google's coding agent."""

    def config(self) -> AgentConfig:
        return AgentConfig(
            name="gemini-cli",
            display_name="Gemini CLI",
            supported_models=["gemini-2.5-pro", "gemini-2.5-flash"],
            required_env=["GOOGLE_API_KEY", "GEMINI_API_KEY"],
        )

    def install_commands(self) -> list[str]:
        return [
            "export DEBIAN_FRONTEND=noninteractive && "
            "( command -v node >/dev/null 2>&1 || ("
            "  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - 2>/dev/null && "
            "  apt-get install -y -qq nodejs 2>/dev/null || true"
            ") )",
            "npm install -g @google/gemini-cli@latest 2>&1 | tail -3",
        ]

    def run_command(self, instruction_path: str, model: str | None = None) -> str:
        cmd = f"cat {shlex.quote(instruction_path)} | gemini -p --yolo"
        if model:
            cmd += f" --model {shlex.quote(model)}"
        return cmd

    def skill_target_dirs(self) -> list[str]:
        return ["/root/.gemini/skills", "/home/agent/.gemini/skills"]

    def env_vars(self) -> dict[str, str]:
        env = self._env_from_host(["GOOGLE_API_KEY", "GEMINI_API_KEY"])
        if "GEMINI_API_KEY" in env and "GOOGLE_API_KEY" not in env:
            env["GOOGLE_API_KEY"] = env["GEMINI_API_KEY"]
        return env


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

_ADAPTERS: dict[str, AgentAdapter] = {
    "claude-code": ClaudeCodeAdapter(),
    "codex": CodexAdapter(),
    "gemini-cli": GeminiCLIAdapter(),
}


def get_adapter(name: str) -> AgentAdapter | None:
    """Get an agent adapter by name."""
    return _ADAPTERS.get(name)


def get_agent(name: str) -> AgentConfig | None:
    """Get agent configuration by name."""
    adapter = _ADAPTERS.get(name)
    return adapter.config() if adapter else None


def list_agents() -> list[AgentConfig]:
    """Return all registered agent configurations."""
    return [a.config() for a in _ADAPTERS.values()]


def get_supported_models(agent_name: str) -> list[str]:
    """Return supported model IDs for an agent."""
    adapter = _ADAPTERS.get(agent_name)
    return adapter.config().supported_models if adapter else []


def register_adapter(name: str, adapter: AgentAdapter) -> None:
    """Register a custom agent adapter at runtime."""
    _ADAPTERS[name] = adapter
