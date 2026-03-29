"""
WhatsApp Service Abstraction

This module provides an abstract interface for WhatsApp messaging.
Implementations can be swapped for different providers:
- Evolution API (self-hosted)
- WhatsApp Cloud API (Meta official)
- Other providers

Usage:
    from services.whatsapp_service import whatsapp_service

    # Send a message
    result = await whatsapp_service.send_message(
        to="5511999999999",
        message="Hello!",
        instance_id="my-instance"
    )
"""

import logging
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum
import httpx
from config import settings

logger = logging.getLogger(__name__)


class MessageStatus(str, Enum):
    """Status of a WhatsApp message."""
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"


@dataclass
class SendMessageResult:
    """Result of sending a WhatsApp message."""
    success: bool
    message_id: Optional[str] = None
    status: MessageStatus = MessageStatus.PENDING
    error: Optional[str] = None
    raw_response: Optional[Dict[str, Any]] = None


@dataclass
class WebhookEvent:
    """Parsed webhook event from WhatsApp."""
    event_type: str  # message_status, message_received, etc.
    message_id: Optional[str] = None
    from_number: Optional[str] = None
    to_number: Optional[str] = None
    status: Optional[MessageStatus] = None
    content: Optional[str] = None
    timestamp: Optional[str] = None
    remote_jid: Optional[str] = None  # Full remoteJid for matching (e.g., 123456@lid or 5599@s.whatsapp.net)
    raw_data: Optional[Dict[str, Any]] = None


class WhatsAppServiceBase(ABC):
    """Abstract base class for WhatsApp service implementations."""

    @abstractmethod
    async def send_message(
        self,
        to: str,
        message: str,
        instance_id: Optional[str] = None
    ) -> SendMessageResult:
        """
        Send a text message via WhatsApp.

        Args:
            to: Recipient phone number (with country code, no +)
            message: Text message content
            instance_id: WhatsApp instance/session ID (if applicable)

        Returns:
            SendMessageResult with success status and message ID
        """
        pass

    @abstractmethod
    async def send_template(
        self,
        to: str,
        template_name: str,
        template_params: Dict[str, str],
        instance_id: Optional[str] = None
    ) -> SendMessageResult:
        """
        Send a pre-approved template message.

        Args:
            to: Recipient phone number
            template_name: Name of the approved template
            template_params: Parameters to fill in the template
            instance_id: WhatsApp instance ID

        Returns:
            SendMessageResult with success status
        """
        pass

    @abstractmethod
    async def get_message_status(
        self,
        message_id: str,
        instance_id: Optional[str] = None
    ) -> MessageStatus:
        """
        Get the current status of a sent message.

        Args:
            message_id: The message ID returned from send_message
            instance_id: WhatsApp instance ID

        Returns:
            Current MessageStatus
        """
        pass

    @abstractmethod
    def parse_webhook(self, payload: Dict[str, Any]) -> Optional[WebhookEvent]:
        """
        Parse an incoming webhook payload from WhatsApp.

        Args:
            payload: Raw webhook payload

        Returns:
            Parsed WebhookEvent or None if not parseable
        """
        pass

    @abstractmethod
    async def check_connection(self, instance_id: Optional[str] = None) -> bool:
        """
        Check if the WhatsApp connection is active.

        Args:
            instance_id: WhatsApp instance ID

        Returns:
            True if connected, False otherwise
        """
        pass


