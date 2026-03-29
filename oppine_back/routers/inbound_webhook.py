"""
Dynamic Inbound Webhook Router

Generic webhook system that adapts to any external system (POS, CRM, e-commerce).
Business owners configure field mappings in the dashboard, and Oppine extracts
customer data from any payload format.

Features:
- Dynamic field extraction (supports nested fields like "customer.phone")
- Configurable field mappings per business
- Test endpoint to preview extraction results
- Automatic fallback to common field names

Usage:
1. Business owner gets their webhook URL from dashboard
2. Uses /test endpoint to paste sample payload and see extracted fields
3. Configures field mappings if needed
4. Connects their system to POST to: /api/v1/inbound/{webhook_token}
"""

import logging
import uuid
import re
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List, Tuple
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models import Business, FeedbackRequest, FeedbackTemplate, FeedbackStatus

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/inbound", tags=["inbound-webhook"])


# ============================================================================
# Field Extraction Logic
# ============================================================================

def get_nested_value(data: Dict[str, Any], path: str) -> Optional[Any]:
    """
    Extract value from nested dictionary using dot notation.

    Examples:
        get_nested_value({"customer": {"phone": "123"}}, "customer.phone") -> "123"
        get_nested_value({"phone": "123"}, "phone") -> "123"
    """
    if not data or not path:
        return None

    keys = path.split(".")
    value = data

    for key in keys:
        if isinstance(value, dict):
            value = value.get(key)
            if value is None:
                return None
        else:
            return None

    return value


def find_field_value(
    payload: Dict[str, Any],
    primary_field: str,
    alternatives: List[str] = None
) -> Tuple[Optional[str], Optional[str]]:
    """
    Find a field value trying primary field first, then alternatives.
    Returns tuple of (value, field_path_that_worked).

    Searches:
    1. Primary field (exact match)
    2. Alternative fields in order
    3. Common patterns in nested objects
    """
    alternatives = alternatives or []

    # Try primary field first
    value = get_nested_value(payload, primary_field)
    if value is not None:
        return str(value), primary_field

    # Try alternatives
    for alt in alternatives:
        value = get_nested_value(payload, alt)
        if value is not None:
            return str(value), alt

    # Deep search in nested objects (one level)
    for key, obj in payload.items():
        if isinstance(obj, dict):
            # Try primary field name inside nested object
            primary_simple = primary_field.split(".")[-1]
            if primary_simple in obj:
                return str(obj[primary_simple]), f"{key}.{primary_simple}"
            # Try alternatives inside nested object
            for alt in alternatives:
                simple_name = alt.split(".")[-1]  # Get last part
                if simple_name in obj:
                    return str(obj[simple_name]), f"{key}.{simple_name}"

    return None, None


def normalize_phone(phone: str) -> str:
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

    return f"+{digits}"


