"""add name and extras to tasks

Revision ID: 004
Revises: 003
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("name", sa.String(256), nullable=True))
    op.add_column("tasks", sa.Column("doc_type", sa.String(64), nullable=True))
    op.add_column("tasks", sa.Column("extras", JSON, nullable=True))


def downgrade() -> None:
    op.drop_column("tasks", "extras")
    op.drop_column("tasks", "doc_type")
    op.drop_column("tasks", "name")
