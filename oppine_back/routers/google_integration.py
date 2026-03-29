"""
Google Business Profile Integration Router.

Endpoints for OAuth connection, location linking, review syncing, and conversion stats.
"""
import logging
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import verify_token
from config import settings
from database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/google",
    tags=["google-integration"],
)


# ============================================================================
# Pydantic Schemas
# ============================================================================

class GoogleAuthUrlResponse(BaseModel):
    url: str


class GoogleCallbackRequest(BaseModel):
    code: str
    state: Optional[str] = None


class GoogleConnectionResponse(BaseModel):
    connected: bool
    google_email: Optional[str] = None
    sync_frequency: Optional[str] = None
    last_synced_at: Optional[str] = None
    is_active: Optional[bool] = None
    connection_error: Optional[str] = None


class GoogleAccountResponse(BaseModel):
    id: str
    name: str


class GoogleLocationResponse(BaseModel):
    id: str
    name: str


class LinkLocationRequest(BaseModel):
    google_account_id: str
    google_location_id: str
    google_location_name: Optional[str] = None


class LocationLinkResponse(BaseModel):
    linked: bool
    google_account_id: Optional[str] = None
    google_location_id: Optional[str] = None
    google_location_name: Optional[str] = None


class SyncFrequencyRequest(BaseModel):
    frequency: str  # 1h, 6h, 12h, 24h


class SyncResponse(BaseModel):
    fetched: Optional[int] = None
    new: Optional[int] = None
    matched: Optional[int] = None
    error: Optional[str] = None


# ============================================================================
# Guard: check if integration is enabled
# ============================================================================

def _check_enabled():
    if not settings.GOOGLE_INTEGRATION_ENABLED:
        raise HTTPException(status_code=404, detail="Google integration is not enabled")


# ============================================================================
# OAuth Endpoints
# ============================================================================

@router.get("/auth/url", response_model=GoogleAuthUrlResponse)
async def get_auth_url(
    token: dict = Depends(verify_token),
):
    """Generate Google OAuth authorization URL."""
    _check_enabled()
    from services.google_business_service import get_authorization_url

    user_uid = token.get("uid")
    state = f"{user_uid}:{secrets.token_urlsafe(16)}"
    url = get_authorization_url(state)
    return {"url": url}


