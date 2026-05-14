"""Skill and SkillVersion models."""

from datetime import datetime

from sqlalchemy import JSON, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from skillforge.models import Base, TimestampMixin, new_uuid


class Skill(TimestampMixin, Base):
    __tablename__ = "skills"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str | None] = mapped_column(String(64))
    tags: Mapped[list] = mapped_column(JSON, default=list)
    is_deleted: Mapped[bool] = mapped_column(default=False)

    versions: Mapped[list["SkillVersion"]] = relationship(
        back_populates="skill", order_by="SkillVersion.version_number"
    )


class SkillVersion(Base):
    __tablename__ = "skill_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    skill_id: Mapped[str] = mapped_column(ForeignKey("skills.id"), index=True)
    version_number: Mapped[int] = mapped_column()
    content: Mapped[str] = mapped_column(Text)  # Full SKILL.md content
    change_note: Mapped[str] = mapped_column(Text, default="")
    word_count: Mapped[int] = mapped_column(default=0)
    section_headers: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(default=func.now())

    skill: Mapped["Skill"] = relationship(back_populates="versions")

    __table_args__ = (UniqueConstraint("skill_id", "version_number"),)
