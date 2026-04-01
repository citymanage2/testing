"""project lifecycle fields

Revision ID: 010
Revises: 009
Create Date: 2026-04-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add columns to projects
    op.add_column(
        "projects",
        sa.Column(
            "stage",
            sa.String(32),
            nullable=False,
            server_default="LEAD",
        ),
    )
    op.add_column(
        "projects",
        sa.Column("construction_type", sa.String(32), nullable=True),
    )
    op.add_column(
        "projects",
        sa.Column(
            "sales_manager_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "projects",
        sa.Column(
            "project_manager_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "projects",
        sa.Column("contract_number", sa.String(128), nullable=True),
    )
    op.add_column(
        "projects",
        sa.Column("contract_date", sa.Date(), nullable=True),
    )

    # Add columns to estimate_items
    op.add_column(
        "estimate_items",
        sa.Column(
            "sale_price",
            sa.Float(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "estimate_items",
        sa.Column("position_code", sa.String(32), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("estimate_items", "position_code")
    op.drop_column("estimate_items", "sale_price")

    op.drop_column("projects", "contract_date")
    op.drop_column("projects", "contract_number")
    op.drop_column("projects", "project_manager_id")
    op.drop_column("projects", "sales_manager_id")
    op.drop_column("projects", "construction_type")
    op.drop_column("projects", "stage")
