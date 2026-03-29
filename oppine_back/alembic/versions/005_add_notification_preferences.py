"""Add notification preferences to users

Revision ID: 005_add_notification_preferences
Revises: 004_add_nps_message
Create Date: 2025-02-03

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '005_add_notification_preferences'
down_revision = '004_add_nps_message'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add notification preference columns to users table
    op.add_column('users', sa.Column('notify_whatsapp', sa.Boolean(), nullable=True, server_default='1'))
    op.add_column('users', sa.Column('notify_email', sa.Boolean(), nullable=True, server_default='0'))
    op.add_column('users', sa.Column('notify_daily_summary', sa.Boolean(), nullable=True, server_default='0'))
    op.add_column('users', sa.Column('notify_promoters', sa.Boolean(), nullable=True, server_default='0'))
    op.add_column('users', sa.Column('notify_victory', sa.Boolean(), nullable=True, server_default='1'))
    op.add_column('users', sa.Column('quiet_hours_enabled', sa.Boolean(), nullable=True, server_default='0'))
    op.add_column('users', sa.Column('quiet_hours_start', sa.String(), nullable=True, server_default='22:00'))
    op.add_column('users', sa.Column('quiet_hours_end', sa.String(), nullable=True, server_default='08:00'))


def downgrade() -> None:
    op.drop_column('users', 'notify_whatsapp')
    op.drop_column('users', 'notify_email')
    op.drop_column('users', 'notify_daily_summary')
    op.drop_column('users', 'notify_promoters')
    op.drop_column('users', 'notify_victory')
    op.drop_column('users', 'quiet_hours_enabled')
    op.drop_column('users', 'quiet_hours_start')
    op.drop_column('users', 'quiet_hours_end')
