"""
Business Management API Routes.

Handles CRUD operations for businesses that collect feedback.
"""
import uuid
import secrets
import logging
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, computed_field
from config import settings

from database import get_db
from auth import verify_token
from models import (
    Business, FeedbackTemplate, FeedbackRequest, FeedbackResponse,
    Project, ProjectMember, HubUserLink, SubscriptionCache
)

from config import SLUG_PLAN_LIMITS as HUB_PLAN_LIMITS
DEFAULT_BUSINESS_LIMIT = 1
DEFAULT_TEMPLATE_LIMIT = 10  # All plans can now edit templates

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/businesses",
    tags=["businesses"]
)


# ============================================================================
# Pydantic Schemas
# ============================================================================

class BusinessCreate(BaseModel):
    """Schema for creating a new business."""
    project_id: str
    name: str
    description: Optional[str] = None
    google_place_id: Optional[str] = None
    google_review_url: Optional[str] = None
    whatsapp_phone: Optional[str] = None
    whatsapp_instance_id: Optional[str] = None
    alert_phone: Optional[str] = None
    alert_email: Optional[str] = None
    nps_message: Optional[str] = None
    template_id: Optional[str] = None
    promoter_threshold: int = 9
    detractor_threshold: int = 6


class BusinessUpdate(BaseModel):
    """Schema for updating a business."""
    name: Optional[str] = None
    description: Optional[str] = None
    google_place_id: Optional[str] = None
    google_review_url: Optional[str] = None
    whatsapp_phone: Optional[str] = None
    whatsapp_instance_id: Optional[str] = None
    alert_phone: Optional[str] = None
    alert_email: Optional[str] = None
    nps_message: Optional[str] = None
    template_id: Optional[str] = None
    promoter_threshold: Optional[int] = None
    detractor_threshold: Optional[int] = None
    is_active: Optional[bool] = None
    auto_send_enabled: Optional[bool] = None


class BusinessResponse(BaseModel):
    """Schema for business response."""
    id: str
    project_id: str
    name: str
    description: Optional[str] = None
    google_place_id: Optional[str] = None
    google_review_url: Optional[str] = None
    whatsapp_phone: Optional[str] = None
    whatsapp_instance_id: Optional[str] = None
    alert_phone: Optional[str] = None
    alert_email: Optional[str] = None
    nps_message: Optional[str] = None
    template_id: Optional[str] = None
    promoter_threshold: int
    detractor_threshold: int
    is_active: bool
    auto_send_enabled: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Webhook integration
    webhook_token: Optional[str] = None
    webhook_url: Optional[str] = None  # Computed from token
    # Stats
    total_feedback_requests: int = 0
    total_responses: int = 0
    average_score: Optional[float] = None
    promoter_count: int = 0
    detractor_count: int = 0

    class Config:
        from_attributes = True


class TemplateCreate(BaseModel):
    """Schema for creating a feedback template."""
    name: str
    pre_message: Optional[str] = None
    initial_message: str
    thank_you_promoter: Optional[str] = None
    thank_you_passive: Optional[str] = None
    thank_you_detractor: Optional[str] = None
    testimonial_request: Optional[str] = None
    is_default: bool = False


class TemplateUpdate(BaseModel):
    """Schema for updating a template."""
    name: Optional[str] = None
    pre_message: Optional[str] = None
    initial_message: Optional[str] = None
    thank_you_promoter: Optional[str] = None
    thank_you_passive: Optional[str] = None
    thank_you_detractor: Optional[str] = None
    testimonial_request: Optional[str] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None


class TemplateResponse(BaseModel):
    """Schema for template response."""
    id: str
    project_id: Optional[str] = None
    business_id: Optional[str] = None
    name: str
    pre_message: Optional[str] = None
    initial_message: str
    thank_you_promoter: Optional[str] = None
    thank_you_passive: Optional[str] = None
    thank_you_detractor: Optional[str] = None
    testimonial_request: Optional[str] = None
    is_default: bool
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Helper Functions
# ============================================================================

def verify_project_access(project_id: str, user_uid: str, db: Session) -> Project:
    """Verify user has access to the project."""
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


def verify_business_access(business_id: str, user_uid: str, db: Session) -> Business:
    """Verify user has access to the business via project."""
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    verify_project_access(business.project_id, user_uid, db)
    return business


def get_plan_slug_for_owner(owner_id: str, db: Session) -> str:
    """Get the plan slug for a project owner."""
    hub_link = db.query(HubUserLink).filter(
        HubUserLink.local_user_id == owner_id
    ).first()

    if not hub_link:
        return "oppine-starter-monthly"

    cached = db.query(SubscriptionCache).filter(
        SubscriptionCache.hub_user_id == hub_link.hub_user_id
    ).first()

    if not cached or not cached.is_active:
        return "oppine-starter-monthly"

    return cached.plan_slug or "oppine-starter-monthly"


