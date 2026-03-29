"""
Angular Hub Integration API Routes.
Handles SSO authentication, webhooks and subscription endpoints.
"""
import hmac
import hashlib
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from config import settings
from models import User, HubUserLink, SubscriptionCache, DailyUsage, Project, ProjectMember, Role, CouponValidationAttempt
from services.angular_hub_service import angular_hub_service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/hub",
    tags=["hub"]
)

security = HTTPBearer(auto_error=False)


# ============================================================================
# Schemas
# ============================================================================

class WebhookPayload(BaseModel):
    """Webhook payload from Angular Hub."""
    event: str
    timestamp: str
    data: dict


class SubscriptionInfo(BaseModel):
    """Subscription info response."""
    plan_id: Optional[str] = None
    plan_name: str
    plan_slug: str
    status: str
    is_active: bool
    limits: dict
    features: dict
    usage: dict


class TokenRefreshRequest(BaseModel):
    """Token refresh request."""
    refresh_token: str


class TokenRefreshResponse(BaseModel):
    """Token refresh response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class HubUserInfo(BaseModel):
    """User info from Hub SSO."""
    uid: str
    email: str
    username: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    hub_user_id: int


class LoginRequest(BaseModel):
    """Login request - proxied to Angular Hub."""
    email: str
    password: str


class RegisterRequest(BaseModel):
    """Register request - proxied to Angular Hub."""
    email: str
    password: str
    password2: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class LoginResponse(BaseModel):
    """Login response with tokens and user info."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class CheckoutRequest(BaseModel):
    """Checkout request for creating a subscription."""
    plan_slug: str
    success_url: str
    cancel_url: str
    coupon_code: Optional[str] = None  # Optional coupon/promo code


class PortalRequest(BaseModel):
    """Portal request for managing subscription."""
    return_url: str


class PricePreviewResponse(BaseModel):
    """Response with price preview including discount (unified with coupon validation)."""
    # Plan data
    plan_name: str
    plan_slug: str
    billing_period: str  # "Mensal" or "Anual"
    currency: str  # "BRL", "USD"

    # Prices (Decimal string with 2 decimal places)
    original_price: str  # "99.90"
    discount_amount: str  # "19.98"
    final_price: str  # "79.92"

    # Coupon data
    coupon_code: Optional[str] = None  # Code provided (or null if not provided)
    coupon_valid: Optional[bool] = None  # null=not provided, true=valid, false=invalid
    coupon_error: Optional[str] = None  # Error message (if coupon invalid)
    discount_type: Optional[str] = None  # "percent" or "fixed"
    discount_percent: Optional[float] = None  # Discount percentage (0-100)


# ============================================================================
# SSO Authentication Dependency
# ============================================================================

