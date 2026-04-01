"""client KS-2 acts tables

Revision ID: 014
Revises: 013
Create Date: 2026-04-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "client_ks2_acts",
        sa.Column("id", sa.String(), nullable=False, primary_key=True),
        sa.Column(
            "project_id",
            sa.String(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "act_number",
            sa.String(64),
            nullable=False,
            server_default="1",
        ),
        sa.Column("period_start", sa.Date(), nullable=True),
        sa.Column("period_end", sa.Date(), nullable=True),
        sa.Column(
            "status",
            sa.String(32),
            nullable=False,
            server_default="draft",
        ),
        sa.Column(
            "contractor_id",
            sa.String(),
            sa.ForeignKey("contractors.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_by",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("signed_at", sa.Date(), nullable=True),
    )

    op.create_index(
        "ix_client_acts_project",
        "client_ks2_acts",
        ["project_id"],
    )

    op.create_table(
        "client_ks2_act_items",
        sa.Column("id", sa.String(), nullable=False, primary_key=True),
        sa.Column(
            "act_id",
            sa.String(),
            sa.ForeignKey("client_ks2_acts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "estimate_item_id",
            sa.String(),
            sa.ForeignKey("estimate_items.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "quantity_presented",
            sa.Float(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "unit_price",
            sa.Float(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
    )

    op.create_index(
        "ix_client_act_items_act",
        "client_ks2_act_items",
        ["act_id"],
    )
    op.create_index(
        "ix_client_act_items_item",
        "client_ks2_act_items",
        ["estimate_item_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_client_act_items_item",
        table_name="client_ks2_act_items",
    )
    op.drop_index(
        "ix_client_act_items_act",
        table_name="client_ks2_act_items",
    )
    op.drop_table("client_ks2_act_items")

    op.drop_index(
        "ix_client_acts_project",
        table_name="client_ks2_acts",
    )
    op.drop_table("client_ks2_acts")
