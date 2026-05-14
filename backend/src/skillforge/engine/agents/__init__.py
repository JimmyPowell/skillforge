"""Agent adapters — configuration and registry for supported AI agents."""

from skillforge.engine.agents.base import AgentAdapter, AgentConfig
from skillforge.engine.agents.registry import (
    get_adapter,
    get_agent,
    get_supported_models,
    list_agents,
    register_adapter,
)

__all__ = [
    "AgentAdapter",
    "AgentConfig",
    "get_adapter",
    "get_agent",
    "get_supported_models",
    "list_agents",
    "register_adapter",
]
