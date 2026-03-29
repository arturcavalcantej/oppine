"""Add has_completed_onboarding flag to users

Revision ID: 011_add_onboarding_flag
Revises: 010_add_whatsapp_number_pool
Create Date: 2026-02-10

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '011_add_onboarding_flag'
down_revision = '010_add_whatsapp_number_pool'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add column with default True so existing users are considered onboarded
    op.add_column('users', sa.Column('has_completed_onboarding', sa.Boolean(), nullable=True, server_default='1'))

    # Set all existing users to True (already onboarded)
    op.execute("UPDATE users SET has_completed_onboarding = 1")


def downgrade() -> None:
    op.drop_column('users', 'has_completed_onboarding')