async def get_current_user_hub(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Gets current user from Angular Hub SSO token.
    Creates or updates local user record as needed.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not credentials:
        raise credentials_exception

    token = credentials.credentials

    # Validate token with Angular Hub
    hub_user = await angular_hub_service.validate_token(token)

    if not hub_user:
        raise credentials_exception

    hub_user_id = hub_user.get("user_id")
    hub_email = hub_user.get("email")

    if not hub_user_id or not hub_email:
        raise credentials_exception

    # Find or create local user
    user = await _get_or_create_user(db, hub_user)

    if not user:
        raise credentials_exception

    # Store token in request state for later use (subscription checks)
    request.state.hub_token = token
    request.state.hub_user_id = hub_user_id

    return user


async def _get_or_create_user(
    db: Session,
    hub_user: Dict[str, Any]
) -> Optional[User]:
    """
    Gets existing user or creates a new one from Angular Hub data.
    """
    hub_user_id = hub_user.get("user_id")
    hub_email = hub_user.get("email")
    hub_username = hub_user.get("username", hub_email.split("@")[0])

    # Check if we have a linked user
    hub_link = db.query(HubUserLink).filter(
        HubUserLink.hub_user_id == hub_user_id
    ).first()

    if hub_link:
        # Return existing linked user
        user = db.query(User).filter(
            User.uid == hub_link.local_user_id
        ).first()

        if user:
            # Update email if changed
            if user.email != hub_email:
                user.email = hub_email
                hub_link.hub_email = hub_email
                db.commit()
            return user

    # Check if user exists by email
    user = db.query(User).filter(
        User.email == hub_email
    ).first()

    if user:
        # Link existing user to Hub
        hub_link = HubUserLink(
            id=str(uuid.uuid4()),
            local_user_id=user.uid,
            hub_user_id=hub_user_id,
            hub_email=hub_email,
            hub_username=hub_username,
            is_sso_user=True
        )
        db.add(hub_link)
        db.commit()
        return user

    # Create new user
    try:
        user_id = str(uuid.uuid4())
        user_name = f"{hub_user.get('first_name', '')} {hub_user.get('last_name', '')}".strip() or hub_username

        user = User(
            uid=user_id,
            email=hub_email,
            name=user_name,
            password_hash="",  # No password for SSO users
        )
        db.add(user)
        db.flush()

        # Create Hub link
        hub_link = HubUserLink(
            id=str(uuid.uuid4()),
            local_user_id=user.uid,
            hub_user_id=hub_user_id,
            hub_email=hub_email,
            hub_username=hub_username,
            is_sso_user=True
        )
        db.add(hub_link)

        # Create default project for new user
        project_id = str(uuid.uuid4())
        default_project = Project(
            id=project_id,
            name=user_name or "Meu Projeto",
            owner_id=user_id
        )
        db.add(default_project)

        # Add user as admin of the default project
        member = ProjectMember(
            project_id=project_id,
            user_id=user_id,
            role=Role.ADMIN
        )
        db.add(member)

        db.commit()
        db.refresh(user)

        logger.info(f"Created new SSO user: {user.email} (Hub ID: {hub_user_id}) with default project")
        return user

    except Exception as e:
        logger.error(f"Error creating SSO user: {e}")
        db.rollback()
        return None


async def get_subscription(
    request: Request,
    current_user: User = Depends(get_current_user_hub),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Gets user's subscription from Angular Hub.
    Uses caching for performance.
    """
    hub_token = getattr(request.state, "hub_token", None)
    hub_user_id = getattr(request.state, "hub_user_id", None)

    if not hub_token or not hub_user_id:
        return angular_hub_service._get_starter_plan()

    # Check local cache first
    cached = db.query(SubscriptionCache).filter(
        SubscriptionCache.hub_user_id == hub_user_id
    ).first()

    if cached and not cached.is_expired():
        return {
            "plan_name": cached.plan_name,
            "plan_slug": cached.plan_slug,
            "status": cached.status,
            "is_active": cached.is_active,
            "limits": cached.limits or {},
            "features": cached.features or {},
            "usage": cached.usage or {},
        }

    # Fetch from Angular Hub
    subscription = await angular_hub_service.get_user_subscription(
        hub_user_id,
        hub_token
    )

    if subscription:
        # Update local cache
        await _update_subscription_cache(db, hub_user_id, subscription)

    return subscription or angular_hub_service._get_starter_plan()


async def _update_subscription_cache(
    db: Session,
    hub_user_id: int,
    subscription: Dict[str, Any]
):
    """
    Updates local subscription cache.
    """
    try:
        cached = db.query(SubscriptionCache).filter(
            SubscriptionCache.hub_user_id == hub_user_id
        ).first()

        expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)

        if cached:
            cached.plan_name = subscription.get("plan_name", "Starter")
            cached.plan_slug = subscription.get("plan_slug", "oppine-starter-monthly")
            cached.status = subscription.get("status", "active")
            cached.is_active = subscription.get("is_active", True)
            cached.limits = subscription.get("limits", {})
            cached.features = subscription.get("features", {})
            cached.usage = subscription.get("usage", {})
            cached.expires_at = expires_at
            cached.cached_at = datetime.now(timezone.utc)
        else:
            cached = SubscriptionCache(
                id=str(uuid.uuid4()),
                hub_user_id=hub_user_id,
                plan_name=subscription.get("plan_name", "Starter"),
                plan_slug=subscription.get("plan_slug", "oppine-starter-monthly"),
                status=subscription.get("status", "active"),
                is_active=subscription.get("is_active", True),
                expires_at=expires_at
            )
            cached.limits = subscription.get("limits", {})
            cached.features = subscription.get("features", {})
            cached.usage = subscription.get("usage", {})
            db.add(cached)

        db.commit()

    except Exception as e:
        logger.error(f"Error updating subscription cache: {e}")
        db.rollback()


# ============================================================================
# Webhook Endpoints
# ============================================================================

@router.post("/webhook")
async def handle_webhook(
    request: Request,
    payload: WebhookPayload,
    x_hub_signature: Optional[str] = Header(None, alias="X-Hub-Signature"),
    db: Session = Depends(get_db)
):
    """
    Receives webhooks from Angular Hub for subscription updates.

    Events handled:
    - subscription.created
    - subscription.updated
    - subscription.canceled
    - subscription.payment_failed
    """
    # Verify webhook signature
    if settings.ANGULAR_HUB_WEBHOOK_SECRET:
        if not x_hub_signature:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing webhook signature"
            )

        body = await request.body()
        expected_signature = hmac.new(
            settings.ANGULAR_HUB_WEBHOOK_SECRET.encode(),
            body,
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(f"sha256={expected_signature}", x_hub_signature):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook signature"
            )

    event = payload.event
    data = payload.data

    logger.info(f"Received webhook: {event}")

    try:
        if event == "subscription.created":
            await _handle_subscription_created(db, data)
        elif event == "subscription.updated":
            await _handle_subscription_updated(db, data)
        elif event == "subscription.canceled":
            await _handle_subscription_canceled(db, data)
        elif event == "subscription.payment_failed":
            await _handle_payment_failed(db, data)
        else:
            logger.warning(f"Unhandled webhook event: {event}")

        return {"status": "ok", "event": event}

    except Exception as e:
        logger.error(f"Error processing webhook {event}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing webhook: {str(e)}"
        )


async def _handle_subscription_created(db: Session, data: dict):
    """Handle new subscription creation."""
    hub_user_id = data.get("user_id")
    if not hub_user_id:
        return

    # Clear any cached data
    angular_hub_service.clear_cache(hub_user_id)

    # Remove old cache from DB
    db.query(SubscriptionCache).filter(
        SubscriptionCache.hub_user_id == hub_user_id
    ).delete()
    db.commit()

    logger.info(f"Subscription created for Hub user {hub_user_id}")


async def _handle_subscription_updated(db: Session, data: dict):
    """Handle subscription updates (plan change, renewal, etc)."""
    hub_user_id = data.get("user_id")
    if not hub_user_id:
        return

    # Clear caches to force refresh
    angular_hub_service.clear_cache(hub_user_id)

    db.query(SubscriptionCache).filter(
        SubscriptionCache.hub_user_id == hub_user_id
    ).delete()
    db.commit()

    logger.info(f"Subscription updated for Hub user {hub_user_id}")


async def _handle_subscription_canceled(db: Session, data: dict):
    """Handle subscription cancellation."""
    hub_user_id = data.get("user_id")
    if not hub_user_id:
        return

    # Clear caches
    angular_hub_service.clear_cache(hub_user_id)

    # Update cache to starter plan (default when no subscription)
    cached = db.query(SubscriptionCache).filter(
        SubscriptionCache.hub_user_id == hub_user_id
    ).first()

    if cached:
        starter_plan = angular_hub_service._get_starter_plan()
        cached.plan_name = starter_plan["plan_name"]
        cached.plan_slug = starter_plan["plan_slug"]
        cached.status = "canceled"
        cached.is_active = False
        cached.limits = starter_plan["limits"]
        cached.features = starter_plan["features"]
        db.commit()

    logger.info(f"Subscription canceled for Hub user {hub_user_id}")


async def _handle_payment_failed(db: Session, data: dict):
    """Handle payment failure."""
    hub_user_id = data.get("user_id")
    if not hub_user_id:
        return

    # Update cache status
    cached = db.query(SubscriptionCache).filter(
        SubscriptionCache.hub_user_id == hub_user_id
    ).first()

    if cached:
        cached.status = "payment_failed"
        db.commit()

    logger.warning(f"Payment failed for Hub user {hub_user_id}")


# ============================================================================
# User Endpoints
# ============================================================================

@router.get("/me/subscription", response_model=SubscriptionInfo)
async def get_my_subscription(
    request: Request,
    db: Session = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    """
    Get current user's subscription info.
    Returns plan details, limits, features, and current usage.
    Uses local Oppine token authentication.
    """
    from auth import verify_token as local_verify_token
    import httpx

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    # Validate local token to get hub_user_id
    try:
        payload = local_verify_token(credentials)
        hub_user_id = payload.get("hub_user_id")
    except HTTPException:
        raise

    if not hub_user_id:
        # User not linked to Hub - return starter plan
        return angular_hub_service._get_starter_plan()

    # Get Hub link with refresh token
    hub_link = db.query(HubUserLink).filter(
        HubUserLink.hub_user_id == hub_user_id
    ).first()

    if not hub_link or not hub_link.hub_refresh_token:
        # No refresh token stored - return starter plan
        return angular_hub_service._get_starter_plan()

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Get fresh access token using stored refresh token
            refresh_response = await client.post(
                f"{settings.ANGULAR_HUB_API_URL}/api/auth/token/refresh/",
                json={"refresh": hub_link.hub_refresh_token}
            )

            if refresh_response.status_code != 200:
                logger.warning(f"Failed to refresh Hub token: {refresh_response.status_code}")
                return angular_hub_service._get_starter_plan()

            refresh_data = refresh_response.json()
            hub_access_token = refresh_data.get("access")

            # Update stored refresh token if a new one was provided
            new_refresh = refresh_data.get("refresh")
            if new_refresh and new_refresh != hub_link.hub_refresh_token:
                hub_link.hub_refresh_token = new_refresh
                db.commit()

            # Get subscription from Hub using the fresh token
            subscription = await angular_hub_service.get_user_subscription(
                hub_user_id,
                hub_access_token,
                force_refresh=True
            )

            return subscription or angular_hub_service._get_starter_plan()

    except Exception as e:
        logger.error(f"Error fetching subscription: {e}")
        return angular_hub_service._get_starter_plan()


@router.post("/me/subscription/refresh")
async def refresh_subscription(
    request: Request,
    current_user: User = Depends(get_current_user_hub),
    db: Session = Depends(get_db)
):
    """
    Force refresh subscription info from Angular Hub.
    Clears local cache and fetches fresh data.
    """
    hub_user_id = getattr(request.state, "hub_user_id", None)

    if hub_user_id:
        # Clear caches
        angular_hub_service.clear_cache(hub_user_id)

        db.query(SubscriptionCache).filter(
            SubscriptionCache.hub_user_id == hub_user_id
        ).delete()
        db.commit()

    # Fetch fresh data
    subscription = await get_subscription(request, current_user, db)
    return subscription


@router.post("/token/refresh", response_model=TokenRefreshResponse)
async def refresh_hub_token(request_body: TokenRefreshRequest):
    """
    Refresh Angular Hub access token.
    Proxies to Angular Hub API.
    """
    result = await angular_hub_service.refresh_token(request_body.refresh_token)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

    return TokenRefreshResponse(
        access_token=result["access_token"],
        refresh_token=result["refresh_token"]
    )


# ============================================================================
# Plans & Billing Endpoints
# ============================================================================

@router.get("/billing/plans")
async def get_billing_plans():
    """
    Get available subscription plans for Oppine.
    Fetches from Angular Hub with SaaS filter.
    """
    plans = await angular_hub_service.get_available_plans()
    return {"plans": plans}


@router.get("/billing/price-preview", response_model=PricePreviewResponse)
async def get_price_preview(
    request: Request,
    plan_slug: str,
    coupon_code: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get price preview for a plan, optionally with a coupon applied.
    Proxies to Angular Hub for price calculation.
    Includes rate limiting when coupon_code is provided to prevent brute-force.
    Returns original price, discount amount, final price, and coupon validation status.
    """
    import httpx

    # Rate limiting check when coupon is provided (to prevent brute-force)
    if coupon_code:
        ip_address = request.client.host if request.client else "unknown"
        five_min_ago = datetime.now(timezone.utc) - timedelta(minutes=5)

        recent_attempts = db.query(CouponValidationAttempt).filter(
            CouponValidationAttempt.ip_address == ip_address,
            CouponValidationAttempt.attempted_at > five_min_ago
        ).count()

        if recent_attempts >= 10:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Muitas tentativas. Aguarde alguns minutos."
            )

        # Record this coupon validation attempt
        attempt = CouponValidationAttempt(
            ip_address=ip_address,
            coupon_code=coupon_code[:50] if coupon_code else None,
            was_valid=False
        )
        db.add(attempt)
        db.commit()

    try:
        # Proxy to Angular Hub for price preview
        # New endpoint format: GET /api/billing/plans/{slug}/price-preview/?token=...
        async with httpx.AsyncClient(timeout=10.0) as client:
            params = {
                "token": "hub_internal_8x7k2m9p4q"
            }
            if coupon_code:
                params["coupon_code"] = coupon_code

            hub_response = await client.get(
                f"{settings.ANGULAR_HUB_API_URL}/api/billing/plans/{plan_slug}/price-preview/",
                params=params
            )

            if hub_response.status_code == 200:
                data = hub_response.json()

                # Update coupon attempt if coupon was valid
                if coupon_code and data.get("coupon_valid") is True:
                    attempt.was_valid = True
                    db.commit()

                return PricePreviewResponse(
                    # Plan data
                    plan_name=data.get("plan_name", ""),
                    plan_slug=data.get("plan_slug", plan_slug),
                    billing_period=data.get("billing_period", "Mensal"),
                    currency=data.get("currency", "BRL"),
                    # Prices (string format from Hub)
                    original_price=data.get("original_price", "0.00"),
                    discount_amount=data.get("discount_amount", "0.00"),
                    final_price=data.get("final_price", "0.00"),
                    # Coupon data
                    coupon_code=data.get("coupon_code"),
                    coupon_valid=data.get("coupon_valid"),
                    coupon_error=data.get("coupon_error"),
                    discount_type=data.get("discount_type"),
                    discount_percent=data.get("discount_percent")
                )
            elif hub_response.status_code == 404:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Plan '{plan_slug}' not found"
                )
            else:
                logger.warning(f"Hub price preview failed: {hub_response.status_code} - {hub_response.text}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Could not get price preview"
                )

    except httpx.RequestError as e:
        logger.error(f"Error connecting to Hub for price preview: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not connect to pricing server"
        )