class MockWhatsAppService(WhatsAppServiceBase):
    """
    Mock implementation for development and testing.
    Simulates WhatsApp messaging without actually sending messages.
    Logs messages to console and saves to file for easy review.
    """

    def __init__(self):
        self._messages: Dict[str, Dict[str, Any]] = {}
        self._message_counter = 0
        self._log_file = "whatsapp_mock_messages.log"

    def _log_to_file(self, entry: str):
        """Append message to log file for easy review."""
        try:
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            with open(self._log_file, "a", encoding="utf-8") as f:
                f.write(f"\n{'='*60}\n")
                f.write(f"[{timestamp}]\n")
                f.write(entry)
                f.write(f"\n{'='*60}\n")
        except Exception as e:
            logger.warning(f"Could not write to mock log file: {e}")

    async def send_message(
        self,
        to: str,
        message: str,
        instance_id: Optional[str] = None
    ) -> SendMessageResult:
        """Mock send message - logs to console and file."""
        self._message_counter += 1
        message_id = f"mock_msg_{self._message_counter}"

        self._messages[message_id] = {
            "to": to,
            "message": message,
            "instance_id": instance_id,
            "status": MessageStatus.SENT
        }

        # Detailed console log
        log_entry = f"""
╔══════════════════════════════════════════════════════════════╗
║  📱 WHATSAPP MESSAGE SIMULATED (MOCK)                        ║
╠══════════════════════════════════════════════════════════════╣
║  To: {to}
║  Instance: {instance_id or 'N/A'}
║  Message ID: {message_id}
╠══════════════════════════════════════════════════════════════╣
║  MESSAGE:
║  {message}
╚══════════════════════════════════════════════════════════════╝
"""
        print(log_entry)
        logger.info(f"[MOCK] WhatsApp → {to}: {message[:100]}...")

        # Save to file
        self._log_to_file(f"TO: {to}\nINSTANCE: {instance_id}\nMESSAGE:\n{message}")

        return SendMessageResult(
            success=True,
            message_id=message_id,
            status=MessageStatus.SENT,
            raw_response={"mock": True, "message_id": message_id}
        )

    async def send_template(
        self,
        to: str,
        template_name: str,
        template_params: Dict[str, str],
        instance_id: Optional[str] = None
    ) -> SendMessageResult:
        """Mock send template - logs and returns success."""
        self._message_counter += 1
        message_id = f"mock_tmpl_{self._message_counter}"

        logger.info(f"[MOCK] WhatsApp template '{template_name}' sent to {to}")

        return SendMessageResult(
            success=True,
            message_id=message_id,
            status=MessageStatus.SENT,
            raw_response={"mock": True, "template": template_name}
        )

    async def get_message_status(
        self,
        message_id: str,
        instance_id: Optional[str] = None
    ) -> MessageStatus:
        """Mock get status - returns DELIVERED for known messages."""
        if message_id in self._messages:
            return MessageStatus.DELIVERED
        return MessageStatus.PENDING

    def parse_webhook(self, payload: Dict[str, Any]) -> Optional[WebhookEvent]:
        """Mock parse webhook - returns a basic event."""
        return WebhookEvent(
            event_type=payload.get("type", "unknown"),
            message_id=payload.get("message_id"),
            raw_data=payload
        )

    async def check_connection(self, instance_id: Optional[str] = None) -> bool:
        """Mock check - always returns True."""
        return True


class EvolutionAPIService(WhatsAppServiceBase):
    """
    Implementation for Evolution API (self-hosted WhatsApp API).
    https://github.com/EvolutionAPI/evolution-api
    """

    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.headers = {
            "apikey": api_key,
            "Content-Type": "application/json"
        }

    async def send_message(
        self,
        to: str,
        message: str,
        instance_id: Optional[str] = None
    ) -> SendMessageResult:
        """Send message via Evolution API."""
        if not instance_id:
            return SendMessageResult(
                success=False,
                error="instance_id is required for Evolution API"
            )

        # Normalize phone number (remove non-digits)
        to_normalized = "".join(filter(str.isdigit, to))

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/message/sendText/{instance_id}",
                    headers=self.headers,
                    json={
                        "number": to_normalized,
                        "textMessage": {
                            "text": message
                        }
                    }
                )

                if response.status_code == 201 or response.status_code == 200:
                    data = response.json()
                    return SendMessageResult(
                        success=True,
                        message_id=data.get("key", {}).get("id"),
                        status=MessageStatus.SENT,
                        raw_response=data
                    )
                else:
                    logger.error(f"Evolution API error: {response.status_code} - {response.text}")
                    return SendMessageResult(
                        success=False,
                        error=f"API error: {response.status_code}",
                        raw_response={"status": response.status_code, "body": response.text}
                    )

        except Exception as e:
            logger.error(f"Evolution API exception: {e}")
            return SendMessageResult(
                success=False,
                error=str(e)
            )

    async def send_template(
        self,
        to: str,
        template_name: str,
        template_params: Dict[str, str],
        instance_id: Optional[str] = None
    ) -> SendMessageResult:
        """
        Evolution API doesn't support official templates.
        Use send_message with a pre-formatted message instead.
        """
        # For Evolution API, templates are just regular messages
        # The template should be pre-formatted by the caller
        message = template_params.get("message", "")
        return await self.send_message(to, message, instance_id)

    async def get_message_status(
        self,
        message_id: str,
        instance_id: Optional[str] = None
    ) -> MessageStatus:
        """Get message status from Evolution API."""
        # Evolution API provides status via webhooks, not polling
        # This method would need to query a local cache/database
        logger.warning("get_message_status not fully implemented for Evolution API")
        return MessageStatus.SENT

    def parse_webhook(self, payload: Dict[str, Any]) -> Optional[WebhookEvent]:
        """Parse Evolution API webhook payload."""
        try:
            event_type = payload.get("event")
            logger.info(f"Parsing Evolution webhook - event: {event_type}, keys: {list(payload.keys())}")

            if event_type == "messages.upsert":
                # New message received or status update
                data = payload.get("data", {})
                key = data.get("key", {})
                message = data.get("message", {})

                # Skip messages from ourselves (fromMe=True)
                if key.get("fromMe"):
                    logger.info("Skipping outgoing message (fromMe=True)")
                    return None

                # Get the remoteJid from key - this is the chat identifier
                # It could be phone@s.whatsapp.net or LID@lid format
                remote_jid = key.get("remoteJid", "")

                # Extract phone number from remoteJid
                # Note: sender field contains the WhatsApp instance number, NOT the customer
                from_number = remote_jid.split("@")[0] if "@" in remote_jid else remote_jid
                logger.info(f"Message received - remoteJid: {remote_jid}, from_number: {from_number}")

                return WebhookEvent(
                    event_type="message_received",
                    message_id=key.get("id"),
                    from_number=from_number,
                    remote_jid=remote_jid,  # Pass full remoteJid for matching
                    content=message.get("conversation") or message.get("extendedTextMessage", {}).get("text"),
                    raw_data=payload
                )

            elif event_type == "messages.update":
                # Message status update
                # Evolution API v1.8 format: data contains remoteJid, id, status directly
                data = payload.get("data", {})

                status_map = {
                    "DELIVERY_ACK": MessageStatus.DELIVERED,
                    "READ": MessageStatus.READ,
                    "PLAYED": MessageStatus.READ,
                }

                # Status is directly in data, not in data.update
                status = status_map.get(
                    data.get("status"),
                    MessageStatus.SENT
                )

                # Get remoteJid - important for LID format tracking
                remote_jid = data.get("remoteJid", "")

                return WebhookEvent(
                    event_type="message_status",
                    message_id=data.get("id"),
                    to_number=remote_jid.split("@")[0] if "@" in remote_jid else remote_jid,
                    remote_jid=remote_jid,  # Include full remoteJid for LID tracking
                    status=status,
                    raw_data=payload
                )

            return WebhookEvent(
                event_type=event_type or "unknown",
                raw_data=payload
            )

        except Exception as e:
            logger.error(f"Error parsing Evolution API webhook: {e}")
            return None

    async def check_connection(self, instance_id: Optional[str] = None) -> bool:
        """Check if Evolution API instance is connected."""
        if not instance_id:
            return False

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/instance/connectionState/{instance_id}",
                    headers=self.headers
                )

                if response.status_code == 200:
                    data = response.json()
                    state = data.get("instance", {}).get("state")
                    return state == "open"

                return False

        except Exception as e:
            logger.error(f"Error checking Evolution API connection: {e}")
            return False


