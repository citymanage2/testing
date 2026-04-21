"""Phase 4: work_stages table + stage_id on estimate_positions

Revision ID: 029
Revises: 028
Create Date: 2026-04-21

New:
  work_stages        — ГПР этапы проекта (v2)
  estimate_positions.stage_id FK → work_stages
"""

from alembic import op
import sqlalchemy as sa

revision = "029"
down_revision = "028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "work_stages",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("parent_id", sa.String(), nullable=True),
        sa.Column("name", sa.String(512), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="planned"),
        sa.Column("plan_start", sa.Date(), nullable=True),
        sa.Column("plan_end", sa.Date(), nullable=True),
        sa.Column("actual_start", sa.Date(), nullable=True),
        sa.Column("actual_end", sa.Date(), nullable=True),
        sa.Column("depends_on", sa.JSON(), nullable=True),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_id"], ["work_stages.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_work_stages_project_id", "work_stages", ["project_id"])

    # Привязка позиции сметы к этапу ГПР
    op.add_column(
        "estimate_positions",
        sa.Column("stage_id", sa.String(), nullable=True),
    )
    op.create_foreign_key(
        "fk_estimate_positions_stage_id",
        "estimate_positions", "work_stages",
        ["stage_id"], ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_estimate_positions_stage_id", "estimate_positions", type_="foreignkey")
    op.drop_column("estimate_positions", "stage_id")
    op.drop_table("work_stages")
