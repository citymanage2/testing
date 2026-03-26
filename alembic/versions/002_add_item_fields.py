"""add is_optimized and source_url to estimate_items

Revision ID: 002
Revises: 001
"""
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("estimate_items", sa.Column("is_optimized", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("estimate_items", sa.Column("source_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("estimate_items", "source_url")
    op.drop_column("estimate_items", "is_optimized")
