"""
pipeline_router.py
───────────────────────────────────────────────────────────────────────────────
FastAPI router that exposes CRUD endpoints for the three pipeline tables:
  • saved_pipelines   – named, serialised pipelines (nodes + edges)
  • pipeline_schedules – recurring schedule attached to a saved pipeline
  • pipeline_runs      – execution history / run records

All routes require a logged-in user (JWT via get_current_user).
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional

from auth import get_current_user
from database import db
from models import (
    UserInDB,
    SavedPipelineCreate, SavedPipelineItem,
    PipelineScheduleCreate, PipelineScheduleItem,
    PipelineRunCreate, PipelineRunUpdate, PipelineRunItem,
)

router = APIRouter(prefix="/pipeline", tags=["Pipeline"])


# ─── Saved Pipelines ──────────────────────────────────────────────────────────

@router.get("/saved", response_model=List[dict])
async def list_saved_pipelines(current_user: UserInDB = Depends(get_current_user)):
    """List all saved pipelines for the authenticated user."""
    return await db.get_user_pipelines(current_user.email)


@router.post("/saved", response_model=dict)
async def upsert_saved_pipeline(
    payload: SavedPipelineCreate,
    current_user: UserInDB = Depends(get_current_user),
):
    """Create or update a saved pipeline (upsert by id)."""
    data = payload.dict()
    data["user_email"] = current_user.email
    if not data.get("id"):
        data["id"] = str(uuid.uuid4())
    pipeline_id = await db.save_pipeline(data)
    return {"id": pipeline_id, "message": "Pipeline saved successfully."}


@router.get("/saved/{pipeline_id}", response_model=dict)
async def get_saved_pipeline(
    pipeline_id: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """Fetch a single saved pipeline by ID."""
    result = await db.get_pipeline(pipeline_id, current_user.email)
    if not result:
        raise HTTPException(status_code=404, detail="Pipeline not found.")
    return result


@router.delete("/saved/{pipeline_id}")
async def delete_saved_pipeline(
    pipeline_id: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """Delete a saved pipeline (and cascades to its schedules and runs)."""
    deleted = await db.delete_pipeline(pipeline_id, current_user.email)
    if not deleted:
        raise HTTPException(status_code=404, detail="Pipeline not found or not owned by you.")
    return {"message": "Pipeline deleted."}


# ─── Pipeline Schedules ───────────────────────────────────────────────────────

@router.get("/schedules", response_model=List[dict])
async def list_all_schedules(current_user: UserInDB = Depends(get_current_user)):
    """List every schedule across all pipelines for the current user."""
    return await db.get_all_user_schedules(current_user.email)


@router.get("/saved/{pipeline_id}/schedules", response_model=List[dict])
async def list_pipeline_schedules(
    pipeline_id: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """List schedules for a specific pipeline."""
    return await db.get_pipeline_schedules(pipeline_id, current_user.email)


@router.post("/saved/{pipeline_id}/schedules", response_model=dict)
async def create_schedule(
    pipeline_id: str,
    payload: PipelineScheduleCreate,
    current_user: UserInDB = Depends(get_current_user),
):
    """Create or update a schedule for a pipeline."""
    # Verify the pipeline belongs to this user
    pipeline = await db.get_pipeline(pipeline_id, current_user.email)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found.")

    data = payload.dict(exclude_unset=True)
    data["pipeline_id"] = pipeline_id
    data["user_email"] = current_user.email
    is_update = bool(data.get("id"))
    if not data.get("id"):
        data["id"] = str(uuid.uuid4())
    data["schedule_name"] = (data.get("schedule_name") or f"{pipeline.get('name', 'Pipeline')} Schedule").strip()

    try:
        schedule_id = await db.save_schedule(data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"id": schedule_id, "message": "Schedule updated." if is_update else "Schedule created."}


@router.patch("/schedules/{schedule_id}/toggle", response_model=dict)
async def toggle_schedule(
    schedule_id: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """Toggle a schedule active/paused."""
    new_state = await db.toggle_schedule(schedule_id, current_user.email)
    if new_state is None:
        raise HTTPException(status_code=404, detail="Schedule not found.")
    return {"id": schedule_id, "is_active": new_state}


@router.delete("/schedules/{schedule_id}")
async def delete_schedule(
    schedule_id: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """Delete a schedule."""
    deleted = await db.delete_schedule(schedule_id, current_user.email)
    if not deleted:
        raise HTTPException(status_code=404, detail="Schedule not found.")
    return {"message": "Schedule deleted."}


# ─── Pipeline Runs ────────────────────────────────────────────────────────────

@router.get("/runs", response_model=List[dict])
async def list_pipeline_runs(
    pipeline_id: Optional[str] = None,
    limit: int = 50,
    current_user: UserInDB = Depends(get_current_user),
):
    """List run records, optionally filtered by pipeline_id."""
    return await db.get_pipeline_runs(current_user.email, pipeline_id=pipeline_id, limit=limit)


@router.post("/runs", response_model=dict)
async def create_pipeline_run(
    payload: PipelineRunCreate,
    current_user: UserInDB = Depends(get_current_user),
):
    """Create a new pipeline run record (call at run start)."""
    data = payload.dict()
    data["user_email"] = current_user.email
    data["id"] = str(uuid.uuid4())
    run_id = await db.create_pipeline_run(data)
    return {"id": run_id, "message": "Pipeline run started."}


@router.patch("/runs/{run_id}", response_model=dict)
async def update_pipeline_run(
    run_id: str,
    payload: PipelineRunUpdate,
    current_user: UserInDB = Depends(get_current_user),
):
    """Update a run record with status, logs, and output info."""
    update = {k: v for k, v in payload.dict().items() if v is not None}
    await db.update_pipeline_run(run_id, current_user.email, update)
    return {"id": run_id, "message": "Run updated."}


@router.delete("/runs/{run_id}")
async def delete_pipeline_run(
    run_id: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """Delete a run record."""
    deleted = await db.delete_pipeline_run(run_id, current_user.email)
    if not deleted:
        raise HTTPException(status_code=404, detail="Run not found.")
    return {"message": "Run deleted."}
