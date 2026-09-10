import hashlib
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db, Base, engine
from backend.models.user import User
from backend.models.profile import UserProfile

router = APIRouter()

# Create tables
Base.metadata.create_all(bind=engine)

SALT = "internscrap_secure_salt_2026"

def hash_password(password: str) -> str:
    return hashlib.sha256(f"{SALT}_{password}".encode("utf-8")).hexdigest()

def verify_password(password: str, password_hash: str) -> bool:
    return hash_password(password) == password_hash

PRESET_USERS = [
    {
        "id": "demo",
        "username": "demo",
        "password": "demo123",
        "full_name": "Demo Candidate",
    },
    {
        "id": "Aryanshh",
        "username": "Aryanshh",
        "password": "Aryanshh123",
        "full_name": "Aryanshh Srivastava",
    },
    {
        "id": "Nishtha",
        "username": "Nishtha",
        "password": "Nishtha123",
        "full_name": "Nishtha Maheshwari",
    },
]

def seed_default_users(db: Session):
    for u_data in PRESET_USERS:
        existing = db.query(User).filter(User.username.ilike(u_data["username"])).first()
        if not existing:
            user = User(
                id=u_data["id"],
                username=u_data["username"],
                password_hash=hash_password(u_data["password"]),
                full_name=u_data["full_name"],
            )
            db.add(user)
        else:
            # Update password hash to ensure default credentials match
            existing.password_hash = hash_password(u_data["password"])
            existing.full_name = u_data["full_name"]
    db.commit()

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = ""

class UserResponse(BaseModel):
    id: str
    username: str
    full_name: Optional[str] = ""

class AuthResponse(BaseModel):
    success: bool
    token: str
    user: UserResponse
    message: Optional[str] = None

@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    seed_default_users(db)
    user = db.query(User).filter(User.username.ilike(payload.username.strip())).first()
    if not user:
        raise HTTPException(status_code=401, detail="User account not found. Check username or create account.")
    
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid password. Please try again.")
    
    token = f"token_{user.id}"
    return AuthResponse(
        success=True,
        token=token,
        user=UserResponse(id=user.id, username=user.username, full_name=user.full_name),
        message=f"Welcome back, {user.full_name or user.username}!",
    )

@router.post("/register", response_model=AuthResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    seed_default_users(db)
    username = payload.username.strip()
    if len(username) < 2:
        raise HTTPException(status_code=400, detail="Username must be at least 2 characters long.")
    if len(payload.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters long.")
    
    existing = db.query(User).filter(User.username.ilike(username)).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this username already exists.")
    
    user_id = username
    new_user = User(
        id=user_id,
        username=username,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name.strip() if payload.full_name else username,
    )
    db.add(new_user)
    
    # Also initialize empty UserProfile
    existing_prof = db.query(UserProfile).filter(UserProfile.id == user_id).first()
    if not existing_prof:
        empty_profile = UserProfile(
            id=user_id,
            full_name=payload.full_name.strip() if payload.full_name else username,
            email="",
            phone="",
            headline="",
            primary_location="",
            bio="",
            github_url="",
            linkedin_url="",
            portfolio_url="",
            desired_work_mode="remote",
            min_hourly_rate=0,
            min_annual_base=0,
            target_platforms=[],
            skills=[],
            work_experience=[],
            education=[],
            digest_enabled=False,
            digest_cadence="daily",
            digest_match_threshold=70.0,
        )
        db.add(empty_profile)
    
    db.commit()
    token = f"token_{user_id}"
    return AuthResponse(
        success=True,
        token=token,
        user=UserResponse(id=new_user.id, username=new_user.username, full_name=new_user.full_name),
        message=f"Account created successfully for {new_user.full_name}!",
    )

@router.get("/presets")
def get_presets():
    return [
        {"id": "demo", "name": "Demo Candidate", "role": "Full mock profile for testing", "preset_pwd": "demo123"},
        {"id": "Aryanshh", "name": "Aryanshh Srivastava", "role": "Blank profile (Setup your own)", "preset_pwd": "Aryanshh123"},
        {"id": "Nishtha", "name": "Nishtha Maheshwari", "role": "Blank profile (Setup your own)", "preset_pwd": "Nishtha123"},
    ]

@router.get("/me", response_model=UserResponse)
def get_current_user(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    seed_default_users(db)
    user_id = None
    if authorization and authorization.startswith("Bearer token_"):
        user_id = authorization.replace("Bearer token_", "").strip()
    elif x_user_id:
        user_id = x_user_id.strip()
    
    if not user_id:
        user_id = "Aryanshh"
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        user = db.query(User).filter(User.username.ilike(user_id)).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    
    return UserResponse(id=user.id, username=user.username, full_name=user.full_name)
