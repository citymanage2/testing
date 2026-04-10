"""Add parent_estimate_id and calculation_method to tasks

Revision ID: 024
Revises: 023
Create Date: 2026-04-10
"""
from alembic import op
import sqlalchemy as sa

revision = '024'
down_revision = '023'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('tasks', sa.Column('parent_estimate_id', sa.String(), nullable=True))
    op.add_column('tasks', sa.Column('calculation_method', sa.String(16), nullable=True))
    # Foreign key (self-referential, soft constraint)
    op.create_foreign_key(
        'fk_tasks_parent_estimate_id',
        'tasks', 'tasks',
        ['parent_estimate_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_tasks_parent_estimate_id', 'tasks', type_='foreignkey')
    op.drop_column('tasks', 'calculation_method')
    op.drop_column('tasks', 'parent_estimate_id')
