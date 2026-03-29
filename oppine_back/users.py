import logging
import uuid
import httpx

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, field_validator
from typing import List, Optional

from auth import verify_token, get_password_hash, verify_password, create_access_token
from database import get_db
from config import settings
import models

logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic Models
class UserBase(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    language: str = "pt-BR"  # pt-BR, en, es
    has_completed_onboarding: bool = False


class UserPreferencesUpdate(BaseModel):
    language: Optional[str] = None
    name: Optional[str] = None


class NotificationPreferences(BaseModel):
    """User notification preferences."""
    notify_whatsapp: bool = True
    notify_email: bool = False
    notify_daily_summary: bool = True  # Daily summary at end of day
    notify_promoters: bool = False
    notify_weekly_summary: bool = True  # Weekly summary on Monday
    quiet_hours_enabled: bool = False
    quiet_hours_start: str = "22:00"
    quiet_hours_end: str = "08:00"


class NotificationPreferencesUpdate(BaseModel):
    """Update notification preferences."""
    notify_whatsapp: Optional[bool] = None
    notify_email: Optional[bool] = None
    notify_daily_summary: Optional[bool] = None
    notify_promoters: Optional[bool] = None
    notify_weekly_summary: Optional[bool] = None
    quiet_hours_enabled: Optional[bool] = None
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None

    @field_validator('email')
    @classmethod
    def normalize_email(cls, v):
        return v.lower()


class UserLogin(BaseModel):
    email: EmailStr
    password: str

    @field_validator('email')
    @classmethod
    def normalize_email(cls, v):
        return v.lower()


class Token(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"


class TokenWithUser(Token):
    user: UserBase


class ProjectBase(BaseModel):
    id: str
    name: str
    owner_id: str


class ProjectDetail(BaseModel):
    """Detailed project info including subscription data."""
    id: str
    name: str
    owner_id: str
    # Subscription fields
    stripe_subscription_id: Optional[str] = None
    subscription_status: str = "active"
    plan_id: Optional[str] = None
    current_period_end: Optional[str] = None
    currency: str = "USD"
    # Usage fields
    daily_usage_count: int = 0
    # Computed tier
    tier: str = "starter"

    class Config:
        from_attributes = True


# Helper function to create local user from Hub data
def _create_local_user_from_hub(db: Session, hub_user: dict, hub_refresh_token: str = None) -> models.User:
    """Create local user and project from Hub user data."""
    hub_user_id = hub_user.get("id")
    hub_email = hub_user.get("email")
    hub_username = hub_user.get("username", hub_email.split("@")[0])
    user_name = f"{hub_user.get('first_name', '')} {hub_user.get('last_name', '')}".strip() or hub_username

    # Check if user already exists locally
    existing_user = db.query(models.User).filter(models.User.email == hub_email).first()
    if existing_user:
        # Check if HubUserLink exists, if not create it
        hub_link = db.query(models.HubUserLink).filter(
            models.HubUserLink.hub_user_id == hub_user_id
        ).first()
        if not hub_link:
            hub_link = models.HubUserLink(
                id=str(uuid.uuid4()),
                local_user_id=existing_user.uid,
                hub_user_id=hub_user_id,
                hub_email=hub_email,
                hub_username=hub_username,
                hub_refresh_token=hub_refresh_token,
                is_sso_user=True
            )
            db.add(hub_link)
            db.commit()
        elif hub_refresh_token:
            # Update the refresh token
            hub_link.hub_refresh_token = hub_refresh_token
            db.commit()
        return existing_user

    # Create new local user
    user_id = str(uuid.uuid4())
    db_user = models.User(
        uid=user_id,
        email=hub_email,
        name=user_name,
        password_hash=""  # No local password for Hub users
    )
    db.add(db_user)
    db.flush()

    # Create Hub link
    hub_link = models.HubUserLink(
        id=str(uuid.uuid4()),
        local_user_id=user_id,
        hub_user_id=hub_user_id,
        hub_email=hub_email,
        hub_username=hub_username,
        hub_refresh_token=hub_refresh_token,
        is_sso_user=True
    )
    db.add(hub_link)

    # Create default project
    project_id = str(uuid.uuid4())
    default_project = models.Project(
        id=project_id,
        name=user_name or "Meu Negócio",
        owner_id=user_id
    )
    db.add(default_project)

    # Add user as admin
    member = models.ProjectMember(
        project_id=project_id,
        user_id=user_id,
        role=models.Role.ADMIN
    )
    db.add(member)

    db.commit()
    db.refresh(db_user)

    logger.info(f"Created local user from Hub: {hub_email} (Hub ID: {hub_user_id})")
    return db_user


# Auth Endpoints
@router.post("/auth/register", response_model=TokenWithUser)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """Register a new user via Angular Hub."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Register user in Angular Hub
            response = await client.post(
                f"{settings.ANGULAR_HUB_API_URL}/api/auth/register/",
                json={
                    "email": user_data.email,
                    "password": user_data.password,
                    "password2": user_data.password,  # Use same password for confirmation
                    "first_name": user_data.name.split()[0] if user_data.name else "",
                    "last_name": " ".join(user_data.name.split()[1:]) if user_data.name and len(user_data.name.split()) > 1 else ""
                }
            )

            if response.status_code == 400:
                error_data = response.json()
                detail = error_data.get("email", error_data.get("password", error_data.get("detail", "Registration failed")))
                if isinstance(detail, list):
                    detail = detail[0]
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=detail
                )

            if response.status_code != 201:
                logger.warning(f"Hub register failed: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Registration failed"
                )

            data = response.json()
            hub_tokens = data.get("tokens", {})
            hub_refresh_token = hub_tokens.get("refresh")

            hub_user = {
                "id": data.get("id"),
                "email": data.get("email"),
                "username": data.get("username"),
                "first_name": data.get("first_name", ""),
                "last_name": data.get("last_name", ""),
            }

            # Create local user linked to Hub (with refresh token for billing)
            db_user = _create_local_user_from_hub(db, hub_user, hub_refresh_token)

            # Create LOCAL access token
            access_token = create_access_token(data={
                "uid": db_user.uid,
                "email": db_user.email,
                "name": db_user.name,
                "hub_user_id": hub_user.get("id")
            })

            logger.info(f"User registered via Hub: {db_user.email}")

            return TokenWithUser(
                access_token=access_token,
                refresh_token=hub_refresh_token,
                user=UserBase(
                    id=db_user.uid,
                    email=db_user.email,
                    name=db_user.name,
                    language=db_user.language or "pt-BR",
                    has_completed_onboarding=bool(db_user.has_completed_onboarding),
                )
            )

    except httpx.RequestError as e:
        logger.error(f"Error connecting to Angular Hub: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not connect to authentication server"
        )


@router.post("/auth/login", response_model=TokenWithUser)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """Login via Angular Hub."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Login to Angular Hub
            response = await client.post(
                f"{settings.ANGULAR_HUB_API_URL}/api/auth/login/",
                json={
                    "email": user_data.email,
                    "password": user_data.password
                }
            )

            if response.status_code != 200:
                logger.warning(f"Hub login failed: {response.status_code}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid email or password"
                )

            data = response.json()
            hub_tokens = data.get("tokens", {})
            hub_refresh_token = hub_tokens.get("refresh")

            hub_user = {
                "id": data.get("id"),
                "email": data.get("email"),
                "username": data.get("username"),
                "first_name": data.get("first_name", ""),
                "last_name": data.get("last_name", ""),
            }

            # Get or create local user (with refresh token for billing)
            db_user = _create_local_user_from_hub(db, hub_user, hub_refresh_token)

            # Create LOCAL access token
            access_token = create_access_token(data={
                "uid": db_user.uid,
                "email": db_user.email,
                "name": db_user.name,
                "hub_user_id": hub_user.get("id")
            })

            return TokenWithUser(
                access_token=access_token,
                refresh_token=hub_refresh_token,
                user=UserBase(
                    id=db_user.uid,
                    email=db_user.email,
                    name=db_user.name,
                    language=db_user.language or "pt-BR",
                    has_completed_onboarding=bool(db_user.has_completed_onboarding),
                )
            )

    except httpx.RequestError as e:
        logger.error(f"Error connecting to Angular Hub: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not connect to authentication server"
        )


@router.get("/auth/me", response_model=UserBase)
def get_current_user(token: dict = Depends(verify_token), db: Session = Depends(get_db)):
    """Get current authenticated user."""
    user_id = token.get("uid")
    user = db.query(models.User).filter(models.User.uid == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return UserBase(
        id=user.uid,
        email=user.email,
        name=user.name,
        language=user.language or "pt-BR",
        has_completed_onboarding=bool(user.has_completed_onboarding),
    )


@router.patch("/auth/me", response_model=UserBase)
def update_user_preferences(
    preferences: UserPreferencesUpdate,
    token: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Update current user preferences (name, language)."""
    user_id = token.get("uid")
    user = db.query(models.User).filter(models.User.uid == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Update fields if provided
    if preferences.language is not None:
        # Validate language
        valid_languages = ["pt-BR", "en", "es"]
        if preferences.language not in valid_languages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid language. Must be one of: {', '.join(valid_languages)}"
            )
        user.language = preferences.language

    if preferences.name is not None:
        user.name = preferences.name

    db.commit()
    db.refresh(user)

    return UserBase(
        id=user.uid,
        email=user.email,
        name=user.name,
        language=user.language or "pt-BR",
        has_completed_onboarding=bool(user.has_completed_onboarding),
    )


# Onboarding Endpoints
@router.post("/auth/me/complete-onboarding", response_model=UserBase)
def complete_onboarding(
    token: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Mark user as having completed onboarding."""
    user_id = token.get("uid")
    user = db.query(models.User).filter(models.User.uid == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    user.has_completed_onboarding = True
    db.commit()
    db.refresh(user)

    return UserBase(
        id=user.uid,
        email=user.email,
        name=user.name,
        language=user.language or "pt-BR",
        has_completed_onboarding=True,
    )


# Notification Preferences Endpoints
@router.get("/auth/me/notifications", response_model=NotificationPreferences)
def get_notification_preferences(
    token: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get current user's notification preferences."""
    user_id = token.get("uid")
    user = db.query(models.User).filter(models.User.uid == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return NotificationPreferences(
        notify_whatsapp=user.notify_whatsapp if user.notify_whatsapp is not None else True,
        notify_email=user.notify_email if user.notify_email is not None else False,
        notify_daily_summary=user.notify_daily_summary if user.notify_daily_summary is not None else True,
        notify_promoters=user.notify_promoters if user.notify_promoters is not None else False,
        notify_weekly_summary=user.notify_weekly_summary if user.notify_weekly_summary is not None else True,
        quiet_hours_enabled=user.quiet_hours_enabled if user.quiet_hours_enabled is not None else False,
        quiet_hours_start=user.quiet_hours_start or "22:00",
        quiet_hours_end=user.quiet_hours_end or "08:00"
    )


@router.patch("/auth/me/notifications", response_model=NotificationPreferences)
def update_notification_preferences(
    preferences: NotificationPreferencesUpdate,
    token: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Update current user's notification preferences."""
    user_id = token.get("uid")
    user = db.query(models.User).filter(models.User.uid == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Update fields if provided
    if preferences.notify_whatsapp is not None:
        user.notify_whatsapp = preferences.notify_whatsapp
    if preferences.notify_email is not None:
        user.notify_email = preferences.notify_email
    if preferences.notify_daily_summary is not None:
        user.notify_daily_summary = preferences.notify_daily_summary
    if preferences.notify_promoters is not None:
        user.notify_promoters = preferences.notify_promoters
    if preferences.notify_weekly_summary is not None:
        user.notify_weekly_summary = preferences.notify_weekly_summary
    if preferences.quiet_hours_enabled is not None:
        user.quiet_hours_enabled = preferences.quiet_hours_enabled
    if preferences.quiet_hours_start is not None:
        user.quiet_hours_start = preferences.quiet_hours_start
    if preferences.quiet_hours_end is not None:
        user.quiet_hours_end = preferences.quiet_hours_end

    db.commit()
    db.refresh(user)

    logger.info(f"Updated notification preferences for user {user_id}")

    return NotificationPreferences(
        notify_whatsapp=user.notify_whatsapp if user.notify_whatsapp is not None else True,
        notify_email=user.notify_email if user.notify_email is not None else False,
        notify_daily_summary=user.notify_daily_summary if user.notify_daily_summary is not None else True,
        notify_promoters=user.notify_promoters if user.notify_promoters is not None else False,
        notify_weekly_summary=user.notify_weekly_summary if user.notify_weekly_summary is not None else True,
        quiet_hours_enabled=user.quiet_hours_enabled if user.quiet_hours_enabled is not None else False,
        quiet_hours_start=user.quiet_hours_start or "22:00",
        quiet_hours_end=user.quiet_hours_end or "08:00"
    )


# Project Endpoints
@router.get("/projects", response_model=List[ProjectBase])
def get_projects(token: dict = Depends(verify_token), db: Session = Depends(get_db)):
    user_id = token.get("uid")
    projects = db.query(models.Project).join(models.ProjectMember).filter(models.ProjectMember.user_id == user_id).all()
    return projects


class ProjectCreate(BaseModel):
    name: str


@router.post("/projects", response_model=ProjectBase)
def create_project(project: ProjectCreate, token: dict = Depends(verify_token), db: Session = Depends(get_db)):
    user_id = token.get("uid")

    project_id = str(uuid.uuid4())
    new_project = models.Project(id=project_id, name=project.name, owner_id=user_id)
    db.add(new_project)

    # Add creator as admin
    member = models.ProjectMember(project_id=project_id, user_id=user_id, role=models.Role.ADMIN)
    db.add(member)

    db.commit()
    db.refresh(new_project)

    return new_project


@router.get("/projects/{project_id}", response_model=ProjectDetail)
def get_project(project_id: str, token: dict = Depends(verify_token), db: Session = Depends(get_db)):
    """Get detailed information about a specific project including subscription data."""
    user_id = token.get("uid")

    # Check if user has access to the project
    membership = db.query(models.ProjectMember).filter(
        models.ProjectMember.project_id == project_id,
        models.ProjectMember.user_id == user_id
    ).first()

    if not membership:
        raise HTTPException(status_code=403, detail="Access denied to this project")

    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Determine tier from plan_id
    tier = settings.get_tier_from_price_id(project.plan_id)

    return ProjectDetail(
        id=project.id,
        name=project.name,
        owner_id=project.owner_id,
        stripe_subscription_id=project.stripe_subscription_id,
        subscription_status=project.subscription_status or "active",
        plan_id=project.plan_id,
        current_period_end=project.current_period_end.isoformat() if project.current_period_end else None,
        currency=project.currency or "USD",
        daily_usage_count=project.daily_usage_count or 0,
        tier=tier
    )
