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
from authlib.integrations.httpx_client import AsyncOAuth2Client
from starlette.responses import RedirectResponse

# Configuration
SECRET_KEY = os.getenv("AUTH_SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto") # Changed to bcrypt for standard PG compatibility
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# OAuth Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
MICROSOFT_CLIENT_ID = os.getenv("MICROSOFT_CLIENT_ID")
MICROSOFT_CLIENT_SECRET = os.getenv("MICROSOFT_CLIENT_SECRET")
APPLE_CLIENT_ID = os.getenv("APPLE_CLIENT_ID")
APPLE_CLIENT_SECRET = os.getenv("APPLE_CLIENT_SECRET")

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
        "phone_number": user.phone_number,
        "professional_field": user.professional_field,
        "country": user.country,
        "company_name": user.company_name,
        "is_premium": False
    }
    
    await create_user(user_in_db)
    
    otp = str(random.randint(100000, 999999))
    await update_user_otp(user.email, otp, datetime.utcnow())
    send_otp_email(user.email, otp)
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="OTP_REQUIRED"
    )

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

# OAuth Routes
@router.get("/auth/google")
async def google_login():
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    client = AsyncOAuth2Client(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        redirect_uri=f"{os.getenv('BASE_URL', 'http://localhost:8000')}/auth/google/callback"
    )
    authorization_url, state = client.create_authorization_url(
        'https://accounts.google.com/o/oauth2/auth',
        scope=['openid', 'email', 'profile']
    )
    return RedirectResponse(authorization_url)

@router.get("/auth/google/callback")
async def google_callback(code: str, state: str):
    client = AsyncOAuth2Client(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        redirect_uri=f"{os.getenv('BASE_URL', 'http://localhost:8000')}/auth/google/callback"
    )
    token = await client.fetch_token(
        'https://oauth2.googleapis.com/token',
        code=code
    )
    user_info = await client.get('https://www.googleapis.com/oauth2/v2/userinfo')
    user_data = user_info.json()
    
    # Check if user exists, if not create
    user = await get_user(user_data['email'])
    if not user:
        user_in_db = {
            "email": user_data['email'],
            "hashed_password": "",  # No password for OAuth
            "full_name": user_data.get('name', ''),
            "phone_number": "",
            "professional_field": "",
            "country": "",
            "company_name": "",
            "is_premium": False,
            "is_verified": True
        }
        await create_user(user_in_db)
    
    access_token = create_access_token(data={"sub": user_data['email']})
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
    return RedirectResponse(f"{frontend_url}/auth/callback?token={access_token}")

@router.get("/auth/microsoft")
async def microsoft_login():
    if not MICROSOFT_CLIENT_ID or not MICROSOFT_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Microsoft OAuth not configured")
    client = AsyncOAuth2Client(
        MICROSOFT_CLIENT_ID,
        MICROSOFT_CLIENT_SECRET,
        redirect_uri=f"{os.getenv('BASE_URL', 'http://localhost:8000')}/auth/microsoft/callback"
    )
    authorization_url, state = client.create_authorization_url(
        'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        scope=['openid', 'email', 'profile']
    )
    return RedirectResponse(authorization_url)

@router.get("/auth/microsoft/callback")
async def microsoft_callback(code: str, state: str):
    client = AsyncOAuth2Client(
        MICROSOFT_CLIENT_ID,
        MICROSOFT_CLIENT_SECRET,
        redirect_uri=f"{os.getenv('BASE_URL', 'http://localhost:8000')}/auth/microsoft/callback"
    )
    token = await client.fetch_token(
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        code=code
    )
    user_info = await client.get('https://graph.microsoft.com/v1.0/me')
    user_data = user_info.json()
    
    user = await get_user(user_data['mail'])
    if not user:
        user_in_db = {
            "email": user_data['mail'],
            "hashed_password": "",
            "full_name": user_data.get('displayName', ''),
            "phone_number": "",
            "professional_field": "",
            "country": "",
            "company_name": "",
            "is_premium": False,
            "is_verified": True
        }
        await create_user(user_in_db)
    
    access_token = create_access_token(data={"sub": user_data['mail']})
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
    return RedirectResponse(f"{frontend_url}/auth/callback?token={access_token}")

@router.get("/auth/apple")
async def apple_login():
    if not APPLE_CLIENT_ID or not APPLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Apple OAuth not configured")
    client = AsyncOAuth2Client(
        APPLE_CLIENT_ID,
        APPLE_CLIENT_SECRET,
        redirect_uri=f"{os.getenv('BASE_URL', 'http://localhost:8000')}/auth/apple/callback"
    )
    authorization_url, state = client.create_authorization_url(
        'https://appleid.apple.com/auth/authorize',
        scope=['name', 'email']
    )
    return RedirectResponse(authorization_url)

@router.get("/auth/apple/callback")
async def apple_callback(code: str, state: str):
    client = AsyncOAuth2Client(
        APPLE_CLIENT_ID,
        APPLE_CLIENT_SECRET,
        redirect_uri=f"{os.getenv('BASE_URL', 'http://localhost:8000')}/auth/apple/callback"
    )
    token = await client.fetch_token(
        'https://appleid.apple.com/auth/token',
        code=code
    )
    # Apple doesn't provide user info directly, need to decode JWT
    import base64
    payload = token['id_token'].split('.')[1]
    decoded = base64.urlsafe_b64decode(payload + '==')
    user_data = jwt.decode(decoded, options={"verify_signature": False})
    
    user = await get_user(user_data['email'])
    if not user:
        user_in_db = {
            "email": user_data['email'],
            "hashed_password": "",
            "full_name": "",
            "phone_number": "",
            "professional_field": "",
            "country": "",
            "company_name": "",
            "is_premium": False,
            "is_verified": True
        }
        await create_user(user_in_db)
    
    access_token = create_access_token(data={"sub": user_data['email']})
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
    return RedirectResponse(f"{frontend_url}/auth/callback?token={access_token}")