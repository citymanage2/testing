"""Add task_id and act_type to client_ks2_acts

Revision ID: 023
Revises: 022
Create Date: 2026-04-10
"""
from alembic import op
import sqlalchemy as sa

revision = '023'
down_revision = '022'
branch_labels = None
depends_on = None


def upgrade():
    # act_type: "client" (КС-2 с заказчиком) | "subcontractor" (КС-2 с подрядчиком)
    op.add_column('client_ks2_acts', sa.Column('act_type', sa.String(32), nullable=False, server_default='client'))
    # task_id — конкретная смета; nullable для совместимости с существующими записями
    op.add_column('client_ks2_acts', sa.Column('task_id', sa.String(), nullable=True))
    op.create_index('ix_client_ks2_acts_task_id', 'client_ks2_acts', ['task_id'])
    try:
        op.create_foreign_key(
            'fk_client_ks2_acts_task_id', 'client_ks2_acts',
            'tasks', ['task_id'], ['id'], ondelete='CASCADE'
        )
    except Exception:
        pass  # SQLite does not support adding FK constraints


def downgrade():
    try:
        op.drop_constraint('fk_client_ks2_acts_task_id', 'client_ks2_acts', type_='foreignkey')
    except Exception:
        pass
    op.drop_index('ix_client_ks2_acts_task_id', 'client_ks2_acts')
    op.drop_column('client_ks2_acts', 'task_id')
    op.drop_column('client_ks2_acts', 'act_type')
