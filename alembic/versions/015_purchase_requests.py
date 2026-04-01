"""purchase requests tables

Revision ID: 015
Revises: 014
Create Date: 2026-04-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "purchase_requests",
        sa.Column("id", sa.String(), nullable=False, primary_key=True),
        sa.Column(
            "project_id",
            sa.String(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column(
            "status",
            sa.String(32),
            nullable=False,
            server_default="draft",
        ),
        sa.Column(
            "requested_by",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.create_index(
        "ix_purchase_req_project",
        "purchase_requests",
        ["project_id"],
    )

    op.create_table(
        "purchase_request_items",
        sa.Column("id", sa.String(), nullable=False, primary_key=True),
        sa.Column(
            "request_id",
            sa.String(),
            sa.ForeignKey("purchase_requests.id", ondelete="CASCADE"),
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
            "quantity_requested",
            sa.Float(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "quantity_delivered",
            sa.Float(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "supplier_id",
            sa.String(),
            sa.ForeignKey("contractors.id", ondelete="SET NULL"),
            nullable=True,
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
        "ix_purchase_req_items_req",
        "purchase_request_items",
        ["request_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_purchase_req_items_req",
        table_name="purchase_request_items",
    )
    op.drop_table("purchase_request_items")

    op.drop_index(
        "ix_purchase_req_project",
        table_name="purchase_requests",
    )
    op.drop_table("purchase_requests")