@router.get("/plans")
async def get_available_plans():
    """
    Get available subscription plans for Oppine.
    Fetches from Angular Hub with SaaS filter.
    (Legacy endpoint - use /billing/plans)
    """
    plans = await angular_hub_service.get_available_plans()
    return {"plans": plans}


@router.post("/billing/checkout")
async def create_checkout(
    request: Request,
    checkout_request: CheckoutRequest,
    db: Session = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    """
    Create a Stripe checkout session via Angular Hub.
    Returns the checkout URL for the user to complete payment.

    The Hub API expects:
    - saas_id: UUID of the SaaS
    - plan_id: UUID of the plan
    - success_url: URL to redirect on success
    - cancel_url: URL to redirect on cancel
    """
    from auth import verify_token as local_verify_token

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    # Validate local token to get hub_user_id
    try:
        payload = local_verify_token(credentials)
        hub_user_id = payload.get("hub_user_id")
    except HTTPException:
        raise

    if not hub_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not linked to Angular Hub"
        )

    # Get Hub link with refresh token
    hub_link = db.query(HubUserLink).filter(
        HubUserLink.hub_user_id == hub_user_id
    ).first()

    if not hub_link:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not linked to Angular Hub"
        )

    import httpx

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # First, get a fresh access token using the stored refresh token
            hub_access_token = None
            if hub_link.hub_refresh_token:
                refresh_response = await client.post(
                    f"{settings.ANGULAR_HUB_API_URL}/api/auth/token/refresh/",
                    json={"refresh": hub_link.hub_refresh_token}
                )
                if refresh_response.status_code == 200:
                    refresh_data = refresh_response.json()
                    hub_access_token = refresh_data.get("access")
                    # Update stored refresh token if a new one was provided
                    new_refresh = refresh_data.get("refresh")
                    if new_refresh and new_refresh != hub_link.hub_refresh_token:
                        hub_link.hub_refresh_token = new_refresh
                        db.commit()
                else:
                    logger.warning(f"Failed to refresh Hub token: {refresh_response.status_code}")

            if not hub_access_token:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session expired. Please login again."
                )

            # Get plan ID from slug using the same method as /billing/plans endpoint
            # This ensures consistent plan retrieval (the saas param doesn't work reliably on Hub)
            available_plans = await angular_hub_service.get_available_plans()
            logger.info(f"Available plans: {[p.get('slug') for p in available_plans]}")
            plan_info = next((p for p in available_plans if p.get("slug") == checkout_request.plan_slug), None)
            logger.info(f"Looking for plan '{checkout_request.plan_slug}', found: {plan_info is not None}")

            if not plan_info:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Plan '{checkout_request.plan_slug}' not found"
                )

            plan_id = plan_info.get("id")

            # Use configured SaaS ID for Oppine
            saas_id = settings.ANGULAR_HUB_SAAS_ID
            if not saas_id:
                logger.error("ANGULAR_HUB_SAAS_ID not configured")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Billing not configured. Contact support."
                )

            # Build checkout payload
            checkout_payload = {
                "saas_id": saas_id,
                "plan_id": plan_id,
                "success_url": checkout_request.success_url,
                "cancel_url": checkout_request.cancel_url,
                "trial": False,
            }

            # Add coupon code if provided
            if checkout_request.coupon_code:
                checkout_payload["coupon_code"] = checkout_request.coupon_code
                checkout_payload["promotion_code"] = checkout_request.coupon_code
                logger.info(f"Adding coupon to checkout: {checkout_request.coupon_code}")

            # Create checkout session via Hub API with user authentication
            checkout_response = await client.post(
                f"{settings.ANGULAR_HUB_API_URL}/api/billing/subscriptions/",
                headers={
                    "Authorization": f"Bearer {hub_access_token}",
                    "Content-Type": "application/json"
                },
                json=checkout_payload
            )

            if checkout_response.status_code in (200, 201):
                data = checkout_response.json()
                checkout_url = data.get("checkout_url") or data.get("url")
                if checkout_url:
                    logger.info(f"Checkout created for user {hub_user_id}, plan {checkout_request.plan_slug}")
                    return {"url": checkout_url}
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="No checkout URL returned from Hub"
                )

            logger.warning(f"Hub checkout failed: {checkout_response.status_code} - {checkout_response.text}")
            raise HTTPException(
                status_code=checkout_response.status_code,
                detail=f"Failed to create checkout: {checkout_response.text}"
            )

    except httpx.RequestError as e:
        logger.error(f"Error connecting to Angular Hub: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not connect to billing server"
        )


