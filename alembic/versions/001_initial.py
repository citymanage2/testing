"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-01-01

"""
from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("username", sa.String(), unique=True, nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("role", sa.String(32), nullable=False, server_default="user"),
    )
    op.create_index("ix_users_username", "users", ["username"])

    op.create_table(
        "projects",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "tasks",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("task_type", sa.String(64), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id"), nullable=True),
        sa.Column("user_prompt", sa.Text(), nullable=True),
        sa.Column("chat_history", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("progress_message", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("estimate_status", sa.String(32), nullable=True),
        sa.Column("estimate_status_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("estimate_status_updated_by", sa.String(128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "task_input_files",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("task_id", sa.String(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_index", sa.Integer(), nullable=False),
        sa.Column("file_name", sa.String(256), nullable=False),
        sa.Column("mime_type", sa.String(128), nullable=False),
        sa.Column("file_data", sa.LargeBinary(), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
    )

    op.create_table(
        "task_results",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("task_id", sa.String(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_name", sa.String(256), nullable=False),
        sa.Column("file_data", sa.LargeBinary(), nullable=False),
        sa.Column("mime_type", sa.String(128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "estimate_items",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("task_id", sa.String(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("section", sa.String(256), nullable=False, server_default=""),
        sa.Column("type", sa.String(64), nullable=False, server_default=""),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("unit", sa.String(64), nullable=False, server_default=""),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("work_price", sa.Float(), nullable=False, server_default="0"),
        sa.Column("mat_price", sa.Float(), nullable=False, server_default="0"),
        sa.Column("total", sa.Float(), nullable=False, server_default="0"),
        sa.Column("is_analogue", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("original_data", sa.JSON(), nullable=True),
    )
    op.create_index("ix_estimate_items_task_id", "estimate_items", ["task_id"])

    op.create_table(
        "task_versions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("task_id", sa.String(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("change_type", sa.String(64), nullable=False),
        sa.Column("change_description", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_task_versions_task_id", "task_versions", ["task_id"])

    op.create_table(
        "price_lists",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("type", sa.String(32), nullable=False),
        sa.Column("filename", sa.String(256), nullable=False),
        sa.Column("content", sa.LargeBinary(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "price_works",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(512), unique=True, nullable=False),
        sa.Column("unit", sa.String(64), nullable=False, server_default=""),
        sa.Column("prices", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("min_price", sa.Float(), nullable=False, server_default="0"),
    )
    op.create_index("ix_price_works_name", "price_works", ["name"])

    op.create_table(
        "price_materials",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(512), unique=True, nullable=False),
        sa.Column("unit", sa.String(64), nullable=False, server_default=""),
        sa.Column("price", sa.Float(), nullable=False, server_default="0"),
    )
    op.create_index("ix_price_materials_name", "price_materials", ["name"])

    # Seed default users — passwords come from env at runtime via startup event
    # (actual seeding done in lifespan)


def downgrade() -> None:
    for t in ["price_materials", "price_works", "price_lists", "task_versions",
              "estimate_items", "task_results", "task_input_files", "tasks", "projects", "users"]:
        op.drop_table(t)
