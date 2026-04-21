"""Architecture v2: new tables for estimates, positions, price layers, catalog, members

Revision ID: 027
Revises: 026
Create Date: 2026-04-21

New tables:
  price_sources        — источники цен (прайс, ФСНБ, внутренние расценки, ручной)
  project_members      — участники проекта с ролями
  catalog_items        — единый каталог работ и материалов
  catalog_prices       — цены каталога из источника на дату
  estimates            — смета v2 (заменяет task-based estimates)
  estimate_sections    — разделы сметы (поддержка вложенности)
  estimate_positions   — позиции сметы
  price_layers         — 4 слоя цен на позицию (заказчик/себестоимость/субподряд/факт)
"""

from alembic import op
import sqlalchemy as sa

revision = "027"
down_revision = "026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # price_sources
    op.create_table(
        "price_sources",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("company_id", sa.String(), nullable=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("source_type", sa.String(32), nullable=False),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("reference_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # project_members
    op.create_table(
        "project_members",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("role", sa.String(32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "user_id", name="uq_project_member"),
    )
    op.create_index("ix_project_members_project_id", "project_members", ["project_id"])

    # catalog_items
    op.create_table(
        "catalog_items",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("company_id", sa.String(), nullable=True),
        sa.Column("item_type", sa.String(16), nullable=False),
        sa.Column("code", sa.String(64), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("unit", sa.String(64), nullable=False, server_default="шт"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(256), nullable=True),
        sa.Column("subcategory", sa.String(256), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # catalog_prices
    op.create_table(
        "catalog_prices",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("catalog_item_id", sa.String(), nullable=False),
        sa.Column("price_source_id", sa.String(), nullable=False),
        sa.Column("work_price", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("material_price", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("effective_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["catalog_item_id"], ["catalog_items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["price_source_id"], ["price_sources.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_catalog_prices_catalog_item_id", "catalog_prices", ["catalog_item_id"])

    # estimates
    op.create_table(
        "estimates",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(512), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="draft"),
        sa.Column("is_locked", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("parent_id", sa.String(), nullable=True),
        sa.Column("version_name", sa.String(64), nullable=True),
        sa.Column("estimate_type", sa.String(32), nullable=False, server_default="client"),
        sa.Column("calculation_method", sa.String(16), nullable=False, server_default="manual"),
        sa.Column("created_by", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_id"], ["estimates.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_estimates_project_id", "estimates", ["project_id"])

    # estimate_sections
    op.create_table(
        "estimate_sections",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("estimate_id", sa.String(), nullable=False),
        sa.Column("parent_id", sa.String(), nullable=True),
        sa.Column("name", sa.String(512), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["estimate_id"], ["estimates.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_id"], ["estimate_sections.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_estimate_sections_estimate_id", "estimate_sections", ["estimate_id"])

    # estimate_positions
    op.create_table(
        "estimate_positions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("estimate_id", sa.String(), nullable=False),
        sa.Column("section_id", sa.String(), nullable=True),
        sa.Column("catalog_item_id", sa.String(), nullable=True),
        sa.Column("row_type", sa.String(16), nullable=False, server_default="item"),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("unit", sa.String(64), nullable=False, server_default="шт"),
        sa.Column("quantity", sa.Numeric(14, 4), nullable=False, server_default="1"),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["estimate_id"], ["estimates.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["section_id"], ["estimate_sections.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["catalog_item_id"], ["catalog_items.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_estimate_positions_estimate_id", "estimate_positions", ["estimate_id"])

    # price_layers
    op.create_table(
        "price_layers",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("position_id", sa.String(), nullable=False),
        sa.Column("layer_type", sa.String(32), nullable=False),
        sa.Column("work_price", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("material_price", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("total", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("price_source_id", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["position_id"], ["estimate_positions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["price_source_id"], ["price_sources.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_price_layers_position_id", "price_layers", ["position_id"])


def downgrade() -> None:
    op.drop_table("price_layers")
    op.drop_table("estimate_positions")
    op.drop_table("estimate_sections")
    op.drop_table("estimates")
    op.drop_table("catalog_prices")
    op.drop_table("catalog_items")
    op.drop_table("project_members")
    op.drop_table("price_sources")