@router.post("/billing/portal")
async def create_billing_portal(
    request: Request,
    portal_request: PortalRequest,
    db: Session = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    """
    Create a Stripe billing portal session via Angular Hub.
    Returns the portal URL for the user to manage their subscription.
    """
    from auth import verify_token as local_verify_token

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    # Validate local token to get hub_user_id
    try:
        payload = local_verify_token(credentials)
        hub_user_id = payload.get("hub_user_id")
    except HTTPException:
        raise

    if not hub_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not linked to Angular Hub"
        )

    # Get Hub link with refresh token
    hub_link = db.query(HubUserLink).filter(
        HubUserLink.hub_user_id == hub_user_id
    ).first()

    if not hub_link:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not linked to Angular Hub"
        )

    import httpx

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Get fresh access token using stored refresh token
            hub_access_token = None
            if hub_link.hub_refresh_token:
                refresh_response = await client.post(
                    f"{settings.ANGULAR_HUB_API_URL}/api/auth/token/refresh/",
                    json={"refresh": hub_link.hub_refresh_token}
                )
                if refresh_response.status_code == 200:
                    refresh_data = refresh_response.json()
                    hub_access_token = refresh_data.get("access")
                    new_refresh = refresh_data.get("refresh")
                    if new_refresh and new_refresh != hub_link.hub_refresh_token:
                        hub_link.hub_refresh_token = new_refresh
                        db.commit()
                else:
                    logger.warning(f"Failed to refresh Hub token: {refresh_response.status_code} - {refresh_response.text}")

            if not hub_access_token:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session expired. Please login again."
                )

            # Get subscription for this user using the specific endpoint
            # This is the same endpoint used by /hub/me/subscription that works correctly
            logger.info(f"Fetching subscription for hub_user_id={hub_user_id}, saas_slug={settings.ANGULAR_HUB_SAAS_SLUG}")
            sub_response = await client.get(
                f"{settings.ANGULAR_HUB_API_URL}/api/billing/subscriptions/user/{settings.ANGULAR_HUB_SAAS_SLUG}/",
                headers={"Authorization": f"Bearer {hub_access_token}"}
            )

            logger.info(f"Subscription response: {sub_response.status_code}")

            if sub_response.status_code == 404:
                logger.warning(f"No subscription found for SaaS {settings.ANGULAR_HUB_SAAS_SLUG}")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No active subscription found. Please subscribe to a plan first."
                )

            if sub_response.status_code != 200:
                logger.error(f"Failed to get subscription: {sub_response.status_code} - {sub_response.text}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to get subscription"
                )

            sub_info = sub_response.json()
            logger.info(f"Subscription data: {sub_info}")

            # Check if subscription is active
            if not sub_info.get("is_active", False):
                logger.warning(f"Subscription is not active: {sub_info}")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No active subscription found. Please subscribe to a plan first."
                )

            # Get subscription ID for portal
            sub_id = sub_info.get("id") or sub_info.get("subscription_id")
            if not sub_id:
                logger.error(f"Subscription has no ID: {sub_info}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Invalid subscription data"
                )

            logger.info(f"Creating portal for subscription_id={sub_id}")
            portal_response = await client.get(
                f"{settings.ANGULAR_HUB_API_URL}/api/billing/subscriptions/{sub_id}/portal/",
                headers={"Authorization": f"Bearer {hub_access_token}"},
                params={"return_url": portal_request.return_url}
            )

            logger.info(f"Portal response: {portal_response.status_code}")

            if portal_response.status_code in (200, 201):
                data = portal_response.json()
                portal_url = data.get("portal_url") or data.get("url")
                if portal_url:
                    logger.info(f"Portal URL created successfully for user {hub_user_id}")
                    return {"url": portal_url}
                logger.error(f"No portal URL in response: {data}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="No portal URL returned from Hub"
                )

            logger.warning(f"Hub portal failed: {portal_response.status_code} - {portal_response.text}")
            raise HTTPException(
                status_code=portal_response.status_code,
                detail=f"Failed to create billing portal: {portal_response.text}"
            )

    except HTTPException:
        raise
    except httpx.RequestError as e:
        logger.error(f"Error connecting to Angular Hub: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not connect to billing server"
        )
    except Exception as e:
        logger.exception(f"Unexpected error in billing portal: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}"
        )


