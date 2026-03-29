"""
Follow-up Service

Handles NPS follow-up logic:
- Sends reminder messages to customers who haven't responded
- Maximum 3 attempts (1 initial + 2 follow-ups)
- Configurable intervals between attempts

Flow:
1. Initial send (follow_up_count = 1)
2. After 24h without response → 1st follow-up (follow_up_count = 2)
3. After 48h without response → 2nd follow-up (follow_up_count = 3)
4. After 3rd attempt → mark as expired
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from models import FeedbackRequest, FeedbackStatus, Business, Project

logger = logging.getLogger(__name__)

# Follow-up configuration
MAX_FOLLOW_UPS = 3  # Maximum total attempts (1 initial + 2 follow-ups)
FOLLOW_UP_INTERVALS_HOURS = [24, 48]  # Hours after each attempt


def get_follow_up_message(attempt: int, business_name: str, customer_name: Optional[str] = None) -> str:
    """
    Generate follow-up message based on attempt number.

    Args:
        attempt: Current attempt number (2 = 1st follow-up, 3 = 2nd follow-up)
        business_name: Name of the business
        customer_name: Customer's name (optional)
    """
    greeting = f" {customer_name.split()[0]}" if customer_name else ""

    messages = {
        2: (
            f"Oi{greeting}! 👋\n\n"
            f"Ainda não recebemos sua avaliação sobre *{business_name}*.\n\n"
            f"Leva menos de 1 minuto! De 0 a 10, qual nota você nos dá?"
        ),
        3: (
            f"Olá{greeting}! 😊\n\n"
            f"Última tentativa! Gostaríamos muito de saber sua opinião sobre *{business_name}*.\n\n"
            f"De 0 a 10, qual nota você nos dá?\n"
            f"(Responda apenas o número)"
        ),
    }

    return messages.get(attempt, messages[2])


def schedule_next_follow_up(request: FeedbackRequest, db: Session) -> None:
    """
    Schedule the next follow-up for a request after it's sent.
    Called after initial send or after a follow-up is sent.
    """
    if request.follow_up_count >= MAX_FOLLOW_UPS:
        # No more follow-ups, clear next_follow_up_at
        request.next_follow_up_at = None
        db.commit()
        return

    # Calculate next follow-up time based on current attempt
    # follow_up_count=1 (initial) → schedule for 24h later (index 0)
    # follow_up_count=2 (1st follow-up) → schedule for 48h later (index 1)
    interval_index = request.follow_up_count - 1
    if interval_index < len(FOLLOW_UP_INTERVALS_HOURS):
        hours = FOLLOW_UP_INTERVALS_HOURS[interval_index]
        request.next_follow_up_at = datetime.now(timezone.utc) + timedelta(hours=hours)
        logger.info(f"Scheduled follow-up for request {request.id} in {hours} hours")
    else:
        request.next_follow_up_at = None

    db.commit()


def get_pending_follow_ups(db: Session) -> List[FeedbackRequest]:
    """
    Get all feedback requests that need follow-up.

    Criteria:
    - Status is sent, delivered, or read (not responded or expired)
    - follow_up_count < MAX_FOLLOW_UPS
    - next_follow_up_at <= now
    - Has no response yet
    """
    now = datetime.now(timezone.utc)

    requests = db.query(FeedbackRequest).filter(
        and_(
            FeedbackRequest.status.in_([
                FeedbackStatus.SENT,
                FeedbackStatus.DELIVERED,
                FeedbackStatus.READ
            ]),
            FeedbackRequest.follow_up_count < MAX_FOLLOW_UPS,
            FeedbackRequest.next_follow_up_at <= now,
            FeedbackRequest.next_follow_up_at.isnot(None)
        )
    ).all()

    # Filter out requests that already have a response
    pending = [r for r in requests if r.response is None]

    return pending


async def send_follow_up(request: FeedbackRequest, db: Session) -> bool:
    """
    Send a follow-up message for a single request.

    Returns:
        True if message was sent successfully
    """
    from services.whatsapp_service import get_service as get_whatsapp_service

    business = request.business
    if not business or not business.is_active:
        logger.warning(f"Business not found or inactive for request {request.id}")
        return False

    # Get the follow-up message
    next_attempt = request.follow_up_count + 1
    message = get_follow_up_message(
        attempt=next_attempt,
        business_name=business.name,
        customer_name=request.customer_name
    )

    # Send via WhatsApp
    whatsapp = get_whatsapp_service()
    result = await whatsapp.send_message(
        to=request.customer_phone,
        message=message,
        instance_id=business.whatsapp_instance_id
    )

    if result.success:
        # Update follow-up tracking
        request.follow_up_count = next_attempt
        request.last_follow_up_at = datetime.now(timezone.utc)

        # Update conversation state back to awaiting_score
        request.conversation_state = "awaiting_score"

        # Schedule next follow-up (or clear if max reached)
        if next_attempt >= MAX_FOLLOW_UPS:
            request.next_follow_up_at = None
            logger.info(f"Request {request.id} reached max follow-ups ({MAX_FOLLOW_UPS})")
        else:
            # Schedule next follow-up
            interval_index = next_attempt - 1
            if interval_index < len(FOLLOW_UP_INTERVALS_HOURS):
                hours = FOLLOW_UP_INTERVALS_HOURS[interval_index]
                request.next_follow_up_at = datetime.now(timezone.utc) + timedelta(hours=hours)

        db.commit()

        logger.info(f"Follow-up {next_attempt} sent for request {request.id} to {request.customer_phone}")
        return True
    else:
        logger.error(f"Failed to send follow-up for request {request.id}: {result.error}")
        return False


async def process_all_follow_ups(db: Session) -> Dict[str, int]:
    """
    Process all pending follow-ups.
    Called by the scheduler job.

    Returns:
        Dictionary with counts: total, sent, failed, skipped
    """
    pending = get_pending_follow_ups(db)

    results = {
        "total": len(pending),
        "sent": 0,
        "failed": 0,
        "skipped": 0
    }

    for request in pending:
        # Double-check the request still needs follow-up
        db.refresh(request)

        if request.response is not None:
            # Customer responded in the meantime
            results["skipped"] += 1
            request.next_follow_up_at = None
            db.commit()
            continue

        success = await send_follow_up(request, db)

        if success:
            results["sent"] += 1
        else:
            results["failed"] += 1

    logger.info(f"Follow-up processing complete: {results}")
    return results


def mark_expired_requests(db: Session) -> int:
    """
    Mark requests as expired if they've reached max follow-ups
    and haven't received a response after 72 hours.

    Returns:
        Number of requests marked as expired
    """
    # Requests that have max follow-ups and last follow-up was > 72h ago
    cutoff = datetime.now(timezone.utc) - timedelta(hours=72)

    expired_requests = db.query(FeedbackRequest).filter(
        and_(
            FeedbackRequest.status.in_([
                FeedbackStatus.SENT,
                FeedbackStatus.DELIVERED,
                FeedbackStatus.READ
            ]),
            FeedbackRequest.follow_up_count >= MAX_FOLLOW_UPS,
            FeedbackRequest.last_follow_up_at <= cutoff,
            FeedbackRequest.next_follow_up_at.is_(None)
        )
    ).all()

    # Filter out requests that have a response
    to_expire = [r for r in expired_requests if r.response is None]

    for request in to_expire:
        request.status = FeedbackStatus.EXPIRED
        logger.info(f"Request {request.id} marked as expired (no response after {MAX_FOLLOW_UPS} attempts)")

    if to_expire:
        db.commit()

    return len(to_expire)
