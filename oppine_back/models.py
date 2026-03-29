from sqlalchemy import Column, String, ForeignKey, DateTime, Integer, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
import uuid
from database import Base


def generate_uuid():
    """Generate a UUID string."""
    return str(uuid.uuid4())


class Role(str, enum.Enum):
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"


class User(Base):
    __tablename__ = "users"

    uid = Column(String, primary_key=True, default=generate_uuid, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    stripe_customer_id = Column(String, nullable=True)
    language = Column(String, default="pt-BR")  # pt-BR, en, es
    has_completed_onboarding = Column(Boolean, default=False)
    google_integration_enabled = Column(Boolean, default=False)

    # Notification preferences
    notify_whatsapp = Column(Boolean, default=True)  # Alerts via WhatsApp
    notify_email = Column(Boolean, default=False)  # Alerts via Email
    notify_daily_summary = Column(Boolean, default=True)  # Daily summary at end of day
    notify_promoters = Column(Boolean, default=False)  # Notify on promoter scores
    notify_weekly_summary = Column(Boolean, default=True)  # Weekly summary (Monday)
    quiet_hours_enabled = Column(Boolean, default=False)
    quiet_hours_start = Column(String, default="22:00")
    quiet_hours_end = Column(String, default="08:00")

    # Relationships
    projects = relationship("ProjectMember", back_populates="user")
    owned_projects = relationship("Project", back_populates="owner")


class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    name = Column(String, nullable=False)
    owner_id = Column(String, ForeignKey("users.uid"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="owned_projects")
    members = relationship("ProjectMember", back_populates="project")

    # Subscription fields
    stripe_subscription_id = Column(String, nullable=True)
    subscription_status = Column(String, default="active")  # active, past_due, canceled, incomplete, trialing
    plan_id = Column(String, nullable=True)  # Stripe Price ID
    current_period_end = Column(DateTime(timezone=True), nullable=True)
    currency = Column(String, default="USD")  # Subscription currency (USD, BRL, EUR)

    # Usage limits (will be adapted for Oppine)
    daily_usage_count = Column(Integer, default=0)
    last_usage_reset = Column(DateTime(timezone=True), nullable=True)
    custom_usage_limit = Column(Integer, nullable=True)


class ProjectMember(Base):
    __tablename__ = "project_members"

    project_id = Column(String, ForeignKey("projects.id"), primary_key=True)
    user_id = Column(String, ForeignKey("users.uid"), primary_key=True)
    role = Column(String, default=Role.ADMIN)  # Storing enum as string for simplicity in SQLite

    project = relationship("Project", back_populates="members")
    user = relationship("User", back_populates="projects")


# ============================================================================
# Angular Hub Integration Models
# ============================================================================

class HubUserLink(Base):
    """
    Links local users to Angular Hub users.
    Stores the Angular Hub user_id for SSO users.
    """
    __tablename__ = "hub_user_links"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    local_user_id = Column(String, ForeignKey("users.uid"), unique=True, nullable=False)
    hub_user_id = Column(Integer, nullable=False, index=True)
    hub_email = Column(String, nullable=False)
    hub_username = Column(String, nullable=True)
    hub_refresh_token = Column(String, nullable=True)  # Stores Hub refresh token for billing API calls
    is_sso_user = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationship
    user = relationship("User", backref="hub_link")


class SubscriptionCache(Base):
    """
    Caches subscription data from Angular Hub.
    Reduces API calls and provides offline resilience.
    """
    __tablename__ = "subscription_cache"

    id = Column(String, primary_key=True, index=True)
    hub_user_id = Column(Integer, nullable=False, index=True, unique=True)

    # Plan info
    plan_name = Column(String, nullable=False, default="Free")
    plan_slug = Column(String, nullable=False, default="free")
    status = Column(String, nullable=False, default="active")
    is_active = Column(Boolean, default=True)

    # Limits and features as JSON strings (SQLite compatible)
    limits_json = Column(Text, default="{}")
    features_json = Column(Text, default="{}")
    usage_json = Column(Text, default="{}")

    # Cache metadata
    cached_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    @property
    def limits(self) -> dict:
        import json
        return json.loads(self.limits_json) if self.limits_json else {}

    @limits.setter
    def limits(self, value: dict):
        import json
        self.limits_json = json.dumps(value) if value else "{}"

    @property
    def features(self) -> dict:
        import json
        return json.loads(self.features_json) if self.features_json else {}

    @features.setter
    def features(self, value: dict):
        import json
        self.features_json = json.dumps(value) if value else "{}"

    @property
    def usage(self) -> dict:
        import json
        return json.loads(self.usage_json) if self.usage_json else {}

    @usage.setter
    def usage(self, value: dict):
        import json
        self.usage_json = json.dumps(value) if value else "{}"

    def is_expired(self) -> bool:
        """Check if cache has expired."""
        from datetime import datetime, timezone
        if not self.expires_at:
            return True
        now = datetime.now(timezone.utc)
        expires = self.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        return now > expires


class DailyUsage(Base):
    """
    Tracks daily usage for rate-limited features.
    Resets at midnight UTC.
    """
    __tablename__ = "daily_usage"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String, ForeignKey("users.uid"), nullable=False)
    date = Column(DateTime(timezone=True), nullable=False, index=True)

    # Usage counters
    messages_sent = Column(Integer, default=0)  # WhatsApp messages sent
    feedback_requests = Column(Integer, default=0)  # Feedback requests created
    api_calls = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CouponValidationAttempt(Base):
    """
    Tracks coupon validation attempts for rate limiting.
    Protects against brute-force coupon guessing.
    """
    __tablename__ = "coupon_validation_attempts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ip_address = Column(String, index=True, nullable=False)
    coupon_code = Column(String, nullable=True)  # Store attempted code for analytics
    was_valid = Column(Boolean, default=False)
    attempted_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


# ============================================================================
# Oppine - Feedback Collection Models
# ============================================================================

class FeedbackStatus(str, enum.Enum):
    """Status of a feedback request."""
    PENDING = "pending"          # Waiting to be sent
    SENT = "sent"                # WhatsApp message sent
    DELIVERED = "delivered"      # Message delivered
    READ = "read"                # Message read by customer
    RESPONDED = "responded"      # Customer responded
    EXPIRED = "expired"          # No response within time limit
    FAILED = "failed"            # Failed to send


class FeedbackScore(str, enum.Enum):
    """Triagem result based on customer score."""
    PROMOTER = "promoter"        # Score 9-10 -> Redirect to Google
    PASSIVE = "passive"          # Score 7-8 -> Thank you, no action
    DETRACTOR = "detractor"      # Score 0-6 -> Alert to seller


class Business(Base):
    """
    Represents a local business that will collect feedback.
    Each business has its own Google My Business link and WhatsApp config.
    """
    __tablename__ = "businesses"

    id = Column(String, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("projects.id"), index=True)

    # Business info
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    # Google My Business integration
    google_place_id = Column(String, nullable=True)  # Google Place ID for reviews
    google_review_url = Column(String, nullable=True)  # Direct URL to leave a review

    # WhatsApp configuration
    whatsapp_phone = Column(String, nullable=True)  # Business WhatsApp number
    whatsapp_instance_id = Column(String, nullable=True)  # WhatsApp API instance ID

    # Inbound Webhook configuration (for integrating client systems)
    webhook_token = Column(String, nullable=True, unique=True)  # Unique token for webhook auth
    webhook_config_json = Column(Text, nullable=True)  # JSON with field mappings

    @property
    def webhook_config(self) -> dict:
        """Get webhook field mapping configuration."""
        import json
        if self.webhook_config_json:
            return json.loads(self.webhook_config_json)
        # Default config
        return {
            "phone_field": "phone",
            "name_field": "name",
            "email_field": "email",
            "phone_alternatives": ["telefone", "celular", "whatsapp", "customer.phone", "cliente.telefone"],
            "name_alternatives": ["nome", "customer.name", "cliente.nome"],
            "metadata_fields": []
        }

    @webhook_config.setter
    def webhook_config(self, value: dict):
        import json
        self.webhook_config_json = json.dumps(value) if value else None

    # Alert configuration
    alert_phone = Column(String, nullable=True)  # Phone to receive negative feedback alerts
    alert_email = Column(String, nullable=True)  # Email to receive negative feedback alerts

    # NPS Message template
    nps_message = Column(Text, nullable=True)  # Custom NPS survey message

    # Thresholds for triagem (fixed defaults)
    promoter_threshold = Column(Integer, default=9)  # Score >= this is promoter
    detractor_threshold = Column(Integer, default=6)  # Score <= this is detractor

    # Template selection (project-level template)
    template_id = Column(String, ForeignKey("feedback_templates.id"), nullable=True)

    # Settings
    is_active = Column(Boolean, default=True)
    auto_send_enabled = Column(Boolean, default=False)  # Auto-send feedback requests

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    project = relationship("Project", backref="businesses")
    selected_template = relationship("FeedbackTemplate", foreign_keys=[template_id])
    feedback_requests = relationship("FeedbackRequest", back_populates="business", cascade="all, delete-orphan")


class FeedbackTemplate(Base):
    """
    Message templates for WhatsApp feedback requests.
    Templates belong to a PROJECT (account-level), not to individual businesses.
    Businesses reference which template they use via template_id.
    """
    __tablename__ = "feedback_templates"

    id = Column(String, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("projects.id"), index=True, nullable=True)
    business_id = Column(String, ForeignKey("businesses.id"), index=True, nullable=True)  # Legacy, nullable

    name = Column(String, nullable=False)  # Template name for identification

    # Optional open question sent before the NPS score question
    pre_message = Column(Text, nullable=True)

    # Initial message asking for feedback (NPS 0-10)
    initial_message = Column(Text, nullable=False)
    # {customer_name}, {business_name}, {feedback_link} placeholders

    # Thank you messages based on score
    thank_you_promoter = Column(Text, nullable=True)  # For 9-10 scores
    thank_you_passive = Column(Text, nullable=True)   # For 7-8 scores
    thank_you_detractor = Column(Text, nullable=True) # For 0-6 scores

    # Follow-up for testimonial (optional)
    testimonial_request = Column(Text, nullable=True)

    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    project = relationship("Project", backref="templates")
    business = relationship("Business", backref="templates", foreign_keys=[business_id])


class FeedbackRequest(Base):
    """
    A feedback request sent to a customer via WhatsApp.
    Tracks the entire lifecycle from creation to response.
    """
    __tablename__ = "feedback_requests"

    id = Column(String, primary_key=True, index=True)
    business_id = Column(String, ForeignKey("businesses.id"), index=True)
    template_id = Column(String, ForeignKey("feedback_templates.id"), nullable=True)

    # Customer info
    customer_name = Column(String, nullable=True)
    customer_phone = Column(String, nullable=False, index=True)  # WhatsApp number
    customer_email = Column(String, nullable=True)

    # Purchase/transaction info (optional)
    transaction_id = Column(String, nullable=True)  # External reference
    transaction_date = Column(DateTime(timezone=True), nullable=True)
    transaction_amount = Column(String, nullable=True)  # Store as string for currency

    # Status tracking
    status = Column(String, default=FeedbackStatus.PENDING)

    # WhatsApp message tracking
    whatsapp_message_id = Column(String, nullable=True)  # ID from WhatsApp API
    whatsapp_remote_jid = Column(String, nullable=True, index=True)  # Chat ID (phone@s.whatsapp.net format)
    whatsapp_lid = Column(String, nullable=True, index=True)  # LID format (xxxxx@lid) - Evolution API uses this
    sent_from_instance_id = Column(String, nullable=True, index=True)  # Which pool instance sent this message
    sent_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)

    # Expiration
    expires_at = Column(DateTime(timezone=True), nullable=True)

    # Conversational NPS tracking
    conversation_state = Column(String, default="awaiting_score")  # awaiting_pre_response, awaiting_score, awaiting_comment, completed
    response_channel = Column(String, default="web")  # web, whatsapp
    pre_comment = Column(Text, nullable=True)  # Temporary: customer's response to pre_message
    last_interaction_at = Column(DateTime(timezone=True), nullable=True)

    # Follow-up tracking (máximo 3 tentativas)
    follow_up_count = Column(Integer, default=0)  # 0=inicial, 1=1º follow-up, 2=2º follow-up, 3=3º follow-up
    last_follow_up_at = Column(DateTime(timezone=True), nullable=True)
    next_follow_up_at = Column(DateTime(timezone=True), nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    business = relationship("Business", back_populates="feedback_requests")
    template = relationship("FeedbackTemplate")
    response = relationship("FeedbackResponse", back_populates="request", uselist=False)


class FeedbackResponse(Base):
    """
    Customer's response to a feedback request.
    Contains the NPS score and optional comment.
    """
    __tablename__ = "feedback_responses"

    id = Column(String, primary_key=True, index=True)
    request_id = Column(String, ForeignKey("feedback_requests.id"), unique=True, index=True)

    # NPS Score (0-10)
    score = Column(Integer, nullable=False)

    # Triagem result based on score
    classification = Column(String, nullable=False)  # promoter, passive, detractor

    # Customer feedback
    pre_comment = Column(Text, nullable=True)  # Response to pre_message (open question before NPS)
    comment = Column(Text, nullable=True)  # Optional comment from customer

    # Testimonial (for promoters who agree to share)
    testimonial_text = Column(Text, nullable=True)
    testimonial_audio_url = Column(String, nullable=True)  # Generated audio testimonial
    testimonial_approved = Column(Boolean, default=False)  # Customer approved sharing

    # Google Review tracking (for promoters)
    google_review_clicked = Column(Boolean, default=False)
    google_review_completed = Column(Boolean, default=False)
    google_review_matched = Column(Boolean, default=False)
    google_review_matched_at = Column(DateTime(timezone=True), nullable=True)

    # Alert tracking (for detractors)
    alert_sent = Column(Boolean, default=False)
    alert_sent_at = Column(DateTime(timezone=True), nullable=True)
    issue_resolved = Column(Boolean, default=False)
    resolution_notes = Column(Text, nullable=True)

    responded_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    request = relationship("FeedbackRequest", back_populates="response")


class AlertNotification(Base):
    """
    Notifications sent to business owners when negative feedback is received.
    """
    __tablename__ = "alert_notifications"

    id = Column(String, primary_key=True, index=True)
    response_id = Column(String, ForeignKey("feedback_responses.id"), index=True)
    business_id = Column(String, ForeignKey("businesses.id"), index=True)

    # Alert details
    alert_type = Column(String, nullable=False)  # whatsapp, email, both

    # Delivery status
    whatsapp_sent = Column(Boolean, default=False)
    whatsapp_sent_at = Column(DateTime(timezone=True), nullable=True)
    email_sent = Column(Boolean, default=False)
    email_sent_at = Column(DateTime(timezone=True), nullable=True)

    # Content sent
    message_content = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    response = relationship("FeedbackResponse", backref="alerts")
    business = relationship("Business", backref="alerts")


# ============================================================================
# Google Business Profile Integration
# ============================================================================

class GoogleOAuthConnection(Base):
    """
    Stores OAuth 2.0 credentials for Google Business Profile API.
    One connection per user.
    """
    __tablename__ = "google_oauth_connections"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String, ForeignKey("users.uid"), unique=True, nullable=False)

    google_email = Column(String, nullable=False)
    google_account_id = Column(String, nullable=True)
    encrypted_refresh_token = Column(Text, nullable=False)  # Fernet-encrypted
    access_token_expires_at = Column(DateTime(timezone=True), nullable=True)

    sync_frequency = Column(String, default="6h")  # 1h, 6h, 12h, 24h
    is_active = Column(Boolean, default=True)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    connection_error = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", backref="google_connection")
    location_links = relationship("GoogleLocationLink", back_populates="connection",
                                     primaryjoin="GoogleOAuthConnection.user_id == GoogleLocationLink.user_id",
                                     foreign_keys="GoogleLocationLink.user_id",
                                     cascade="all, delete-orphan")


