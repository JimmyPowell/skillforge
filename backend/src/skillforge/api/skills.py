"""Skills API endpoints."""

import difflib
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from skillforge.database import get_db
from skillforge.models.skill import Skill, SkillVersion

logger = logging.getLogger(__name__)

router = APIRouter()


class SkillImportRequest(BaseModel):
    source_path: str


@router.get("")
async def list_skills(db: AsyncSession = Depends(get_db)):
    """List all skills with their latest version info."""
    result = await db.execute(
        select(Skill)
        .where(Skill.is_deleted.is_(False))
        .options(selectinload(Skill.versions))
        .order_by(Skill.name)
    )
    skills = result.scalars().all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "category": s.category,
            "tags": s.tags,
            "version_count": len(s.versions),
            "latest_version": s.versions[-1].version_number if s.versions else None,
            "created_at": s.created_at,
            "updated_at": s.updated_at,
        }
        for s in skills
    ]


@router.post("", status_code=201)
async def create_skill(
    data: dict,
    db: AsyncSession = Depends(get_db),
):
    """Create a new skill with initial version."""
    skill = Skill(
        name=data["name"],
        description=data.get("description", ""),
        category=data.get("category"),
        tags=data.get("tags", []),
    )
    db.add(skill)
    await db.flush()

    # Create initial version if content provided
    content = data.get("content", "")
    if content:
        version = SkillVersion(
            skill_id=skill.id,
            version_number=1,
            content=content,
            change_note="Initial version",
            word_count=len(content.split()),
            section_headers=_extract_headers(content),
        )
        db.add(version)

    return {"id": skill.id, "name": skill.name}


@router.post("/import")
async def import_skills(body: SkillImportRequest, db: AsyncSession = Depends(get_db)):
    """Import skills from SkillsBench task directories (environment/skills/*/SKILL.md)."""
    source = Path(body.source_path)
    if not source.is_dir():
        raise HTTPException(status_code=400, detail=f"Source path does not exist or is not a directory: {body.source_path}")

    # Walk all task directories looking for skills
    # Pattern: tasks/<task>/environment/skills/<skill-name>/SKILL.md
    skill_files: list[tuple[str, Path]] = []  # (skill_name, path)
    seen_skill_names: set[str] = set()

    for task_dir in sorted(source.iterdir()):
        if not task_dir.is_dir():
            continue
        skills_dir = task_dir / "environment" / "skills"
        if not skills_dir.is_dir():
            continue
        for skill_dir in sorted(skills_dir.iterdir()):
            if not skill_dir.is_dir():
                continue
            skill_md = skill_dir / "SKILL.md"
            if skill_md.exists():
                skill_name = skill_dir.name
                if skill_name not in seen_skill_names:
                    seen_skill_names.add(skill_name)
                    skill_files.append((skill_name, skill_md))

    # Get existing skill names to skip duplicates
    result = await db.execute(select(Skill.name))
    existing_names: set[str] = {row[0] for row in result.all()}

    imported = 0
    skipped = 0
    errors: list[str] = []

    for skill_name, skill_md_path in skill_files:
        if skill_name in existing_names:
            skipped += 1
            continue

        try:
            content = skill_md_path.read_text(encoding="utf-8")

            # Parse YAML frontmatter for name and description
            frontmatter = _parse_yaml_frontmatter(content)
            display_name = frontmatter.get("name", skill_name)
            description = frontmatter.get("description", "")

            skill = Skill(
                name=skill_name,
                description=description,
                category=None,
                tags=[],
            )
            db.add(skill)
            await db.flush()  # Get the skill.id

            version = SkillVersion(
                skill_id=skill.id,
                version_number=1,
                content=content,
                change_note="Imported from SkillsBench",
                word_count=len(content.split()),
                section_headers=_extract_headers(content),
            )
            db.add(version)
            imported += 1

        except Exception as exc:
            logger.warning("Failed to import skill %s: %s", skill_name, exc)
            errors.append(f"{skill_name}: {exc}")

    if imported > 0:
        await db.flush()

    return {"imported": imported, "skipped": skipped, "errors": errors}


@router.get("/{skill_id}")
async def get_skill(skill_id: str, db: AsyncSession = Depends(get_db)):
    """Get skill details with all versions."""
    result = await db.execute(
        select(Skill)
        .where(Skill.id == skill_id, Skill.is_deleted.is_(False))
        .options(selectinload(Skill.versions))
    )
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")

    return {
        "id": skill.id,
        "name": skill.name,
        "description": skill.description,
        "category": skill.category,
        "tags": skill.tags,
        "versions": [
            {
                "id": v.id,
                "version_number": v.version_number,
                "change_note": v.change_note,
                "word_count": v.word_count,
                "section_headers": v.section_headers,
                "created_at": v.created_at,
            }
            for v in skill.versions
        ],
        "created_at": skill.created_at,
        "updated_at": skill.updated_at,
    }


