"""Add plan_start and plan_end to work_schedule_items for Gantt chart

Revision ID: 025
Revises: 024
Create Date: 2026-04-10
"""
from alembic import op
import sqlalchemy as sa

revision = '025'
down_revision = '024'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('work_schedule_items', sa.Column('plan_start', sa.String(10), nullable=True))
    op.add_column('work_schedule_items', sa.Column('plan_end', sa.String(10), nullable=True))


def downgrade() -> None:
    op.drop_column('work_schedule_items', 'plan_end')
    op.drop_column('work_schedule_items', 'plan_start')
