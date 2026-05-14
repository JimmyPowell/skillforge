"""Task model."""

from sqlalchemy import JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from skillforge.models import Base, TimestampMixin, new_uuid


class Task(TimestampMixin, Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str | None] = mapped_column(String(64))
    difficulty: Mapped[str | None] = mapped_column(String(16))
    tags: Mapped[list] = mapped_column(JSON, default=list)
    instruction_md: Mapped[str] = mapped_column(Text, default="")
    dockerfile: Mapped[str] = mapped_column(Text, default="")
    verifier_code: Mapped[str] = mapped_column(Text, default="")
    solution_sh: Mapped[str] = mapped_column(Text, default="")
    task_config: Mapped[dict] = mapped_column(JSON, default=dict)  # task.toml contents
    disk_path: Mapped[str | None] = mapped_column(String(512))  # filesystem path if imported
    is_deleted: Mapped[bool] = mapped_column(default=False)
