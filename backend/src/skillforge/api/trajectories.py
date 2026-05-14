"""Trajectory analysis API endpoints.

Provides access to parsed trajectory events and skill usage analysis
for completed runs.
"""

import json
import logging
from dataclasses import asdict
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from skillforge.database import get_db
from skillforge.engine.trajectory_parser import TrajectoryParser
from skillforge.models.run import (
    Run,
    SkillUsageEvent,
    TrajectoryEvent as TrajectoryEventModel,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _find_trajectory_file(run: Run) -> Path | None:
    """Locate the acp_trajectory.jsonl file for a run.

    Searches in order:
    1. run.timing.get("trial_dir") / trajectory / acp_trajectory.jsonl
    2. Standard BenchFlow jobs directory structure
    """
    # Check trial_dir from timing metadata
    trial_dir = (run.timing or {}).get("trial_dir")
    if trial_dir:
        traj_path = Path(trial_dir) / "trajectory" / "acp_trajectory.jsonl"
        if traj_path.exists():
            return traj_path

    # Check if task has a disk_path we can use to locate the jobs dir
    if hasattr(run, "task") and run.task and run.task.disk_path:
        jobs_base = Path(run.task.disk_path).parent.parent / "jobs"
        if jobs_base.exists():
            task_name = Path(run.task.disk_path).name
            # Search most recent job directories
            for job_dir in sorted(jobs_base.iterdir(), reverse=True):
                if not job_dir.is_dir():
                    continue
                for trial_dir_path in job_dir.iterdir():
                    if trial_dir_path.is_dir() and trial_dir_path.name.startswith(
                        task_name
                    ):
                        traj_path = (
                            trial_dir_path / "trajectory" / "acp_trajectory.jsonl"
                        )
                        if traj_path.exists():
                            return traj_path
                # Only check the most recent job
                break

    return None


def _load_raw_events(traj_path: Path) -> list[dict]:
    """Load raw events from a trajectory JSONL file."""
    events = []
    for line in traj_path.read_text(encoding="utf-8").strip().split("\n"):
        line = line.strip()
        if line:
            events.append(json.loads(line))
    return events


@router.get("/{run_id}/trajectory")
async def get_trajectory(run_id: str, db: AsyncSession = Depends(get_db)):
    """Get parsed trajectory events for a run.

    Returns the list of trajectory events, each with:
    - step, type, kind, title, content, is_skill_related, duration_ms, timestamp
    """
    # First try to get from DB (already parsed)
    result = await db.execute(
        select(TrajectoryEventModel)
        .where(TrajectoryEventModel.run_id == run_id)
        .order_by(TrajectoryEventModel.step_number)
    )
    db_events = result.scalars().all()

    if db_events:
        return [
            {
                "step": e.step_number,
                "type": e.role,
                "content": e.content,
                "tool_name": e.tool_name,
                "is_error": e.is_error,
                "duration_ms": e.duration_ms,
                "timestamp": e.timestamp,
            }
            for e in db_events
        ]

    # Fall back to parsing from file
    run_result = await db.execute(
        select(Run).where(Run.id == run_id).options(selectinload(Run.task))
    )
    run = run_result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    traj_path = _find_trajectory_file(run)
    if not traj_path:
        raise HTTPException(
            status_code=404,
            detail="Trajectory file not found for this run",
        )

    try:
        raw_events = _load_raw_events(traj_path)
    except (json.JSONDecodeError, OSError) as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse trajectory file: {e}",
        )

    parser = TrajectoryParser()
    events, _ = parser.parse(raw_events)

    return [asdict(event) for event in events]


@router.get("/{run_id}/skill-usage")
async def get_skill_usage(run_id: str, db: AsyncSession = Depends(get_db)):
    """Get skill usage analysis for a run.

    Returns:
    - skill_read: whether the agent read the skill
    - read_at_step: which step the first read occurred
    - read_method: how it was read ("Skill tool", "cat SKILL.md", "Read SKILL.md")
    - sections_accessed: list of skill section headers referenced
    - skill_mentions_in_reasoning: list of {step, quote} dicts
    """
    # First try from DB
    result = await db.execute(
        select(SkillUsageEvent).where(SkillUsageEvent.run_id == run_id)
    )
    db_usage = result.scalar_one_or_none()

    if db_usage:
        return {
            "skill_read": db_usage.skill_read,
            "read_at_step": db_usage.read_at_step,
            "read_method": db_usage.read_method,
            "sections_accessed": db_usage.sections_accessed,
            "skill_mentions_in_reasoning": db_usage.mentions,
        }

    # Fall back to parsing from file
    run_result = await db.execute(
        select(Run).where(Run.id == run_id).options(selectinload(Run.task))
    )
    run = run_result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    traj_path = _find_trajectory_file(run)
    if not traj_path:
        raise HTTPException(
            status_code=404,
            detail="Trajectory file not found for this run",
        )

    try:
        raw_events = _load_raw_events(traj_path)
    except (json.JSONDecodeError, OSError) as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse trajectory file: {e}",
        )

    # Load skill content if available for section matching
    skill_content = None
    if run.skill_version_id:
        from skillforge.models.skill import SkillVersion

        sv_result = await db.execute(
            select(SkillVersion).where(SkillVersion.id == run.skill_version_id)
        )
        sv = sv_result.scalar_one_or_none()
        if sv and hasattr(sv, "content"):
            skill_content = sv.content

    parser = TrajectoryParser(skill_content=skill_content)
    _, analysis = parser.parse(raw_events)

    return asdict(analysis)
