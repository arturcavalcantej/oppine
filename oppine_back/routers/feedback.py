"""
Feedback Management API Routes.

Handles feedback requests, responses, and webhooks.
"""
import uuid
import logging
from typing import List, Optional
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from pydantic import BaseModel

from database import get_db, SessionLocal
from auth import verify_token
from models import (
    Business, FeedbackTemplate, FeedbackRequest, FeedbackResponse,
    AlertNotification, Project, ProjectMember, FeedbackStatus, FeedbackScore,
    DailyUsage
)
from services.whatsapp_service import get_service as get_whatsapp_service, MessageStatus
from services.whatsapp_pool_service import get_whatsapp_pool
import re

logger = logging.getLogger(__name__)


def normalize_phone_brazil(phone: str) -> str:
    """Normalize phone number to E.164 format with Brazil country code."""
    if not phone:
        return phone

    # Remove all non-digits
    digits = re.sub(r'\D', '', phone)

    # Add Brazil country code if not present
    if len(digits) == 10 or len(digits) == 11:
        digits = f"55{digits}"
    elif len(digits) == 12 or len(digits) == 13:
        if not digits.startswith('55'):
            digits = f"55{digits}"

    return digits

router = APIRouter(
    prefix="/feedback",
    tags=["feedback"]
)


# ============================================================================
# Pydantic Schemas
# ============================================================================

class FeedbackRequestCreate(BaseModel):
    """Schema for creating a feedback request."""
    business_id: str
    template_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: str
    customer_email: Optional[str] = None
    transaction_id: Optional[str] = None
    transaction_date: Optional[datetime] = None
    transaction_amount: Optional[str] = None
    send_immediately: bool = True


class FeedbackRequestBulkCreate(BaseModel):
    """Schema for bulk creating feedback requests."""
    business_id: str
    template_id: Optional[str] = None
    customers: List[dict]  # List of {name, phone, email, transaction_id, etc.}
    send_immediately: bool = True


class FeedbackRequestResponse(BaseModel):
    """Schema for feedback request response."""
    id: str
    business_id: str
    template_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: str
    customer_email: Optional[str] = None
    transaction_id: Optional[str] = None
    transaction_date: Optional[datetime] = None
    status: str
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    created_at: datetime
    # Response data if available
    response: Optional[dict] = None

    class Config:
        from_attributes = True


class FeedbackResponseCreate(BaseModel):
    """Schema for submitting a feedback response (from customer)."""
    score: int  # 0-10
    comment: Optional[str] = None


class FeedbackResponseData(BaseModel):
    """Schema for feedback response data."""
    id: str
    request_id: str
    score: int
    classification: str
    comment: Optional[str] = None
    testimonial_text: Optional[str] = None
    testimonial_approved: bool
    google_review_clicked: bool
    google_review_completed: bool
    alert_sent: bool
    issue_resolved: bool
    resolution_notes: Optional[str] = None
    responded_at: datetime
    # Request data
    customer_name: Optional[str] = None
    customer_phone: str
    business_name: str

    class Config:
        from_attributes = True


class GoogleConversionStats(BaseModel):
    """Schema for Google review conversion metrics."""
    total_promoters: int = 0
    clicked_google_review: int = 0
    matched_reviews: int = 0
    total_google_reviews: int = 0
    click_rate: float = 0
    conversion_rate: float = 0


class DashboardStats(BaseModel):
    """Schema for dashboard statistics."""
    total_requests: int
    total_responses: int
    response_rate: float
    average_score: Optional[float]
    nps_score: Optional[float]  # Net Promoter Score
    promoters: int
    passives: int
    detractors: int
    pending_alerts: int
    resolved_issues: int
    google_conversion: Optional[GoogleConversionStats] = None


# ============================================================================
# Helper Functions
# ============================================================================

def increment_message_count(user_id: str, db: Session) -> None:
    """
    Increment the daily WhatsApp message counter for usage tracking.
    Creates a new DailyUsage record if one doesn't exist for today.
    """
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    # Try to find existing record for today
    usage = db.query(DailyUsage).filter(
        DailyUsage.user_id == user_id,
        DailyUsage.date == today
    ).first()

    if usage:
        usage.messages_sent = (usage.messages_sent or 0) + 1
    else:
        # Create new record for today
        usage = DailyUsage(
            id=str(uuid.uuid4()),
            user_id=user_id,
            date=today,
            messages_sent=1
        )
        db.add(usage)

    db.commit()
    logger.debug(f"Incremented message count for user {user_id}")