def get_business_limit(owner_id: str, db: Session) -> int:
    """
    Get the business limit for a user based on their subscription plan.
    Returns -1 for unlimited.
    """
    plan_slug = get_plan_slug_for_owner(owner_id, db)
    limits = HUB_PLAN_LIMITS.get(plan_slug, {"businesses": DEFAULT_BUSINESS_LIMIT})
    return limits.get("businesses", DEFAULT_BUSINESS_LIMIT)


def get_template_limit(owner_id: str, db: Session) -> int:
    """
    Get the template limit per account for a user based on their subscription plan.
    Returns -1 for unlimited.
    """
    plan_slug = get_plan_slug_for_owner(owner_id, db)
    limits = HUB_PLAN_LIMITS.get(plan_slug, {"templates_per_account": DEFAULT_TEMPLATE_LIMIT})
    return limits.get("templates_per_account", DEFAULT_TEMPLATE_LIMIT)


def can_edit_templates(owner_id: str, db: Session) -> bool:
    """
    Check if user can edit templates based on their plan.
    All paid plans can now edit templates (no more free plan restrictions).
    """
    # All paid plans (starter, growth) can edit templates
    return True


def generate_webhook_token() -> str:
    """Generate a secure webhook token."""
    return secrets.token_urlsafe(32)


def get_webhook_url(webhook_token: Optional[str]) -> Optional[str]:
    """Build the full webhook URL from token."""
    if not webhook_token:
        return None
    backend_url = settings.BACKEND_URL if hasattr(settings, 'BACKEND_URL') else "http://localhost:8000"
    return f"{backend_url}/api/v1/inbound/{webhook_token}"


def get_business_stats(business_id: str, db: Session) -> dict:
    """Calculate statistics for a business."""
    total_requests = db.query(func.count(FeedbackRequest.id)).filter(
        FeedbackRequest.business_id == business_id
    ).scalar() or 0

    total_responses = db.query(func.count(FeedbackResponse.id)).join(
        FeedbackRequest
    ).filter(
        FeedbackRequest.business_id == business_id
    ).scalar() or 0

    avg_score = db.query(func.avg(FeedbackResponse.score)).join(
        FeedbackRequest
    ).filter(
        FeedbackRequest.business_id == business_id
    ).scalar()

    promoter_count = db.query(func.count(FeedbackResponse.id)).join(
        FeedbackRequest
    ).filter(
        FeedbackRequest.business_id == business_id,
        FeedbackResponse.classification == "promoter"
    ).scalar() or 0

    detractor_count = db.query(func.count(FeedbackResponse.id)).join(
        FeedbackRequest
    ).filter(
        FeedbackRequest.business_id == business_id,
        FeedbackResponse.classification == "detractor"
    ).scalar() or 0

    return {
        "total_feedback_requests": total_requests,
        "total_responses": total_responses,
        "average_score": round(avg_score, 2) if avg_score else None,
        "promoter_count": promoter_count,
        "detractor_count": detractor_count
    }


# ============================================================================
# Business CRUD Endpoints
# ============================================================================

@router.post("", response_model=BusinessResponse)
def create_business(
    data: BusinessCreate,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """Create a new business for a project."""
    user_uid = token.get("uid")
    project = verify_project_access(data.project_id, user_uid, db)

    # Check business limit based on subscription plan
    business_limit = get_business_limit(project.owner_id, db)
    if business_limit != -1:  # -1 means unlimited
        current_count = db.query(func.count(Business.id)).filter(
            Business.project_id == data.project_id
        ).scalar() or 0

        if current_count >= business_limit:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Limite de negócios atingido ({business_limit}). Faça upgrade do plano para adicionar mais negócios."
            )

    business = Business(
        id=str(uuid.uuid4()),
        project_id=data.project_id,
        name=data.name,
        description=data.description,
        google_place_id=data.google_place_id,
        google_review_url=data.google_review_url,
        whatsapp_phone=data.whatsapp_phone,
        whatsapp_instance_id=data.whatsapp_instance_id,
        alert_phone=data.alert_phone,
        alert_email=data.alert_email,
        nps_message=data.nps_message,
        promoter_threshold=data.promoter_threshold,
        detractor_threshold=data.detractor_threshold,
        webhook_token=generate_webhook_token()  # Auto-generate webhook token
    )

    db.add(business)
    db.commit()
    db.refresh(business)

    logger.info(f"Business created: {business.name} ({business.id})")

    # Exclude internal fields from response
    exclude_fields = {'webhook_config_json', 'updated_at'}
    return BusinessResponse(
        **{c.name: getattr(business, c.name) for c in business.__table__.columns if c.name not in exclude_fields},
        webhook_url=get_webhook_url(business.webhook_token),
        **get_business_stats(business.id, db)
    )


