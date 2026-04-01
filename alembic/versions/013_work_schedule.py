"""work schedule tables

Revision ID: 013
Revises: 012
Create Date: 2026-04-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "work_schedule_items",
        sa.Column("id", sa.String(), nullable=False, primary_key=True),
        sa.Column(
            "project_id",
            sa.String(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "estimate_item_id",
            sa.String(),
            sa.ForeignKey("estimate_items.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("name", sa.String(512), nullable=False),
        sa.Column("unit", sa.String(64), nullable=True),
        sa.Column(
            "total_quantity",
            sa.Float(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "sort_order",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.create_index(
        "ix_work_sched_project",
        "work_schedule_items",
        ["project_id"],
    )

    op.create_table(
        "work_schedule_entries",
        sa.Column("id", sa.String(), nullable=False, primary_key=True),
        sa.Column(
            "schedule_item_id",
            sa.String(),
            sa.ForeignKey("work_schedule_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("period_label", sa.String(32), nullable=False),
        sa.Column(
            "period_type",
            sa.String(8),
            nullable=False,
            server_default="month",
        ),
        sa.Column(
            "planned_qty",
            sa.Float(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "actual_qty",
            sa.Float(),
            nullable=False,
            server_default="0",
        ),
        sa.UniqueConstraint(
            "schedule_item_id",
            "period_label",
            name="uq_work_sched_entry_item_period",
        ),
    )

    op.create_index(
        "ix_work_sched_entries_item",
        "work_schedule_entries",
        ["schedule_item_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_work_sched_entries_item",
        table_name="work_schedule_entries",
    )
    op.drop_table("work_schedule_entries")

    op.drop_index(
        "ix_work_sched_project",
        table_name="work_schedule_items",
    )
    op.drop_table("work_schedule_items")
