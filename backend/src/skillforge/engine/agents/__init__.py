"""Agent adapters — configuration and registry for supported AI agents."""

from skillforge.engine.agents.base import AgentConfig
from skillforge.engine.agents.registry import get_agent, get_supported_models, list_agents

__all__ = ["AgentConfig", "get_agent", "get_supported_models", "list_agents"]

