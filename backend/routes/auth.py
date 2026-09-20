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
    email: Optional[str] = ""
    primary_role: Optional[str] = "Software Engineer"
    desired_work_mode: Optional[str] = "Remote"
    years_of_experience: Optional[int] = 1

class UserResponse(BaseModel):
    id: str
    username: str
    full_name: Optional[str] = ""
    email: Optional[str] = ""

class AuthResponse(BaseModel):
    success: bool
    token: str
    user: UserResponse
    message: Optional[str] = None

@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    seed_default_users(db)
    login_id = payload.username.strip()
    user = (
        db.query(User)
        .filter((User.username.ilike(login_id)) | (User.email.ilike(login_id)))
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=401,
            detail="User account not found. Check your username/email or create an account.",
        )
    
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid password. Please try again.")
    
    token = f"token_{user.id}"
    return AuthResponse(
        success=True,
        token=token,
        user=UserResponse(
            id=user.id,
            username=user.username,
            full_name=user.full_name,
            email=user.email or "",
        ),
        message=f"Welcome back, {user.full_name or user.username}!",
    )

@router.post("/register", response_model=AuthResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    seed_default_users(db)
    username = payload.username.strip()
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters long.")
    
    if not all(c.isalnum() or c in ("_", "-", ".") for c in username):
        raise HTTPException(
            status_code=400,
            detail="Username can only contain letters, numbers, hyphens, periods, and underscores.",
        )

    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")
    
    email = (payload.email or "").strip().lower()
    if email and ("@" not in email or "." not in email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    
    existing = db.query(User).filter(User.username.ilike(username)).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Username '{username}' is already taken. Please choose another username.",
        )
    
    if email:
        existing_email = db.query(User).filter(User.email.ilike(email)).first()
        if existing_email:
            raise HTTPException(
                status_code=400,
                detail="An account with this email address already exists. Please sign in instead.",
            )

    user_id = username
    full_name = payload.full_name.strip() if payload.full_name else username
    primary_role = (payload.primary_role or "Software Engineer").strip()
    desired_work_mode = (payload.desired_work_mode or "Remote").strip()
    years_of_experience = int(payload.years_of_experience) if payload.years_of_experience is not None else 1

    new_user = User(
        id=user_id,
        username=username,
        email=email,
        password_hash=hash_password(payload.password),
        full_name=full_name,
    )
    db.add(new_user)
    
    # Initialize clean UserProfile with valid column parameters
    existing_prof = db.query(UserProfile).filter(UserProfile.id == user_id).first()
    if not existing_prof:
        new_profile = UserProfile(
            id=user_id,
            full_name=full_name,
            email=email or f"{username}@example.com",
            phone="",
            location="Remote",
            headline=f"{primary_role} • {desired_work_mode}",
            bio=f"{full_name} is a {primary_role} seeking {desired_work_mode.lower()} opportunities.",
            github_url="",
            linkedin_url="",
            portfolio_url="",
            wellfound_url="",
            twitter_url="",
            primary_role=primary_role,
            years_of_experience=years_of_experience,
            desired_work_mode=desired_work_mode,
            notice_period="Immediately available",
            relocation_open=False,
            min_salary=90000,
            min_hourly_rate=45.0,
            work_authorization="yes",
            require_sponsorship="no",
            citizenship_country="United States",
            personal_pitch=f"Passionate {primary_role} dedicated to building robust software systems and collaborating with high-velocity teams.",
            proudest_project_highlight="",
            eeo_gender="Decline to self-identify",
            eeo_race="Decline to self-identify",
            eeo_veteran="I am not a protected veteran",
            eeo_disability="No, I do not have a disability",
            custom_answers={},
            skills=[],
            skills_with_years=[],
            experience=[],
            education=[],
            digest_enabled=True,
            digest_frequency="daily",
            digest_min_score=70.0,
        )
        db.add(new_profile)
    
    db.commit()
    token = f"token_{user_id}"
    return AuthResponse(
        success=True,
        token=token,
        user=UserResponse(
            id=new_user.id,
            username=new_user.username,
            full_name=new_user.full_name,
            email=new_user.email or "",
        ),
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
    
    return UserResponse(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        email=user.email or "",
    )