# ============================================================================
# SSO Login Endpoints
# ============================================================================

@router.post("/auth/register", response_model=LoginResponse)
async def sso_register(
    request_body: RegisterRequest,
    db: Session = Depends(get_db)
):
    """
    Register via Angular Hub SSO.
    Proxies registration to Angular Hub, creates local user, and returns LOCAL tokens.
    This ensures all Oppine endpoints work with the same token.
    """
    import httpx
    from auth import create_access_token

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Register user in Angular Hub
            response = await client.post(
                f"{settings.ANGULAR_HUB_API_URL}/api/auth/register/",
                json={
                    "email": request_body.email,
                    "password": request_body.password,
                    "password2": request_body.password2,
                    "first_name": request_body.first_name or "",
                    "last_name": request_body.last_name or ""
                }
            )

            if response.status_code == 400:
                # Validation error from Hub (e.g., email already exists)
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

            # Hub user info is in the register response
            hub_user = {
                "id": data.get("id"),
                "user_id": data.get("id"),
                "email": data.get("email"),
                "username": data.get("username"),
                "first_name": data.get("first_name", ""),
                "last_name": data.get("last_name", ""),
            }

            # Create local user linked to Hub
            user = await _get_or_create_user(db, hub_user)

            if not user:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Could not create local user"
                )

            # Save hub_refresh_token in HubUserLink for billing API calls
            if hub_refresh_token:
                hub_link = db.query(HubUserLink).filter(
                    HubUserLink.hub_user_id == hub_user.get("id")
                ).first()
                if hub_link:
                    hub_link.hub_refresh_token = hub_refresh_token
                    db.commit()
                    logger.info(f"Saved hub_refresh_token for new user {user.email}")

            # Generate LOCAL Oppine token
            local_access_token = create_access_token(data={
                "uid": user.uid,
                "email": user.email,
                "name": user.name,
                "hub_user_id": hub_user.get("id"),
            })

            logger.info(f"User registered via Hub SSO: {user.email} (Hub ID: {hub_user.get('id')})")

            return LoginResponse(
                access_token=local_access_token,
                refresh_token=hub_refresh_token,
                user={
                    "uid": user.uid,
                    "email": user.email,
                    "name": user.name,
                    "hub_user_id": hub_user.get("id"),
                }
            )

    except httpx.RequestError as e:
        logger.error(f"Error connecting to Angular Hub: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not connect to authentication server"
        )