@router.get("", response_model=List[BusinessResponse])
def list_businesses(
    project_id: str,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """List all businesses for a project."""
    user_uid = token.get("uid")
    verify_project_access(project_id, user_uid, db)

    businesses = db.query(Business).filter(
        Business.project_id == project_id
    ).order_by(Business.created_at.desc()).all()

    result = []
    exclude_fields = {'webhook_config_json', 'updated_at'}
    for business in businesses:
        stats = get_business_stats(business.id, db)
        result.append(BusinessResponse(
            **{c.name: getattr(business, c.name) for c in business.__table__.columns if c.name not in exclude_fields},
            webhook_url=get_webhook_url(business.webhook_token),
            **stats
        ))

    return result


@router.get("/{business_id}", response_model=BusinessResponse)
def get_business(
    business_id: str,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """Get a specific business by ID."""
    user_uid = token.get("uid")
    business = verify_business_access(business_id, user_uid, db)

    exclude_fields = {'webhook_config_json', 'updated_at'}
    return BusinessResponse(
        **{c.name: getattr(business, c.name) for c in business.__table__.columns if c.name not in exclude_fields},
        webhook_url=get_webhook_url(business.webhook_token),
        **get_business_stats(business.id, db)
    )


@router.patch("/{business_id}", response_model=BusinessResponse)
def update_business(
    business_id: str,
    data: BusinessUpdate,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """Update a business."""
    user_uid = token.get("uid")
    business = verify_business_access(business_id, user_uid, db)

    # Update only provided fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(business, field, value)

    db.commit()
    db.refresh(business)

    logger.info(f"Business updated: {business.name} ({business.id})")

    exclude_fields = {'webhook_config_json', 'updated_at'}
    return BusinessResponse(
        **{c.name: getattr(business, c.name) for c in business.__table__.columns if c.name not in exclude_fields},
        webhook_url=get_webhook_url(business.webhook_token),
        **get_business_stats(business.id, db)
    )


@router.delete("/{business_id}")
def delete_business(
    business_id: str,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """Delete a business and all related data."""
    user_uid = token.get("uid")
    business = verify_business_access(business_id, user_uid, db)

    db.delete(business)
    db.commit()

    logger.info(f"Business deleted: {business.name} ({business_id})")

    return {"message": "Business deleted successfully"}


# ============================================================================
# Template CRUD Endpoints
# ============================================================================

@router.post("/{business_id}/templates", response_model=TemplateResponse)
def create_template(
    business_id: str,
    data: TemplateCreate,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """Create a feedback template for a project (via business for backward compat)."""
    user_uid = token.get("uid")
    business = verify_business_access(business_id, user_uid, db)

    # Get project to check owner's plan
    project = db.query(Project).filter(Project.id == business.project_id).first()

    # Check template limit per account (not per business)
    template_limit = get_template_limit(project.owner_id, db)
    if template_limit != -1:  # -1 means unlimited
        current_count = db.query(func.count(FeedbackTemplate.id)).filter(
            FeedbackTemplate.project_id == business.project_id
        ).scalar() or 0

        if current_count >= template_limit:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Limite de templates atingido ({template_limit}). Faça upgrade do plano para adicionar mais templates."
            )

    # If this is marked as default, unset other defaults for the project
    if data.is_default:
        db.query(FeedbackTemplate).filter(
            FeedbackTemplate.project_id == business.project_id,
            FeedbackTemplate.is_default == True
        ).update({"is_default": False})

    template = FeedbackTemplate(
        id=str(uuid.uuid4()),
        project_id=business.project_id,
        business_id=None,  # Project-level template
        name=data.name,
        initial_message=data.initial_message,
        thank_you_promoter=data.thank_you_promoter,
        thank_you_passive=data.thank_you_passive,
        thank_you_detractor=data.thank_you_detractor,
        testimonial_request=data.testimonial_request,
        is_default=data.is_default
    )

    db.add(template)
    db.commit()
    db.refresh(template)

    return template


@router.get("/{business_id}/templates", response_model=List[TemplateResponse])
def list_templates(
    business_id: str,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """List all templates for a business's project."""
    user_uid = token.get("uid")
    business = verify_business_access(business_id, user_uid, db)

    # Return all templates for the project (not just this business)
    templates = db.query(FeedbackTemplate).filter(
        FeedbackTemplate.project_id == business.project_id
    ).order_by(FeedbackTemplate.is_default.desc(), FeedbackTemplate.created_at.desc()).all()

    return templates


@router.patch("/{business_id}/templates/{template_id}", response_model=TemplateResponse)
def update_template(
    business_id: str,
    template_id: str,
    data: TemplateUpdate,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """Update a template."""
    user_uid = token.get("uid")
    business = verify_business_access(business_id, user_uid, db)

    # Check if user can edit templates (only Growth plan can)
    project = db.query(Project).filter(Project.id == business.project_id).first()
    if not can_edit_templates(project.owner_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Plano Starter não permite edição de templates. Faça upgrade para o Growth."
        )

    template = db.query(FeedbackTemplate).filter(
        FeedbackTemplate.id == template_id,
        FeedbackTemplate.project_id == business.project_id
    ).first()

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # If setting as default, unset other defaults for the project
    if data.is_default:
        db.query(FeedbackTemplate).filter(
            FeedbackTemplate.project_id == business.project_id,
            FeedbackTemplate.is_default == True,
            FeedbackTemplate.id != template_id
        ).update({"is_default": False})

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)

    db.commit()
    db.refresh(template)

    return template


@router.delete("/{business_id}/templates/{template_id}")
def delete_template(
    business_id: str,
    template_id: str,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """Delete a template."""
    user_uid = token.get("uid")
    business = verify_business_access(business_id, user_uid, db)

    # Check if user can edit templates (only Growth plan can)
    project = db.query(Project).filter(Project.id == business.project_id).first()
    if not can_edit_templates(project.owner_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Plano Starter não permite exclusão de templates. Faça upgrade para o Growth."
        )

    template = db.query(FeedbackTemplate).filter(
        FeedbackTemplate.id == template_id,
        FeedbackTemplate.project_id == business.project_id
    ).first()

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Prevent deleting the default template
    if template.is_default:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível excluir o template padrão. Defina outro template como padrão primeiro."
        )

    # Prevent deleting the last template
    template_count = db.query(func.count(FeedbackTemplate.id)).filter(
        FeedbackTemplate.project_id == business.project_id
    ).scalar() or 0

    if template_count <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível excluir o único template. A conta precisa ter pelo menos um template."
        )

    db.delete(template)
    db.commit()

    return {"message": "Template deleted successfully"}


# ============================================================================
# Webhook Management Endpoints
# ============================================================================

class WebhookInfoResponse(BaseModel):
    """Schema for webhook info response."""
    webhook_token: str
    webhook_url: str
    test_url: str
    example_payload: dict


@router.get("/{business_id}/webhook", response_model=WebhookInfoResponse)
def get_webhook_info(
    business_id: str,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """
    Get webhook integration info for a business.
    Returns the webhook URL and example payload format.
    """
    user_uid = token.get("uid")
    business = verify_business_access(business_id, user_uid, db)

    # Generate token if not exists
    if not business.webhook_token:
        business.webhook_token = generate_webhook_token()
        db.commit()
        db.refresh(business)

    webhook_url = get_webhook_url(business.webhook_token)
    backend_url = settings.BACKEND_URL if hasattr(settings, 'BACKEND_URL') else "http://localhost:8000"

    return WebhookInfoResponse(
        webhook_token=business.webhook_token,
        webhook_url=webhook_url,
        test_url=f"{backend_url}/api/v1/inbound/{business.webhook_token}/test",
        example_payload={
            "customer": {
                "phone": "11999999999",
                "name": "João Silva"
            },
            "metadata": {
                "order_id": "12345",
                "product": "Nome do produto/serviço",
                "value": 99.90
            }
        }
    )


@router.post("/{business_id}/webhook/regenerate", response_model=WebhookInfoResponse)
def regenerate_webhook_token(
    business_id: str,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token)
):
    """
    Regenerate the webhook token for a business.
    WARNING: This will invalidate the previous webhook URL.
    """
    user_uid = token.get("uid")
    business = verify_business_access(business_id, user_uid, db)

    # Generate new token
    business.webhook_token = generate_webhook_token()
    db.commit()
    db.refresh(business)

    logger.info(f"Webhook token regenerated for business {business.name} ({business.id})")

    webhook_url = get_webhook_url(business.webhook_token)
    backend_url = settings.BACKEND_URL if hasattr(settings, 'BACKEND_URL') else "http://localhost:8000"

    return WebhookInfoResponse(
        webhook_token=business.webhook_token,
        webhook_url=webhook_url,
        test_url=f"{backend_url}/api/v1/inbound/{business.webhook_token}/test",
        example_payload={
            "customer": {
                "phone": "11999999999",
                "name": "João Silva"
            },
            "metadata": {
                "order_id": "12345",
                "product": "Nome do produto/serviço",
                "value": 99.90
            }
        }
    )
