"""FastAPI application factory."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from skillforge.config import settings
from skillforge.database import async_session_factory, engine
from skillforge.engine.benchflow_backend import BenchFlowBackend
from skillforge.engine.orchestrator import Orchestrator
from skillforge.models import Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup/shutdown lifecycle."""
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

    yield

    # Shutdown
    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        description="Skills quality evaluation and iteration platform",
        version="0.1.0",
        lifespan=lifespan,
    )

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
        return {"status": "ok", "app": settings.app_name}

    return app


app = create_app()
