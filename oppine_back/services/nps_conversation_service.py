"""
NPS Conversation Service

Handles conversational NPS feedback collection via WhatsApp.
Manages conversation state and processes incoming messages.
"""

import re
import logging
import uuid
from typing import Optional, Tuple
from datetime import datetime, timezone
from dataclasses import dataclass
from enum import Enum
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class ConversationState(str, Enum):
    """States for NPS conversation flow."""
    AWAITING_PRE_RESPONSE = "awaiting_pre_response"
    AWAITING_SCORE = "awaiting_score"
    AWAITING_COMMENT = "awaiting_comment"
    COMPLETED = "completed"


@dataclass
class ScoreParseResult:
    """Result of parsing a score from text."""
    success: bool
    score: Optional[int] = None
    error_message: Optional[str] = None


@dataclass
class ConversationResponse:
    """Response to send back to customer."""
    message: str
    next_state: ConversationState
    should_create_response: bool = False
    score: Optional[int] = None
    classification: Optional[str] = None
    include_google_link: bool = False
    send_alert: bool = False  # Send alert immediately (used when comment arrives)
    schedule_delayed_alert: bool = False  # Schedule alert with delay to wait for comment


# Score parsing patterns
SCORE_PATTERNS = [
    # Direct number: "9", "10", "0"
    r'^(\d{1,2})$',
    # With "nota": "nota 9", "nota: 9", "nota 10"
    r'nota[:\s]*(\d{1,2})',
    # Fraction: "9/10", "10/10"
    r'(\d{1,2})\s*/\s*10',
    # With text: "dou 9", "minha nota e 9", "minha nota é 9"
    r'(?:dou|minha\s+nota\s+[eé]?)\s*(\d{1,2})',
    # "seria X", "daria X"
    r'(?:seria|daria)\s*(\d{1,2})',
]

WRITTEN_NUMBERS = {
    'zero': 0, 'um': 1, 'uma': 1, 'dois': 2, 'duas': 2,
    'tres': 3, 'três': 3, 'quatro': 4, 'cinco': 5,
    'seis': 6, 'sete': 7, 'oito': 8, 'nove': 9, 'dez': 10
}


def parse_score(text: str) -> ScoreParseResult:
    """
    Parse NPS score from customer message.

    Handles formats:
    - "9" or "10" (plain number)
    - "nota 9" or "nota: 9"
    - "9/10"
    - "dou 9" or "minha nota é 9"
    - Written numbers: "dez", "nove"
    """
    if not text:
        return ScoreParseResult(success=False, error_message="Mensagem vazia")

    text = text.strip().lower()

    # Remove accents for matching
    text_clean = text.replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u').replace('ê', 'e').replace('ã', 'a')

    # Try written numbers first
    for word, value in WRITTEN_NUMBERS.items():
        word_clean = word.replace('ê', 'e').replace('á', 'a')
        if word_clean in text_clean or word in text:
            return ScoreParseResult(success=True, score=value)

    # Try regex patterns
    for pattern in SCORE_PATTERNS:
        match = re.search(pattern, text_clean, re.IGNORECASE)
        if match:
            try:
                score = int(match.group(1))
                if 0 <= score <= 10:
                    return ScoreParseResult(success=True, score=score)
                else:
                    return ScoreParseResult(
                        success=False,
                        error_message="A nota deve ser entre 0 e 10"
                    )
            except ValueError:
                continue

    return ScoreParseResult(
        success=False,
        error_message="Não consegui entender a nota"
    )


def classify_score(score: int, promoter_threshold: int = 9, detractor_threshold: int = 6) -> str:
    """Classify score as promoter, passive, or detractor."""
    if score >= promoter_threshold:
        return "promoter"
    elif score <= detractor_threshold:
        return "detractor"
    else:
        return "passive"


def get_response_message(
    classification: str,
    customer_name: Optional[str],
    business_name: str,
    google_review_url: Optional[str],
    template: Optional[dict] = None
) -> Tuple[str, bool]:
    """
    Get appropriate response message based on classification.
    Returns (message, include_google_link).
    """
    name = customer_name.split()[0] if customer_name else ""
    name_greeting = f", {name}" if name else ""

    if classification == "promoter":
        if template and template.get("thank_you_promoter"):
            msg = template["thank_you_promoter"]
        else:
            msg = f"Muito obrigado{name_greeting}! Ficamos muito felizes com sua avaliação!"
            if google_review_url:
                msg += "\n\nQue tal compartilhar sua experiência no Google? Isso nos ajuda muito!"
        return msg, bool(google_review_url)

    elif classification == "passive":
        if template and template.get("thank_you_passive"):
            msg = template["thank_you_passive"]
        else:
            msg = f"Obrigado pelo seu feedback{name_greeting}!"
            msg += "\n\nHá algo específico que poderíamos melhorar para conquistar um 10?"
        return msg, False

    else:  # detractor
        if template and template.get("thank_you_detractor"):
            msg = template["thank_you_detractor"]
        else:
            msg = f"Obrigado pelo seu feedback{name_greeting}."
            msg += "\n\nLamentamos que sua experiência não tenha sido a melhor. Poderia nos contar o que aconteceu? Queremos melhorar."
        return msg, False


