"""
Global Repository Router
/repo/validation-rules   – shared validation rule sets (read by all, write by auth users)
/repo/cleaning-ops       – shared cleaning operation sets (same access model)
"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from typing import List
import uuid

from models import RuleRepoCreate, RuleRepoItem, CleaningOpRepoCreate, CleaningOpRepoItem, UserInDB
from auth import get_current_user
from database import db

router = APIRouter(prefix="/repo", tags=["repository"])


# ── Validation Rule Repo ────────────────────────────────────────────────────

@router.get("/validation-rules", response_model=List[RuleRepoItem])
async def list_validation_rules():
    """Return ALL published validation rule sets (public endpoint)."""
    try:
        return await db.get_all_rule_repos()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/validation-rules", response_model=dict)
async def publish_validation_rules(
    payload: RuleRepoCreate,
    current_user: UserInDB = Depends(get_current_user)
):
    """Publish a new validation rule set to the global repository."""
    if not payload.rules:
        raise HTTPException(status_code=400, detail="At least one rule is required.")
    try:
        data = payload.model_dump()
        data["id"] = str(uuid.uuid4())
        data["author_email"] = current_user.email
        data["author_name"] = current_user.full_name or current_user.email
        data["created_at"] = datetime.utcnow().isoformat()
        await db.create_rule_repo(data)
        return {"status": "published", "id": data["id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/validation-rules/{repo_id}")
async def delete_validation_rule_repo(
    repo_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """Delete a published rule set (only its author can delete it)."""
    try:
        deleted = await db.delete_rule_repo(repo_id, current_user.email)
        if not deleted:
            raise HTTPException(status_code=404, detail="Not found or not authorised.")
        return {"status": "deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Cleaning Operation Repo ─────────────────────────────────────────────────

@router.get("/cleaning-ops", response_model=List[CleaningOpRepoItem])
async def list_cleaning_ops():
    """Return ALL published cleaning operation sets (public endpoint)."""
    try:
        return await db.get_all_cleaning_op_repos()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cleaning-ops", response_model=dict)
async def publish_cleaning_ops(
    payload: CleaningOpRepoCreate,
    current_user: UserInDB = Depends(get_current_user)
):
    """Publish a new cleaning operation set to the global repository."""
    if not payload.operations:
        raise HTTPException(status_code=400, detail="At least one operation is required.")
    try:
        data = payload.model_dump()
        data["id"] = str(uuid.uuid4())
        data["author_email"] = current_user.email
        data["author_name"] = current_user.full_name or current_user.email
        data["created_at"] = datetime.utcnow().isoformat()
        await db.create_cleaning_op_repo(data)
        return {"status": "published", "id": data["id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/cleaning-ops/{repo_id}")
async def delete_cleaning_op_repo(
    repo_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """Delete a published operation set (only its author can delete it)."""
    try:
        deleted = await db.delete_cleaning_op_repo(repo_id, current_user.email)
        if not deleted:
            raise HTTPException(status_code=404, detail="Not found or not authorised.")
        return {"status": "deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
