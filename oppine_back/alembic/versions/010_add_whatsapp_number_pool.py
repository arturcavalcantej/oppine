"""Add WhatsApp number pool for shared instances

Revision ID: 010_add_whatsapp_number_pool
Revises: 009_deduplicate_project_templates
Create Date: 2025-02-05

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '010_add_whatsapp_number_pool'
down_revision = '009_deduplicate_project_templates'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create whatsapp_numbers table for the shared pool
    op.create_table(
        'whatsapp_numbers',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('instance_id', sa.String(), nullable=False),
        sa.Column('phone_number', sa.String(), nullable=False),
        sa.Column('display_name', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='1'),
        sa.Column('is_connected', sa.Boolean(), nullable=True, server_default='0'),
        sa.Column('daily_limit', sa.Integer(), nullable=True, server_default='1000'),
        sa.Column('messages_sent_today', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('last_counter_reset', sa.DateTime(timezone=True), nullable=True),
        sa.Column('total_messages_sent', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('priority', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('instance_id'),
        sa.UniqueConstraint('phone_number')
    )
    op.create_index('ix_whatsapp_numbers_id', 'whatsapp_numbers', ['id'])

    # Add sent_from_instance_id to feedback_requests to track which pool number sent the message
    op.add_column('feedback_requests',
        sa.Column('sent_from_instance_id', sa.String(), nullable=True)
    )
    op.create_index('ix_feedback_requests_sent_from_instance_id', 'feedback_requests', ['sent_from_instance_id'])


def downgrade() -> None:
    op.drop_index('ix_feedback_requests_sent_from_instance_id', 'feedback_requests')
    op.drop_column('feedback_requests', 'sent_from_instance_id')
    op.drop_index('ix_whatsapp_numbers_id', 'whatsapp_numbers')
    op.drop_table('whatsapp_numbers')