@router.post("/auth/login", response_model=LoginResponse)
async def sso_login(
    request_body: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    Login via Angular Hub SSO.
    Proxies credentials to Angular Hub, creates local user, and returns LOCAL tokens.
    This ensures all Oppine endpoints work with the same token.
    """
    import httpx
    from auth import create_access_token

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Login to Angular Hub using email endpoint
            response = await client.post(
                f"{settings.ANGULAR_HUB_API_URL}/api/auth/login/",
                json={
                    "email": request_body.email,
                    "password": request_body.password
                }
            )

            if response.status_code != 200:
                logger.warning(f"Hub login failed: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials"
                )

            data = response.json()
            hub_tokens = data.get("tokens", {})
            hub_refresh_token = hub_tokens.get("refresh")

            # Hub user info is in the login response
            hub_user = {
                "id": data.get("id"),
                "user_id": data.get("id"),
                "email": data.get("email"),
                "username": data.get("username"),
                "first_name": data.get("first_name", ""),
                "last_name": data.get("last_name", ""),
            }

            # Create or get local user
            user = await _get_or_create_user(db, hub_user)

            if not user:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Could not create local user"
                )

            # Save hub_refresh_token in HubUserLink for billing API calls
            if hub_refresh_token:
                hub_link = db.query(HubUserLink).filter(
                    HubUserLink.hub_user_id == hub_user.get("id")
                ).first()
                if hub_link:
                    hub_link.hub_refresh_token = hub_refresh_token
                    db.commit()
                    logger.info(f"Updated hub_refresh_token for user {user.email}")

            # Generate LOCAL Oppine token (not Hub token)
            # This token will be validated by verify_token in auth.py
            local_access_token = create_access_token(data={
                "uid": user.uid,
                "email": user.email,
                "name": user.name,
                "hub_user_id": hub_user.get("id"),
            })

            return LoginResponse(
                access_token=local_access_token,
                refresh_token=hub_refresh_token,  # Keep Hub refresh token for future refresh
                user={
                    "uid": user.uid,
                    "email": user.email,
                    "name": user.name,
                    "hub_user_id": hub_user.get("id"),
                }
            )

    except httpx.RequestError as e:
        logger.error(f"Error connecting to Angular Hub: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not connect to authentication server"
        )


@router.get("/auth/me")
async def get_current_user_info(
    request: Request,
    db: Session = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    """
    Get current authenticated user info.
    Uses local token validation (same as /projects and other endpoints).
    """
    from auth import verify_token as local_verify_token

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    # Validate local token
    try:
        payload = local_verify_token(credentials)
        uid = payload.get("uid")
        hub_user_id = payload.get("hub_user_id")
    except HTTPException:
        raise

    # Get user from database
    user = db.query(User).filter(User.uid == uid).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return {
        "uid": user.uid,
        "email": user.email,
        "name": user.name,
        "language": user.language,
        "hub_user_id": hub_user_id,
    }


# ============================================================================
# Health Check
# ============================================================================

@router.get("/health")
async def hub_health():
    """
    Check Angular Hub integration health.
    """
    return {
        "status": "ok",
        "hub_enabled": settings.ANGULAR_HUB_ENABLED,
        "hub_url": settings.ANGULAR_HUB_API_URL,
        "saas_slug": settings.ANGULAR_HUB_SAAS_SLUG,
    }