def verify_business_access(business_id: str, user_uid: str, db: Session) -> Business:
    """Verify user has access to the business via project."""
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    project = db.query(Project).filter(Project.id == business.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project.owner_id == user_uid
    is_member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project.id,
        ProjectMember.user_id == user_uid
    ).first() is not None

    if not is_owner and not is_member:
        raise HTTPException(status_code=403, detail="Access denied")

    return business


def classify_score(score: int, business: Business) -> str:
    """Classify a score as promoter, passive, or detractor."""
    if score >= business.promoter_threshold:
        return FeedbackScore.PROMOTER
    elif score <= business.detractor_threshold:
        return FeedbackScore.DETRACTOR
    else:
        return FeedbackScore.PASSIVE


def format_message(template: str, context: dict) -> str:
    """Format a template message with context variables."""
    for key, value in context.items():
        template = template.replace(f"{{{key}}}", str(value) if value else "")
    return template


async def send_feedback_request_task(
    request_id: str,
    business_id: str,
    template_id: Optional[str]
):
    """Background task wrapper - creates its own DB session."""
    db = SessionLocal()
    try:
        request = db.query(FeedbackRequest).filter(FeedbackRequest.id == request_id).first()
        business = db.query(Business).filter(Business.id == business_id).first()
        template = db.query(FeedbackTemplate).filter(FeedbackTemplate.id == template_id).first() if template_id else None

        if request and business:
            await send_feedback_request(request, business, template, db)
    finally:
        db.close()


async def send_feedback_request(
    request: FeedbackRequest,
    business: Business,
    template: Optional[FeedbackTemplate],
    db: Session
):
    """Send a feedback request via WhatsApp (conversational NPS)."""

    # Build conversational NPS message (asks for score directly, no link)
    customer_name = request.customer_name.split()[0] if request.customer_name else ""
    initial_state = "awaiting_score"  # Default state

    # Check if template has a pre_message (open question before NPS)
    if template and template.pre_message:
        message = format_message(template.pre_message, {
            "customer_name": request.customer_name or "Cliente",
            "business_name": business.name,
        })
        initial_state = "awaiting_pre_response"
    # Priority: 1) business.nps_message, 2) template, 3) default
    elif business.nps_message:
        # Use custom NPS message from business settings
        message = business.nps_message.replace(
            "{customer_name}", f" {customer_name}" if customer_name else ""
        ).replace(
            "{business_name}", business.name
        )
    elif template and template.initial_message and "{feedback_link}" not in template.initial_message:
        # Use template if it doesn't have feedback_link (conversational style)
        message = format_message(template.initial_message, {
            "customer_name": request.customer_name or "Cliente",
            "business_name": business.name,
        })
    else:
        # Default conversational message
        customer_greeting = f" {customer_name}" if customer_name else ""
        message = (
            f"Ola{customer_greeting}! Obrigado por escolher {business.name}.\n\n"
            f"De 0 a 10, qual a chance de voce nos recomendar para amigos ou familiares?"
        )

    # Send message - use pool if no specific instance configured
    instance_id_used = None

    if business.whatsapp_instance_id:
        # Business has specific instance - use it directly
        whatsapp = get_whatsapp_service()
        result = await whatsapp.send_message(
            to=request.customer_phone,
            message=message,
            instance_id=business.whatsapp_instance_id
        )
        instance_id_used = business.whatsapp_instance_id
    else:
        # No specific instance - use shared pool
        pool = get_whatsapp_pool()
        result, instance_id_used = await pool.send_message(
            to=request.customer_phone,
            message=message,
            db=db
        )
        logger.info(f"Used pool instance {instance_id_used} for business {business.id}")

    # Update request status
    if result.success:
        request.status = FeedbackStatus.SENT
        request.whatsapp_message_id = result.message_id
        request.sent_at = datetime.now(timezone.utc)
        request.conversation_state = initial_state
        request.response_channel = "whatsapp"
        request.sent_from_instance_id = instance_id_used  # Track which instance sent this

        # Save remoteJid from response for matching incoming messages
        if result.raw_response:
            remote_jid = result.raw_response.get("key", {}).get("remoteJid")
            if remote_jid:
                request.whatsapp_remote_jid = remote_jid
                logger.info(f"Saved remoteJid: {remote_jid}")

        # Set follow-up tracking (1st attempt = initial send)
        request.follow_up_count = 1
        request.last_follow_up_at = datetime.now(timezone.utc)
        # Schedule 1st follow-up for 24 hours later
        request.next_follow_up_at = datetime.now(timezone.utc) + timedelta(hours=24)

        # Increment message counter for usage tracking
        project = db.query(Project).filter(Project.id == business.project_id).first()
        if project:
            increment_message_count(project.owner_id, db)

        logger.info(f"Feedback request sent: {request.id} to {request.customer_phone}")
    else:
        request.status = FeedbackStatus.FAILED
        logger.error(f"Failed to send feedback request {request.id}: {result.error}")

    db.commit()
    return result


