"""Rename notify_victory to notify_weekly_summary

Revision ID: 006_rename_victory_to_weekly
Revises: 005_add_notification_preferences
Create Date: 2025-02-03

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '006_rename_victory_to_weekly'
down_revision = '005_add_notification_preferences'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Rename notify_victory to notify_weekly_summary
    op.alter_column('users', 'notify_victory', new_column_name='notify_weekly_summary')

    # Update notify_daily_summary default to True for existing users
    op.execute("UPDATE users SET notify_daily_summary = 1 WHERE notify_daily_summary IS NULL OR notify_daily_summary = 0")


def downgrade() -> None:
    op.alter_column('users', 'notify_weekly_summary', new_column_name='notify_victory')