@router.post("/{skill_id}/versions", status_code=201)
async def create_version(
    skill_id: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
):
    """Create a new version of a skill."""
    result = await db.execute(
        select(Skill)
        .where(Skill.id == skill_id, Skill.is_deleted.is_(False))
        .options(selectinload(Skill.versions))
    )
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")

    next_version = max((v.version_number for v in skill.versions), default=0) + 1
    content = data["content"]

    version = SkillVersion(
        skill_id=skill_id,
        version_number=next_version,
        content=content,
        change_note=data.get("change_note", ""),
        word_count=len(content.split()),
        section_headers=_extract_headers(content),
    )
    db.add(version)
    await db.flush()

    return {"id": version.id, "version_number": next_version}


def _extract_headers(content: str) -> list[str]:
    """Extract markdown headers from skill content."""
    return [
        line.lstrip("#").strip()
        for line in content.split("\n")
        if line.startswith("#") and not line.startswith("---")
    ]


@router.get("/{skill_id}/versions/{version_id}/content")
async def get_version_content(
    skill_id: str, version_id: str, db: AsyncSession = Depends(get_db)
):
    """Return the full content of a specific skill version."""
    result = await db.execute(
        select(SkillVersion).where(
            SkillVersion.id == version_id, SkillVersion.skill_id == skill_id
        )
    )
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    return {
        "skill_id": skill_id,
        "version_id": version.id,
        "version_number": version.version_number,
        "content": version.content,
        "word_count": version.word_count,
        "section_headers": version.section_headers,
        "change_note": version.change_note,
        "created_at": version.created_at,
    }


@router.get("/{skill_id}/diff")
async def diff_versions(
    skill_id: str,
    v1: int = Query(..., description="First version number"),
    v2: int = Query(..., description="Second version number"),
    db: AsyncSession = Depends(get_db),
):
    """Return a unified diff between two versions of a skill."""
    # Verify skill exists
    skill_result = await db.execute(
        select(Skill).where(Skill.id == skill_id, Skill.is_deleted.is_(False))
    )
    skill = skill_result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")

    # Fetch both versions
    v1_result = await db.execute(
        select(SkillVersion).where(
            SkillVersion.skill_id == skill_id, SkillVersion.version_number == v1
        )
    )
    v2_result = await db.execute(
        select(SkillVersion).where(
            SkillVersion.skill_id == skill_id, SkillVersion.version_number == v2
        )
    )

    version_1 = v1_result.scalar_one_or_none()
    version_2 = v2_result.scalar_one_or_none()

    if not version_1:
        raise HTTPException(status_code=404, detail=f"Version {v1} not found")
    if not version_2:
        raise HTTPException(status_code=404, detail=f"Version {v2} not found")

    # Compute unified diff
    lines_1 = version_1.content.splitlines(keepends=True)
    lines_2 = version_2.content.splitlines(keepends=True)

    diff_lines = list(
        difflib.unified_diff(lines_1, lines_2, fromfile=f"v{v1}", tofile=f"v{v2}")
    )
    diff_text = "".join(diff_lines)

    # Compute stats
    additions = sum(1 for l in diff_lines if l.startswith("+") and not l.startswith("+++"))
    deletions = sum(1 for l in diff_lines if l.startswith("-") and not l.startswith("---"))
    changes = min(additions, deletions)

    return {
        "skill_name": skill.name,
        "v1": {"version": v1, "word_count": version_1.word_count},
        "v2": {"version": v2, "word_count": version_2.word_count},
        "diff": diff_text,
        "stats": {
            "additions": additions,
            "deletions": deletions,
            "changes": changes,
        },
    }


def _parse_yaml_frontmatter(content: str) -> dict[str, str]:
    """Parse YAML frontmatter from SKILL.md content (between --- delimiters).

    Returns a dict with 'name' and 'description' if found.
    """
    result: dict[str, str] = {}
    lines = content.split("\n")

    if not lines or lines[0].strip() != "---":
        return result

    # Find the closing ---
    end_idx = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end_idx = i
            break

    if end_idx is None:
        return result

    # Simple YAML key: value parsing for frontmatter
    for line in lines[1:end_idx]:
        line = line.strip()
        if ":" in line:
            key, _, value = line.partition(":")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and value:
                result[key] = value

    return result