async def send_alert_notification(
    response: FeedbackResponse,
    request: FeedbackRequest,
    business: Business,
    db: Session
):
    """Send alert notification to business owner for negative feedback."""
    logger.info(f"send_alert_notification called for response {response.id}, business {business.name}, alert_phone={business.alert_phone}")

    # Skip if alert was already sent
    if response.alert_sent:
        logger.info(f"Alert already sent for response {response.id}, skipping")
        return

    if not business.alert_phone:
        logger.warning(f"No alert_phone configured for business {business.id} ({business.name}), skipping alert")
        return

    whatsapp = get_whatsapp_service()

    alert_message = (
        f"⚠️ ALERTA DE FEEDBACK NEGATIVO\n\n"
        f"Negócio: {business.name}\n"
        f"Cliente: {request.customer_name or 'Não informado'}\n"
        f"Telefone: {request.customer_phone}\n"
        f"Nota: {response.score}/10\n"
        f"Comentário: {response.comment or 'Sem comentário'}\n\n"
        f"Recomendamos entrar em contato para resolver a situação."
    )

    alert = AlertNotification(
        id=str(uuid.uuid4()),
        response_id=response.id,
        business_id=business.id,
        alert_type="whatsapp" if business.alert_phone else "email",
        message_content=alert_message
    )

    # Send via WhatsApp if configured
    if business.alert_phone:
        # Normalize phone number to include Brazil country code
        alert_phone_normalized = normalize_phone_brazil(business.alert_phone)
        logger.info(f"Sending alert to normalized phone: {alert_phone_normalized} (original: {business.alert_phone})")

        if business.whatsapp_instance_id:
            # Business has specific instance
            result = await whatsapp.send_message(
                to=alert_phone_normalized,
                message=alert_message,
                instance_id=business.whatsapp_instance_id
            )
        else:
            # Use pool
            pool = get_whatsapp_pool()
            result, _ = await pool.send_message(
                to=alert_phone_normalized,
                message=alert_message,
                db=db
            )

        if result.success:
            alert.whatsapp_sent = True
            alert.whatsapp_sent_at = datetime.now(timezone.utc)
            logger.info(f"Alert WhatsApp sent to {business.alert_phone}")
        else:
            logger.error(f"Failed to send alert WhatsApp to {business.alert_phone}: {result.error}")


    # TODO: Send via email if configured

    db.add(alert)
    response.alert_sent = True
    response.alert_sent_at = datetime.now(timezone.utc)
    db.commit()

    logger.info(f"Alert sent for response {response.id}")


# Default delay in seconds before sending detractor alert (waiting for possible comment)
DETRACTOR_ALERT_DELAY_SECONDS = 180  # 3 minutes


async def send_delayed_alert(
    response_id: str,
    request_id: str,
    business_id: str,
    delay_seconds: int = DETRACTOR_ALERT_DELAY_SECONDS
):
    """
    Wait for a delay period then send alert if comment hasn't arrived.
    This gives the customer time to add a comment before the alert is sent.
    """
    import asyncio
    from database import SessionLocal

    logger.info(f"Scheduled delayed alert for response {response_id} in {delay_seconds} seconds")

    # Wait for the delay period
    await asyncio.sleep(delay_seconds)

    # Create a new database session (the original may be closed)
    db = SessionLocal()
    try:
        # Reload the response from database to check current state
        response = db.query(FeedbackResponse).filter(FeedbackResponse.id == response_id).first()
        if not response:
            logger.warning(f"Response {response_id} not found for delayed alert")
            return

        # Check if alert was already sent (comment arrived and triggered immediate alert)
        if response.alert_sent:
            logger.info(f"Alert already sent for response {response_id}, skipping delayed alert")
            return

        # Load request and business
        request = db.query(FeedbackRequest).filter(FeedbackRequest.id == request_id).first()
        business = db.query(Business).filter(Business.id == business_id).first()

        if not request or not business:
            logger.warning(f"Request or business not found for delayed alert")
            return

        # Send the alert (with or without comment depending on what was received)
        logger.info(f"Sending delayed alert for response {response_id} (comment: {response.comment or 'sem comentário'})")
        await send_alert_notification(response, request, business, db)

    except Exception as e:
        logger.error(f"Error in delayed alert task: {e}")
    finally:
        db.close()


