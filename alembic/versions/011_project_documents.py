"""project documents table

Revision ID: 011
Revises: 010
Create Date: 2026-04-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_documents",
        sa.Column("id", sa.String(), nullable=False, primary_key=True),
        sa.Column(
            "project_id",
            sa.String(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "category",
            sa.String(64),
            nullable=False,
            server_default="other",
        ),
        sa.Column("file_name", sa.String(256), nullable=False),
        sa.Column("mime_type", sa.String(64), nullable=False),
        sa.Column("file_data", sa.LargeBinary(), nullable=False),
        sa.Column(
            "version",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
        sa.Column(
            "status",
            sa.String(32),
            nullable=False,
            server_default="received",
        ),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column(
            "uploaded_by",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "uploaded_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "is_latest",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )

    op.create_index(
        "ix_proj_docs_project",
        "project_documents",
        ["project_id", "is_latest"],
    )


def downgrade() -> None:
    op.drop_index("ix_proj_docs_project", table_name="project_documents")
    op.drop_table("project_documents")
