"""Deduplicate templates per project and clean orphans

Revision ID: 009_deduplicate_project_templates
Revises: 008_templates_per_project
Create Date: 2026-02-03

Changes:
- Delete orphaned templates (project_id=NULL and business_id=NULL)
- Deduplicate templates per project (keep first of each name)
- Update business.template_id references to surviving templates
- Clear legacy business_id from surviving project-level templates
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '009_deduplicate_project_templates'
down_revision = '008_templates_per_project'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Delete orphaned templates (no project_id AND no business_id)
    conn.execute(sa.text("""
        DELETE FROM feedback_templates
        WHERE project_id IS NULL AND business_id IS NULL
    """))

    # 2. For each project, deduplicate templates by name
    # Get all projects that have templates
    projects = conn.execute(sa.text("""
        SELECT DISTINCT project_id FROM feedback_templates
        WHERE project_id IS NOT NULL
    """)).fetchall()

    for (project_id,) in projects:
        # Get all template names for this project
        template_names = conn.execute(sa.text("""
            SELECT DISTINCT name FROM feedback_templates
            WHERE project_id = :project_id
        """), {"project_id": project_id}).fetchall()

        for (name,) in template_names:
            # Get all templates with this name, ordered: is_default DESC, created_at ASC
            duplicates = conn.execute(sa.text("""
                SELECT id, is_default FROM feedback_templates
                WHERE project_id = :project_id AND name = :name
                ORDER BY is_default DESC, created_at ASC
            """), {"project_id": project_id, "name": name}).fetchall()

            if len(duplicates) <= 1:
                continue

            # Keep the first one (default preferred), delete the rest
            keep_id = duplicates[0][0]
            delete_ids = [d[0] for d in duplicates[1:]]

            for delete_id in delete_ids:
                # Update any business.template_id references to the surviving template
                conn.execute(sa.text("""
                    UPDATE businesses
                    SET template_id = :keep_id
                    WHERE template_id = :delete_id
                """), {"keep_id": keep_id, "delete_id": delete_id})

                # Delete the duplicate
                conn.execute(sa.text("""
                    DELETE FROM feedback_templates
                    WHERE id = :delete_id
                """), {"delete_id": delete_id})

    # 3. Clear legacy business_id from all project-level templates
    conn.execute(sa.text("""
        UPDATE feedback_templates
        SET business_id = NULL
        WHERE project_id IS NOT NULL
    """))

    # 4. Ensure only one default per project
    for (project_id,) in projects:
        defaults = conn.execute(sa.text("""
            SELECT id FROM feedback_templates
            WHERE project_id = :project_id AND is_default = 1
            ORDER BY created_at ASC
        """), {"project_id": project_id}).fetchall()

        if len(defaults) > 1:
            # Keep only the first default
            keep_default = defaults[0][0]
            for d in defaults[1:]:
                conn.execute(sa.text("""
                    UPDATE feedback_templates
                    SET is_default = 0
                    WHERE id = :id
                """), {"id": d[0]})


def downgrade() -> None:
    # Data migration, not reversible in a meaningful way
    pass
