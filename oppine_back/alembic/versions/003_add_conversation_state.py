"""Add conversation state fields for WhatsApp NPS

Revision ID: 003_add_conversation_state
Revises: 002_rename_user_id_to_uid
Create Date: 2025-01-30

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '003_add_conversation_state'
down_revision = '002_rename_user_id_to_uid'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add conversation tracking fields to feedback_requests
    op.add_column('feedback_requests',
        sa.Column('conversation_state', sa.String(), nullable=True, server_default='awaiting_score')
    )
    op.add_column('feedback_requests',
        sa.Column('response_channel', sa.String(), nullable=True, server_default='web')
    )
    op.add_column('feedback_requests',
        sa.Column('last_interaction_at', sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('feedback_requests', 'conversation_state')
    op.drop_column('feedback_requests', 'response_channel')
    op.drop_column('feedback_requests', 'last_interaction_at')
