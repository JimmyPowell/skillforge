# SkillForge

Skills quality evaluation and iteration platform.

**Core idea**: Fixed agent + model, swap skill versions, measure the delta.

## Quick Start

```bash
# Backend
cd backend && uv sync && uv run uvicorn skillforge.main:app --reload --port 8000

# Frontend
cd frontend && bun install && bun dev --port 3000
```

## Architecture

- **Backend**: Python FastAPI + SQLAlchemy + SQLite
- **Frontend**: Next.js 14 + React + shadcn/ui + Tailwind
- **Execution**: Docker-based task isolation with agent-specific skill injection

## Project Structure

```
skillforge/
├── backend/          # FastAPI application
├── frontend/         # Next.js application
├── data/             # Runtime data (skills, tasks, runs)
└── scripts/          # Development scripts
```
