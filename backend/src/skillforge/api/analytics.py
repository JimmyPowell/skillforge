"""Analytics API endpoints — Phase 4."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from skillforge.database import get_db
from skillforge.models.run import Run, RunStatus, SkillUsageEvent, TokenUsage
from skillforge.models.skill import Skill, SkillVersion
from skillforge.models.task import Task

router = APIRouter()


@router.get("/dashboard")
async def dashboard(db: AsyncSession = Depends(get_db)):
    """Return overview stats for the analytics dashboard."""
    # Total skills (non-deleted)
    total_skills = (
        await db.execute(select(func.count()).where(Skill.is_deleted.is_(False)))
    ).scalar_one()

    # Total tasks (non-deleted)
    total_tasks = (
        await db.execute(select(func.count()).where(Task.is_deleted.is_(False)))
    ).scalar_one()

    # Run aggregates
    run_stats = (
        await db.execute(
            select(
                func.count().label("total"),
                func.count(case((Run.status == RunStatus.COMPLETED.value, 1))).label(
                    "completed"
                ),
                func.sum(
                    case((Run.passed.is_(True), 1), else_=0)
                ).label("passed_count"),
                func.avg(Run.reward).label("avg_reward"),
            )
        )
    ).one()

    total_runs = run_stats.total
    completed_runs = run_stats.completed
    passed_count = run_stats.passed_count or 0
    avg_reward = round(float(run_stats.avg_reward), 4) if run_stats.avg_reward else 0.0
    overall_pass_rate = (
        round(passed_count / completed_runs, 4) if completed_runs > 0 else 0.0
    )

    # Skill read rate (among runs that have skill_usage records)
    skill_read_stats = (
        await db.execute(
            select(
                func.count().label("total"),
                func.sum(
                    case((SkillUsageEvent.skill_read.is_(True), 1), else_=0)
                ).label("read_count"),
            ).select_from(SkillUsageEvent)
        )
    ).one()

    skill_read_rate = (
        round(skill_read_stats.read_count / skill_read_stats.total, 4)
        if skill_read_stats.total and skill_read_stats.total > 0
        else 0.0
    )

    # Recent runs (last 10)
    recent_result = await db.execute(
        select(Run)
        .options(selectinload(Run.task), selectinload(Run.skill_version))
        .order_by(Run.queued_at.desc())
        .limit(10)
    )
    recent_runs_models = recent_result.scalars().all()
    recent_runs = [
        {
            "id": r.id,
            "task_name": r.task.name if r.task else None,
            "agent": r.agent,
            "model": r.model,
            "status": r.status,
            "reward": r.reward,
            "passed": r.passed,
            "queued_at": r.queued_at,
            "completed_at": r.completed_at,
        }
        for r in recent_runs_models
    ]

    return {
        "total_skills": total_skills,
        "total_tasks": total_tasks,
        "total_runs": total_runs,
        "completed_runs": completed_runs,
        "overall_pass_rate": overall_pass_rate,
        "avg_reward": avg_reward,
        "skill_read_rate": skill_read_rate,
        "recent_runs": recent_runs,
    }


@router.get("/skill/{skill_id}/trends")
async def skill_trends(skill_id: str, db: AsyncSession = Depends(get_db)):
    """Return per-version pass rate trend for a specific skill."""
    # Verify skill exists
    skill_result = await db.execute(
        select(Skill).where(Skill.id == skill_id, Skill.is_deleted.is_(False))
    )
    skill = skill_result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")

    # Get version-level aggregates by joining Run → SkillVersion
    stmt = (
        select(
            SkillVersion.version_number,
            func.count().label("runs"),
            func.sum(case((Run.passed.is_(True), 1), else_=0)).label("passed"),
            func.avg(Run.reward).label("avg_reward"),
            func.avg(TokenUsage.input_tokens + TokenUsage.output_tokens).label(
                "avg_tokens"
            ),
        )
        .select_from(Run)
        .join(SkillVersion, Run.skill_version_id == SkillVersion.id)
        .outerjoin(TokenUsage, TokenUsage.run_id == Run.id)
        .where(SkillVersion.skill_id == skill_id)
        .group_by(SkillVersion.version_number)
        .order_by(SkillVersion.version_number)
    )

    result = await db.execute(stmt)
    rows = result.all()

    versions = []
    for row in rows:
        runs_count = row.runs
        passed_count = row.passed or 0
        pass_rate = round(passed_count / runs_count, 4) if runs_count > 0 else 0.0
        versions.append(
            {
                "version": row.version_number,
                "runs": runs_count,
                "passed": passed_count,
                "pass_rate": pass_rate,
                "avg_reward": round(float(row.avg_reward), 4) if row.avg_reward else 0.0,
                "avg_tokens": int(row.avg_tokens) if row.avg_tokens else 0,
            }
        )

    return {"skill_name": skill.name, "versions": versions}


@router.get("/comparison")
async def compare_runs(
    run_a: str = Query(..., description="ID of the first run"),
    run_b: str = Query(..., description="ID of the second run"),
    db: AsyncSession = Depends(get_db),
):
    """Return side-by-side comparison of two runs."""
    load_opts = [
        selectinload(Run.task),
        selectinload(Run.skill_version).selectinload(SkillVersion.skill),
        selectinload(Run.token_usage),
        selectinload(Run.skill_usage),
    ]

    result_a = await db.execute(
        select(Run).where(Run.id == run_a).options(*load_opts)
    )
    result_b = await db.execute(
        select(Run).where(Run.id == run_b).options(*load_opts)
    )

    r_a = result_a.scalar_one_or_none()
    r_b = result_b.scalar_one_or_none()

    if not r_a:
        raise HTTPException(status_code=404, detail=f"Run {run_a} not found")
    if not r_b:
        raise HTTPException(status_code=404, detail=f"Run {run_b} not found")

    def _run_summary(r: Run) -> dict:
        summary: dict = {
            "id": r.id,
            "task_name": r.task.name if r.task else None,
            "skill_name": (
                r.skill_version.skill.name
                if r.skill_version and r.skill_version.skill
                else None
            ),
            "reward": r.reward,
            "passed": r.passed,
            "timing": r.timing,
            "tool_calls": r.tool_calls_count,
            "token_usage": None,
            "skill_usage": None,
        }
        if r.token_usage:
            summary["token_usage"] = {
                "input_tokens": r.token_usage.input_tokens,
                "output_tokens": r.token_usage.output_tokens,
                "cache_read_tokens": r.token_usage.cache_read_tokens,
                "total_cost_usd": r.token_usage.total_cost_usd,
            }
        if r.skill_usage:
            summary["skill_usage"] = {
                "skill_read": r.skill_usage.skill_read,
                "read_at_step": r.skill_usage.read_at_step,
                "read_method": r.skill_usage.read_method,
                "sections_accessed": r.skill_usage.sections_accessed,
            }
        return summary

    summary_a = _run_summary(r_a)
    summary_b = _run_summary(r_b)

    # Compute deltas
    reward_a = r_a.reward or 0.0
    reward_b = r_b.reward or 0.0
    tool_calls_a = r_a.tool_calls_count or 0
    tool_calls_b = r_b.tool_calls_count or 0

    # Duration from timing dict (total_seconds key) or compute from queued/completed
    def _duration(r: Run) -> float:
        if r.timing and "total_seconds" in r.timing:
            return float(r.timing["total_seconds"])
        if r.completed_at and r.queued_at:
            return (r.completed_at - r.queued_at).total_seconds()
        return 0.0

    duration_a = _duration(r_a)
    duration_b = _duration(r_b)

    delta = {
        "reward": round(reward_a - reward_b, 4),
        "tool_calls": tool_calls_a - tool_calls_b,
        "duration": round(duration_a - duration_b, 2),
    }

    return {"run_a": summary_a, "run_b": summary_b, "delta": delta}


@router.get("/token-summary")
async def token_summary(
    group_by: str = Query("skill", description="Group by 'skill' or 'task'"),
    db: AsyncSession = Depends(get_db),
):
    """Return token consumption grouped by skill or task."""
    if group_by not in ("skill", "task"):
        raise HTTPException(
            status_code=400, detail="group_by must be 'skill' or 'task'"
        )

    if group_by == "skill":
        stmt = (
            select(
                Skill.name.label("name"),
                func.sum(TokenUsage.input_tokens).label("total_input"),
                func.sum(TokenUsage.output_tokens).label("total_output"),
                func.sum(TokenUsage.total_cost_usd).label("total_cost"),
                func.count(TokenUsage.id).label("run_count"),
            )
            .select_from(TokenUsage)
            .join(Run, TokenUsage.run_id == Run.id)
            .join(SkillVersion, Run.skill_version_id == SkillVersion.id)
            .join(Skill, SkillVersion.skill_id == Skill.id)
            .group_by(Skill.name)
            .order_by(func.sum(TokenUsage.total_cost_usd).desc())
        )
    else:
        stmt = (
            select(
                Task.name.label("name"),
                func.sum(TokenUsage.input_tokens).label("total_input"),
                func.sum(TokenUsage.output_tokens).label("total_output"),
                func.sum(TokenUsage.total_cost_usd).label("total_cost"),
                func.count(TokenUsage.id).label("run_count"),
            )
            .select_from(TokenUsage)
            .join(Run, TokenUsage.run_id == Run.id)
            .join(Task, Run.task_id == Task.id)
            .group_by(Task.name)
            .order_by(func.sum(TokenUsage.total_cost_usd).desc())
        )

    result = await db.execute(stmt)
    rows = result.all()

    groups = [
        {
            "name": row.name,
            "total_input": row.total_input or 0,
            "total_output": row.total_output or 0,
            "total_cost": round(float(row.total_cost), 4) if row.total_cost else 0.0,
            "run_count": row.run_count,
        }
        for row in rows
    ]

    return {"groups": groups}