@router.post("/auth/callback", response_model=GoogleConnectionResponse)
async def handle_callback(
    data: GoogleCallbackRequest,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    """Exchange OAuth code for tokens and save connection."""
    _check_enabled()
    from services.google_business_service import exchange_code, save_connection

    user_uid = token.get("uid")

    try:
        token_data = exchange_code(data.code)
    except Exception as e:
        logger.error(f"Google OAuth callback failed for user {user_uid}: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Failed to exchange authorization code: {e}")

    if not token_data.get("refresh_token"):
        raise HTTPException(status_code=400, detail="No refresh token received. Please revoke access and try again.")

    conn = save_connection(db, user_uid, token_data)

    return GoogleConnectionResponse(
        connected=True,
        google_email=conn.google_email,
        sync_frequency=conn.sync_frequency,
        last_synced_at=conn.last_synced_at.isoformat() if conn.last_synced_at else None,
        is_active=conn.is_active,
    )


@router.get("/connection", response_model=GoogleConnectionResponse)
async def get_connection_status(
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    """Get current Google connection status."""
    _check_enabled()
    from services.google_business_service import get_connection

    user_uid = token.get("uid")
    conn = get_connection(db, user_uid)

    if not conn:
        return GoogleConnectionResponse(connected=False)

    return GoogleConnectionResponse(
        connected=True,
        google_email=conn.google_email,
        sync_frequency=conn.sync_frequency,
        last_synced_at=conn.last_synced_at.isoformat() if conn.last_synced_at else None,
        is_active=conn.is_active,
        connection_error=conn.connection_error,
    )


@router.delete("/connection")
async def disconnect_google(
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    """Disconnect Google account."""
    _check_enabled()
    from services.google_business_service import disconnect

    user_uid = token.get("uid")
    success = disconnect(db, user_uid)
    if not success:
        raise HTTPException(status_code=404, detail="No Google connection found")
    return {"success": True}


# ============================================================================
# Account & Location Listing
# ============================================================================

@router.get("/accounts", response_model=list[GoogleAccountResponse])
async def list_google_accounts(
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    """List Google Business Profile accounts."""
    _check_enabled()
    from services.google_business_service import list_accounts, QuotaExceededError

    user_uid = token.get("uid")
    try:
        accounts = list_accounts(db, user_uid)
    except QuotaExceededError as e:
        raise HTTPException(status_code=429, detail=str(e))
    return accounts


@router.get("/accounts/{account_id:path}/locations", response_model=list[GoogleLocationResponse])
async def list_google_locations(
    account_id: str,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    """List locations for a Google Business Profile account."""
    _check_enabled()
    from services.google_business_service import list_locations, QuotaExceededError

    user_uid = token.get("uid")
    try:
        locations = list_locations(db, user_uid, account_id)
    except QuotaExceededError as e:
        raise HTTPException(status_code=429, detail=str(e))
    return locations


# ============================================================================
# Business-Location Linking
# ============================================================================

@router.post("/businesses/{business_id}/link", response_model=LocationLinkResponse)
async def link_business_location(
    business_id: str,
    data: LinkLocationRequest,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    """Link a business to a Google location."""
    _check_enabled()
    from services.google_business_service import link_location
    from routers.feedback import verify_business_access

    user_uid = token.get("uid")
    verify_business_access(business_id, user_uid, db)

    link = link_location(
        db, user_uid, business_id,
        data.google_account_id,
        data.google_location_id,
        data.google_location_name,
    )

    return LocationLinkResponse(
        linked=True,
        google_account_id=link.google_account_id,
        google_location_id=link.google_location_id,
        google_location_name=link.google_location_name,
    )


@router.delete("/businesses/{business_id}/link")
async def unlink_business_location(
    business_id: str,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    """Unlink a business from its Google location."""
    _check_enabled()
    from services.google_business_service import unlink_location
    from routers.feedback import verify_business_access

    user_uid = token.get("uid")
    verify_business_access(business_id, user_uid, db)

    success = unlink_location(db, business_id)
    if not success:
        raise HTTPException(status_code=404, detail="No location link found")
    return {"success": True}


@router.get("/businesses/{business_id}/link", response_model=LocationLinkResponse)
async def get_business_link_status(
    business_id: str,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    """Get link status for a business."""
    _check_enabled()
    from services.google_business_service import get_location_link
    from routers.feedback import verify_business_access

    user_uid = token.get("uid")
    verify_business_access(business_id, user_uid, db)

    link = get_location_link(db, business_id)
    if not link:
        return LocationLinkResponse(linked=False)

    return LocationLinkResponse(
        linked=True,
        google_account_id=link.google_account_id,
        google_location_id=link.google_location_id,
        google_location_name=link.google_location_name,
    )


# ============================================================================
# Settings
# ============================================================================

@router.patch("/settings")
async def update_settings(
    data: SyncFrequencyRequest,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    """Update sync frequency."""
    _check_enabled()
    from services.google_business_service import update_sync_frequency

    user_uid = token.get("uid")
    success = update_sync_frequency(db, user_uid, data.frequency)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid frequency or no connection found")
    return {"success": True}


# ============================================================================
# Reviews & Stats
# ============================================================================

@router.get("/businesses/{business_id}/reviews")
async def get_reviews(
    business_id: str,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    """Get synced Google reviews for a business."""
    _check_enabled()
    from services.google_business_service import get_synced_reviews
    from routers.feedback import verify_business_access

    user_uid = token.get("uid")
    verify_business_access(business_id, user_uid, db)

    return get_synced_reviews(db, business_id, limit, offset)


@router.get("/businesses/{business_id}/conversion-stats")
async def get_business_conversion_stats(
    business_id: str,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    """Get conversion funnel stats for a business."""
    _check_enabled()
    from services.google_business_service import get_conversion_stats
    from routers.feedback import verify_business_access

    user_uid = token.get("uid")
    verify_business_access(business_id, user_uid, db)

    return get_conversion_stats(db, business_id)


@router.post("/businesses/{business_id}/sync", response_model=SyncResponse)
async def trigger_sync(
    business_id: str,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    """Manually trigger review sync for a business."""
    _check_enabled()
    from services.google_business_service import sync_reviews_for_business
    from routers.feedback import verify_business_access

    user_uid = token.get("uid")
    verify_business_access(business_id, user_uid, db)

    result = sync_reviews_for_business(db, business_id)

    if "error" in result:
        return SyncResponse(error=result["error"])

    return SyncResponse(
        fetched=result.get("fetched", 0),
        new=result.get("new", 0),
        matched=result.get("matched", 0),
    )
