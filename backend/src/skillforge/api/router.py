"""Main API router — aggregates all sub-routers."""

from fastapi import APIRouter

from skillforge.api.agents import router as agents_router
from skillforge.api.analytics import router as analytics_router
from skillforge.api.skills import router as skills_router
from skillforge.api.tasks import router as tasks_router
from skillforge.api.runs import router as runs_router
from skillforge.api.trajectories import router as trajectories_router
from skillforge.api.ws import router as ws_router

api_router = APIRouter()

api_router.include_router(agents_router, prefix="/agents", tags=["agents"])
api_router.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
api_router.include_router(skills_router, prefix="/skills", tags=["skills"])
api_router.include_router(tasks_router, prefix="/tasks", tags=["tasks"])
api_router.include_router(runs_router, prefix="/runs", tags=["runs"])
api_router.include_router(trajectories_router, prefix="/runs", tags=["trajectories"])
api_router.include_router(ws_router, tags=["websocket"])
