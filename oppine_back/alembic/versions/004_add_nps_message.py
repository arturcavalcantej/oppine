"""Add NPS message field to businesses

Revision ID: 004_add_nps_message
Revises: 003_add_conversation_state
Create Date: 2025-01-30

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '004_add_nps_message'
down_revision = '003_add_conversation_state'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('businesses',
        sa.Column('nps_message', sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('businesses', 'nps_message')
