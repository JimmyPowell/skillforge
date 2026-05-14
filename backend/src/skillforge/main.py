"""FastAPI application factory."""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from skillforge.config import settings
from skillforge.database import async_session_factory, engine
from skillforge.engine.benchflow_backend import BenchFlowBackend
from skillforge.engine.orchestrator import Orchestrator
from skillforge.models import Base

logger = logging.getLogger("skillforge")

# Track server start time for uptime calculation
_start_time: float = 0.0


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup/shutdown lifecycle."""
    global _start_time
    _start_time = time.time()

    # Create data directories
    for d in [settings.data_dir, settings.skills_dir, settings.tasks_dir, settings.runs_dir]:
        d.mkdir(parents=True, exist_ok=True)

    # Create database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Initialize execution engine
    backend = BenchFlowBackend(
        docker_use_sg=settings.docker_use_sg,
        jobs_dir=str(settings.data_dir / "jobs"),
    )
    orchestrator = Orchestrator(
        backend=backend,
        session_factory=async_session_factory,
        max_concurrent=settings.max_concurrent_runs,
    )
    app.state.orchestrator = orchestrator

    # Recover runs that were interrupted by a previous shutdown
    recovered = await orchestrator.recover_stale_runs()
    if recovered:
        logger.info("Recovered %d stale runs on startup", recovered)

    # Print startup banner
    _print_banner()

    yield

    # Shutdown
    await engine.dispose()


def _print_banner() -> None:
    """Print a startup banner to the console."""
    banner = """
  ╔═══════════════════════════════════╗
  ║  SkillForge v0.1.0               ║
  ║  API: http://0.0.0.0:8000        ║
  ║  Docs: http://0.0.0.0:8000/docs  ║
  ╚═══════════════════════════════════╝
"""
    print(banner)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log method, path, status code, and duration for every request.

    Skips /health and /docs endpoints to reduce noise.
    """

    SKIP_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if any(path.startswith(skip) for skip in self.SKIP_PATHS):
            return await call_next(request)

        start = time.time()
        response: Response = await call_next(request)
        duration_ms = (time.time() - start) * 1000

        logger.info(
            "%s %s → %d (%.1fms)",
            request.method,
            path,
            response.status_code,
            duration_ms,
        )
        return response


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        description="Skills quality evaluation and iteration platform",
        version="0.1.0",
        lifespan=lifespan,
    )

    # Request logging middleware (added first so it wraps everything)
    app.add_middleware(RequestLoggingMiddleware)

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routers
    from skillforge.api.router import api_router

    app.include_router(api_router, prefix="/api")

    @app.get("/health")
    async def health():
        """Enhanced health check with system status."""
        import subprocess

        from sqlalchemy import inspect, text

        # Docker status
        docker_info = {"status": "unknown"}
        try:
            if settings.docker_use_sg:
                result = subprocess.run(
                    ["sg", "docker", "-c", "docker info --format '{{.ServerVersion}}'"],
                    capture_output=True, text=True, timeout=10,
                )
            else:
                result = subprocess.run(
                    ["docker", "info", "--format", "{{.ServerVersion}}"],
                    capture_output=True, text=True, timeout=10,
                )
            if result.returncode == 0:
                docker_info = {"status": "ok", "version": result.stdout.strip().strip("'")}
            else:
                docker_info = {"status": "error", "detail": result.stderr.strip()[:200]}
        except Exception as e:
            docker_info = {"status": "error", "detail": str(e)[:200]}

        # Database status
        db_info = {"status": "unknown"}
        try:
            async with engine.connect() as conn:
                # Check connectivity
                await conn.execute(text("SELECT 1"))
                # Count tables
                def count_tables(sync_conn):
                    inspector = inspect(sync_conn)
                    return len(inspector.get_table_names())

                table_count = await conn.run_sync(count_tables)
                db_info = {"status": "ok", "tables": table_count}
        except Exception as e:
            db_info = {"status": "error", "detail": str(e)[:200]}

        # Active/queued runs
        active_runs = 0
        queued_runs = 0
        try:
            from sqlalchemy import func, select as sa_select

            from skillforge.models.run import Run

            async with async_session_factory() as db:
                result = await db.execute(
                    sa_select(Run.status, func.count()).group_by(Run.status)
                )
                status_counts = dict(result.all())
                active_runs = (
                    status_counts.get("building", 0)
                    + status_counts.get("running", 0)
                    + status_counts.get("verifying", 0)
                )
                queued_runs = status_counts.get("pending", 0)
        except Exception:
            pass

        uptime = time.time() - _start_time if _start_time else 0

        return {
            "status": "ok",
            "app": "SkillForge",
            "version": "0.1.0",
            "docker": docker_info,
            "database": db_info,
            "uptime_seconds": int(uptime),
            "active_runs": active_runs,
            "queued_runs": queued_runs,
        }

    return app


app = create_app()
