"""Agent registry — built-in agent configurations.

Provides lookup functions for the three built-in agents:
  - claude-code (Claude Code via BenchFlow ACP)
  - codex (OpenAI Codex)
  - gemini-cli (Google Gemini CLI)
"""

from skillforge.engine.agents.base import AgentConfig

# ---------------------------------------------------------------------------
# Built-in agent definitions
# ---------------------------------------------------------------------------

_AGENTS: dict[str, AgentConfig] = {
    "claude-code": AgentConfig(
        name="claude-code",
        display_name="Claude Code",
        skill_paths=["~/.claude/skills"],
        supported_models=["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5"],
        required_env=["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"],
        benchflow_agent_id="claude-agent-acp",
    ),
    "codex": AgentConfig(
        name="codex",
        display_name="OpenAI Codex",
        skill_paths=["~/.agents/skills"],
        supported_models=["gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano"],
        required_env=["OPENAI_API_KEY"],
        benchflow_agent_id="codex-acp",
    ),
    "gemini-cli": AgentConfig(
        name="gemini-cli",
        display_name="Gemini CLI",
        skill_paths=["~/.gemini/skills"],
        supported_models=["gemini-2.5-pro", "gemini-2.5-flash"],
        required_env=["GOOGLE_API_KEY", "GEMINI_API_KEY"],
        benchflow_agent_id="gemini",
    ),
}


def get_agent(name: str) -> AgentConfig | None:
    """Get agent configuration by name. Returns None if not found."""
    return _AGENTS.get(name)


def list_agents() -> list[AgentConfig]:
    """Return all registered agent configurations."""
    return list(_AGENTS.values())


def get_supported_models(agent_name: str) -> list[str]:
    """Return supported model IDs for an agent. Empty list if agent not found."""
    agent = _AGENTS.get(agent_name)
    if agent is None:
        return []
    return agent.supported_models
