"""Agents API endpoints."""

from fastapi import APIRouter, HTTPException

from skillforge.engine.agents import get_agent, get_supported_models, list_agents

router = APIRouter()


@router.get("")
async def list_agents_endpoint():
    """List all supported agents and their configurations."""
    return [agent.to_dict() for agent in list_agents()]


@router.get("/{name}/models")
async def get_agent_models(name: str):
    """Get supported models for a specific agent."""
    agent = get_agent(name)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent '{name}' not found")
    return get_supported_models(name)
