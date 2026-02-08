from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
from models import UserInDB
from database import db

router = APIRouter()

@router.post("/pay")
async def upgrade_user(current_user: UserInDB = Depends(get_current_user)):
    # Simulate payment processing (always success for demo)
    await db.upgrade_user(current_user.email)
    return {"status": "success", "message": "Upgraded to Premium", "is_premium": True}
