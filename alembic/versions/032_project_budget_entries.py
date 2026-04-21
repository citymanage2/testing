"""Phase 5: project_budget_entries

Revision ID: 032
Revises: 031
Create Date: 2026-04-21
"""

from alembic import op
import sqlalchemy as sa

revision = "032"
down_revision = "031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_budget_entries",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("entry_type", sa.String(16), nullable=False),
        sa.Column("category", sa.String(32), nullable=False, server_default="other"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("planned_amount", sa.Numeric(16, 2), nullable=False, server_default="0"),
        sa.Column("actual_amount", sa.Numeric(16, 2), nullable=False, server_default="0"),
        sa.Column("planned_date", sa.Date(), nullable=True),
        sa.Column("actual_date", sa.Date(), nullable=True),
        sa.Column("reference_type", sa.String(64), nullable=True),
        sa.Column("reference_id", sa.String(), nullable=True),
        sa.Column("created_by", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_project_budget_entries_project_id", "project_budget_entries", ["project_id"])
    op.create_index("ix_project_budget_entries_entry_type", "project_budget_entries", ["entry_type"])


def downgrade() -> None:
    op.drop_table("project_budget_entries")
