"""Initial Oppine schema

Revision ID: 001_initial_oppine
Revises:
Create Date: 2024-01-26

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001_initial_oppine'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Users table
    op.create_table(
        'users',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('password_hash', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('stripe_customer_id', sa.String(), nullable=True),
        sa.Column('language', sa.String(), nullable=True, default='pt-BR'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_users_id', 'users', ['id'])
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    # Projects table
    op.create_table(
        'projects',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('owner_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('stripe_subscription_id', sa.String(), nullable=True),
        sa.Column('subscription_status', sa.String(), default='active'),
        sa.Column('plan_id', sa.String(), nullable=True),
        sa.Column('current_period_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('currency', sa.String(), default='USD'),
        sa.Column('daily_usage_count', sa.Integer(), default=0),
        sa.Column('last_usage_reset', sa.DateTime(timezone=True), nullable=True),
        sa.Column('custom_usage_limit', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_projects_id', 'projects', ['id'])

    # Project members table
    op.create_table(
        'project_members',
        sa.Column('project_id', sa.String(), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('role', sa.String(), default='admin'),
        sa.PrimaryKeyConstraint('project_id', 'user_id')
    )

    # Hub user links table
    op.create_table(
        'hub_user_links',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('local_user_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('hub_user_id', sa.Integer(), nullable=False),
        sa.Column('hub_email', sa.String(), nullable=False),
        sa.Column('hub_username', sa.String(), nullable=True),
        sa.Column('hub_refresh_token', sa.String(), nullable=True),
        sa.Column('is_sso_user', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('local_user_id')
    )
    op.create_index('ix_hub_user_links_id', 'hub_user_links', ['id'])
    op.create_index('ix_hub_user_links_hub_user_id', 'hub_user_links', ['hub_user_id'])

    # Subscription cache table
    op.create_table(
        'subscription_cache',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('hub_user_id', sa.Integer(), nullable=False),
        sa.Column('plan_name', sa.String(), nullable=False, default='Free'),
        sa.Column('plan_slug', sa.String(), nullable=False, default='free'),
        sa.Column('status', sa.String(), nullable=False, default='active'),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('limits_json', sa.Text(), default='{}'),
        sa.Column('features_json', sa.Text(), default='{}'),
        sa.Column('usage_json', sa.Text(), default='{}'),
        sa.Column('cached_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('hub_user_id')
    )
    op.create_index('ix_subscription_cache_id', 'subscription_cache', ['id'])
    op.create_index('ix_subscription_cache_hub_user_id', 'subscription_cache', ['hub_user_id'])

    # Daily usage table
    op.create_table(
        'daily_usage',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('messages_sent', sa.Integer(), default=0),
        sa.Column('feedback_requests', sa.Integer(), default=0),
        sa.Column('api_calls', sa.Integer(), default=0),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_daily_usage_id', 'daily_usage', ['id'])
    op.create_index('ix_daily_usage_date', 'daily_usage', ['date'])

    # Coupon validation attempts table
    op.create_table(
        'coupon_validation_attempts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('ip_address', sa.String(), nullable=False),
        sa.Column('coupon_code', sa.String(), nullable=True),
        sa.Column('was_valid', sa.Boolean(), default=False),
        sa.Column('attempted_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_coupon_validation_attempts_ip_address', 'coupon_validation_attempts', ['ip_address'])
    op.create_index('ix_coupon_validation_attempts_attempted_at', 'coupon_validation_attempts', ['attempted_at'])

    # Businesses table
    op.create_table(
        'businesses',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('google_place_id', sa.String(), nullable=True),
        sa.Column('google_review_url', sa.String(), nullable=True),
        sa.Column('whatsapp_phone', sa.String(), nullable=True),
        sa.Column('whatsapp_instance_id', sa.String(), nullable=True),
        sa.Column('alert_phone', sa.String(), nullable=True),
        sa.Column('alert_email', sa.String(), nullable=True),
        sa.Column('promoter_threshold', sa.Integer(), default=9),
        sa.Column('detractor_threshold', sa.Integer(), default=6),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('auto_send_enabled', sa.Boolean(), default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_businesses_id', 'businesses', ['id'])
    op.create_index('ix_businesses_project_id', 'businesses', ['project_id'])

    # Feedback templates table
    op.create_table(
        'feedback_templates',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('business_id', sa.String(), sa.ForeignKey('businesses.id'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('initial_message', sa.Text(), nullable=False),
        sa.Column('thank_you_promoter', sa.Text(), nullable=True),
        sa.Column('thank_you_passive', sa.Text(), nullable=True),
        sa.Column('thank_you_detractor', sa.Text(), nullable=True),
        sa.Column('testimonial_request', sa.Text(), nullable=True),
        sa.Column('is_default', sa.Boolean(), default=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_feedback_templates_id', 'feedback_templates', ['id'])
    op.create_index('ix_feedback_templates_business_id', 'feedback_templates', ['business_id'])

    # Feedback requests table
    op.create_table(
        'feedback_requests',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('business_id', sa.String(), sa.ForeignKey('businesses.id'), nullable=False),
        sa.Column('template_id', sa.String(), sa.ForeignKey('feedback_templates.id'), nullable=True),
        sa.Column('customer_name', sa.String(), nullable=True),
        sa.Column('customer_phone', sa.String(), nullable=False),
        sa.Column('customer_email', sa.String(), nullable=True),
        sa.Column('transaction_id', sa.String(), nullable=True),
        sa.Column('transaction_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('transaction_amount', sa.String(), nullable=True),
        sa.Column('status', sa.String(), default='pending'),
        sa.Column('whatsapp_message_id', sa.String(), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('delivered_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_feedback_requests_id', 'feedback_requests', ['id'])
    op.create_index('ix_feedback_requests_business_id', 'feedback_requests', ['business_id'])
    op.create_index('ix_feedback_requests_customer_phone', 'feedback_requests', ['customer_phone'])

    # Feedback responses table
    op.create_table(
        'feedback_responses',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('request_id', sa.String(), sa.ForeignKey('feedback_requests.id'), nullable=False),
        sa.Column('score', sa.Integer(), nullable=False),
        sa.Column('classification', sa.String(), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('testimonial_text', sa.Text(), nullable=True),
        sa.Column('testimonial_audio_url', sa.String(), nullable=True),
        sa.Column('testimonial_approved', sa.Boolean(), default=False),
        sa.Column('google_review_clicked', sa.Boolean(), default=False),
        sa.Column('google_review_completed', sa.Boolean(), default=False),
        sa.Column('alert_sent', sa.Boolean(), default=False),
        sa.Column('alert_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('issue_resolved', sa.Boolean(), default=False),
        sa.Column('resolution_notes', sa.Text(), nullable=True),
        sa.Column('responded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('request_id')
    )
    op.create_index('ix_feedback_responses_id', 'feedback_responses', ['id'])
    op.create_index('ix_feedback_responses_request_id', 'feedback_responses', ['request_id'])

    # Alert notifications table
    op.create_table(
        'alert_notifications',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('response_id', sa.String(), sa.ForeignKey('feedback_responses.id'), nullable=False),
        sa.Column('business_id', sa.String(), sa.ForeignKey('businesses.id'), nullable=False),
        sa.Column('alert_type', sa.String(), nullable=False),
        sa.Column('whatsapp_sent', sa.Boolean(), default=False),
        sa.Column('whatsapp_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('email_sent', sa.Boolean(), default=False),
        sa.Column('email_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('message_content', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_alert_notifications_id', 'alert_notifications', ['id'])
    op.create_index('ix_alert_notifications_response_id', 'alert_notifications', ['response_id'])
    op.create_index('ix_alert_notifications_business_id', 'alert_notifications', ['business_id'])


def downgrade() -> None:
    op.drop_table('alert_notifications')
    op.drop_table('feedback_responses')
    op.drop_table('feedback_requests')
    op.drop_table('feedback_templates')
    op.drop_table('businesses')
    op.drop_table('coupon_validation_attempts')
    op.drop_table('daily_usage')
    op.drop_table('subscription_cache')
    op.drop_table('hub_user_links')
    op.drop_table('project_members')
    op.drop_table('projects')
    op.drop_table('users')
