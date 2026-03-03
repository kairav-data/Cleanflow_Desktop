from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
import random
from models import UserCreate, UserInDB, Token, TokenData, VerifyOTPRequest, ResendOTPRequest
from database import get_user, create_user, update_user_otp, verify_user
from email_utils import send_otp_email

import os

# Configuration
SECRET_KEY = os.getenv("AUTH_SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto") # Changed to bcrypt for standard PG compatibility
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

router = APIRouter()

# --- Utilities ---
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    safe_password = password[:72]
    return pwd_context.hash(safe_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception
    
    user = await get_user(token_data.email)
    if user is None:
        raise credentials_exception
    return UserInDB(**user)

# --- Routes ---

@router.post("/register", response_model=Token)
async def register(user: UserCreate):
    existing_user = await get_user(user.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user.password)
    user_in_db = {
        "email": user.email,
        "hashed_password": hashed_password,
        "full_name": user.full_name,
        "is_premium": False
    }
    
    await create_user(user_in_db)
    
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    # get_user returns a dictionary from your new database.py
    user = await get_user(form_data.username)
    
    if not user or not verify_password(form_data.password, user['hashed_password']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.get('is_verified', False):
        otp = str(random.randint(100000, 999999))
        await update_user_otp(user['email'], otp, datetime.utcnow())
        send_otp_email(user['email'], otp)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="OTP_REQUIRED"
        )
        
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user['email']}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/verify-otp", response_model=Token)
async def verify_otp(request: VerifyOTPRequest):
    user = await get_user(request.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.get('is_verified', False):
        raise HTTPException(status_code=400, detail="User already verified")
        
    if not user.get('otp') or user['otp'] != request.otp:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
        
    # Check expiration (e.g. 10 minutes)
    if user.get('otp_created_at'):
        time_diff = datetime.utcnow() - user['otp_created_at']
        if time_diff.total_seconds() > 600:
            raise HTTPException(status_code=400, detail="OTP expired")
            
    await verify_user(request.email)
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user['email']}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/resend-otp")
async def resend_otp(request: ResendOTPRequest):
    user = await get_user(request.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.get('is_verified', False):
        raise HTTPException(status_code=400, detail="User already verified")
        
    otp = str(random.randint(100000, 999999))
    await update_user_otp(user['email'], otp, datetime.utcnow())
    send_otp_email(user['email'], otp)
    
    return {"status": "success", "message": "OTP sent successfully"}

@router.get("/users/me", response_model=UserInDB)
async def read_users_me(current_user: UserInDB = Depends(get_current_user)):
    return current_user