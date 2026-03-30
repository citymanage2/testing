"""add project financials: address, client, dates, budget, gallery, payments

Revision ID: 008
Revises: 007
"""
from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Extend projects table
    op.add_column("projects", sa.Column("address", sa.Text, nullable=True))
    op.add_column("projects", sa.Column("client_id", sa.String, nullable=True))
    op.add_column("projects", sa.Column("start_date", sa.Date, nullable=True))
    op.add_column("projects", sa.Column("end_date", sa.Date, nullable=True))
    op.add_column("projects", sa.Column("status", sa.String(32), nullable=True, server_default="active"))
    op.add_column("projects", sa.Column("budget_planned", sa.Numeric(14, 2), nullable=True))
    op.add_column("projects", sa.Column("notes", sa.Text, nullable=True))

    # Project gallery
    op.create_table(
        "project_gallery",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.String, sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_name", sa.String(256), nullable=False),
        sa.Column("mime_type", sa.String(64), nullable=False),
        sa.Column("file_data", sa.LargeBinary, nullable=False),
        sa.Column("caption", sa.String(512), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("uploaded_by", sa.String, sa.ForeignKey("users.id"), nullable=False),
    )
    op.create_index("ix_gallery_project", "project_gallery", ["project_id"])

    # Project payments
    op.create_table(
        "project_payments",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("project_id", sa.String, sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("direction", sa.String(16), nullable=False),  # income | expense
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("paid_at", sa.Date, nullable=False),
        sa.Column("description", sa.String(512), nullable=True),
        sa.Column("contractor_id", sa.String, nullable=True),
        sa.Column("created_by", sa.String, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_payments_project", "project_payments", ["project_id"])


def downgrade() -> None:
    op.drop_index("ix_payments_project", "project_payments")
    op.drop_table("project_payments")
    op.drop_index("ix_gallery_project", "project_gallery")
    op.drop_table("project_gallery")
    op.drop_column("projects", "notes")
    op.drop_column("projects", "budget_planned")
    op.drop_column("projects", "status")
    op.drop_column("projects", "end_date")
    op.drop_column("projects", "start_date")
    op.drop_column("projects", "client_id")
    op.drop_column("projects", "address")