class WhatsAppCloudAPIService(WhatsAppServiceBase):
    """
    Implementation for WhatsApp Cloud API (Meta official).
    https://developers.facebook.com/docs/whatsapp/cloud-api
    """

    def __init__(self, access_token: str, phone_number_id: str):
        self.access_token = access_token
        self.phone_number_id = phone_number_id
        self.base_url = "https://graph.facebook.com/v18.0"
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }

    async def send_message(
        self,
        to: str,
        message: str,
        instance_id: Optional[str] = None
    ) -> SendMessageResult:
        """Send message via WhatsApp Cloud API."""
        phone_id = instance_id or self.phone_number_id
        to_normalized = "".join(filter(str.isdigit, to))

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/{phone_id}/messages",
                    headers=self.headers,
                    json={
                        "messaging_product": "whatsapp",
                        "recipient_type": "individual",
                        "to": to_normalized,
                        "type": "text",
                        "text": {"body": message}
                    }
                )

                if response.status_code == 200:
                    data = response.json()
                    messages = data.get("messages", [])
                    message_id = messages[0].get("id") if messages else None

                    return SendMessageResult(
                        success=True,
                        message_id=message_id,
                        status=MessageStatus.SENT,
                        raw_response=data
                    )
                else:
                    logger.error(f"WhatsApp Cloud API error: {response.status_code} - {response.text}")
                    return SendMessageResult(
                        success=False,
                        error=f"API error: {response.status_code}",
                        raw_response={"status": response.status_code, "body": response.text}
                    )

        except Exception as e:
            logger.error(f"WhatsApp Cloud API exception: {e}")
            return SendMessageResult(
                success=False,
                error=str(e)
            )

    async def send_template(
        self,
        to: str,
        template_name: str,
        template_params: Dict[str, str],
        instance_id: Optional[str] = None
    ) -> SendMessageResult:
        """Send template message via WhatsApp Cloud API."""
        phone_id = instance_id or self.phone_number_id
        to_normalized = "".join(filter(str.isdigit, to))

        # Build components from params
        components = []
        if template_params:
            body_params = [
                {"type": "text", "text": v}
                for v in template_params.values()
            ]
            components.append({
                "type": "body",
                "parameters": body_params
            })

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/{phone_id}/messages",
                    headers=self.headers,
                    json={
                        "messaging_product": "whatsapp",
                        "recipient_type": "individual",
                        "to": to_normalized,
                        "type": "template",
                        "template": {
                            "name": template_name,
                            "language": {"code": "pt_BR"},
                            "components": components
                        }
                    }
                )

                if response.status_code == 200:
                    data = response.json()
                    messages = data.get("messages", [])
                    message_id = messages[0].get("id") if messages else None

                    return SendMessageResult(
                        success=True,
                        message_id=message_id,
                        status=MessageStatus.SENT,
                        raw_response=data
                    )
                else:
                    return SendMessageResult(
                        success=False,
                        error=f"API error: {response.status_code}",
                        raw_response={"status": response.status_code, "body": response.text}
                    )

        except Exception as e:
            logger.error(f"WhatsApp Cloud API template exception: {e}")
            return SendMessageResult(
                success=False,
                error=str(e)
            )

    async def get_message_status(
        self,
        message_id: str,
        instance_id: Optional[str] = None
    ) -> MessageStatus:
        """Cloud API provides status via webhooks only."""
        logger.warning("get_message_status requires webhook integration for Cloud API")
        return MessageStatus.SENT

    def parse_webhook(self, payload: Dict[str, Any]) -> Optional[WebhookEvent]:
        """Parse WhatsApp Cloud API webhook payload."""
        try:
            entry = payload.get("entry", [])
            if not entry:
                return None

            changes = entry[0].get("changes", [])
            if not changes:
                return None

            value = changes[0].get("value", {})

            # Check for status updates
            statuses = value.get("statuses", [])
            if statuses:
                status_data = statuses[0]
                status_map = {
                    "sent": MessageStatus.SENT,
                    "delivered": MessageStatus.DELIVERED,
                    "read": MessageStatus.READ,
                    "failed": MessageStatus.FAILED,
                }

                return WebhookEvent(
                    event_type="message_status",
                    message_id=status_data.get("id"),
                    to_number=status_data.get("recipient_id"),
                    status=status_map.get(status_data.get("status"), MessageStatus.SENT),
                    timestamp=status_data.get("timestamp"),
                    raw_data=payload
                )

            # Check for incoming messages
            messages = value.get("messages", [])
            if messages:
                msg = messages[0]
                return WebhookEvent(
                    event_type="message_received",
                    message_id=msg.get("id"),
                    from_number=msg.get("from"),
                    content=msg.get("text", {}).get("body"),
                    timestamp=msg.get("timestamp"),
                    raw_data=payload
                )

            return None

        except Exception as e:
            logger.error(f"Error parsing Cloud API webhook: {e}")
            return None

    async def check_connection(self, instance_id: Optional[str] = None) -> bool:
        """Check if Cloud API is accessible."""
        phone_id = instance_id or self.phone_number_id

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/{phone_id}",
                    headers=self.headers
                )
                return response.status_code == 200

        except Exception as e:
            logger.error(f"Error checking Cloud API connection: {e}")
            return False


