"""SkillForge CLI — command-line interface for the evaluation platform."""

import sys
from pathlib import Path

import typer

app = typer.Typer(
    name="skillforge",
    help="SkillForge — Skills quality evaluation and iteration platform",
    no_args_is_help=True,
)


@app.command()
def run(
    task: Path = typer.Option(..., help="Path to the task directory"),
    skill: Path = typer.Option(None, help="Path to the skill file or directory"),
    agent: str = typer.Option("claude-code", help="Agent to use for evaluation"),
    model: str = typer.Option("claude-sonnet-4-6", help="Model identifier"),
    timeout: int = typer.Option(600, help="Timeout in seconds"),
):
    """Run a single evaluation."""
    import asyncio

    from skillforge.config import settings
    from skillforge.engine import RunConfig
    from skillforge.engine.benchflow_backend import BenchFlowBackend

    task_path = task.resolve()
    if not task_path.exists():
        typer.echo(f"Error: task path does not exist: {task_path}", err=True)
        raise typer.Exit(1)

    skills_dir = str(skill.resolve()) if skill else None

    config = RunConfig(
        task_path=str(task_path),
        agent=agent,
        model=model,
        skills_dir=skills_dir,
        timeout_sec=timeout,
    )

    backend = BenchFlowBackend(
        docker_use_sg=settings.docker_use_sg,
        jobs_dir=str(settings.data_dir / "jobs"),
    )

    typer.echo(f"Running evaluation: task={task_path.name} agent={agent} model={model}")
    if skills_dir:
        typer.echo(f"  Skills: {skills_dir}")

    def on_status(update):
        typer.echo(f"  [{update.phase.value}] {update.message}")

    result = asyncio.run(backend.execute(config, on_status=on_status))

    typer.echo("\n--- Results ---")
    typer.echo(f"  Reward: {result.reward}")
    typer.echo(f"  Passed: {result.passed}")
    typer.echo(f"  Tool calls: {result.tool_calls_count}")
    if result.error:
        typer.echo(f"  Error: {result.error}", err=True)
        raise typer.Exit(1)


@app.command("import-tasks")
def import_tasks(
    source_dir: Path = typer.Argument(..., help="Path to SkillsBench tasks directory"),
):
    """Import tasks from a SkillsBench tasks directory."""
    import shutil

    from skillforge.config import settings

    source_dir = source_dir.resolve()
    if not source_dir.is_dir():
        typer.echo(f"Error: source directory does not exist: {source_dir}", err=True)
        raise typer.Exit(1)

    dest = settings.tasks_dir
    dest.mkdir(parents=True, exist_ok=True)

    imported = 0
    for task_dir in sorted(source_dir.iterdir()):
        if not task_dir.is_dir() or task_dir.name.startswith("."):
            continue
        target = dest / task_dir.name
        if target.exists():
            typer.echo(f"  Skip (exists): {task_dir.name}")
            continue
        shutil.copytree(task_dir, target)
        imported += 1
        typer.echo(f"  Imported: {task_dir.name}")

    typer.echo(f"\nImported {imported} task(s) to {dest}")


@app.command("import-skills")
def import_skills(
    source_dir: Path = typer.Argument(..., help="Path to directory containing skills"),
):
    """Import skills from a directory."""
    import shutil

    from skillforge.config import settings

    source_dir = source_dir.resolve()
    if not source_dir.is_dir():
        typer.echo(f"Error: source directory does not exist: {source_dir}", err=True)
        raise typer.Exit(1)

    dest = settings.skills_dir
    dest.mkdir(parents=True, exist_ok=True)

    imported = 0
    # Import skills from task directories (tasks/*/environment/skills/)
    for task_dir in sorted(source_dir.iterdir()):
        if not task_dir.is_dir():
            continue
        skills_subdir = task_dir / "environment" / "skills"
        if not skills_subdir.is_dir():
            continue
        for skill_file in skills_subdir.iterdir():
            if skill_file.suffix == ".md" and skill_file.is_file():
                target = dest / f"{task_dir.name}_{skill_file.name}"
                if target.exists():
                    typer.echo(f"  Skip (exists): {target.name}")
                    continue
                shutil.copy2(skill_file, target)
                imported += 1
                typer.echo(f"  Imported: {target.name}")

    typer.echo(f"\nImported {imported} skill(s) to {dest}")


@app.command()
def serve(
    host: str = typer.Option("0.0.0.0", help="Host to bind to"),
    port: int = typer.Option(8000, help="Port to listen on"),
    reload: bool = typer.Option(False, help="Enable auto-reload for development"),
):
    """Start the SkillForge API server."""
    import uvicorn

    uvicorn.run(
        "skillforge.main:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info",
    )


@app.command()
def health(
    url: str = typer.Option("http://localhost:8000", help="Server URL to check"),
):
    """Check the health of a running SkillForge server."""
    import httpx

    try:
        resp = httpx.get(f"{url}/health", timeout=5)
        data = resp.json()

        if data.get("status") == "ok":
            typer.echo(f"SkillForge is healthy!")
            typer.echo(f"  Version: {data.get('version', 'unknown')}")
            typer.echo(f"  Uptime: {data.get('uptime_seconds', 0)}s")
            typer.echo(f"  Docker: {data.get('docker', {}).get('status', 'unknown')}")
            typer.echo(f"  Database: {data.get('database', {}).get('status', 'unknown')}")
            typer.echo(f"  Active runs: {data.get('active_runs', 0)}")
            typer.echo(f"  Queued runs: {data.get('queued_runs', 0)}")
        else:
            typer.echo(f"SkillForge health check failed: {data}", err=True)
            raise typer.Exit(1)

    except httpx.ConnectError:
        typer.echo(f"Error: Cannot connect to SkillForge at {url}", err=True)
        raise typer.Exit(1)
    except Exception as e:
        typer.echo(f"Error: {e}", err=True)
        raise typer.Exit(1)


if __name__ == "__main__":
    app()
