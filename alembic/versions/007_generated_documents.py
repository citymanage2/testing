"""add generated_documents table

Revision ID: 007
Revises: 006
"""
from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "generated_documents",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("task_id", sa.String, sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("doc_kind", sa.String(32), nullable=False),   # estimate_xlsx | ks2 | ks3
        sa.Column("file_name", sa.String(256), nullable=False),
        sa.Column("file_data", sa.LargeBinary, nullable=False),
        sa.Column("mime_type", sa.String(64), nullable=False),
        sa.Column("created_by", sa.String, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("params", sa.JSON, nullable=True),
    )
    op.create_index("ix_gendocs_task", "generated_documents", ["task_id", "doc_kind"])


def downgrade() -> None:
    op.drop_index("ix_gendocs_task", "generated_documents")
    op.drop_table("generated_documents")