def extract_customer_data(
    payload: Dict[str, Any],
    config: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Extract customer data from payload using configured field mappings.

    Args:
        payload: The webhook payload
        config: Business webhook configuration with field mappings

    Returns:
        Dictionary with extracted data and metadata about extraction
    """
    result = {
        "phone": None,
        "phone_raw": None,
        "phone_field_found": None,
        "name": None,
        "name_field_found": None,
        "email": None,
        "email_field_found": None,
        "metadata": {},
        "extraction_log": []
    }

    # Extract phone (required)
    phone_field = config.get("phone_field", "phone")
    phone_alternatives = config.get("phone_alternatives", [
        "telefone", "celular", "whatsapp", "mobile", "cell",
        "customer.phone", "cliente.telefone", "cliente.celular",
        "contact.phone", "contato.telefone",
        "data.phone", "data.telefone"
    ])

    raw_phone, phone_path = find_field_value(payload, phone_field, phone_alternatives)
    if raw_phone:
        result["phone_raw"] = raw_phone
        result["phone"] = normalize_phone(raw_phone)
        result["phone_field_found"] = phone_path
        result["extraction_log"].append(f"✓ Phone found at '{phone_path}': {raw_phone}")
    else:
        result["extraction_log"].append(f"✗ Phone not found (tried: {phone_field}, {phone_alternatives[:3]}...)")

    # Extract name (optional)
    name_field = config.get("name_field", "name")
    name_alternatives = config.get("name_alternatives", [
        "nome", "customer_name", "cliente_nome",
        "customer.name", "cliente.nome",
        "contact.name", "contato.nome",
        "first_name", "full_name"
    ])

    name, name_path = find_field_value(payload, name_field, name_alternatives)
    if name:
        result["name"] = name
        result["name_field_found"] = name_path
        result["extraction_log"].append(f"✓ Name found at '{name_path}': {name}")
    else:
        result["extraction_log"].append(f"○ Name not found (optional)")

    # Extract email (optional)
    email_field = config.get("email_field", "email")
    email_alternatives = config.get("email_alternatives", [
        "e-mail", "customer.email", "cliente.email",
        "contact.email", "contato.email"
    ])

    email, email_path = find_field_value(payload, email_field, email_alternatives)
    if email:
        result["email"] = email
        result["email_field_found"] = email_path
        result["extraction_log"].append(f"✓ Email found at '{email_path}': {email}")

    # Extract metadata fields
    metadata_fields = config.get("metadata_fields", [])
    for field_path in metadata_fields:
        value = get_nested_value(payload, field_path)
        if value is not None:
            # Use last part of path as key
            key = field_path.split(".")[-1]
            result["metadata"][key] = value

    # Also try to extract common metadata automatically
    common_metadata = ["order_id", "pedido_id", "transaction_id", "product", "produto", "value", "valor"]
    for field in common_metadata:
        if field not in result["metadata"]:
            value, _ = find_field_value(payload, field, [])
            if value is not None:
                result["metadata"][field] = value

    return result


# ============================================================================
# Schemas
# ============================================================================

class WebhookResponse(BaseModel):
    """Response from webhook endpoint."""
    success: bool
    message: str
    request_id: Optional[str] = None
    requests_created: Optional[int] = None


class WebhookTestRequest(BaseModel):
    """Request to test webhook payload extraction."""
    payload: Dict[str, Any] = Field(..., description="Sample payload from your system")


class WebhookTestResponse(BaseModel):
    """Response from webhook test."""
    success: bool
    extracted_data: Dict[str, Any]
    extraction_log: List[str]
    would_create_request: bool
    message: str


class WebhookConfigUpdate(BaseModel):
    """Configuration for webhook field mappings."""
    phone_field: Optional[str] = Field(None, description="Primary field path for phone (e.g., 'customer.phone')")
    name_field: Optional[str] = Field(None, description="Primary field path for name")
    email_field: Optional[str] = Field(None, description="Primary field path for email")
    phone_alternatives: Optional[List[str]] = Field(None, description="Alternative field paths to try for phone")
    name_alternatives: Optional[List[str]] = Field(None, description="Alternative field paths to try for name")
    metadata_fields: Optional[List[str]] = Field(None, description="Field paths to extract as metadata")


class WebhookConfigResponse(BaseModel):
    """Current webhook configuration."""
    webhook_token: str
    webhook_url: str
    config: Dict[str, Any]


# ============================================================================
# Helper Functions
# ============================================================================

def generate_webhook_token() -> str:
    """Generate a secure webhook token."""
    return secrets.token_urlsafe(32)


async def send_feedback_request_task(
    feedback_request: FeedbackRequest,
    business: Business,
    template: Optional[FeedbackTemplate],
    db: Session
):
    """Background task to send feedback request via WhatsApp (conversational NPS)."""
    from services.whatsapp_service import get_service

    try:
        whatsapp = get_service()

        # Build conversational NPS message (asks for score directly)
        customer_name = feedback_request.customer_name.split()[0] if feedback_request.customer_name else ""

        # Priority: 1) business.nps_message, 2) template, 3) default
        if business.nps_message:
            # Use custom NPS message from business settings
            message = business.nps_message.replace(
                "{customer_name}", f" {customer_name}" if customer_name else ""
            ).replace(
                "{business_name}", business.name
            )
        elif template and template.initial_message and "{feedback_link}" not in template.initial_message:
            # Template configured for conversational flow
            message = template.initial_message.replace(
                "{customer_name}", feedback_request.customer_name or "Cliente"
            ).replace(
                "{business_name}", business.name
            )
        else:
            customer_greeting = f" {customer_name}" if customer_name else ""
            message = (
                f"Ola{customer_greeting}! Obrigado por escolher {business.name}.\n\n"
                f"De 0 a 10, qual a chance de voce nos recomendar para amigos ou familiares?"
            )

        result = await whatsapp.send_message(
            to=feedback_request.customer_phone,
            message=message,
            instance_id=business.whatsapp_instance_id
        )

        if result.success:
            feedback_request.status = FeedbackStatus.SENT
            feedback_request.whatsapp_message_id = result.message_id
            feedback_request.sent_at = datetime.now(timezone.utc)
            feedback_request.conversation_state = "awaiting_score"
            feedback_request.response_channel = "whatsapp"
            logger.info(f"Sent feedback request {feedback_request.id} to {feedback_request.customer_phone}")
        else:
            feedback_request.status = FeedbackStatus.FAILED
            logger.error(f"Failed to send feedback request {feedback_request.id}: {result.error}")

        db.commit()

    except Exception as e:
        logger.error(f"Error sending feedback request: {e}")
        feedback_request.status = FeedbackStatus.FAILED
        db.commit()


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/{webhook_token}", response_model=WebhookResponse)
async def receive_webhook(
    webhook_token: str,
    payload: Dict[str, Any],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Receive customer data from external system.

    This endpoint accepts ANY payload format. Configure field mappings
    in the dashboard or use the /test endpoint to see extraction results.

    Common payload formats that work automatically:

    Simple:
    ```json
    {"phone": "11999999999", "name": "João"}
    ```

    Nested:
    ```json
    {"customer": {"phone": "11999999999", "name": "João"}}
    ```

    Portuguese:
    ```json
    {"telefone": "11999999999", "nome": "João"}
    ```

    POS/CRM style:
    ```json
    {"cliente": {"celular": "11999999999", "nome": "João"}, "pedido_id": "123"}
    ```
    """
    # Find business by webhook token
    business = db.query(Business).filter(
        Business.webhook_token == webhook_token,
        Business.is_active == True
    ).first()

    if not business:
        raise HTTPException(status_code=404, detail="Invalid webhook token")

    # Extract customer data using business config
    config = business.webhook_config
    extracted = extract_customer_data(payload, config)

    if not extracted["phone"]:
        raise HTTPException(
            status_code=400,
            detail=f"Could not find phone number in payload. Use /test endpoint to configure field mappings."
        )

    # Check for duplicate (same phone in last hour)
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    existing = db.query(FeedbackRequest).filter(
        FeedbackRequest.business_id == business.id,
        FeedbackRequest.customer_phone == extracted["phone"],
        FeedbackRequest.created_at >= one_hour_ago
    ).first()

    if existing:
        return WebhookResponse(
            success=True,
            message="Feedback request already exists for this customer (within last hour)",
            request_id=existing.id
        )

    # Get default template
    template = db.query(FeedbackTemplate).filter(
        FeedbackTemplate.business_id == business.id,
        FeedbackTemplate.is_default == True,
        FeedbackTemplate.is_active == True
    ).first()

    # Create feedback request
    feedback_request = FeedbackRequest(
        id=str(uuid.uuid4()),
        business_id=business.id,
        template_id=template.id if template else None,
        customer_name=extracted["name"],
        customer_phone=extracted["phone"],
        customer_email=extracted["email"],
        status=FeedbackStatus.PENDING,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7)
    )

    # Store extraction metadata in transaction fields if available
    if extracted["metadata"]:
        if "order_id" in extracted["metadata"] or "pedido_id" in extracted["metadata"]:
            feedback_request.transaction_id = extracted["metadata"].get("order_id") or extracted["metadata"].get("pedido_id")
        if "value" in extracted["metadata"] or "valor" in extracted["metadata"]:
            feedback_request.transaction_amount = str(extracted["metadata"].get("value") or extracted["metadata"].get("valor"))

    db.add(feedback_request)
    db.commit()
    db.refresh(feedback_request)

    logger.info(
        f"Created feedback request {feedback_request.id} via webhook for business {business.name}. "
        f"Phone found at: {extracted['phone_field_found']}"
    )

    # Send immediately
    background_tasks.add_task(
        send_feedback_request_task,
        feedback_request,
        business,
        template,
        db
    )

    return WebhookResponse(
        success=True,
        message="Feedback request created successfully",
        request_id=feedback_request.id
    )