# ============================================================================
# Feedback Request Endpoints
# ============================================================================

@router.post("/requests", response_model=FeedbackRequestResponse)
async def create_feedback_request(
    data: FeedbackRequestCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """Create a new feedback request."""
    user_uid = token.get("uid")
    business = verify_business_access(data.business_id, user_uid, db)

    # Get template - priority: 1) explicit template_id, 2) business.template_id, 3) default by business_id
    template = None
    if data.template_id:
        template = db.query(FeedbackTemplate).filter(
            FeedbackTemplate.id == data.template_id
        ).first()
    elif business.template_id:
        # Use the template configured on the business
        template = db.query(FeedbackTemplate).filter(
            FeedbackTemplate.id == business.template_id
        ).first()
    else:
        # Fallback: find default template by business_id
        template = db.query(FeedbackTemplate).filter(
            FeedbackTemplate.business_id == data.business_id,
            FeedbackTemplate.is_default == True,
            FeedbackTemplate.is_active == True
        ).first()

    # Create feedback request
    feedback_request = FeedbackRequest(
        id=str(uuid.uuid4()),
        business_id=data.business_id,
        template_id=template.id if template else None,
        customer_name=data.customer_name,
        customer_phone=data.customer_phone,
        customer_email=data.customer_email,
        transaction_id=data.transaction_id,
        transaction_date=data.transaction_date,
        transaction_amount=data.transaction_amount,
        status=FeedbackStatus.PENDING,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7)
    )

    db.add(feedback_request)
    db.commit()
    db.refresh(feedback_request)

    # Send immediately if requested
    if data.send_immediately:
        background_tasks.add_task(
            send_feedback_request_task,
            feedback_request.id,
            business.id,
            template.id if template else None
        )

    return FeedbackRequestResponse(
        id=feedback_request.id,
        business_id=feedback_request.business_id,
        template_id=feedback_request.template_id,
        customer_name=feedback_request.customer_name,
        customer_phone=feedback_request.customer_phone,
        customer_email=feedback_request.customer_email,
        transaction_id=feedback_request.transaction_id,
        transaction_date=feedback_request.transaction_date,
        status=feedback_request.status,
        sent_at=feedback_request.sent_at,
        delivered_at=feedback_request.delivered_at,
        read_at=feedback_request.read_at,
        created_at=feedback_request.created_at
    )


@router.post("/requests/bulk")
async def create_bulk_feedback_requests(
    data: FeedbackRequestBulkCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """Create multiple feedback requests at once."""
    user_uid = token.get("uid")
    business = verify_business_access(data.business_id, user_uid, db)

    # Get template - priority: 1) explicit template_id, 2) business.template_id, 3) default by business_id
    template = None
    if data.template_id:
        template = db.query(FeedbackTemplate).filter(
            FeedbackTemplate.id == data.template_id
        ).first()
    elif business.template_id:
        # Use the template configured on the business
        template = db.query(FeedbackTemplate).filter(
            FeedbackTemplate.id == business.template_id
        ).first()
    else:
        # Fallback: find default template by business_id
        template = db.query(FeedbackTemplate).filter(
            FeedbackTemplate.business_id == data.business_id,
            FeedbackTemplate.is_default == True,
            FeedbackTemplate.is_active == True
        ).first()

    created = []
    for customer in data.customers:
        feedback_request = FeedbackRequest(
            id=str(uuid.uuid4()),
            business_id=data.business_id,
            template_id=template.id if template else None,
            customer_name=customer.get("name"),
            customer_phone=customer.get("phone"),
            customer_email=customer.get("email"),
            transaction_id=customer.get("transaction_id"),
            status=FeedbackStatus.PENDING,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7)
        )
        db.add(feedback_request)
        created.append(feedback_request)

    db.commit()

    # Send all if requested
    if data.send_immediately:
        for req in created:
            background_tasks.add_task(
                send_feedback_request_task,
                req.id,
                business.id,
                template.id if template else None
            )

    return {
        "created": len(created),
        "ids": [r.id for r in created]
    }


