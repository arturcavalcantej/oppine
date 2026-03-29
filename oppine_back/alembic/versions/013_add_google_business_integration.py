"""Add Google Business Profile integration tables and columns

Revision ID: 013_add_google_business_integration
Revises: 012_add_pre_message
Create Date: 2026-02-13

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '013_add_google_business_integration'
down_revision = '012_add_pre_message'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # New column on users
    op.add_column('users', sa.Column('google_integration_enabled', sa.Boolean(), nullable=True, server_default='0'))

    # New columns on feedback_responses
    op.add_column('feedback_responses', sa.Column('google_review_matched', sa.Boolean(), nullable=True, server_default='0'))
    op.add_column('feedback_responses', sa.Column('google_review_matched_at', sa.DateTime(timezone=True), nullable=True))

    # google_oauth_connections table
    op.create_table(
        'google_oauth_connections',
        sa.Column('id', sa.String(), primary_key=True, index=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.uid'), unique=True, nullable=False),
        sa.Column('google_email', sa.String(), nullable=False),
        sa.Column('google_account_id', sa.String(), nullable=True),
        sa.Column('encrypted_refresh_token', sa.Text(), nullable=False),
        sa.Column('access_token_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sync_frequency', sa.String(), server_default='6h'),
        sa.Column('is_active', sa.Boolean(), server_default='1'),
        sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('connection_error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # google_location_links table
    op.create_table(
        'google_location_links',
        sa.Column('id', sa.String(), primary_key=True, index=True),
        sa.Column('business_id', sa.String(), sa.ForeignKey('businesses.id'), unique=True, nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.uid'), nullable=False),
        sa.Column('google_account_id', sa.String(), nullable=False),
        sa.Column('google_location_id', sa.String(), nullable=False),
        sa.Column('google_location_name', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # google_reviews table
    op.create_table(
        'google_reviews',
        sa.Column('id', sa.String(), primary_key=True, index=True),
        sa.Column('business_id', sa.String(), sa.ForeignKey('businesses.id'), nullable=False, index=True),
        sa.Column('google_review_id', sa.String(), unique=True, nullable=False, index=True),
        sa.Column('reviewer_name', sa.String(), nullable=True),
        sa.Column('star_rating', sa.Integer(), nullable=True),
        sa.Column('review_text', sa.Text(), nullable=True),
        sa.Column('review_create_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('matched_response_id', sa.String(), sa.ForeignKey('feedback_responses.id'), nullable=True),
        sa.Column('match_confidence', sa.String(), nullable=True),
        sa.Column('match_method', sa.String(), nullable=True),
        sa.Column('synced_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('google_reviews')
    op.drop_table('google_location_links')
    op.drop_table('google_oauth_connections')
    op.drop_column('feedback_responses', 'google_review_matched_at')
    op.drop_column('feedback_responses', 'google_review_matched')
    op.drop_column('users', 'google_integration_enabled')
