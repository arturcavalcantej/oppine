"""
WhatsApp Number Pool Service

Manages a pool of shared WhatsApp numbers (Evolution API instances) for sending messages.
Automatically selects the best available number using round-robin with rate limiting.

Usage:
    from services.whatsapp_pool_service import whatsapp_pool

    result, instance_id = await whatsapp_pool.send_message(
        to="5511999999999",
        message="Hello!",
        db=db_session
    )
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_

from models import WhatsAppNumber
from services.whatsapp_service import (
    EvolutionAPIService,
    SendMessageResult,
    MessageStatus,
    get_whatsapp_service
)
from config import settings

logger = logging.getLogger(__name__)


class WhatsAppPoolService:
    """
    Manages a pool of WhatsApp numbers for sending messages.
    Provides load balancing and rate limiting across multiple instances.
    """

    def __init__(self):
        self._evolution_service: Optional[EvolutionAPIService] = None

    @property
    def evolution_service(self) -> EvolutionAPIService:
        """Get or create the Evolution API service instance."""
        if self._evolution_service is None:
            import os
            base_url = os.getenv("EVOLUTION_API_URL", "")
            api_key = os.getenv("EVOLUTION_API_KEY", "")

            if not base_url or not api_key:
                raise ValueError("Evolution API not configured. Set EVOLUTION_API_URL and EVOLUTION_API_KEY.")

            self._evolution_service = EvolutionAPIService(base_url, api_key)

        return self._evolution_service

    async def _reset_daily_counters_if_needed(self, db: Session) -> None:
        """Reset daily message counters if a new day has started."""
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        # Find numbers that haven't been reset today
        numbers_to_reset = db.query(WhatsAppNumber).filter(
            and_(
                WhatsAppNumber.is_active == True,
                (WhatsAppNumber.last_counter_reset == None) |
                (WhatsAppNumber.last_counter_reset < today_start)
            )
        ).all()

        for number in numbers_to_reset:
            number.messages_sent_today = 0
            number.last_counter_reset = now
            logger.info(f"Reset daily counter for instance {number.instance_id}")

        if numbers_to_reset:
            db.commit()

    async def get_available_number(self, db: Session) -> Optional[WhatsAppNumber]:
        """
        Select an available number from the pool.

        Selection criteria (in order):
        1. Active and connected
        2. Under daily limit
        3. Lowest usage today (load balancing)
        4. Lowest priority number (lower = higher priority)
        """
        # Reset counters if needed
        await self._reset_daily_counters_if_needed(db)

        # Find best available number
        number = db.query(WhatsAppNumber).filter(
            and_(
                WhatsAppNumber.is_active == True,
                WhatsAppNumber.messages_sent_today < WhatsAppNumber.daily_limit
            )
        ).order_by(
            WhatsAppNumber.priority.asc(),  # Lower priority first
            WhatsAppNumber.messages_sent_today.asc()  # Less used first
        ).first()

        if not number:
            logger.error("No available WhatsApp numbers in pool!")
            return None

        return number

    async def send_message(
        self,
        to: str,
        message: str,
        db: Session
    ) -> Tuple[SendMessageResult, Optional[str]]:
        """
        Send a message using an available number from the pool.

        Args:
            to: Recipient phone number
            message: Message content
            db: Database session

        Returns:
            Tuple of (SendMessageResult, instance_id used)
        """
        # Get available number
        number = await self.get_available_number(db)

        if not number:
            return SendMessageResult(
                success=False,
                error="No available WhatsApp numbers in pool",
                status=MessageStatus.FAILED
            ), None

        logger.info(f"Using pool number {number.instance_id} ({number.phone_number}) for message to {to}")

        # Send via Evolution API
        try:
            result = await self.evolution_service.send_message(
                to=to,
                message=message,
                instance_id=number.instance_id
            )

            # Update counters on success
            if result.success:
                number.messages_sent_today += 1
                number.total_messages_sent += 1
                number.last_used_at = datetime.utcnow()
                db.commit()
                logger.info(f"Message sent via {number.instance_id}. Today: {number.messages_sent_today}/{number.daily_limit}")
            else:
                logger.warning(f"Failed to send via {number.instance_id}: {result.error}")

            return result, number.instance_id

        except Exception as e:
            logger.error(f"Exception sending via {number.instance_id}: {e}")
            return SendMessageResult(
                success=False,
                error=str(e),
                status=MessageStatus.FAILED
            ), number.instance_id

    async def check_pool_health(self, db: Session) -> dict:
        """
        Check the health of all numbers in the pool.
        Updates connection status for each number.

        Returns:
            Summary of pool health
        """
        numbers = db.query(WhatsAppNumber).filter(
            WhatsAppNumber.is_active == True
        ).all()

        healthy = 0
        unhealthy = 0

        for number in numbers:
            try:
                is_connected = await self.evolution_service.check_connection(number.instance_id)
                number.is_connected = is_connected

                if is_connected:
                    healthy += 1
                else:
                    unhealthy += 1
                    logger.warning(f"Number {number.instance_id} is disconnected")

            except Exception as e:
                number.is_connected = False
                unhealthy += 1
                logger.error(f"Error checking {number.instance_id}: {e}")

        db.commit()

        return {
            "total": len(numbers),
            "healthy": healthy,
            "unhealthy": unhealthy,
            "numbers": [
                {
                    "instance_id": n.instance_id,
                    "phone": n.phone_number,
                    "connected": n.is_connected,
                    "messages_today": n.messages_sent_today,
                    "daily_limit": n.daily_limit
                }
                for n in numbers
            ]
        }

    async def get_pool_stats(self, db: Session) -> dict:
        """Get statistics about the number pool."""
        numbers = db.query(WhatsAppNumber).all()

        active = [n for n in numbers if n.is_active]
        connected = [n for n in active if n.is_connected]

        total_capacity = sum(n.daily_limit for n in active)
        total_used = sum(n.messages_sent_today for n in active)

        return {
            "total_numbers": len(numbers),
            "active_numbers": len(active),
            "connected_numbers": len(connected),
            "daily_capacity": total_capacity,
            "messages_sent_today": total_used,
            "remaining_capacity": total_capacity - total_used,
            "utilization_percent": round((total_used / total_capacity * 100) if total_capacity > 0 else 0, 1)
        }

    def get_number_by_instance_id(self, instance_id: str, db: Session) -> Optional[WhatsAppNumber]:
        """Get a specific number by its instance ID."""
        return db.query(WhatsAppNumber).filter(
            WhatsAppNumber.instance_id == instance_id
        ).first()


# Global instance
_pool_service: Optional[WhatsAppPoolService] = None


def get_whatsapp_pool() -> WhatsAppPoolService:
    """Get the global WhatsApp pool service instance."""
    global _pool_service
    if _pool_service is None:
        _pool_service = WhatsAppPoolService()
    return _pool_service


# Convenience alias
whatsapp_pool = get_whatsapp_pool()