def get_whatsapp_service() -> WhatsAppServiceBase:
    """
    Factory function to get the configured WhatsApp service.

    Checks environment variables to determine which implementation to use:
    - WHATSAPP_PROVIDER: "evolution", "cloud", or "mock" (default: mock)
    - EVOLUTION_API_URL: Base URL for Evolution API
    - EVOLUTION_API_KEY: API key for Evolution API
    - WHATSAPP_ACCESS_TOKEN: Access token for Cloud API
    - WHATSAPP_PHONE_NUMBER_ID: Phone number ID for Cloud API
    """
    import os

    provider = os.getenv("WHATSAPP_PROVIDER", "mock").lower()

    if provider == "evolution":
        base_url = os.getenv("EVOLUTION_API_URL", "")
        api_key = os.getenv("EVOLUTION_API_KEY", "")

        if not base_url or not api_key:
            logger.warning("Evolution API not configured, falling back to mock")
            return MockWhatsAppService()

        return EvolutionAPIService(base_url, api_key)

    elif provider == "cloud":
        access_token = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
        phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")

        if not access_token or not phone_number_id:
            logger.warning("WhatsApp Cloud API not configured, falling back to mock")
            return MockWhatsAppService()

        return WhatsAppCloudAPIService(access_token, phone_number_id)

    else:
        logger.info("Using mock WhatsApp service")
        return MockWhatsAppService()


# Global instance (lazy initialization)
_whatsapp_service: Optional[WhatsAppServiceBase] = None


def get_service() -> WhatsAppServiceBase:
    """Get the global WhatsApp service instance."""
    global _whatsapp_service
    if _whatsapp_service is None:
        _whatsapp_service = get_whatsapp_service()
    return _whatsapp_service


# Convenience alias
whatsapp_service = get_service()
