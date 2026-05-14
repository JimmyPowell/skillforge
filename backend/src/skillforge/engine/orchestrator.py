"""Run orchestrator — bridges API requests to the execution backend.

Manages the full lifecycle: create DB record → dispatch to backend → collect
results → update DB → analyze trajectory → notify watchers. The orchestrator
depends only on the ExecutionBackend interface, never on a specific implementation.
"""

import asyncio
import logging
from datetime import datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from skillforge.engine import (
    ExecutionBackend,
    RunConfig,
    RunPhase,
    RunResult,
    StatusUpdate,
)
from skillforge.engine.trajectory_parser import TrajectoryParser
from skillforge.engine.token_extractor import TokenExtractor
from skillforge.models.run import Run, SkillUsageEvent, TokenUsage, TrajectoryEvent
from skillforge.models.run import RunStatus as DBRunStatus
from skillforge.models.skill import SkillVersion
from skillforge.models.task import Task

logger = logging.getLogger(__name__)

# Map engine phases to DB status values
_PHASE_TO_DB_STATUS = {
    RunPhase.PENDING: DBRunStatus.PENDING,
    RunPhase.BUILDING: DBRunStatus.BUILDING,
    RunPhase.RUNNING: DBRunStatus.RUNNING,
    RunPhase.VERIFYING: DBRunStatus.VERIFYING,
    RunPhase.ANALYZING: DBRunStatus.ANALYZING,
    RunPhase.COMPLETED: DBRunStatus.COMPLETED,
    RunPhase.FAILED: DBRunStatus.FAILED,
    RunPhase.CANCELLED: DBRunStatus.CANCELLED,
}