class GoogleLocationLink(Base):
    """
    Links a Business to a Google Business Profile location.
    One link per business.
    """
    __tablename__ = "google_location_links"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    business_id = Column(String, ForeignKey("businesses.id"), unique=True, nullable=False)
    user_id = Column(String, ForeignKey("users.uid"), nullable=False)

    google_account_id = Column(String, nullable=False)
    google_location_id = Column(String, nullable=False)
    google_location_name = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    business = relationship("Business", backref="google_location_link")
    user = relationship("User")
    connection = relationship("GoogleOAuthConnection", back_populates="location_links",
                              primaryjoin="GoogleLocationLink.user_id == GoogleOAuthConnection.user_id",
                              foreign_keys="GoogleLocationLink.user_id")


class GoogleReview(Base):
    """
    Synced reviews from Google Business Profile.
    Can be matched to FeedbackResponse records via heuristics.
    """
    __tablename__ = "google_reviews"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    business_id = Column(String, ForeignKey("businesses.id"), index=True, nullable=False)

    google_review_id = Column(String, unique=True, nullable=False, index=True)
    reviewer_name = Column(String, nullable=True)
    star_rating = Column(Integer, nullable=True)  # 1-5
    review_text = Column(Text, nullable=True)
    review_create_time = Column(DateTime(timezone=True), nullable=True)

    # Matching to Oppine feedback
    matched_response_id = Column(String, ForeignKey("feedback_responses.id"), nullable=True)
    match_confidence = Column(String, nullable=True)  # high, medium, low
    match_method = Column(String, nullable=True)  # name+time, time+click, etc.

    synced_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    business = relationship("Business", backref="google_reviews")
    matched_response = relationship("FeedbackResponse", backref="google_review_match")


# ============================================================================
# WhatsApp Number Pool (Shared Numbers for All Accounts)
# ============================================================================

class WhatsAppNumber(Base):
    """
    Pool of WhatsApp numbers/instances shared across all accounts.
    Uses Evolution API instances for sending messages.
    The system automatically selects an available number using round-robin/load balancing.
    """
    __tablename__ = "whatsapp_numbers"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)

    # Evolution API instance configuration
    instance_id = Column(String, unique=True, nullable=False)  # Evolution API instance name
    phone_number = Column(String, unique=True, nullable=False)  # Display phone (e.g., +5511999999999)
    display_name = Column(String, nullable=True)  # Friendly name for admin

    # Status and control
    is_active = Column(Boolean, default=True)
    is_connected = Column(Boolean, default=False)  # Updated via health checks

    # Rate limiting
    daily_limit = Column(Integer, default=1000)  # Max messages per day
    messages_sent_today = Column(Integer, default=0)
    last_counter_reset = Column(DateTime(timezone=True), nullable=True)

    # Metrics
    total_messages_sent = Column(Integer, default=0)
    last_used_at = Column(DateTime(timezone=True), nullable=True)

    # Priority (lower = higher priority)
    priority = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
