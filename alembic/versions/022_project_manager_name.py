"""add project_manager_name to projects

Revision ID: 022
Revises: 021
Create Date: 2026-04-09
"""
from alembic import op
import sqlalchemy as sa

revision = '022'
down_revision = '021'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('projects', sa.Column('project_manager_name', sa.String(), nullable=True))

def downgrade():
    op.drop_column('projects', 'project_manager_name')
