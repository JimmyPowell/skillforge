"""Runs API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from skillforge.database import get_db
from skillforge.models.run import Run, SkillUsageEvent, TokenUsage

router = APIRouter()


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
