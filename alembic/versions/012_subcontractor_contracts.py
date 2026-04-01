"""subcontractor contracts tables

Revision ID: 012
Revises: 011
Create Date: 2026-04-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "subcontractor_contracts",
        sa.Column("id", sa.String(), nullable=False, primary_key=True),
        sa.Column(
            "project_id",
            sa.String(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "contractor_id",
            sa.String(),
            sa.ForeignKey("contractors.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("contract_number", sa.String(128), nullable=True),
        sa.Column("contract_date", sa.Date(), nullable=True),
        sa.Column(
            "status",
            sa.String(32),
            nullable=False,
            server_default="draft",
        ),
        sa.Column(
            "advance_pct",
            sa.Float(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "guarantee_pct",
            sa.Float(),
            nullable=False,
            server_default="0",
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
        "ix_sub_contracts_project",
        "subcontractor_contracts",
        ["project_id"],
    )

    op.create_table(
        "subcontractor_contract_items",
        sa.Column("id", sa.String(), nullable=False, primary_key=True),
        sa.Column(
            "contract_id",
            sa.String(),
            sa.ForeignKey("subcontractor_contracts.id", ondelete="CASCADE"),
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
            "quantity",
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
        "ix_sub_contract_items_contract",
        "subcontractor_contract_items",
        ["contract_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_sub_contract_items_contract",
        table_name="subcontractor_contract_items",
    )
    op.drop_table("subcontractor_contract_items")

    op.drop_index(
        "ix_sub_contracts_project",
        table_name="subcontractor_contracts",
    )
    op.drop_table("subcontractor_contracts")
