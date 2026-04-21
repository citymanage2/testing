"""Phase 4: warehouses, warehouse_stock, stock_movements

Revision ID: 030
Revises: 029
Create Date: 2026-04-21
"""

from alembic import op
import sqlalchemy as sa

revision = "030"
down_revision = "029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "warehouses",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("warehouse_type", sa.String(16), nullable=False, server_default="central"),
        sa.Column("project_id", sa.String(), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_warehouses_project_id", "warehouses", ["project_id"])

    op.create_table(
        "warehouse_stock",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("warehouse_id", sa.String(), nullable=False),
        sa.Column("catalog_item_id", sa.String(), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 4), nullable=False, server_default="0"),
        sa.Column("reserved_quantity", sa.Numeric(14, 4), nullable=False, server_default="0"),
        sa.Column("unit", sa.String(64), nullable=False, server_default="шт"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["catalog_item_id"], ["catalog_items.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("warehouse_id", "catalog_item_id", name="uq_stock_warehouse_item"),
    )
    op.create_index("ix_warehouse_stock_warehouse_id", "warehouse_stock", ["warehouse_id"])

    op.create_table(
        "stock_movements",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("warehouse_id", sa.String(), nullable=False),
        sa.Column("from_warehouse_id", sa.String(), nullable=True),
        sa.Column("catalog_item_id", sa.String(), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 4), nullable=False),
        sa.Column("movement_type", sa.String(16), nullable=False),
        sa.Column("reference_type", sa.String(64), nullable=True),
        sa.Column("reference_id", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["from_warehouse_id"], ["warehouses.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["catalog_item_id"], ["catalog_items.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_stock_movements_warehouse_id", "stock_movements", ["warehouse_id"])


def downgrade() -> None:
    op.drop_table("stock_movements")
    op.drop_table("warehouse_stock")
    op.drop_table("warehouses")
