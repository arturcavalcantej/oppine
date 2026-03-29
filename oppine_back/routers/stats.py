from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
from database import get_db
from models import Project, ProjectMember, HubUserLink, SubscriptionCache, Business, FeedbackRequest, FeedbackResponse, DailyUsage, FeedbackTemplate
from config import settings, SLUG_PLAN_LIMITS as HUB_PLAN_LIMITS, DEFAULT_STARTER_LIMITS
from auth import verify_token
from typing import Optional, List
from pydantic import BaseModel
import httpx
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/projects",
    tags=["stats"]
)


def extract_tier_from_slug(slug: str) -> str:
    """
    Extract tier from Hub plan slug.
    Only two tiers exist: starter and growth.
    """
    slug_lower = slug.lower()

    if "growth" in slug_lower:
        return "growth"

    # Default to starter for any other plan
    return "starter"


async def refresh_subscription_cache(hub_link: HubUserLink, db: Session) -> Optional[dict]:
    """
    Refresh subscription cache using stored refresh token.
    Returns subscription data if successful, None otherwise.
    """
    if not hub_link.hub_refresh_token:
        return None

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Get fresh access token using stored refresh token
            refresh_response = await client.post(
                f"{settings.ANGULAR_HUB_API_URL}/api/auth/token/refresh/",
                json={"refresh": hub_link.hub_refresh_token}
            )

            if refresh_response.status_code != 200:
                logger.warning(f"Failed to refresh Hub token: {refresh_response.status_code}")
                return None

            refresh_data = refresh_response.json()
            hub_access_token = refresh_data.get("access")

            # Update stored refresh token if a new one was provided
            new_refresh = refresh_data.get("refresh")
            if new_refresh and new_refresh != hub_link.hub_refresh_token:
                hub_link.hub_refresh_token = new_refresh
                db.commit()

            # Get subscription from Hub using the correct endpoint
            sub_response = await client.get(
                f"{settings.ANGULAR_HUB_API_URL}/api/billing/subscriptions/user/{settings.ANGULAR_HUB_SAAS_SLUG}/",
                headers={"Authorization": f"Bearer {hub_access_token}"}
            )

            if sub_response.status_code == 404:
                # User has no subscription - return starter plan data
                logger.info(f"No subscription found for hub_user_id={hub_link.hub_user_id}, returning starter plan")
                return {
                    "plan_name": "Starter",
                    "plan_slug": "oppine-starter-monthly",
                    "status": "active",
                    "is_active": True,
                    "limits": {},
                    "features": {},
                    "usage": {}
                }

            if sub_response.status_code != 200:
                logger.warning(f"Failed to get subscription: {sub_response.status_code} - {sub_response.text}")
                return None

            subscription = sub_response.json()
            logger.info(f"Refreshed subscription for hub_user_id={hub_link.hub_user_id}: {subscription.get('plan_slug')}")

            # Update local cache
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
            cached = db.query(SubscriptionCache).filter(
                SubscriptionCache.hub_user_id == hub_link.hub_user_id
            ).first()

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
                import uuid
                cached = SubscriptionCache(
                    id=str(uuid.uuid4()),
                    hub_user_id=hub_link.hub_user_id,
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
            return subscription

    except Exception as e:
        logger.error(f"Error refreshing subscription cache: {e}")
        return None


def get_tier_from_hub_cache(owner_id: str, db: Session) -> tuple[str, dict, str, str]:
    """
    Get subscription tier from Angular Hub cache for the project owner.
    Returns (tier, limits, plan_slug, plan_name) tuple.
    This is the sync version that only reads from cache.
    """
    # Find the Hub link for the project owner
    hub_link = db.query(HubUserLink).filter(
        HubUserLink.local_user_id == owner_id
    ).first()

    if not hub_link:
        return "starter", DEFAULT_STARTER_LIMITS, "oppine-starter-monthly", "Starter"

    # Get cached subscription
    cached = db.query(SubscriptionCache).filter(
        SubscriptionCache.hub_user_id == hub_link.hub_user_id
    ).first()

    # If no cache or not active, return free plan
    if not cached or not cached.is_active:
        return "starter", DEFAULT_STARTER_LIMITS, "oppine-starter-monthly", "Starter"

    # Use plan slug directly to get limits from HUB_PLAN_LIMITS
    plan_slug = cached.plan_slug or "oppine-starter-monthly"
    plan_name = cached.plan_name or "Free"
    limits = HUB_PLAN_LIMITS.get(plan_slug, DEFAULT_STARTER_LIMITS)

    # Extract tier for display purposes
    tier = extract_tier_from_slug(plan_slug)

    return tier, limits, plan_slug, plan_name


async def get_tier_from_hub_cache_async(owner_id: str, db: Session) -> tuple[str, dict, str, str]:
    """
    Get subscription tier from Angular Hub cache for the project owner.
    Returns (tier, limits, plan_slug, plan_name) tuple.
    This is the async version that refreshes cache if expired.
    """
    # Find the Hub link for the project owner
    hub_link = db.query(HubUserLink).filter(
        HubUserLink.local_user_id == owner_id
    ).first()

    if not hub_link:
        return "starter", DEFAULT_STARTER_LIMITS, "oppine-starter-monthly", "Starter"

    # Get cached subscription
    cached = db.query(SubscriptionCache).filter(
        SubscriptionCache.hub_user_id == hub_link.hub_user_id
    ).first()

    # If cache is missing or expired, try to refresh it
    if not cached or cached.is_expired():
        subscription = await refresh_subscription_cache(hub_link, db)
        if subscription:
            # Re-query the updated cache
            cached = db.query(SubscriptionCache).filter(
                SubscriptionCache.hub_user_id == hub_link.hub_user_id
            ).first()

    # If still no cache or not active, return free plan
    if not cached or not cached.is_active:
        return "starter", DEFAULT_STARTER_LIMITS, "oppine-starter-monthly", "Starter"

    # Use plan slug directly to get limits from HUB_PLAN_LIMITS
    plan_slug = cached.plan_slug or "oppine-starter-monthly"
    plan_name = cached.plan_name or "Free"
    limits = HUB_PLAN_LIMITS.get(plan_slug, DEFAULT_STARTER_LIMITS)

    # Extract tier for display purposes
    tier = extract_tier_from_slug(plan_slug)

    return tier, limits, plan_slug, plan_name


def verify_project_access(project_id: str, user_uid: str, db: Session) -> Project:
    """Verify user has access to the project and return it."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project.owner_id == user_uid
    is_member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_uid
    ).first() is not None

    if not is_owner and not is_member:
        raise HTTPException(status_code=403, detail="Access denied to this project")

    return project


@router.get("/{project_id}/stats")
async def get_project_stats(
    project_id: str,
    db: Session = Depends(get_db),
    token_data: dict = Depends(verify_token)
):
    """Get comprehensive statistics for a project."""
    user_uid = token_data.get("uid")
    project = verify_project_access(project_id, user_uid, db)

    # Determine tier and limits
    # First check local Stripe subscription
    if project.plan_id:
        tier = settings.get_tier_from_price_id(project.plan_id)
        limits = settings.PLAN_LIMITS.get(tier, settings.PLAN_LIMITS["free"])
        plan_slug = f"stripe-{tier}"
        plan_name = tier.capitalize()
    else:
        # Fallback to Angular Hub subscription cache (refreshes if expired)
        tier, limits, plan_slug, plan_name = await get_tier_from_hub_cache_async(project.owner_id, db)

    # Count businesses for this project
    total_businesses = db.query(func.count(Business.id)).filter(
        Business.project_id == project_id
    ).scalar() or 0

    # Get all business IDs for this project
    business_ids = [b.id for b in db.query(Business.id).filter(Business.project_id == project_id).all()]

    # Count feedback requests and responses (all time)
    total_feedback_requests = 0
    total_feedback_responses = 0
    positive_reviews = 0
    negative_alerts = 0

    if business_ids:
        total_feedback_requests = db.query(func.count(FeedbackRequest.id)).filter(
            FeedbackRequest.business_id.in_(business_ids)
        ).scalar() or 0

        total_feedback_responses = db.query(func.count(FeedbackResponse.id)).join(
            FeedbackRequest
        ).filter(
            FeedbackRequest.business_id.in_(business_ids)
        ).scalar() or 0

        positive_reviews = db.query(func.count(FeedbackResponse.id)).join(
            FeedbackRequest
        ).filter(
            FeedbackRequest.business_id.in_(business_ids),
            FeedbackResponse.classification == "promoter"
        ).scalar() or 0

        negative_alerts = db.query(func.count(FeedbackResponse.id)).join(
            FeedbackRequest
        ).filter(
            FeedbackRequest.business_id.in_(business_ids),
            FeedbackResponse.classification == "detractor"
        ).scalar() or 0

    # Calculate current month usage
    first_day_of_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Sends this month (counts only initial survey sends via DailyUsage)
    sends_this_month = db.query(func.sum(DailyUsage.messages_sent)).filter(
        DailyUsage.user_id == project.owner_id,
        DailyUsage.date >= first_day_of_month
    ).scalar() or 0

    return {
        "usage": {
            "messages": {
                "current": sends_this_month,
                "limit": limits.get("messages_per_month", 50),
                "period": limits.get("period", "monthly")
            },
            "businesses": {
                "current": total_businesses,
                "limit": limits.get("businesses", 1)
            }
        },
        "totals": {
            "businesses": total_businesses,
            "feedback_requests": total_feedback_requests,
            "feedback_responses": total_feedback_responses,
            "positive_reviews": positive_reviews,
            "negative_alerts": negative_alerts
        },
        "subscription": {
            "tier": tier,
            "plan_slug": plan_slug,
            "plan_name": plan_name,
            "status": project.subscription_status or "active",
            "period_end": project.current_period_end.isoformat() if project.current_period_end else None
        }
    }


class ProjectTemplateResponse(BaseModel):
    """Response schema for project templates."""
    id: str
    name: str
    initial_message: str
    thank_you_promoter: Optional[str] = None
    thank_you_passive: Optional[str] = None
    thank_you_detractor: Optional[str] = None
    testimonial_request: Optional[str] = None
    is_default: bool = False
    is_active: bool = True
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/{project_id}/templates", response_model=List[ProjectTemplateResponse])
def list_project_templates(
    project_id: str,
    db: Session = Depends(get_db),
    token_data: dict = Depends(verify_token)
):
    """
    List all templates for a project.
    This endpoint allows fetching templates even when no businesses exist.
    """
    user_uid = token_data.get("uid")
    project = verify_project_access(project_id, user_uid, db)

    templates = db.query(FeedbackTemplate).filter(
        FeedbackTemplate.project_id == project.id
    ).order_by(FeedbackTemplate.is_default.desc(), FeedbackTemplate.created_at.desc()).all()

    return templates
