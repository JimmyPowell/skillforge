"""Runs API endpoints."""

import itertools
import time
import uuid
from collections import deque

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from skillforge.config import settings
from skillforge.database import get_db
from skillforge.engine.agents import get_agent, get_supported_models, list_agents
from skillforge.models.run import Run, SkillUsageEvent, TokenUsage

router = APIRouter()


# ---------------------------------------------------------------------------
# In-memory rate limiter for run creation
# ---------------------------------------------------------------------------


class _RateLimiter:
    """Simple sliding-window rate limiter (in-memory, per-process)."""

    def __init__(self, max_requests: int, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._timestamps: deque[float] = deque()

    def is_allowed(self) -> bool:
        """Check if a new request is allowed. If yes, record it."""
        now = time.time()
        cutoff = now - self.window_seconds
        # Remove expired timestamps
        while self._timestamps and self._timestamps[0] < cutoff:
            self._timestamps.popleft()
        if len(self._timestamps) >= self.max_requests:
            return False
        self._timestamps.append(now)
        return True


_run_creation_limiter = _RateLimiter(
    max_requests=settings.rate_limit_runs_per_minute,
    window_seconds=60,
)


# ---------------------------------------------------------------------------
# Agent endpoints (must be defined BEFORE /{run_id} to avoid path conflicts)
# ---------------------------------------------------------------------------


@router.get("/agents")
async def list_agents_endpoint():
    """List all supported agents and their configurations."""
    return [agent.to_dict() for agent in list_agents()]


@router.get("/agents/{name}/models")
async def get_agent_models(name: str):
    """Get supported models for a specific agent."""
    agent = get_agent(name)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent '{name}' not found")
    return get_supported_models(name)


# ---------------------------------------------------------------------------
# Batch run endpoints (must be defined BEFORE /{run_id} to avoid path conflicts)
# ---------------------------------------------------------------------------


@router.post("/batch", status_code=202)
async def create_batch_run(data: dict, request: Request, db: AsyncSession = Depends(get_db)):
    """Create a batch of evaluation runs from a matrix of parameters.

    Body:
        task_ids: list of task IDs
        skill_version_ids: list of skill version IDs (null = baseline)
        agents: list of agent names
        models: list of model identifiers
        config: optional shared config (timeout_sec, env_vars, etc.)

    Creates one Run per combination in the cartesian product:
        task_ids x skill_version_ids x agents x models
    """
    if not _run_creation_limiter.is_allowed():
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded: max {settings.rate_limit_runs_per_minute} run creations per minute",
        )
    task_ids = data.get("task_ids", [])
    skill_version_ids = data.get("skill_version_ids", [])
    agents = data.get("agents", ["claude-code"])
    models = data.get("models", ["claude-sonnet-4-6"])
    config = data.get("config", {})

    if not task_ids:
        raise HTTPException(status_code=400, detail="task_ids is required and must be non-empty")
    if not skill_version_ids:
        # Default to a single baseline run (no skill)
        skill_version_ids = [None]

    batch_id = str(uuid.uuid4())
    run_ids: list[str] = []
    orchestrator = request.app.state.orchestrator

    # Create runs for every combination in the matrix
    for task_id, sv_id, agent_name, model in itertools.product(
        task_ids, skill_version_ids, agents, models
    ):
        # Resolve agent to benchflow_agent_id
        agent_cfg = get_agent(agent_name)
        agent_value = agent_cfg.benchflow_agent_id if agent_cfg else agent_name

        run = Run(
            task_id=task_id,
            skill_version_id=sv_id,
            agent=agent_value,
            model=model,
            config=config,
            batch_id=batch_id,
            labels=data.get("labels", []),
        )
        db.add(run)
        await db.flush()
        run_ids.append(run.id)

    await db.commit()

    # Dispatch all runs
    for rid in run_ids:
        await orchestrator.dispatch(rid)

    return {
        "batch_id": batch_id,
        "total_runs": len(run_ids),
        "run_ids": run_ids,
    }


