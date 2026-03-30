"""add subcontractor assignments and work acceptances

Revision ID: 009
Revises: 008
"""
from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "subcontractor_assignments",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("estimate_id", sa.String, sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("contractor_id", sa.String, sa.ForeignKey("contractors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scope_type", sa.String(16), nullable=False, server_default="section"),
        sa.Column("scope_ref", sa.String(512), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_sub_assign_estimate", "subcontractor_assignments", ["estimate_id"])

    op.create_table(
        "work_acceptances",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("estimate_id", sa.String, sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("contractor_id", sa.String, sa.ForeignKey("contractors.id", ondelete="SET NULL"), nullable=True),
        sa.Column("act_number", sa.String(64), nullable=False, server_default="1"),
        sa.Column("period_start", sa.Date, nullable=True),
        sa.Column("period_end", sa.Date, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_work_acc_estimate", "work_acceptances", ["estimate_id"])

    op.create_table(
        "work_acceptance_items",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("acceptance_id", sa.String, sa.ForeignKey("work_acceptances.id", ondelete="CASCADE"), nullable=False),
        sa.Column("estimate_item_id", sa.String, sa.ForeignKey("estimate_items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quantity_accepted", sa.Float, nullable=False, server_default="0"),
    )
    op.create_index("ix_work_acc_items_acc", "work_acceptance_items", ["acceptance_id"])
    op.create_index("ix_work_acc_items_item", "work_acceptance_items", ["estimate_item_id"])


def downgrade() -> None:
    op.drop_index("ix_work_acc_items_item", "work_acceptance_items")
    op.drop_index("ix_work_acc_items_acc", "work_acceptance_items")
    op.drop_table("work_acceptance_items")
    op.drop_index("ix_work_acc_estimate", "work_acceptances")
    op.drop_table("work_acceptances")
    op.drop_index("ix_sub_assign_estimate", "subcontractor_assignments")
    op.drop_table("subcontractor_assignments")
