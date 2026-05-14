"""Run and related models."""

import enum
from datetime import datetime

from sqlalchemy import JSON, Float, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from skillforge.models import Base, new_uuid


class RunStatus(str, enum.Enum):
    PENDING = "pending"
    BUILDING = "building"
    INJECTING = "injecting"
    RUNNING = "running"
    VERIFYING = "verifying"
    ANALYZING = "analyzing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Run(Base):
    __tablename__ = "runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id"), index=True)
    skill_version_id: Mapped[str | None] = mapped_column(
        ForeignKey("skill_versions.id"), nullable=True
    )
    agent: Mapped[str] = mapped_column(String(32))  # "claude-code", "codex", "gemini-cli"
    model: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(20), default=RunStatus.PENDING.value)
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    batch_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)
    labels: Mapped[list] = mapped_column(JSON, default=list)

    # Timing
    queued_at: Mapped[datetime] = mapped_column(default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Results
    reward: Mapped[float | None] = mapped_column(Float, nullable=True)
    passed: Mapped[bool | None] = mapped_column(nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    verifier_output: Mapped[str | None] = mapped_column(Text, nullable=True)
    tool_calls_count: Mapped[int | None] = mapped_column(nullable=True)

    # Timing breakdown
    timing: Mapped[dict] = mapped_column(JSON, default=dict)

    # Relationships
    task: Mapped["Task"] = relationship()  # noqa: F821
    skill_version: Mapped["SkillVersion | None"] = relationship()  # noqa: F821
    trajectory_events: Mapped[list["TrajectoryEvent"]] = relationship(back_populates="run")
    token_usage: Mapped["TokenUsage | None"] = relationship(back_populates="run", uselist=False)
    skill_usage: Mapped["SkillUsageEvent | None"] = relationship(
        back_populates="run", uselist=False
    )


class TrajectoryEvent(Base):
    __tablename__ = "trajectory_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id"), index=True)
    step_number: Mapped[int] = mapped_column()
    timestamp: Mapped[datetime | None] = mapped_column(nullable=True)
    role: Mapped[str] = mapped_column(String(20))  # user, assistant, tool_call, tool_result
    content: Mapped[str] = mapped_column(Text, default="")
    tool_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    tool_input: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_error: Mapped[bool] = mapped_column(default=False)
    duration_ms: Mapped[int | None] = mapped_column(nullable=True)

    run: Mapped["Run"] = relationship(back_populates="trajectory_events")


class TokenUsage(Base):
    __tablename__ = "token_usage"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id"), unique=True, index=True)
    input_tokens: Mapped[int] = mapped_column(default=0)
    output_tokens: Mapped[int] = mapped_column(default=0)
    cache_read_tokens: Mapped[int] = mapped_column(default=0)
    cache_creation_tokens: Mapped[int] = mapped_column(default=0)
    total_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    breakdown: Mapped[dict] = mapped_column(JSON, default=dict)

    run: Mapped["Run"] = relationship(back_populates="token_usage")


class SkillUsageEvent(Base):
    __tablename__ = "skill_usage_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id"), unique=True, index=True)
    skill_read: Mapped[bool] = mapped_column(default=False)
    read_at_step: Mapped[int | None] = mapped_column(nullable=True)
    read_method: Mapped[str | None] = mapped_column(String(64), nullable=True)
    sections_accessed: Mapped[list] = mapped_column(JSON, default=list)
    mentions: Mapped[list] = mapped_column(JSON, default=list)
    recommendations_followed: Mapped[list] = mapped_column(JSON, default=list)
    recommendations_ignored: Mapped[list] = mapped_column(JSON, default=list)
    analysis_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    run: Mapped["Run"] = relationship(back_populates="skill_usage")


# Import Task and SkillVersion for relationship resolution
from skillforge.models.skill import SkillVersion  # noqa: E402, F401
from skillforge.models.task import Task  # noqa: E402, F401
