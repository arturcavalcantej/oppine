"""
Google Business Profile Integration Service.

Handles OAuth 2.0 authentication, review syncing, and promoter-review matching.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List, Any

from cryptography.fernet import Fernet
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from sqlalchemy.orm import Session

from config import settings
from models import (
    GoogleOAuthConnection,
    GoogleLocationLink,
    GoogleReview,
    FeedbackResponse,
    FeedbackRequest,
    Business,
    generate_uuid,
)

logger = logging.getLogger(__name__)


class QuotaExceededError(Exception):
    """Raised when Google API quota is exceeded (429)."""
    pass


# Google API scopes
SCOPES = [
    "https://www.googleapis.com/auth/business.manage",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
]

# ============================================================================
# Token Encryption (Fernet symmetric)
# ============================================================================

def _get_fernet() -> Fernet:
    key = settings.GOOGLE_TOKEN_ENCRYPTION_KEY
    if not key:
        raise ValueError("GOOGLE_TOKEN_ENCRYPTION_KEY is not configured")
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_token(token: str) -> str:
    return _get_fernet().encrypt(token.encode()).decode()


def decrypt_token(encrypted: str) -> str:
    return _get_fernet().decrypt(encrypted.encode()).decode()


# ============================================================================
# OAuth 2.0 Flow
# ============================================================================

def _build_flow(state: Optional[str] = None) -> Flow:
    client_config = {
        "web": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
        }
    }
    flow = Flow.from_client_config(client_config, scopes=SCOPES, state=state)
    flow.redirect_uri = settings.GOOGLE_REDIRECT_URI
    return flow


def get_authorization_url(state: str) -> str:
    flow = _build_flow(state=state)
    url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return url


def exchange_code(code: str) -> Dict[str, Any]:
    flow = _build_flow()
    flow.fetch_token(code=code)
    creds = flow.credentials

    # Get user info from ID token
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests

    id_info = id_token.verify_oauth2_token(
        creds.id_token,
        google_requests.Request(),
        settings.GOOGLE_CLIENT_ID,
    )

    return {
        "email": id_info.get("email", ""),
        "refresh_token": creds.refresh_token,
        "access_token": creds.token,
        "expires_at": creds.expiry,
    }


def save_connection(db: Session, user_id: str, token_data: Dict[str, Any]) -> GoogleOAuthConnection:
    existing = db.query(GoogleOAuthConnection).filter(
        GoogleOAuthConnection.user_id == user_id
    ).first()

    if existing:
        existing.google_email = token_data["email"]
        existing.encrypted_refresh_token = encrypt_token(token_data["refresh_token"])
        existing.access_token_expires_at = token_data.get("expires_at")
        existing.is_active = True
        existing.connection_error = None
        existing.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return existing

    conn = GoogleOAuthConnection(
        id=generate_uuid(),
        user_id=user_id,
        google_email=token_data["email"],
        encrypted_refresh_token=encrypt_token(token_data["refresh_token"]),
        access_token_expires_at=token_data.get("expires_at"),
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return conn


def get_connection(db: Session, user_id: str) -> Optional[GoogleOAuthConnection]:
    return db.query(GoogleOAuthConnection).filter(
        GoogleOAuthConnection.user_id == user_id
    ).first()


def disconnect(db: Session, user_id: str) -> bool:
    conn = get_connection(db, user_id)
    if not conn:
        return False

    # Delete location links first
    db.query(GoogleLocationLink).filter(
        GoogleLocationLink.user_id == user_id
    ).delete()

    db.delete(conn)
    db.commit()

    # Try to revoke the token
    try:
        refresh_token = decrypt_token(conn.encrypted_refresh_token)
        import httpx
        httpx.post(
            "https://oauth2.googleapis.com/revoke",
            params={"token": refresh_token},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    except Exception as e:
        logger.warning(f"Failed to revoke Google token for user {user_id}: {e}")

    return True


# ============================================================================
# Access Token Management
# ============================================================================

def get_credentials(db: Session, user_id: str) -> Optional[Credentials]:
    conn = get_connection(db, user_id)
    if not conn or not conn.is_active:
        return None

    try:
        refresh_token = decrypt_token(conn.encrypted_refresh_token)
    except Exception as e:
        logger.error(f"Failed to decrypt token for user {user_id}: {e}")
        conn.connection_error = "Token decryption failed"
        conn.is_active = False
        db.commit()
        return None

    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        scopes=SCOPES,
    )

    # Refresh if needed
    if not creds.valid:
        from google.auth.transport.requests import Request
        try:
            creds.refresh(Request())
            conn.access_token_expires_at = creds.expiry
            conn.connection_error = None
            db.commit()
        except Exception as e:
            logger.error(f"Failed to refresh Google token for user {user_id}: {e}")
            conn.connection_error = str(e)
            db.commit()
            return None

    return creds


# ============================================================================
# Google Business Profile API
# ============================================================================

def _ensure_fresh_token(creds: Credentials) -> Credentials:
    """Ensure the credentials have a valid access token."""
    if not creds.valid:
        from google.auth.transport.requests import Request
        creds.refresh(Request())
    return creds


def list_accounts(db: Session, user_id: str) -> List[Dict[str, str]]:
    creds = get_credentials(db, user_id)
    if not creds:
        logger.warning(f"No credentials for user {user_id}")
        return []

    try:
        creds = _ensure_fresh_token(creds)
        import httpx
        resp = httpx.get(
            "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
            headers={"Authorization": f"Bearer {creds.token}"},
            timeout=30,
        )
        logger.info(f"Google accounts API: {resp.status_code} - {resp.text[:500]}")
        if resp.status_code == 429:
            raise QuotaExceededError(
                "Cota da API do Google excedida. Aumente a cota 'Requests per minute' "
                "em APIs e Serviços > My Business Account Management API > Cotas no Google Cloud Console."
            )
        resp.raise_for_status()
        data = resp.json()
        accounts = data.get("accounts", [])
        return [
            {
                "id": acc["name"],  # accounts/123456
                "name": acc.get("accountName", acc["name"]),
            }
            for acc in accounts
        ]
    except QuotaExceededError:
        raise
    except Exception as e:
        logger.error(f"Failed to list Google accounts for user {user_id}: {e}", exc_info=True)
        return []


def list_locations(db: Session, user_id: str, account_id: str) -> List[Dict[str, str]]:
    creds = get_credentials(db, user_id)
    if not creds:
        return []

    try:
        creds = _ensure_fresh_token(creds)
        import httpx
        resp = httpx.get(
            f"https://mybusinessbusinessinformation.googleapis.com/v1/{account_id}/locations",
            headers={"Authorization": f"Bearer {creds.token}"},
            params={"readMask": "name,title"},
            timeout=30,
        )
        logger.info(f"Google locations API for {account_id}: {resp.status_code} - {resp.text[:500]}")
        if resp.status_code == 429:
            raise QuotaExceededError(
                "Cota da API do Google excedida. Aumente a cota no Google Cloud Console."
            )
        resp.raise_for_status()
        data = resp.json()
        locations = data.get("locations", [])
        return [
            {
                "id": loc["name"],  # locations/456
                "name": loc.get("title", loc["name"]),
            }
            for loc in locations
        ]
    except QuotaExceededError:
        raise
    except Exception as e:
        logger.error(f"Failed to list Google locations for user {user_id}, account {account_id}: {e}", exc_info=True)
        return []


# ============================================================================
# Location Linking
# ============================================================================

def link_location(
    db: Session,
    user_id: str,
    business_id: str,
    google_account_id: str,
    google_location_id: str,
    google_location_name: Optional[str] = None,
) -> GoogleLocationLink:
    existing = db.query(GoogleLocationLink).filter(
        GoogleLocationLink.business_id == business_id
    ).first()

    if existing:
        existing.google_account_id = google_account_id
        existing.google_location_id = google_location_id
        existing.google_location_name = google_location_name
        existing.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return existing

    link = GoogleLocationLink(
        id=generate_uuid(),
        business_id=business_id,
        user_id=user_id,
        google_account_id=google_account_id,
        google_location_id=google_location_id,
        google_location_name=google_location_name,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


def unlink_location(db: Session, business_id: str) -> bool:
    link = db.query(GoogleLocationLink).filter(
        GoogleLocationLink.business_id == business_id
    ).first()
    if not link:
        return False
    db.delete(link)
    db.commit()
    return True


def get_location_link(db: Session, business_id: str) -> Optional[GoogleLocationLink]:
    return db.query(GoogleLocationLink).filter(
        GoogleLocationLink.business_id == business_id
    ).first()


# ============================================================================
# Review Syncing
# ============================================================================

def _fetch_reviews(creds: Credentials, account_id: str, location_id: str) -> List[Dict]:
    """Fetch reviews from Google Business Profile API via direct REST calls.

    The old mybusiness v4 discovery service was deprecated.
    Reviews are now accessed via direct HTTP to the mybusiness.googleapis.com endpoint.
    """
    try:
        # Ensure token is fresh
        if not creds.valid:
            from google.auth.transport.requests import Request
            creds.refresh(Request())

        import httpx
        headers = {"Authorization": f"Bearer {creds.token}"}

        # location_id format: "accounts/123/locations/456"
        url = f"https://mybusiness.googleapis.com/v4/{location_id}/reviews"
        all_reviews = []
        page_token = None

        while True:
            params = {"pageSize": 50}
            if page_token:
                params["pageToken"] = page_token

            resp = httpx.get(url, headers=headers, params=params, timeout=30)

            if resp.status_code == 403:
                logger.warning(f"Access denied for reviews on {location_id} - check API permissions")
                break
            resp.raise_for_status()

            data = resp.json()
            all_reviews.extend(data.get("reviews", []))

            page_token = data.get("nextPageToken")
            if not page_token:
                break

        return all_reviews
    except Exception as e:
        logger.error(f"Failed to fetch reviews for {location_id}: {e}")
        return []


def sync_reviews_for_business(db: Session, business_id: str) -> Dict[str, int]:
    """Sync reviews from Google for a specific business. Returns stats."""
    link = get_location_link(db, business_id)
    if not link:
        return {"error": "no_location_link"}

    creds = get_credentials(db, link.user_id)
    if not creds:
        return {"error": "no_credentials"}

    reviews = _fetch_reviews(creds, link.google_account_id, link.google_location_id)

    stats = {"fetched": len(reviews), "new": 0, "matched": 0}

    for review_data in reviews:
        google_review_id = review_data.get("reviewId", review_data.get("name", ""))
        if not google_review_id:
            continue

        # Upsert review
        existing = db.query(GoogleReview).filter(
            GoogleReview.google_review_id == google_review_id
        ).first()

        if existing:
            existing.synced_at = datetime.now(timezone.utc)
            continue

        # Parse review data
        reviewer = review_data.get("reviewer", {})
        star_rating_str = review_data.get("starRating", "")
        star_map = {"ONE": 1, "TWO": 2, "THREE": 3, "FOUR": 4, "FIVE": 5}
        star_rating = star_map.get(star_rating_str)

        create_time = None
        if review_data.get("createTime"):
            try:
                create_time = datetime.fromisoformat(
                    review_data["createTime"].replace("Z", "+00:00")
                )
            except (ValueError, TypeError):
                pass

        new_review = GoogleReview(
            id=generate_uuid(),
            business_id=business_id,
            google_review_id=google_review_id,
            reviewer_name=reviewer.get("displayName"),
            star_rating=star_rating,
            review_text=review_data.get("comment"),
            review_create_time=create_time,
        )
        db.add(new_review)
        stats["new"] += 1

        # Try to match with Oppine response
        matched = _match_review_to_response(new_review, business_id, db)
        if matched:
            stats["matched"] += 1

    # Update last synced timestamp
    conn = db.query(GoogleOAuthConnection).filter(
        GoogleOAuthConnection.user_id == link.user_id
    ).first()
    if conn:
        conn.last_synced_at = datetime.now(timezone.utc)

    db.commit()
    return stats


# ============================================================================
# Review-to-Response Matching (Heuristic)
# ============================================================================

def _normalize_name(name: Optional[str]) -> str:
    if not name:
        return ""
    return name.strip().lower()


def _name_similarity(name1: str, name2: str) -> float:
    """Simple name similarity based on common tokens."""
    if not name1 or not name2:
        return 0.0
    tokens1 = set(_normalize_name(name1).split())
    tokens2 = set(_normalize_name(name2).split())
    if not tokens1 or not tokens2:
        return 0.0
    intersection = tokens1 & tokens2
    union = tokens1 | tokens2
    return len(intersection) / len(union) if union else 0.0


def _match_review_to_response(
    review: GoogleReview,
    business_id: str,
    db: Session,
) -> bool:
    """Try to match a Google review to an Oppine FeedbackResponse."""
    if not review.review_create_time:
        return False

    # Look for promoter responses in a 72h window before the review
    window_start = review.review_create_time - timedelta(hours=72)

    candidates = (
        db.query(FeedbackResponse)
        .join(FeedbackRequest, FeedbackResponse.request_id == FeedbackRequest.id)
        .filter(
            FeedbackRequest.business_id == business_id,
            FeedbackResponse.classification == "promoter",
            FeedbackResponse.responded_at >= window_start,
            FeedbackResponse.responded_at <= review.review_create_time,
            FeedbackResponse.google_review_matched == False,  # noqa: E712
        )
        .all()
    )

    best_match = None
    best_confidence = None
    best_method = None

    for response in candidates:
        request = response.request
        if not request:
            continue

        hours_diff = (review.review_create_time - response.responded_at).total_seconds() / 3600
        name_sim = _name_similarity(review.reviewer_name, request.customer_name)
        clicked = response.google_review_clicked

        # HIGH: name match >80% + within 24h + clicked
        if name_sim > 0.8 and hours_diff <= 24 and clicked:
            best_match = response
            best_confidence = "high"
            best_method = "name+time+click"
            break

        # HIGH: name match >80% + within 24h
        if name_sim > 0.8 and hours_diff <= 24:
            if not best_confidence or best_confidence not in ("high",):
                best_match = response
                best_confidence = "high"
                best_method = "name+time"

        # MEDIUM: name match >70% + within 72h
        if name_sim > 0.7 and hours_diff <= 72:
            if not best_confidence or best_confidence not in ("high",):
                best_match = response
                best_confidence = "medium"
                best_method = "name+time"

        # LOW: within 48h + clicked, no name match
        if hours_diff <= 48 and clicked and not best_confidence:
            best_match = response
            best_confidence = "low"
            best_method = "time+click"

    if best_match:
        review.matched_response_id = best_match.id
        review.match_confidence = best_confidence
        review.match_method = best_method
        best_match.google_review_matched = True
        best_match.google_review_matched_at = datetime.now(timezone.utc)
        return True

    return False


# ============================================================================
# Batch Sync (called by scheduler)
# ============================================================================

def sync_all_businesses(db: Session) -> Dict[str, Any]:
    """Sync reviews for all businesses with active Google connections."""
    connections = db.query(GoogleOAuthConnection).filter(
        GoogleOAuthConnection.is_active == True  # noqa: E712
    ).all()

    results = {"total": 0, "synced": 0, "errors": 0}

    for conn in connections:
        now = datetime.now(timezone.utc)

        # Check sync frequency
        if conn.last_synced_at:
            freq_hours = {"1h": 1, "6h": 6, "12h": 12, "24h": 24}.get(conn.sync_frequency, 6)
            if (now - conn.last_synced_at).total_seconds() < freq_hours * 3600:
                continue

        # Get all linked businesses for this user
        links = db.query(GoogleLocationLink).filter(
            GoogleLocationLink.user_id == conn.user_id
        ).all()

        for link in links:
            results["total"] += 1
            try:
                stats = sync_reviews_for_business(db, link.business_id)
                if "error" not in stats:
                    results["synced"] += 1
                    logger.info(f"Synced reviews for business {link.business_id}: {stats}")
                else:
                    results["errors"] += 1
                    logger.warning(f"Sync error for business {link.business_id}: {stats}")
            except Exception as e:
                results["errors"] += 1
                logger.error(f"Failed to sync reviews for business {link.business_id}: {e}")

    return results


# ============================================================================
# Conversion Stats
# ============================================================================

def get_conversion_stats(db: Session, business_id: str) -> Dict[str, Any]:
    """Get conversion funnel stats for a business."""
    # Total promoters
    total_promoters = (
        db.query(FeedbackResponse)
        .join(FeedbackRequest, FeedbackResponse.request_id == FeedbackRequest.id)
        .filter(
            FeedbackRequest.business_id == business_id,
            FeedbackResponse.classification == "promoter",
        )
        .count()
    )

    # Promoters who clicked Google review link
    clicked = (
        db.query(FeedbackResponse)
        .join(FeedbackRequest, FeedbackResponse.request_id == FeedbackRequest.id)
        .filter(
            FeedbackRequest.business_id == business_id,
            FeedbackResponse.classification == "promoter",
            FeedbackResponse.google_review_clicked == True,  # noqa: E712
        )
        .count()
    )

    # Matched reviews (confirmed conversions)
    matched = (
        db.query(FeedbackResponse)
        .join(FeedbackRequest, FeedbackResponse.request_id == FeedbackRequest.id)
        .filter(
            FeedbackRequest.business_id == business_id,
            FeedbackResponse.google_review_matched == True,  # noqa: E712
        )
        .count()
    )

    # Total synced reviews
    total_reviews = (
        db.query(GoogleReview)
        .filter(GoogleReview.business_id == business_id)
        .count()
    )

    # Match confidence breakdown
    high_confidence = db.query(GoogleReview).filter(
        GoogleReview.business_id == business_id,
        GoogleReview.match_confidence == "high",
    ).count()
    medium_confidence = db.query(GoogleReview).filter(
        GoogleReview.business_id == business_id,
        GoogleReview.match_confidence == "medium",
    ).count()
    low_confidence = db.query(GoogleReview).filter(
        GoogleReview.business_id == business_id,
        GoogleReview.match_confidence == "low",
    ).count()

    return {
        "total_promoters": total_promoters,
        "clicked_google_review": clicked,
        "matched_reviews": matched,
        "total_google_reviews": total_reviews,
        "click_rate": round(clicked / total_promoters * 100, 1) if total_promoters > 0 else 0,
        "conversion_rate": round(matched / total_promoters * 100, 1) if total_promoters > 0 else 0,
        "confidence_breakdown": {
            "high": high_confidence,
            "medium": medium_confidence,
            "low": low_confidence,
        },
    }


def get_synced_reviews(
    db: Session, business_id: str, limit: int = 50, offset: int = 0
) -> Dict[str, Any]:
    """Get paginated synced reviews for a business."""
    query = db.query(GoogleReview).filter(
        GoogleReview.business_id == business_id
    ).order_by(GoogleReview.review_create_time.desc())

    total = query.count()
    reviews = query.offset(offset).limit(limit).all()

    return {
        "total": total,
        "reviews": [
            {
                "id": r.id,
                "google_review_id": r.google_review_id,
                "reviewer_name": r.reviewer_name,
                "star_rating": r.star_rating,
                "review_text": r.review_text,
                "review_create_time": r.review_create_time.isoformat() if r.review_create_time else None,
                "matched_response_id": r.matched_response_id,
                "match_confidence": r.match_confidence,
                "match_method": r.match_method,
                "synced_at": r.synced_at.isoformat() if r.synced_at else None,
            }
            for r in reviews
        ],
    }


# ============================================================================
# Settings
# ============================================================================

def update_sync_frequency(db: Session, user_id: str, frequency: str) -> bool:
    if frequency not in ("1h", "6h", "12h", "24h"):
        return False
    conn = get_connection(db, user_id)
    if not conn:
        return False
    conn.sync_frequency = frequency
    conn.updated_at = datetime.now(timezone.utc)
    db.commit()
    return True
