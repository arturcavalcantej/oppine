"""Add follow-up tracking fields to feedback_requests

Revision ID: 007_add_follow_up_fields
Revises: 006_rename_victory_to_weekly
Create Date: 2025-02-03

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '007_add_follow_up_fields'
down_revision = '006_rename_victory_to_weekly'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add follow-up tracking columns
    op.add_column('feedback_requests', sa.Column('follow_up_count', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('feedback_requests', sa.Column('last_follow_up_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('feedback_requests', sa.Column('next_follow_up_at', sa.DateTime(timezone=True), nullable=True))

    # Create index for efficient querying of pending follow-ups
    op.create_index('ix_feedback_requests_next_follow_up_at', 'feedback_requests', ['next_follow_up_at'])

    # Set follow_up_count to 1 for all requests that were already sent (first attempt)
    op.execute("""
        UPDATE feedback_requests
        SET follow_up_count = 1
        WHERE status IN ('sent', 'delivered', 'read') AND follow_up_count IS NULL
    """)

    # Set follow_up_count to 0 for pending requests
    op.execute("""
        UPDATE feedback_requests
        SET follow_up_count = 0
        WHERE status = 'pending' AND follow_up_count IS NULL
    """)


def downgrade() -> None:
    op.drop_index('ix_feedback_requests_next_follow_up_at', table_name='feedback_requests')
    op.drop_column('feedback_requests', 'next_follow_up_at')
    op.drop_column('feedback_requests', 'last_follow_up_at')
    op.drop_column('feedback_requests', 'follow_up_count')
