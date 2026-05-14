"""Tasks API endpoints."""

import logging
import tomllib
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from skillforge.database import get_db
from skillforge.models.task import Task

logger = logging.getLogger(__name__)

router = APIRouter()


class ImportRequest(BaseModel):
    source_path: str


@router.get("")
async def list_tasks(db: AsyncSession = Depends(get_db)):
    """List all tasks."""
    result = await db.execute(
        select(Task).where(Task.is_deleted.is_(False)).order_by(Task.name)
    )
    tasks = result.scalars().all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "category": t.category,
            "difficulty": t.difficulty,
            "tags": t.tags,
            "created_at": t.created_at,
        }
        for t in tasks
    ]


@router.post("", status_code=201)
async def create_task(data: dict, db: AsyncSession = Depends(get_db)):
    """Create a new task."""
    task = Task(
        name=data["name"],
        description=data.get("description", ""),
        category=data.get("category"),
        difficulty=data.get("difficulty"),
        tags=data.get("tags", []),
        instruction_md=data.get("instruction_md", ""),
        dockerfile=data.get("dockerfile", ""),
        verifier_code=data.get("verifier_code", ""),
        solution_sh=data.get("solution_sh", ""),
        task_config=data.get("task_config", {}),
        disk_path=data.get("disk_path"),
    )
    db.add(task)
    await db.flush()
    return {"id": task.id, "name": task.name}


@router.post("/import")
async def import_tasks(body: ImportRequest, db: AsyncSession = Depends(get_db)):
    """Import tasks from a SkillsBench tasks directory."""
    source = Path(body.source_path)
    if not source.is_dir():
        raise HTTPException(status_code=400, detail=f"Source path does not exist or is not a directory: {body.source_path}")

    # Find all directories that contain a task.toml
    task_dirs: list[Path] = sorted(
        d for d in source.iterdir() if d.is_dir() and (d / "task.toml").exists()
    )

    # Get existing task names to skip duplicates
    result = await db.execute(select(Task.name))
    existing_names: set[str] = {row[0] for row in result.all()}

    imported = 0
    skipped = 0
    errors: list[str] = []

    for task_dir in task_dirs:
        task_name = task_dir.name

        if task_name in existing_names:
            skipped += 1
            continue

        try:
            # Parse task.toml
            task_toml_path = task_dir / "task.toml"
            with open(task_toml_path, "rb") as f:
                task_config = tomllib.load(f)

            metadata = task_config.get("metadata", {})
            category = metadata.get("category")
            difficulty = metadata.get("difficulty")
            tags = metadata.get("tags", [])

            # Read instruction.md
            instruction_md = ""
            instruction_path = task_dir / "instruction.md"
            if instruction_path.exists():
                instruction_md = instruction_path.read_text(encoding="utf-8")

            # Derive description from metadata or first line of instruction
            description = metadata.get("description", "")
            if not description and instruction_md:
                first_line = instruction_md.strip().split("\n")[0]
                # Strip leading markdown heading markers
                description = first_line.lstrip("# ").strip()

            # Read Dockerfile
            dockerfile = ""
            dockerfile_path = task_dir / "environment" / "Dockerfile"
            if dockerfile_path.exists():
                dockerfile = dockerfile_path.read_text(encoding="utf-8")

            # Read verifier code
            verifier_code = ""
            verifier_path = task_dir / "tests" / "test_outputs.py"
            if verifier_path.exists():
                verifier_code = verifier_path.read_text(encoding="utf-8")

            # Read solution
            solution_sh = ""
            solution_path = task_dir / "solution" / "solve.sh"
            if solution_path.exists():
                solution_sh = solution_path.read_text(encoding="utf-8")

            task = Task(
                name=task_name,
                description=description,
                category=category,
                difficulty=difficulty,
                tags=tags,
                instruction_md=instruction_md,
                dockerfile=dockerfile,
                verifier_code=verifier_code,
                solution_sh=solution_sh,
                task_config=task_config,
                disk_path=str(task_dir.resolve()),
            )
            db.add(task)
            imported += 1

        except Exception as exc:
            logger.warning("Failed to import task %s: %s", task_name, exc)
            errors.append(f"{task_name}: {exc}")

    # Flush all new tasks to the database
    if imported > 0:
        await db.flush()

    return {"imported": imported, "skipped": skipped, "errors": errors}


@router.get("/{task_id}")
async def get_task(task_id: str, db: AsyncSession = Depends(get_db)):
    """Get task details."""
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.is_deleted.is_(False))
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return {
        "id": task.id,
        "name": task.name,
        "description": task.description,
        "category": task.category,
        "difficulty": task.difficulty,
        "tags": task.tags,
        "instruction_md": task.instruction_md,
        "dockerfile": task.dockerfile,
        "verifier_code": task.verifier_code,
        "solution_sh": task.solution_sh,
        "task_config": task.task_config,
        "disk_path": task.disk_path,
        "created_at": task.created_at,
    }
