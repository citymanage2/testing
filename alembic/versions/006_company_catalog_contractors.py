"""add company_settings, contractors, price_catalog

Revision ID: 006
Revises: 005
"""
from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "company_settings",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("user_id", sa.String, sa.ForeignKey("users.id"), nullable=False, unique=True),
        sa.Column("name", sa.String(256), nullable=False, server_default=""),
        sa.Column("inn", sa.String(12), nullable=True),
        sa.Column("kpp", sa.String(9), nullable=True),
        sa.Column("ogrn", sa.String(15), nullable=True),
        sa.Column("address", sa.Text, nullable=True),
        sa.Column("logo_data", sa.LargeBinary, nullable=True),
        sa.Column("logo_mime", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "contractors",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("user_id", sa.String, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("kind", sa.String(32), nullable=False, server_default="client"),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("inn", sa.String(12), nullable=True),
        sa.Column("kpp", sa.String(9), nullable=True),
        sa.Column("address", sa.Text, nullable=True),
        sa.Column("contact", sa.String(256), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_contractors_user_kind", "contractors", ["user_id", "kind"])

    op.create_table(
        "price_catalog",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("user_id", sa.String, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("item_type", sa.String(32), nullable=False, server_default="work"),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("unit", sa.String(64), nullable=True),
        sa.Column("work_price", sa.Float, nullable=False, server_default="0"),
        sa.Column("mat_price", sa.Float, nullable=False, server_default="0"),
        sa.Column("tags", sa.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_price_catalog_user_type", "price_catalog", ["user_id", "item_type"])


def downgrade() -> None:
    op.drop_index("ix_price_catalog_user_type", "price_catalog")
    op.drop_table("price_catalog")
    op.drop_index("ix_contractors_user_kind", "contractors")
    op.drop_table("contractors")
    op.drop_table("company_settings")
