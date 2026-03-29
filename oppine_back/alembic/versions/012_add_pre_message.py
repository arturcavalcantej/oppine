"""Add pre_message field for open question before NPS

Revision ID: 012_add_pre_message
Revises: 011_add_onboarding_flag
Create Date: 2026-02-12

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '012_add_pre_message'
down_revision = '011_add_onboarding_flag'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Template: optional open question sent before the NPS question
    op.add_column('feedback_templates', sa.Column('pre_message', sa.Text(), nullable=True))

    # Request: temporary storage for the pre_message response (before FeedbackResponse is created)
    op.add_column('feedback_requests', sa.Column('pre_comment', sa.Text(), nullable=True))

    # Response: final copy of the pre_message response
    op.add_column('feedback_responses', sa.Column('pre_comment', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('feedback_responses', 'pre_comment')
    op.drop_column('feedback_requests', 'pre_comment')
    op.drop_column('feedback_templates', 'pre_message')
