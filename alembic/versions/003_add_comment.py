"""add comment to estimate_items

Revision ID: 003
Revises: 002
"""
from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("estimate_items", sa.Column("comment", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("estimate_items", "comment")