@router.post("/{webhook_token}/test", response_model=WebhookTestResponse)
async def test_webhook_payload(
    webhook_token: str,
    request: WebhookTestRequest,
    db: Session = Depends(get_db)
):
    """
    Test endpoint to see how your payload would be processed.

    Use this to:
    1. Paste a sample payload from your system
    2. See which fields are extracted
    3. Identify if you need to configure custom field mappings

    No feedback request is created - this is just for testing.
    """
    # Find business
    business = db.query(Business).filter(
        Business.webhook_token == webhook_token,
        Business.is_active == True
    ).first()

    if not business:
        raise HTTPException(status_code=404, detail="Invalid webhook token")

    # Extract using current config
    config = business.webhook_config
    extracted = extract_customer_data(request.payload, config)

    would_create = extracted["phone"] is not None

    if would_create:
        message = f"✓ Ready! Phone will be extracted from '{extracted['phone_field_found']}'"
    else:
        message = "✗ Phone not found. Configure 'phone_field' or check your payload structure."

    return WebhookTestResponse(
        success=would_create,
        extracted_data={
            "phone": extracted["phone"],
            "phone_raw": extracted["phone_raw"],
            "name": extracted["name"],
            "email": extracted["email"],
            "metadata": extracted["metadata"]
        },
        extraction_log=extracted["extraction_log"],
        would_create_request=would_create,
        message=message
    )


