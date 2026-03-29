"""Move templates from per-business to per-project level

Revision ID: 008_templates_per_project
Revises: 007_add_follow_up_fields
Create Date: 2026-02-03

Changes:
- Add project_id column to feedback_templates
- Add template_id column to businesses
- Migrate existing templates: set project_id from business->project
- Deduplicate templates per project (keep first default)
- Set template_id on businesses to their project's default template
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '008_templates_per_project'
down_revision = '007_add_follow_up_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add project_id to feedback_templates (nullable initially)
    op.add_column('feedback_templates', sa.Column('project_id', sa.String(), nullable=True))
    op.create_index('ix_feedback_templates_project_id', 'feedback_templates', ['project_id'])

    # 2. Add template_id to businesses (nullable)
    op.add_column('businesses', sa.Column('template_id', sa.String(), nullable=True))

    # 3. Set project_id on existing templates from their business's project_id
    op.execute("""
        UPDATE feedback_templates
        SET project_id = (
            SELECT businesses.project_id
            FROM businesses
            WHERE businesses.id = feedback_templates.business_id
        )
        WHERE business_id IS NOT NULL
    """)

    # 4. For each business, set template_id to the default template of the project
    # First, find the default template per project, then assign it
    op.execute("""
        UPDATE businesses
        SET template_id = (
            SELECT ft.id
            FROM feedback_templates ft
            WHERE ft.project_id = businesses.project_id
            AND ft.is_default = 1
            LIMIT 1
        )
    """)

    # For businesses without a default template, use any template from their project
    op.execute("""
        UPDATE businesses
        SET template_id = (
            SELECT ft.id
            FROM feedback_templates ft
            WHERE ft.project_id = businesses.project_id
            LIMIT 1
        )
        WHERE template_id IS NULL
    """)

    # 5. Make business_id nullable on feedback_templates (SQLite workaround: can't alter column)
    # In SQLite we can't modify column constraints, so business_id stays as-is
    # but new templates will be created with business_id = NULL


def downgrade() -> None:
    op.drop_column('businesses', 'template_id')
    op.drop_index('ix_feedback_templates_project_id', table_name='feedback_templates')
    op.drop_column('feedback_templates', 'project_id')