class NPSConversationHandler:
    """Handles the conversation flow for NPS collection."""

    def __init__(self, db_session: Session):
        self.db = db_session

    def process_incoming_message(
        self,
        from_number: str,
        message_content: str,
        business_id: Optional[str] = None,
        remote_jid: Optional[str] = None
    ) -> Optional[Tuple['FeedbackRequest', ConversationResponse]]:
        """
        Process an incoming WhatsApp message and return appropriate response.
        Returns tuple of (feedback_request, response) or None if no active conversation.
        """
        from models import FeedbackRequest, FeedbackResponse, Business, FeedbackStatus

        # Normalize phone number (remove non-digits)
        from_normalized = re.sub(r'\D', '', from_number)
        phone_suffix = from_normalized[-10:]  # Last 10 digits for matching

        logger.info(f"Looking for FeedbackRequest - phone: {phone_suffix}, remote_jid: {remote_jid}")

        feedback_request = None
        is_lid_format = remote_jid and "@lid" in remote_jid

        # First, try to find by whatsapp_lid if it's LID format
        if is_lid_format:
            query = self.db.query(FeedbackRequest).filter(
                FeedbackRequest.whatsapp_lid == remote_jid,
                FeedbackRequest.status.in_([
                    FeedbackStatus.SENT.value,
                    FeedbackStatus.DELIVERED.value,
                    FeedbackStatus.READ.value,
                    FeedbackStatus.RESPONDED.value  # Include RESPONDED for awaiting_comment state
                ]),
                FeedbackRequest.conversation_state != ConversationState.COMPLETED.value
            )

            if business_id:
                query = query.filter(FeedbackRequest.business_id == business_id)

            feedback_request = query.order_by(
                FeedbackRequest.sent_at.asc()
            ).first()

            if feedback_request:
                logger.info(f"Found FeedbackRequest by whatsapp_lid: {feedback_request.id}")

        # Also try by whatsapp_remote_jid
        if not feedback_request and remote_jid:
            query = self.db.query(FeedbackRequest).filter(
                FeedbackRequest.whatsapp_remote_jid == remote_jid,
                FeedbackRequest.status.in_([
                    FeedbackStatus.SENT.value,
                    FeedbackStatus.DELIVERED.value,
                    FeedbackStatus.READ.value,
                    FeedbackStatus.RESPONDED.value  # Include RESPONDED for awaiting_comment state
                ]),
                FeedbackRequest.conversation_state != ConversationState.COMPLETED.value
            )

            if business_id:
                query = query.filter(FeedbackRequest.business_id == business_id)

            feedback_request = query.order_by(
                FeedbackRequest.sent_at.asc()
            ).first()

            if feedback_request:
                logger.info(f"Found FeedbackRequest by remoteJid: {feedback_request.id}")

        # Fallback: try to find by phone number suffix
        if not feedback_request:
            query = self.db.query(FeedbackRequest).filter(
                FeedbackRequest.customer_phone.contains(phone_suffix),  # Match last 10 digits
                FeedbackRequest.status.in_([
                    FeedbackStatus.SENT.value,
                    FeedbackStatus.DELIVERED.value,
                    FeedbackStatus.READ.value,
                    FeedbackStatus.RESPONDED.value  # Include RESPONDED for awaiting_comment state
                ]),
                FeedbackRequest.conversation_state != ConversationState.COMPLETED.value
            )

            if business_id:
                query = query.filter(FeedbackRequest.business_id == business_id)

            feedback_request = query.order_by(
                FeedbackRequest.sent_at.asc()
            ).first()

            if feedback_request:
                logger.info(f"Found FeedbackRequest by phone suffix: {feedback_request.id}")

        if not feedback_request:
            # Debug: check all active requests
            all_active = self.db.query(FeedbackRequest).filter(
                FeedbackRequest.status.in_([
                    FeedbackStatus.SENT.value,
                    FeedbackStatus.DELIVERED.value,
                    FeedbackStatus.READ.value,
                    FeedbackStatus.RESPONDED.value
                ])
            ).all()
            logger.info(f"No active feedback request for {from_number} (remoteJid: {remote_jid}). Active requests: {[(r.customer_phone, r.whatsapp_remote_jid, r.status, r.conversation_state) for r in all_active[:5]]}")
            return None

        business = feedback_request.business
        state = feedback_request.conversation_state or ConversationState.AWAITING_SCORE.value

        logger.info(f"Processing message for request {feedback_request.id}, state: {state}")

        # Get template for response messages
        template_data = None
        if feedback_request.template:
            template_data = {
                "thank_you_promoter": feedback_request.template.thank_you_promoter,
                "thank_you_passive": feedback_request.template.thank_you_passive,
                "thank_you_detractor": feedback_request.template.thank_you_detractor,
                "initial_message": feedback_request.template.initial_message,
            }

        if state == ConversationState.AWAITING_PRE_RESPONSE.value:
            response = self._handle_pre_response(
                feedback_request,
                business,
                message_content,
                template_data
            )
            return (feedback_request, response)

        elif state == ConversationState.AWAITING_SCORE.value:
            response = self._handle_score_response(
                feedback_request,
                business,
                message_content,
                template_data
            )
            return (feedback_request, response)

        elif state == ConversationState.AWAITING_COMMENT.value:
            response = self._handle_comment_response(
                feedback_request,
                business,
                message_content
            )
            return (feedback_request, response)

        return None

    def _handle_pre_response(
        self,
        request: 'FeedbackRequest',
        business: 'Business',
        message: str,
        template: Optional[dict]
    ) -> ConversationResponse:
        """Handle message when awaiting pre_message response (open question before NPS)."""

        # Save customer's text response temporarily on the request
        request.pre_comment = message
        request.last_interaction_at = datetime.now(timezone.utc)
        request.conversation_state = ConversationState.AWAITING_SCORE.value

        # Build the NPS question from template
        customer_name = request.customer_name.split()[0] if request.customer_name else ""
        if template and template.get("initial_message"):
            nps_msg = template["initial_message"]
            nps_msg = nps_msg.replace("{customer_name}", request.customer_name or "Cliente")
            nps_msg = nps_msg.replace("{business_name}", business.name)
        else:
            customer_greeting = f" {customer_name}" if customer_name else ""
            nps_msg = (
                f"Obrigado{customer_greeting}! Agora, de 0 a 10, "
                f"qual a chance de voce nos recomendar para amigos ou familiares?"
            )

        self.db.commit()

        logger.info(f"Pre-response received for request {request.id}, transitioning to AWAITING_SCORE")

        return ConversationResponse(
            message=nps_msg,
            next_state=ConversationState.AWAITING_SCORE
        )

    def _handle_score_response(
        self,
        request: 'FeedbackRequest',
        business: 'Business',
        message: str,
        template: Optional[dict]
    ) -> ConversationResponse:
        """Handle message when awaiting score."""
        from models import FeedbackResponse, FeedbackStatus

        parse_result = parse_score(message)

        if not parse_result.success:
            # Could not parse score, ask again
            return ConversationResponse(
                message="Desculpe, nao consegui entender sua nota. Por favor, responda com um numero de 0 a 10.",
                next_state=ConversationState.AWAITING_SCORE
            )

        score = parse_result.score
        classification = classify_score(
            score,
            business.promoter_threshold,
            business.detractor_threshold
        )

        # Create feedback response
        response = FeedbackResponse(
            id=str(uuid.uuid4()),
            request_id=request.id,
            score=score,
            classification=classification,
            pre_comment=request.pre_comment,  # Copy from request (set by pre_message flow)
            responded_at=datetime.now(timezone.utc)
        )
        self.db.add(response)
        self.db.flush()  # Flush to make the relationship available for alert sending

        # Update request
        request.status = FeedbackStatus.RESPONDED.value
        request.response_channel = "whatsapp"
        request.last_interaction_at = datetime.now(timezone.utc)
        request.next_follow_up_at = None  # Cancel any pending follow-ups

        # Get response message
        response_msg, include_link = get_response_message(
            classification,
            request.customer_name,
            business.name,
            business.google_review_url,
            template
        )

        # Determine next state based on classification
        if classification == "promoter":
            request.conversation_state = ConversationState.COMPLETED.value
            if include_link and business.google_review_url:
                response_msg += f"\n\n{business.google_review_url}"

            return ConversationResponse(
                message=response_msg,
                next_state=ConversationState.COMPLETED,
                should_create_response=True,
                score=score,
                classification=classification,
                include_google_link=include_link,
                send_alert=False
            )

        else:  # passive or detractor
            # Ask for comment
            request.conversation_state = ConversationState.AWAITING_COMMENT.value

            # For detractors, schedule delayed alert to wait for possible comment
            # Alert will be sent after delay if no comment, or immediately when comment arrives
            return ConversationResponse(
                message=response_msg,
                next_state=ConversationState.AWAITING_COMMENT,
                should_create_response=True,
                score=score,
                classification=classification,
                send_alert=False,  # Don't send immediately
                schedule_delayed_alert=(classification == "detractor")  # Schedule delayed alert
            )

    def _handle_comment_response(
        self,
        request: 'FeedbackRequest',
        business: 'Business',
        message: str
    ) -> ConversationResponse:
        """Handle message when awaiting comment."""

        # Update the response with comment
        should_send_alert = False
        if request.response:
            request.response.comment = message
            request.response.updated_at = datetime.now(timezone.utc)

            # If detractor and alert not yet sent, send alert now with the comment
            if request.response.classification == "detractor" and not request.response.alert_sent:
                should_send_alert = True
                logger.info(f"Comment received for detractor, will send alert with comment for request {request.id}")

        request.conversation_state = ConversationState.COMPLETED.value
        request.last_interaction_at = datetime.now(timezone.utc)

        self.db.commit()

        return ConversationResponse(
            message="Muito obrigado pelo seu feedback detalhado! Sua opinião é muito importante para nós.",
            next_state=ConversationState.COMPLETED,
            send_alert=should_send_alert  # Send alert immediately with comment
        )