@router.get("/batch/{batch_id}")
async def get_batch_status(batch_id: str, db: AsyncSession = Depends(get_db)):
    """Get the status summary for a batch of runs."""
    result = await db.execute(
        select(Run).where(Run.batch_id == batch_id).order_by(Run.queued_at)
    )
    runs = result.scalars().all()

    if not runs:
        raise HTTPException(status_code=404, detail="Batch not found")

    completed = sum(1 for r in runs if r.status == "completed")
    failed = sum(1 for r in runs if r.status == "failed")
    pending = sum(1 for r in runs if r.status in ("pending", "building", "running", "verifying", "analyzing"))
    passed = sum(1 for r in runs if r.passed is True)

    return {
        "batch_id": batch_id,
        "total": len(runs),
        "completed": completed,
        "passed": passed,
        "failed": failed,
        "pending": pending,
        "runs": [
            {
                "id": r.id,
                "task_id": r.task_id,
                "skill_version_id": r.skill_version_id,
                "agent": r.agent,
                "model": r.model,
                "status": r.status,
                "reward": r.reward,
                "passed": r.passed,
            }
            for r in runs
        ],
    }


# ---------------------------------------------------------------------------
# Run CRUD endpoints
# ---------------------------------------------------------------------------


@router.get("")
async def list_runs(
    task_id: str | None = None,
    skill_id: str | None = None,
    status: str | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """List runs with optional filters."""
    query = select(Run).order_by(Run.queued_at.desc()).limit(limit)
    if task_id:
        query = query.where(Run.task_id == task_id)
    if status:
        query = query.where(Run.status == status)

    result = await db.execute(query)
    runs = result.scalars().all()
    return [
        {
            "id": r.id,
            "task_id": r.task_id,
            "skill_version_id": r.skill_version_id,
            "agent": r.agent,
            "model": r.model,
            "status": r.status,
            "reward": r.reward,
            "passed": r.passed,
            "queued_at": r.queued_at,
            "completed_at": r.completed_at,
            "labels": r.labels,
        }
        for r in runs
    ]


@router.post("", status_code=202)
async def create_run(data: dict, request: Request, db: AsyncSession = Depends(get_db)):
    """Trigger a new evaluation run."""
    if not _run_creation_limiter.is_allowed():
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded: max {settings.rate_limit_runs_per_minute} run creations per minute",
        )

    run = Run(
        task_id=data["task_id"],
        skill_version_id=data.get("skill_version_id"),
        agent=data.get("agent", "claude-code"),
        model=data.get("model", "claude-sonnet-4-6"),
        config=data.get("config", {}),
        labels=data.get("labels", []),
    )
    db.add(run)
    await db.flush()
    await db.commit()

    # Dispatch to execution engine
    orchestrator = request.app.state.orchestrator
    await orchestrator.dispatch(run.id)

    return {"id": run.id, "status": run.status}


@router.get("/{run_id}")
async def get_run(run_id: str, db: AsyncSession = Depends(get_db)):
    """Get run details with results."""
    result = await db.execute(
        select(Run)
        .where(Run.id == run_id)
        .options(
            selectinload(Run.token_usage),
            selectinload(Run.skill_usage),
        )
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    response = {
        "id": run.id,
        "task_id": run.task_id,
        "skill_version_id": run.skill_version_id,
        "agent": run.agent,
        "model": run.model,
        "status": run.status,
        "config": run.config,
        "labels": run.labels,
        "queued_at": run.queued_at,
        "started_at": run.started_at,
        "completed_at": run.completed_at,
        "reward": run.reward,
        "passed": run.passed,
        "error": run.error,
        "verifier_output": run.verifier_output,
        "tool_calls_count": run.tool_calls_count,
        "timing": run.timing,
    }

    if run.token_usage:
        response["token_usage"] = {
            "input_tokens": run.token_usage.input_tokens,
            "output_tokens": run.token_usage.output_tokens,
            "cache_read_tokens": run.token_usage.cache_read_tokens,
            "total_cost_usd": run.token_usage.total_cost_usd,
        }

    if run.skill_usage:
        response["skill_usage"] = {
            "skill_read": run.skill_usage.skill_read,
            "read_at_step": run.skill_usage.read_at_step,
            "read_method": run.skill_usage.read_method,
            "sections_accessed": run.skill_usage.sections_accessed,
        }

    return response
