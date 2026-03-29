"""
WhatsApp Number Pool Management API Routes.

Admin endpoints for managing the shared WhatsApp number pool.
"""
import uuid
import logging
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from auth import verify_token
from models import WhatsAppNumber
from services.whatsapp_pool_service import get_whatsapp_pool

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin/whatsapp-pool",
    tags=["whatsapp-pool"]
)


# ============================================================================
# Pydantic Schemas
# ============================================================================

class WhatsAppNumberCreate(BaseModel):
    """Schema for adding a number to the pool."""
    instance_id: str
    phone_number: str
    display_name: Optional[str] = None
    daily_limit: int = 1000
    priority: int = 0


class WhatsAppNumberUpdate(BaseModel):
    """Schema for updating a number in the pool."""
    display_name: Optional[str] = None
    daily_limit: Optional[int] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None


class WhatsAppNumberResponse(BaseModel):
    """Response schema for a pool number."""
    id: str
    instance_id: str
    phone_number: str
    display_name: Optional[str]
    is_active: bool
    is_connected: bool
    daily_limit: int
    messages_sent_today: int
    total_messages_sent: int
    priority: int
    last_used_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class PoolStatsResponse(BaseModel):
    """Response schema for pool statistics."""
    total_numbers: int
    active_numbers: int
    connected_numbers: int
    daily_capacity: int
    messages_sent_today: int
    remaining_capacity: int
    utilization_percent: float


class PoolHealthResponse(BaseModel):
    """Response schema for pool health check."""
    total: int
    healthy: int
    unhealthy: int
    numbers: List[dict]


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/numbers", response_model=List[WhatsAppNumberResponse])
async def list_pool_numbers(
    current_user: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    List all numbers in the pool.
    Admin only.
    """
    numbers = db.query(WhatsAppNumber).order_by(
        WhatsAppNumber.priority.asc(),
        WhatsAppNumber.created_at.asc()
    ).all()

    return numbers


@router.post("/numbers", response_model=WhatsAppNumberResponse, status_code=status.HTTP_201_CREATED)
async def add_pool_number(
    data: WhatsAppNumberCreate,
    current_user: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Add a new number to the pool.
    Admin only.
    """
    # Check if instance already exists
    existing = db.query(WhatsAppNumber).filter(
        (WhatsAppNumber.instance_id == data.instance_id) |
        (WhatsAppNumber.phone_number == data.phone_number)
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Instance ID or phone number already exists in pool"
        )

    number = WhatsAppNumber(
        id=str(uuid.uuid4()),
        instance_id=data.instance_id,
        phone_number=data.phone_number,
        display_name=data.display_name,
        daily_limit=data.daily_limit,
        priority=data.priority,
        is_active=True,
        is_connected=False
    )

    db.add(number)
    db.commit()
    db.refresh(number)

    logger.info(f"Added number to pool: {number.instance_id} ({number.phone_number})")
    return number


@router.get("/numbers/{number_id}", response_model=WhatsAppNumberResponse)
async def get_pool_number(
    number_id: str,
    current_user: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get a specific number from the pool."""
    number = db.query(WhatsAppNumber).filter(WhatsAppNumber.id == number_id).first()

    if not number:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Number not found in pool"
        )

    return number


@router.patch("/numbers/{number_id}", response_model=WhatsAppNumberResponse)
async def update_pool_number(
    number_id: str,
    data: WhatsAppNumberUpdate,
    current_user: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Update a number in the pool."""
    number = db.query(WhatsAppNumber).filter(WhatsAppNumber.id == number_id).first()

    if not number:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Number not found in pool"
        )

    if data.display_name is not None:
        number.display_name = data.display_name
    if data.daily_limit is not None:
        number.daily_limit = data.daily_limit
    if data.priority is not None:
        number.priority = data.priority
    if data.is_active is not None:
        number.is_active = data.is_active

    db.commit()
    db.refresh(number)

    logger.info(f"Updated pool number: {number.instance_id}")
    return number


@router.delete("/numbers/{number_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pool_number(
    number_id: str,
    current_user: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Remove a number from the pool."""
    number = db.query(WhatsAppNumber).filter(WhatsAppNumber.id == number_id).first()

    if not number:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Number not found in pool"
        )

    db.delete(number)
    db.commit()

    logger.info(f"Removed pool number: {number.instance_id}")


@router.get("/stats", response_model=PoolStatsResponse)
async def get_pool_stats(
    current_user: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get statistics about the number pool."""
    pool = get_whatsapp_pool()
    stats = await pool.get_pool_stats(db)
    return stats


@router.post("/health-check", response_model=PoolHealthResponse)
async def check_pool_health(
    current_user: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Check the health of all numbers in the pool.
    Updates connection status for each number.
    """
    pool = get_whatsapp_pool()
    health = await pool.check_pool_health(db)
    return health


@router.post("/numbers/{number_id}/reset-counter")
async def reset_number_counter(
    number_id: str,
    current_user: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Manually reset the daily message counter for a number."""
    number = db.query(WhatsAppNumber).filter(WhatsAppNumber.id == number_id).first()

    if not number:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Number not found in pool"
        )

    number.messages_sent_today = 0
    number.last_counter_reset = datetime.utcnow()
    db.commit()

    logger.info(f"Reset counter for pool number: {number.instance_id}")
    return {"message": "Counter reset successfully"}