@router.get("/requests", response_model=List[FeedbackRequestResponse])
def list_feedback_requests(
    business_id: str,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """List feedback requests for a business."""
    user_uid = token.get("uid")
    verify_business_access(business_id, user_uid, db)

    query = db.query(FeedbackRequest).filter(
        FeedbackRequest.business_id == business_id
    )

    if status:
        query = query.filter(FeedbackRequest.status == status)

    requests = query.order_by(
        FeedbackRequest.created_at.desc()
    ).offset(offset).limit(limit).all()

    result = []
    for req in requests:
        response_data = None
        if req.response:
            response_data = {
                "score": req.response.score,
                "classification": req.response.classification,
                "comment": req.response.comment,
                "responded_at": req.response.responded_at.isoformat() if req.response.responded_at else None
            }

        result.append(FeedbackRequestResponse(
            id=req.id,
            business_id=req.business_id,
            template_id=req.template_id,
            customer_name=req.customer_name,
            customer_phone=req.customer_phone,
            customer_email=req.customer_email,
            transaction_id=req.transaction_id,
            transaction_date=req.transaction_date,
            status=req.status,
            sent_at=req.sent_at,
            delivered_at=req.delivered_at,
            read_at=req.read_at,
            created_at=req.created_at,
            response=response_data
        ))

    return result


@router.post("/requests/{request_id}/send")
async def send_request(
    request_id: str,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """Manually send a pending feedback request."""
    user_uid = token.get("uid")

    feedback_request = db.query(FeedbackRequest).filter(
        FeedbackRequest.id == request_id
    ).first()

    if not feedback_request:
        raise HTTPException(status_code=404, detail="Request not found")

    business = verify_business_access(feedback_request.business_id, user_uid, db)

    template = None
    if feedback_request.template_id:
        template = db.query(FeedbackTemplate).filter(
            FeedbackTemplate.id == feedback_request.template_id
        ).first()

    result = await send_feedback_request(feedback_request, business, template, db)

    return {
        "success": result.success,
        "message_id": result.message_id,
        "error": result.error
    }


# ============================================================================
# Public Endpoints (No Auth) - For QR Code / Link flow
# ============================================================================

class PublicFeedbackRequestCreate(BaseModel):
    """Schema for public feedback request creation (self-registration via QR Code)."""
    business_id: str
    customer_phone: str
    customer_name: Optional[str] = None


class PublicBusinessInfo(BaseModel):
    """Schema for public business info."""
    id: str
    name: str
    logo_url: Optional[str] = None


@router.get("/public/business/{business_id}", response_model=PublicBusinessInfo)
def get_public_business_info(
    business_id: str,
    db: Session = Depends(get_db)
):
    """Get public info for a business (for QR Code landing page)."""
    business = db.query(Business).filter(
        Business.id == business_id,
        Business.is_active == True
    ).first()

    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    return PublicBusinessInfo(
        id=business.id,
        name=business.name,
        logo_url=getattr(business, 'logo_url', None)  # logo_url may not exist yet
    )


@router.post("/public/request")
async def create_public_feedback_request(
    data: PublicFeedbackRequestCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Create a feedback request from public form (QR Code flow)."""
    # Validate business exists and is active
    business = db.query(Business).filter(
        Business.id == data.business_id,
        Business.is_active == True
    ).first()

    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    # Get template - priority: 1) business.template_id, 2) default by business_id
    template = None
    if business.template_id:
        template = db.query(FeedbackTemplate).filter(
            FeedbackTemplate.id == business.template_id
        ).first()
    else:
        template = db.query(FeedbackTemplate).filter(
            FeedbackTemplate.business_id == data.business_id,
            FeedbackTemplate.is_default == True,
            FeedbackTemplate.is_active == True
        ).first()

    # Create feedback request
    feedback_request = FeedbackRequest(
        id=str(uuid.uuid4()),
        business_id=data.business_id,
        template_id=template.id if template else None,
        customer_name=data.customer_name,
        customer_phone=data.customer_phone,
        status=FeedbackStatus.PENDING,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7)
    )

    db.add(feedback_request)
    db.commit()
    db.refresh(feedback_request)

    # Send immediately
    background_tasks.add_task(
        send_feedback_request_task,
        feedback_request.id,
        business.id,
        template.id if template else None
    )

    logger.info(f"Public feedback request created: {feedback_request.id} for {data.customer_phone}")

    return {
        "success": True,
        "request_id": feedback_request.id,
        "message": "Feedback request created successfully"
    }


@router.get("/public/{request_id}")
def get_public_feedback_info(
    request_id: str,
    db: Session = Depends(get_db)
):
    """Get public info for a feedback request (for the customer form)."""
    feedback_request = db.query(FeedbackRequest).filter(
        FeedbackRequest.id == request_id
    ).first()

    if not feedback_request:
        raise HTTPException(status_code=404, detail="Feedback request not found")

    # Check if already responded
    if feedback_request.response:
        return {
            "already_responded": True,
            "business_name": feedback_request.business.name
        }

    # Check if expired
    if feedback_request.expires_at:
        expires_at = feedback_request.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            return {
                "expired": True,
                "business_name": feedback_request.business.name
            }

    return {
        "already_responded": False,
        "expired": False,
        "business_name": feedback_request.business.name,
        "customer_name": feedback_request.customer_name
    }


@router.post("/public/{request_id}/respond")
async def submit_feedback_response(
    request_id: str,
    data: FeedbackResponseCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Submit a feedback response (public endpoint for customers)."""
    feedback_request = db.query(FeedbackRequest).filter(
        FeedbackRequest.id == request_id
    ).first()

    if not feedback_request:
        raise HTTPException(status_code=404, detail="Feedback request not found")

    # Check if already responded
    if feedback_request.response:
        raise HTTPException(status_code=400, detail="Already responded")

    # Check if expired
    if feedback_request.expires_at:
        expires_at = feedback_request.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Request expired")

    # Validate score
    if data.score < 0 or data.score > 10:
        raise HTTPException(status_code=400, detail="Score must be between 0 and 10")

    business = feedback_request.business
    classification = classify_score(data.score, business)

    # Create response
    response = FeedbackResponse(
        id=str(uuid.uuid4()),
        request_id=request_id,
        score=data.score,
        classification=classification,
        comment=data.comment
    )

    db.add(response)
    feedback_request.status = FeedbackStatus.RESPONDED
    db.commit()

    # Handle based on classification
    result = {
        "success": True,
        "classification": classification,
        "score": data.score
    }

    if classification == FeedbackScore.PROMOTER and business.google_review_url:
        # Redirect to Google Review
        result["google_review_url"] = business.google_review_url
        result["message"] = "Obrigado pelo feedback! Por favor, considere nos avaliar no Google."

    elif classification == FeedbackScore.DETRACTOR:
        # Send alert to business
        background_tasks.add_task(
            send_alert_notification,
            response,
            feedback_request,
            business,
            db
        )
        result["message"] = "Obrigado pelo feedback. Lamentamos que sua experiência não tenha sido satisfatória. Entraremos em contato em breve."

    else:
        result["message"] = "Obrigado pelo seu feedback!"

    logger.info(f"Feedback response received: {response.id} (score: {data.score}, classification: {classification})")

    return result


# ============================================================================
# Feedback Response Endpoints (Authenticated)
# ============================================================================

@router.get("/responses", response_model=List[FeedbackResponseData])
def list_feedback_responses(
    business_id: str,
    classification: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """List feedback responses for a business."""
    user_uid = token.get("uid")
    business = verify_business_access(business_id, user_uid, db)

    query = db.query(FeedbackResponse).join(FeedbackRequest).filter(
        FeedbackRequest.business_id == business_id
    )

    if classification:
        query = query.filter(FeedbackResponse.classification == classification)

    responses = query.order_by(
        FeedbackResponse.responded_at.desc()
    ).offset(offset).limit(limit).all()

    result = []
    for resp in responses:
        result.append(FeedbackResponseData(
            id=resp.id,
            request_id=resp.request_id,
            score=resp.score,
            classification=resp.classification,
            comment=resp.comment,
            testimonial_text=resp.testimonial_text,
            testimonial_approved=resp.testimonial_approved,
            google_review_clicked=resp.google_review_clicked,
            google_review_completed=resp.google_review_completed,
            alert_sent=resp.alert_sent,
            issue_resolved=resp.issue_resolved,
            resolution_notes=resp.resolution_notes,
            responded_at=resp.responded_at,
            customer_name=resp.request.customer_name,
            customer_phone=resp.request.customer_phone,
            business_name=business.name
        ))

    return result


@router.patch("/responses/{response_id}/resolve")
def mark_issue_resolved(
    response_id: str,
    resolution_notes: Optional[str] = None,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """Mark a detractor issue as resolved."""
    user_uid = token.get("uid")

    response = db.query(FeedbackResponse).filter(
        FeedbackResponse.id == response_id
    ).first()

    if not response:
        raise HTTPException(status_code=404, detail="Response not found")

    verify_business_access(response.request.business_id, user_uid, db)

    response.issue_resolved = True
    response.resolution_notes = resolution_notes
    db.commit()

    return {"message": "Issue marked as resolved"}


# ============================================================================
# Dashboard/Stats Endpoint
# ============================================================================

@router.get("/dashboard/{business_id}", response_model=DashboardStats)
def get_dashboard_stats(
    business_id: str,
    days: int = 30,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """Get dashboard statistics for a business."""
    user_uid = token.get("uid")
    verify_business_access(business_id, user_uid, db)

    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Total requests in period
    total_requests = db.query(func.count(FeedbackRequest.id)).filter(
        FeedbackRequest.business_id == business_id,
        FeedbackRequest.created_at >= since
    ).scalar() or 0

    # Total responses in period
    total_responses = db.query(func.count(FeedbackResponse.id)).join(
        FeedbackRequest
    ).filter(
        FeedbackRequest.business_id == business_id,
        FeedbackResponse.responded_at >= since
    ).scalar() or 0

    # Response rate
    response_rate = (total_responses / total_requests * 100) if total_requests > 0 else 0

    # Average score
    avg_score = db.query(func.avg(FeedbackResponse.score)).join(
        FeedbackRequest
    ).filter(
        FeedbackRequest.business_id == business_id,
        FeedbackResponse.responded_at >= since
    ).scalar()

    # Classification counts
    promoters = db.query(func.count(FeedbackResponse.id)).join(
        FeedbackRequest
    ).filter(
        FeedbackRequest.business_id == business_id,
        FeedbackResponse.responded_at >= since,
        FeedbackResponse.classification == "promoter"
    ).scalar() or 0

    passives = db.query(func.count(FeedbackResponse.id)).join(
        FeedbackRequest
    ).filter(
        FeedbackRequest.business_id == business_id,
        FeedbackResponse.responded_at >= since,
        FeedbackResponse.classification == "passive"
    ).scalar() or 0

    detractors = db.query(func.count(FeedbackResponse.id)).join(
        FeedbackRequest
    ).filter(
        FeedbackRequest.business_id == business_id,
        FeedbackResponse.responded_at >= since,
        FeedbackResponse.classification == "detractor"
    ).scalar() or 0

    # NPS Score: (% promoters - % detractors) * 100
    nps_score = None
    if total_responses > 0:
        promoter_pct = promoters / total_responses
        detractor_pct = detractors / total_responses
        nps_score = round((promoter_pct - detractor_pct) * 100, 1)

    # Pending alerts (detractors not resolved)
    pending_alerts = db.query(func.count(FeedbackResponse.id)).join(
        FeedbackRequest
    ).filter(
        FeedbackRequest.business_id == business_id,
        FeedbackResponse.classification == "detractor",
        FeedbackResponse.issue_resolved == False
    ).scalar() or 0

    # Resolved issues
    resolved_issues = db.query(func.count(FeedbackResponse.id)).join(
        FeedbackRequest
    ).filter(
        FeedbackRequest.business_id == business_id,
        FeedbackResponse.classification == "detractor",
        FeedbackResponse.issue_resolved == True
    ).scalar() or 0

    # Google conversion stats (if integration is active)
    google_conversion = None
    try:
        from models import GoogleLocationLink
        has_link = db.query(GoogleLocationLink).filter(
            GoogleLocationLink.business_id == business_id
        ).first()
        if has_link:
            from services.google_business_service import get_conversion_stats
            conv = get_conversion_stats(db, business_id)
            google_conversion = GoogleConversionStats(
                total_promoters=conv["total_promoters"],
                clicked_google_review=conv["clicked_google_review"],
                matched_reviews=conv["matched_reviews"],
                total_google_reviews=conv["total_google_reviews"],
                click_rate=conv["click_rate"],
                conversion_rate=conv["conversion_rate"],
            )
    except Exception:
        pass  # Integration not available, skip

    return DashboardStats(
        total_requests=total_requests,
        total_responses=total_responses,
        response_rate=round(response_rate, 1),
        average_score=round(avg_score, 2) if avg_score else None,
        nps_score=nps_score,
        promoters=promoters,
        passives=passives,
        detractors=detractors,
        pending_alerts=pending_alerts,
        resolved_issues=resolved_issues,
        google_conversion=google_conversion,
    )


# ============================================================================
# WhatsApp Webhook Endpoint
# ============================================================================

@router.post("/webhook/whatsapp")
async def whatsapp_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Receive WhatsApp webhook events.
    Updates message status and handles incoming replies for NPS conversation.
    """
    try:
        payload = await request.json()
        logger.info(f"WhatsApp webhook received: {payload.get('event', 'no-event')}")
        logger.info(f"Webhook FULL payload: {payload}")

        whatsapp = get_whatsapp_service()

        event = whatsapp.parse_webhook(payload)
        if not event:
            logger.warning(f"Could not parse webhook payload: {payload}")
            return {"status": "ignored"}

        if event.event_type == "message_status" and event.message_id:
            # Update feedback request status
            feedback_request = db.query(FeedbackRequest).filter(
                FeedbackRequest.whatsapp_message_id == event.message_id
            ).first()

            if feedback_request:
                if event.status == MessageStatus.DELIVERED:
                    feedback_request.status = FeedbackStatus.DELIVERED
                    feedback_request.delivered_at = datetime.now(timezone.utc)
                elif event.status == MessageStatus.READ:
                    feedback_request.status = FeedbackStatus.READ
                    feedback_request.read_at = datetime.now(timezone.utc)

                # Save LID format separately for matching (Evolution API uses LID for incoming messages)
                if event.remote_jid and "@lid" in event.remote_jid:
                    if feedback_request.whatsapp_lid != event.remote_jid:
                        logger.info(f"Saving LID: {event.remote_jid} for request {feedback_request.id}")
                        feedback_request.whatsapp_lid = event.remote_jid
                # Also update remote_jid if it changed (but not to LID format)
                elif event.remote_jid and event.remote_jid != feedback_request.whatsapp_remote_jid:
                    logger.info(f"Updating remoteJid from {feedback_request.whatsapp_remote_jid} to {event.remote_jid}")
                    feedback_request.whatsapp_remote_jid = event.remote_jid

                db.commit()
                logger.info(f"Updated request {feedback_request.id} status to {event.status}")

        elif event.event_type == "message_received":
            # Handle incoming NPS conversation message
            logger.info(f"Received message from {event.from_number} (remoteJid: {event.remote_jid}): {event.content}")
            background_tasks.add_task(
                process_nps_conversation_task,
                event.from_number,
                event.content,
                event.remote_jid  # Pass remoteJid for matching
            )

        return {"status": "processed"}

    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        return {"status": "error", "message": str(e)}


async def process_nps_conversation_task(
    from_number: str,
    message_content: str,
    remote_jid: str = None
):
    """
    Background task wrapper - creates its own DB session.
    This is necessary because the original request session may be closed
    by the time this background task runs.
    """
    db = SessionLocal()
    try:
        await process_nps_conversation(from_number, message_content, db, remote_jid)
    finally:
        db.close()


async def process_nps_conversation(
    from_number: str,
    message_content: str,
    db: Session,
    remote_jid: str = None
):
    """
    Process incoming WhatsApp message as part of NPS conversation.
    """
    from services.nps_conversation_service import NPSConversationHandler

    try:
        handler = NPSConversationHandler(db)
        result = handler.process_incoming_message(from_number, message_content, remote_jid=remote_jid)

        if not result:
            logger.info(f"No active conversation for {from_number}")
            return

        feedback_request, response = result
        business = feedback_request.business

        # Send response message via WhatsApp
        # Use customer_phone from the request, not from_number (which may be LID format)
        customer_phone = feedback_request.customer_phone

        # Determine which instance to use:
        # 1. If request was sent via pool, use the same instance
        # 2. If business has specific instance, use it
        # 3. Otherwise, use pool to select one
        instance_to_use = (
            feedback_request.sent_from_instance_id or
            business.whatsapp_instance_id
        )

        if instance_to_use:
            # Use specific instance
            whatsapp = get_whatsapp_service()
            send_result = await whatsapp.send_message(
                to=customer_phone,
                message=response.message,
                instance_id=instance_to_use
            )
        else:
            # Use pool
            pool = get_whatsapp_pool()
            send_result, _ = await pool.send_message(
                to=customer_phone,
                message=response.message,
                db=db
            )

        if send_result.success:
            logger.info(f"Sent NPS response to {customer_phone}: {response.next_state}")
        else:
            logger.error(f"Failed to send NPS response to {customer_phone}: {send_result.error}")

        # Handle detractor alert
        logger.info(f"Alert check: send_alert={response.send_alert}, schedule_delayed={response.schedule_delayed_alert}, has_response={feedback_request.response is not None}, alert_phone={business.alert_phone}")

        if response.send_alert and feedback_request.response:
            # Send alert immediately (comment just arrived)
            logger.info(f"Sending detractor alert immediately for request {feedback_request.id}")
            await send_alert_notification(
                feedback_request.response,
                feedback_request,
                business,
                db
            )
        elif response.schedule_delayed_alert and feedback_request.response:
            # Schedule delayed alert to wait for possible comment
            logger.info(f"Scheduling delayed alert for request {feedback_request.id}")
            import asyncio
            asyncio.create_task(send_delayed_alert(
                response_id=feedback_request.response.id,
                request_id=feedback_request.id,
                business_id=business.id
            ))

        db.commit()

    except Exception as e:
        logger.error(f"Error processing NPS conversation: {e}", exc_info=True)
        db.rollback()  # Rollback on error to avoid partial commits
