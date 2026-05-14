"""WebSocket endpoints for real-time run status updates."""

import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from skillforge.engine import RunPhase

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/runs/{run_id}")
async def run_websocket(websocket: WebSocket, run_id: str):
    """Real-time status updates for a specific run.

    Clients connect to this WebSocket to receive phase transitions
    as they happen. The connection closes automatically when the run
    reaches a terminal state (COMPLETED, FAILED, CANCELLED).
    """
    await websocket.accept()
    orchestrator = websocket.app.state.orchestrator
    queue = orchestrator.subscribe(run_id)

    try:
        while True:
            update = await queue.get()
            await websocket.send_json({
                "type": "status",
                "run_id": run_id,
                "phase": update.phase.value,
                "message": update.message,
                "timestamp": update.timestamp.isoformat(),
            })
            if update.phase in (RunPhase.COMPLETED, RunPhase.FAILED, RunPhase.CANCELLED):
                break
    except WebSocketDisconnect:
        logger.debug("WebSocket client disconnected for run %s", run_id)
    except Exception as e:
        logger.warning("WebSocket error for run %s: %s", run_id, e)
    finally:
        orchestrator.unsubscribe(run_id, queue)


@router.websocket("/ws/runs/batch/{batch_id}")
async def batch_websocket(websocket: WebSocket, batch_id: str):
    """Real-time status updates for all runs in a batch.

    Multiplexes updates from all runs that share the given batch_id.
    Closes when all runs in the batch reach terminal state.
    """
    await websocket.accept()
    orchestrator = websocket.app.state.orchestrator

    # We subscribe to all runs in the batch as they are discovered.
    # For simplicity, we use a single shared queue and fan-in approach.
    shared_queue: asyncio.Queue = asyncio.Queue()
    subscribed_run_ids: list[str] = []

    # Import here to avoid circular imports
    from sqlalchemy import select
    from skillforge.database import async_session_factory
    from skillforge.models.run import Run

    # Find all runs for this batch
    async with async_session_factory() as db:
        result = await db.execute(
            select(Run.id).where(Run.batch_id == batch_id)
        )
        run_ids = [row[0] for row in result.all()]

    if not run_ids:
        await websocket.send_json({"type": "error", "message": "Batch not found"})
        await websocket.close()
        return

    # Subscribe to each run and fan updates into the shared queue
    for rid in run_ids:
        q = orchestrator.subscribe(rid)
        subscribed_run_ids.append(rid)
        asyncio.create_task(_fan_in(q, shared_queue, rid, orchestrator))

    terminal_count = 0
    total = len(run_ids)

    try:
        while terminal_count < total:
            item = await shared_queue.get()
            run_id_for_update, update = item
            await websocket.send_json({
                "type": "status",
                "run_id": run_id_for_update,
                "batch_id": batch_id,
                "phase": update.phase.value,
                "message": update.message,
                "timestamp": update.timestamp.isoformat(),
            })
            if update.phase in (RunPhase.COMPLETED, RunPhase.FAILED, RunPhase.CANCELLED):
                terminal_count += 1
    except WebSocketDisconnect:
        logger.debug("WebSocket client disconnected for batch %s", batch_id)
    except Exception as e:
        logger.warning("WebSocket error for batch %s: %s", batch_id, e)
    finally:
        # Cleanup is handled by the fan-in tasks completing
        pass


async def _fan_in(
    source: asyncio.Queue,
    dest: asyncio.Queue,
    run_id: str,
    orchestrator,
) -> None:
    """Forward updates from a per-run queue into the shared batch queue."""
    try:
        while True:
            update = await source.get()
            await dest.put((run_id, update))
            if update.phase in (RunPhase.COMPLETED, RunPhase.FAILED, RunPhase.CANCELLED):
                break
    except Exception:
        pass
    finally:
        orchestrator.unsubscribe(run_id, source)
