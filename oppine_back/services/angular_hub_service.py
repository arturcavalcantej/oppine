"""
Angular Hub Integration Service
Handles SSO authentication and subscription verification with Angular Hub.
"""
import httpx
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import logging

from config import settings

logger = logging.getLogger(__name__)


class AngularHubService:
    """
    Service for integrating with Angular Hub API.
    Handles token validation, user info retrieval, and subscription checks.
    """

    def __init__(self):
        self.base_url = settings.ANGULAR_HUB_API_URL.rstrip('/')
        self.saas_slug = settings.ANGULAR_HUB_SAAS_SLUG
        self.api_key = settings.ANGULAR_HUB_API_KEY
        self.jwt_secret = settings.ANGULAR_HUB_JWT_SECRET
        self._subscription_cache: Dict[str, Dict[str, Any]] = {}
        self._cache_ttl = timedelta(minutes=5)

    async def validate_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Validates a JWT token from Angular Hub via API call.

        Args:
            token: JWT access token from Angular Hub

        Returns:
            Dict with user info if valid, None otherwise
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                logger.debug(f"Validating token with Angular Hub API: {self.base_url}/api/auth/me/")
                response = await client.get(
                    f"{self.base_url}/api/auth/me/",
                    headers={"Authorization": f"Bearer {token}"}
                )

                logger.debug(f"Token validation response status: {response.status_code}")

                if response.status_code == 200:
                    data = response.json()
                    logger.info(f"Token validated for user: {data.get('email')}")
                    return {
                        "user_id": data.get("id"),
                        "email": data.get("email"),
                        "username": data.get("username"),
                        "first_name": data.get("first_name"),
                        "last_name": data.get("last_name"),
                    }

                logger.warning(f"Token validation failed: {response.status_code} - {response.text}")
                return None

        except httpx.RequestError as e:
            logger.error(f"Error connecting to Angular Hub: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error validating token: {e}")
            return None

    async def get_user_subscription(
        self,
        user_id: int,
        token: str,
        force_refresh: bool = False
    ) -> Optional[Dict[str, Any]]:
        """
        Gets user's subscription info from Angular Hub.
        For Oppine, the subscription is on the global SaaS, not on user-owned SaaS.
        Uses caching to reduce API calls.

        Args:
            user_id: User ID in Angular Hub
            token: Valid access token
            force_refresh: Force cache refresh

        Returns:
            Dict with subscription info or None
        """
        cache_key = f"sub_{user_id}"

        # Check cache
        if not force_refresh and cache_key in self._subscription_cache:
            cached = self._subscription_cache[cache_key]
            if datetime.now(timezone.utc) < cached["expires_at"]:
                logger.debug(f"Returning cached subscription for user {user_id}")
                return cached["data"]

        # Fetch from API using the correct endpoint
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Get user's subscription for this SaaS
                logger.info(f"Fetching subscription for user {user_id} from {self.base_url}/api/billing/subscriptions/user/{self.saas_slug}/")
                sub_response = await client.get(
                    f"{self.base_url}/api/billing/subscriptions/user/{self.saas_slug}/",
                    headers={"Authorization": f"Bearer {token}"}
                )

                if sub_response.status_code == 200:
                    sub_data = sub_response.json()
                    logger.info(f"Got subscription data for user {user_id}: plan_slug={sub_data.get('plan_slug')}, is_active={sub_data.get('is_active')}")
                    subscription_data = self._parse_user_subscription(sub_data)

                    # Cache the result
                    self._subscription_cache[cache_key] = {
                        "data": subscription_data,
                        "expires_at": datetime.now(timezone.utc) + self._cache_ttl
                    }

                    return subscription_data
                elif sub_response.status_code == 404:
                    # User has no subscription - return and cache starter plan
                    logger.info(f"User {user_id} has no subscription for {self.saas_slug}, returning starter plan")
                    starter_plan = self._get_starter_plan()
                    self._subscription_cache[cache_key] = {
                        "data": starter_plan,
                        "expires_at": datetime.now(timezone.utc) + self._cache_ttl
                    }
                    return starter_plan
                else:
                    logger.warning(f"Failed to get user subscription: {sub_response.status_code} - {sub_response.text}")
                    # On error, return starter plan but don't cache it
                    return self._get_starter_plan()

        except httpx.RequestError as e:
            logger.error(f"Error fetching subscription: {e}")
            # Return cached data if available (even if expired)
            if cache_key in self._subscription_cache:
                logger.info(f"Returning expired cache for user {user_id} due to network error")
                return self._subscription_cache[cache_key]["data"]
            return self._get_starter_plan()

    async def get_available_plans(self) -> list[Dict[str, Any]]:
        """
        Fetches available plans for this SaaS from Angular Hub.
        Handles pagination to get all plans (max 5 pages to avoid infinite loops).

        Returns:
            List of plan dictionaries
        """
        all_plans = {}  # Use dict to deduplicate by ID
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                url = f"{self.base_url}/api/billing/plans/"
                # Don't filter by saas param as it doesn't work reliably
                # We'll filter locally by slug
                max_pages = 5
                page = 0

                while url and page < max_pages:
                    page += 1
                    response = await client.get(url)
                    if response.status_code != 200:
                        logger.warning(f"Failed to get plans page {page}: {response.status_code}")
                        break

                    data = response.json()
                    plans = data.get("results", data) if isinstance(data, dict) else data

                    # Deduplicate by ID
                    for plan in plans:
                        plan_id = plan.get("id")
                        if plan_id and plan_id not in all_plans:
                            all_plans[plan_id] = plan

                    # Get next page URL
                    url = data.get("next") if isinstance(data, dict) else None

                # Filter plans by saas_slug - only include plans that start with saas_slug
                filtered_plans = [
                    plan for plan in all_plans.values()
                    if plan.get("slug", "").lower().startswith(self.saas_slug.lower())
                ]

                # Sort: Starter first, then by price
                def sort_key(plan):
                    price = float(plan.get("price", "0") or "0")
                    is_starter = "starter" in plan.get("slug", "").lower()
                    is_yearly = "yearly" in plan.get("slug", "").lower() or "anual" in plan.get("slug", "").lower()
                    # Starter first, then monthly plans by price, then yearly plans
                    return (0 if is_starter else (2 if is_yearly else 1), price)

                filtered_plans.sort(key=sort_key)
                logger.info(f"Found {len(filtered_plans)} plans for {self.saas_slug}")
                return [self._format_plan(plan) for plan in filtered_plans]
        except Exception as e:
            logger.error(f"Error fetching plans: {e}")
            return []

    def _format_plan(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        """Formats plan data for frontend consumption."""
        return {
            "id": plan.get("id"),
            "name": plan.get("name"),
            "slug": plan.get("slug"),
            "description": plan.get("description"),
            "price": plan.get("price"),
            "billing_period": plan.get("billing_period"),
            "features": plan.get("features", []),
            "limits": plan.get("limits", {}),
            "is_popular": plan.get("is_popular", False),
        }

    def _parse_subscription(self, stats: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parses subscription data from SaaS stats.
        """
        subscription = stats.get("subscription", {})

        if not subscription or not stats.get("has_subscription"):
            return self._get_starter_plan()

        return {
            "plan_id": subscription.get("plan_id"),
            "plan_name": subscription.get("plan", "Starter"),
            "plan_slug": subscription.get("plan_slug", subscription.get("plan", "starter").lower().replace(" ", "-")),
            "status": subscription.get("status", "inactive"),
            "is_active": subscription.get("is_active", False),
            "limits": self._get_plan_limits(subscription.get("plan", "Free")),
            "features": self._get_plan_features(subscription.get("plan", "Free")),
            "usage": {
                "projects": stats.get("projects_count", 0),
                "storage_bytes": stats.get("storage_used", 0),
                "files": stats.get("files_count", 0),
            }
        }

    def _parse_user_subscription(self, sub_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parses subscription data from user subscription endpoint.
        """
        plan_name = sub_data.get("plan_name", "Free")
        plan_slug = sub_data.get("plan_slug", plan_name.lower().replace(" ", "-"))

        return {
            "plan_id": sub_data.get("plan_id"),
            "plan_name": plan_name,
            "plan_slug": plan_slug,
            "status": sub_data.get("status_display", sub_data.get("status", "inactive")),
            "is_active": sub_data.get("is_active", False),
            "limits": self._get_plan_limits(plan_slug),  # Use plan_slug (e.g., "oppine-starter-monthly")
            "features": self._get_plan_features(plan_slug),  # Use plan_slug for features too
            "usage": {
                "projects": 0,
                "storage_bytes": 0,
                "files": 0,
            }
        }

    def _get_starter_plan(self) -> Dict[str, Any]:
        """
        Returns default starter plan limits for Oppine.
        """
        return {
            "plan_id": None,
            "plan_name": "Starter",
            "plan_slug": "oppine-starter-monthly",
            "status": "active",
            "is_active": True,
            "limits": {
                "messages_per_month": 50,
                "businesses": 1,
            },
            "features": {
                "whatsapp_messaging": True,
                "feedback_collection": True,
                "nps_triagem": True,
                "google_review_redirect": True,
                "alerts": True,
                "dashboard": True,
                "priority_support": False,
            },
            "usage": {
                "messages": 0,
                "businesses": 0,
            }
        }

    def _get_plan_limits(self, plan_name: str) -> Dict[str, int]:
        """
        Returns limits based on plan name or slug for Oppine.
        """
        from config import settings

        # Try keyword matching for plan names
        name_lower = plan_name.lower()
        if "growth" in name_lower:
            limits = settings.PLAN_LIMITS.get("growth", {})
        elif "starter" in name_lower:
            limits = settings.PLAN_LIMITS.get("starter", {})
        else:
            limits = settings.PLAN_LIMITS.get("starter", {})

        return {
            "messages_per_month": limits.get("messages_per_month", 50),
            "businesses": limits.get("businesses", 1),
        }

    def _get_plan_features(self, plan_slug: str) -> Dict[str, bool]:
        """
        Returns features based on plan slug for Oppine.
        Only two tiers: starter and growth.
        """
        starter_features = {
            "whatsapp_messaging": True,
            "feedback_collection": True,
            "nps_triagem": True,
            "google_review_redirect": True,
            "alerts": True,
            "dashboard": True,
            "priority_support": False,
        }
        growth_features = {
            "whatsapp_messaging": True,
            "feedback_collection": True,
            "nps_triagem": True,
            "google_review_redirect": True,
            "alerts": True,
            "dashboard": True,
            "priority_support": True,
        }

        # Map plan slugs to features
        slug_lower = plan_slug.lower()

        if "growth" in slug_lower:
            return growth_features

        # Default to starter features
        return starter_features

    async def refresh_token(self, refresh_token: str) -> Optional[Dict[str, str]]:
        """
        Refreshes access token using Angular Hub API.

        Args:
            refresh_token: Valid refresh token

        Returns:
            Dict with new access and refresh tokens, or None
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/auth/token/refresh/",
                    json={"refresh": refresh_token}
                )

                if response.status_code == 200:
                    data = response.json()
                    return {
                        "access_token": data.get("access"),
                        "refresh_token": data.get("refresh", refresh_token),
                    }

                logger.warning(f"Token refresh failed: {response.status_code}")
                return None

        except httpx.RequestError as e:
            logger.error(f"Error refreshing token: {e}")
            return None

    def clear_cache(self, user_id: Optional[int] = None):
        """
        Clears subscription cache.

        Args:
            user_id: If provided, clears only that user's cache
        """
        if user_id:
            cache_key = f"sub_{user_id}"
            self._subscription_cache.pop(cache_key, None)
        else:
            self._subscription_cache.clear()

    async def create_checkout_session(
        self,
        plan_slug: str,
        success_url: str,
        cancel_url: str,
        token: str
    ) -> Optional[str]:
        """
        Creates a Stripe checkout session via Angular Hub.

        Args:
            plan_slug: The plan slug to subscribe to
            success_url: URL to redirect on success
            cancel_url: URL to redirect on cancel
            token: User's access token

        Returns:
            Checkout session URL or None on error
        """
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/billing/subscriptions/",
                    headers={"Authorization": f"Bearer {token}"},
                    json={
                        "saas_slug": self.saas_slug,
                        "plan_slug": plan_slug,
                        "success_url": success_url,
                        "cancel_url": cancel_url,
                    }
                )

                if response.status_code in (200, 201):
                    data = response.json()
                    checkout_url = data.get("checkout_url") or data.get("url")
                    if checkout_url:
                        logger.info(f"Checkout session created for plan: {plan_slug}")
                        return checkout_url
                    logger.warning(f"No checkout URL in response: {data}")
                    return None

                logger.warning(f"Checkout creation failed: {response.status_code} - {response.text}")
                return None

        except httpx.RequestError as e:
            logger.error(f"Error creating checkout session: {e}")
            return None

    async def create_billing_portal_session(
        self,
        return_url: str,
        token: str
    ) -> Optional[str]:
        """
        Creates a Stripe billing portal session via Angular Hub.

        Args:
            return_url: URL to return to after portal session
            token: User's access token

        Returns:
            Portal session URL or None on error
        """
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/billing/portal/",
                    headers={"Authorization": f"Bearer {token}"},
                    json={
                        "saas_slug": self.saas_slug,
                        "return_url": return_url,
                    }
                )

                if response.status_code in (200, 201):
                    data = response.json()
                    portal_url = data.get("portal_url") or data.get("url")
                    if portal_url:
                        logger.info("Billing portal session created")
                        return portal_url
                    logger.warning(f"No portal URL in response: {data}")
                    return None

                logger.warning(f"Portal creation failed: {response.status_code} - {response.text}")
                return None

        except httpx.RequestError as e:
            logger.error(f"Error creating portal session: {e}")
            return None


# Singleton instance
angular_hub_service = AngularHubService()