@router.get("/{webhook_token}/config", response_model=WebhookConfigResponse)
async def get_webhook_config(
    webhook_token: str,
    db: Session = Depends(get_db)
):
    """
    Get current webhook configuration for a business.
    """
    from config import settings

    business = db.query(Business).filter(
        Business.webhook_token == webhook_token,
        Business.is_active == True
    ).first()

    if not business:
        raise HTTPException(status_code=404, detail="Invalid webhook token")

    backend_url = settings.BACKEND_URL if hasattr(settings, 'BACKEND_URL') else "http://localhost:8000"

    return WebhookConfigResponse(
        webhook_token=business.webhook_token,
        webhook_url=f"{backend_url}/api/v1/inbound/{business.webhook_token}",
        config=business.webhook_config
    )


@router.patch("/{webhook_token}/config", response_model=WebhookConfigResponse)
async def update_webhook_config(
    webhook_token: str,
    config_update: WebhookConfigUpdate,
    db: Session = Depends(get_db)
):
    """
    Update webhook field mappings.

    Use this after testing your payload to configure custom field paths.

    Example - if your system sends:
    ```json
    {"dados": {"contato": {"cel": "11999999999", "nome_completo": "João"}}}
    ```

    Configure:
    ```json
    {
        "phone_field": "dados.contato.cel",
        "name_field": "dados.contato.nome_completo"
    }
    ```
    """
    from config import settings

    business = db.query(Business).filter(
        Business.webhook_token == webhook_token,
        Business.is_active == True
    ).first()

    if not business:
        raise HTTPException(status_code=404, detail="Invalid webhook token")

    # Get current config and merge updates
    current_config = business.webhook_config
    update_data = config_update.model_dump(exclude_none=True)

    for key, value in update_data.items():
        current_config[key] = value

    business.webhook_config = current_config
    db.commit()
    db.refresh(business)

    logger.info(f"Updated webhook config for business {business.name}")

    backend_url = settings.BACKEND_URL if hasattr(settings, 'BACKEND_URL') else "http://localhost:8000"

    return WebhookConfigResponse(
        webhook_token=business.webhook_token,
        webhook_url=f"{backend_url}/api/v1/inbound/{business.webhook_token}",
        config=business.webhook_config
    )


@router.get("/{webhook_token}/test")
async def verify_webhook(
    webhook_token: str,
    db: Session = Depends(get_db)
):
    """
    Simple GET endpoint to verify webhook token is valid.
    Useful for integration testing and health checks.
    """
    business = db.query(Business).filter(
        Business.webhook_token == webhook_token,
        Business.is_active == True
    ).first()

    if not business:
        raise HTTPException(status_code=404, detail="Invalid webhook token")

    return {
        "success": True,
        "message": "Webhook token is valid",
        "business_name": business.name,
        "whatsapp_configured": bool(business.whatsapp_instance_id)
    }