class Orchestrator:
    """Coordinates evaluation runs between the database and execution backend."""

    def __init__(
        self,
        backend: ExecutionBackend,
        session_factory,
        max_concurrent: int = 2,
    ):
        self.backend = backend
        self.session_factory = session_factory
        self.max_concurrent = max_concurrent
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._status_watchers: dict[str, list[asyncio.Queue]] = {}

    def subscribe(self, run_id: str) -> asyncio.Queue:
        """Subscribe to real-time status updates for a run."""
        queue: asyncio.Queue = asyncio.Queue()
        self._status_watchers.setdefault(run_id, []).append(queue)
        return queue

    def unsubscribe(self, run_id: str, queue: asyncio.Queue) -> None:
        watchers = self._status_watchers.get(run_id, [])
        if queue in watchers:
            watchers.remove(queue)

    def _notify(self, run_id: str, update: StatusUpdate) -> None:
        """Notify all watchers of a status change."""
        for queue in self._status_watchers.get(run_id, []):
            try:
                queue.put_nowait(update)
            except asyncio.QueueFull:
                pass

    async def dispatch(self, run_id: str) -> None:
        """Dispatch a run for execution. Call this after creating the Run in DB."""
        asyncio.create_task(self._execute_run(run_id))

    async def _execute_run(self, run_id: str) -> None:
        """Execute a single run with concurrency control."""
        async with self._semaphore:
            async with self.session_factory() as db:
                try:
                    await self._do_execute(run_id, db)
                except Exception as e:
                    logger.exception("Unhandled error in run %s", run_id)
                    await self._update_run_status(
                        db, run_id,
                        status=DBRunStatus.FAILED,
                        error=f"Orchestrator error: {e}",
                    )

    async def _do_execute(self, run_id: str, db: AsyncSession) -> None:
        """Core execution logic."""
        # Load run from DB
        result = await db.execute(select(Run).where(Run.id == run_id))
        run = result.scalar_one_or_none()
        if not run:
            logger.error("Run %s not found", run_id)
            return

        # Load task
        task_result = await db.execute(select(Task).where(Task.id == run.task_id))
        task = task_result.scalar_one_or_none()
        if not task or not task.disk_path:
            await self._update_run_status(db, run_id, DBRunStatus.FAILED, error="Task not found or has no disk_path")
            self._notify(run_id, StatusUpdate(phase=RunPhase.FAILED, message="Task not found or has no disk_path"))
            return

        # Load skill version (optional)
        skills_dir = None
        if run.skill_version_id:
            sv_result = await db.execute(select(SkillVersion).where(SkillVersion.id == run.skill_version_id))
            sv = sv_result.scalar_one_or_none()
            if sv:
                # Write skill content to a temp directory for injection
                skill_result = await db.execute(select(SkillVersion).where(SkillVersion.id == run.skill_version_id))
                skill_version = skill_result.scalar_one_or_none()
                if skill_version:
                    skills_dir = await self._prepare_skills_dir(task, skill_version)

        # --- Phase: BUILDING ---
        await self._update_run_status(db, run_id, DBRunStatus.BUILDING)
        run.started_at = datetime.now()
        await db.commit()
        self._notify(run_id, StatusUpdate(phase=RunPhase.BUILDING, message="Preparing evaluation environment..."))

        # Build execution config
        config = RunConfig(
            task_path=task.disk_path,
            agent=run.agent,
            model=run.model,
            skills_dir=skills_dir,
            timeout_sec=run.config.get("timeout_sec", 600),
            env_vars=run.config.get("env_vars", {}),
        )

        # Status callback — emits granular phase transitions to watchers
        def on_status(update: StatusUpdate):
            db_status = _PHASE_TO_DB_STATUS.get(update.phase)
            if db_status:
                self._notify(run_id, update)

        # --- Phase: RUNNING ---
        self._notify(run_id, StatusUpdate(phase=RunPhase.RUNNING, message="Agent executing task..."))

        # Execute!
        exec_result = await self.backend.execute(config, on_status=on_status)

        # --- Phase: VERIFYING ---
        self._notify(run_id, StatusUpdate(phase=RunPhase.VERIFYING, message="Checking results..."))

        # Update run with results
        run.reward = exec_result.reward
        run.passed = exec_result.passed
        run.error = exec_result.error
        run.verifier_output = exec_result.verifier_output
        run.tool_calls_count = exec_result.tool_calls_count
        run.timing = exec_result.timing
        run.completed_at = datetime.now()

        # Store trial_dir in timing for trajectory lookup
        if exec_result.trial_dir:
            run.timing = {**run.timing, "trial_dir": exec_result.trial_dir}

        if exec_result.error and exec_result.reward is None:
            run.status = DBRunStatus.FAILED.value
        else:
            run.status = DBRunStatus.COMPLETED.value

        await db.commit()

        # --- Phase: ANALYZING ---
        self._notify(run_id, StatusUpdate(phase=RunPhase.ANALYZING, message="Analyzing trajectory..."))

        # Analyze trajectory (non-blocking — errors here don't fail the run)
        await self._analyze_trajectory(db, run, exec_result)

        # --- Final notification ---
        final_phase = RunPhase.FAILED if run.status == DBRunStatus.FAILED.value else RunPhase.COMPLETED
        self._notify(run_id, StatusUpdate(
            phase=final_phase,
            message=f"reward={run.reward}" if run.reward is not None else (run.error or ""),
        ))

        logger.info(
            "Run %s completed: status=%s reward=%s",
            run_id, run.status, run.reward,
        )

    async def _update_run_status(
        self,
        db: AsyncSession,
        run_id: str,
        status: DBRunStatus,
        error: str | None = None,
    ) -> None:
        """Update run status in database."""
        result = await db.execute(select(Run).where(Run.id == run_id))
        run = result.scalar_one_or_none()
        if run:
            run.status = status.value
            if error:
                run.error = error
            await db.commit()

    async def _prepare_skills_dir(self, task: Task, skill_version: SkillVersion) -> str | None:
        """Write skill content to task's skills directory for injection."""
        if not task.disk_path:
            return None

        task_path = Path(task.disk_path)
        skills_base = task_path / "environment" / "skills"

        # If the task already has a skills directory on disk, use it
        if skills_base.is_dir():
            return str(skills_base)

        # Otherwise create a temp skills dir with our skill version
        # TODO: for custom skills not on disk, write to a temp dir
        return None

    async def _analyze_trajectory(
        self, db: AsyncSession, run: Run, exec_result: RunResult
    ) -> None:
        """Parse trajectory, extract skill usage and token data, store in DB.

        This runs after the run is marked complete. Errors here are logged
        but do not affect the run's final status.
        """
        try:
            raw_events = exec_result.trajectory
            if not raw_events:
                logger.debug("Run %s has no trajectory data to analyze", run.id)
                return

            # Load skill content for section matching (if skill was injected)
            skill_content = None
            if run.skill_version_id:
                sv_result = await db.execute(
                    select(SkillVersion).where(SkillVersion.id == run.skill_version_id)
                )
                sv = sv_result.scalar_one_or_none()
                if sv and hasattr(sv, "content"):
                    skill_content = sv.content

            # Parse trajectory events
            parser = TrajectoryParser(skill_content=skill_content)
            events, skill_analysis = parser.parse(raw_events)

            # Store TrajectoryEvent records
            for ev in events:
                db_event = TrajectoryEvent(
                    run_id=run.id,
                    step_number=ev.step,
                    role=ev.type,
                    content=ev.content,
                    tool_name=ev.title if ev.title else None,
                    tool_input={"kind": ev.kind} if ev.kind else None,
                    is_error=False,
                    duration_ms=ev.duration_ms,
                )
                db.add(db_event)

            # Store SkillUsageEvent record
            skill_event = SkillUsageEvent(
                run_id=run.id,
                skill_read=skill_analysis.skill_read,
                read_at_step=skill_analysis.read_at_step,
                read_method=skill_analysis.read_method,
                sections_accessed=skill_analysis.sections_accessed,
                mentions=[
                    m for m in skill_analysis.skill_mentions_in_reasoning
                ],
            )
            db.add(skill_event)

            # Estimate and store TokenUsage
            extractor = TokenExtractor()
            model = run.model or "claude-sonnet-4-6"
            token_snapshot = extractor.estimate_from_trajectory(raw_events, model)

            token_usage = TokenUsage(
                run_id=run.id,
                input_tokens=token_snapshot.input_tokens,
                output_tokens=token_snapshot.output_tokens,
                cache_read_tokens=token_snapshot.cache_read_tokens,
                cache_creation_tokens=token_snapshot.cache_creation_tokens,
                total_cost_usd=token_snapshot.total_cost_usd,
                breakdown={
                    "model": model,
                    "estimation_method": "char_count",
                },
            )
            db.add(token_usage)

            await db.commit()
            logger.info(
                "Run %s trajectory analysis complete: %d events, skill_read=%s",
                run.id, len(events), skill_analysis.skill_read,
            )

        except Exception as e:
            logger.warning(
                "Failed to analyze trajectory for run %s: %s", run.id, e,
                exc_info=True,
            )
            # Rollback just the analysis changes, don't affect the run
            await db.rollback()
