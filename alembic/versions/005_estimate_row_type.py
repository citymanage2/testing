"""add row_type and sort_order to estimate_items

Revision ID: 005
Revises: 004
"""
from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("estimate_items", sa.Column("row_type", sa.String(16), nullable=False, server_default="item"))
    op.add_column("estimate_items", sa.Column("sort_order", sa.Float(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("estimate_items", "sort_order")
    op.drop_column("estimate_items", "row_type")
