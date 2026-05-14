"""Base agent configuration dataclass."""

from dataclasses import dataclass, field


@dataclass
class AgentConfig:
    """Configuration for a supported AI agent."""

    name: str  # "claude-code", "codex", "gemini-cli"
    display_name: str  # "Claude Code", "OpenAI Codex", "Gemini CLI"
    skill_paths: list[str]  # Where skills get injected in container
    supported_models: list[str]  # Known model IDs
    required_env: list[str]  # Required env vars (any one suffices if multiple)
    benchflow_agent_id: str  # BenchFlow registry name (e.g. "claude-agent-acp")

    def to_dict(self) -> dict:
        """Serialize to API-friendly dict."""
        return {
            "name": self.name,
            "display_name": self.display_name,
            "skill_paths": self.skill_paths,
            "supported_models": self.supported_models,
            "required_env": self.required_env,
            "benchflow_agent_id": self.benchflow_agent_id,
        }
