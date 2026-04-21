"""Phase 4: material_requests, material_request_items

Revision ID: 031
Revises: 030
Create Date: 2026-04-21
"""

from alembic import op
import sqlalchemy as sa

revision = "031"
down_revision = "030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "material_requests",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("stage_id", sa.String(), nullable=True),
        sa.Column("warehouse_id", sa.String(), nullable=True),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="draft"),
        sa.Column("requested_by", sa.String(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["stage_id"], ["work_stages.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["requested_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_material_requests_project_id", "material_requests", ["project_id"])

    op.create_table(
        "material_request_items",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("request_id", sa.String(), nullable=False),
        sa.Column("catalog_item_id", sa.String(), nullable=True),
        sa.Column("estimate_position_id", sa.String(), nullable=True),
        sa.Column("name", sa.String(512), nullable=False),
        sa.Column("unit", sa.String(64), nullable=False, server_default="шт"),
        sa.Column("quantity_planned", sa.Numeric(14, 4), nullable=False, server_default="0"),
        sa.Column("quantity_actual", sa.Numeric(14, 4), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["request_id"], ["material_requests.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["catalog_item_id"], ["catalog_items.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["estimate_position_id"], ["estimate_positions.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_material_request_items_request_id", "material_request_items", ["request_id"])


def downgrade() -> None:
    op.drop_table("material_request_items")
    op.drop_table("material_requests")
