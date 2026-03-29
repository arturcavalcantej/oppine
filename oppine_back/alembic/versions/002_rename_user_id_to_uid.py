"""Rename User.id to User.uid

Revision ID: 002_rename_user_id_to_uid
Revises: 001_initial_oppine
Create Date: 2026-01-27

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002_rename_user_id_to_uid'
down_revision = '001_initial_oppine'
branch_labels = None
depends_on = None


def upgrade():
    # Rename the 'id' column to 'uid' in users table
    # SQLite 3.25.0+ supports ALTER TABLE RENAME COLUMN
    op.alter_column('users', 'id', new_column_name='uid')


def downgrade():
    # Revert: rename 'uid' back to 'id'
    op.alter_column('users', 'uid', new_column_name='id')
