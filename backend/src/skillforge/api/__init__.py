"""Main API router — aggregates all sub-routers."""

from fastapi import APIRouter

from skillforge.api.skills import router as skills_router
from skillforge.api.tasks import router as tasks_router
from skillforge.api.runs import router as runs_router

api_router = APIRouter()

api_router.include_router(skills_router, prefix="/skills", tags=["skills"])
api_router.include_router(tasks_router, prefix="/tasks", tags=["tasks"])
api_router.include_router(runs_router, prefix="/runs", tags=["runs"])
