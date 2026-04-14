"""Add VOR fields to estimate_items (ТЗ v1.0 schema 3.1)

Revision ID: 026
Revises: 025
Create Date: 2026-04-14

New fields:
  is_estimated    — price was estimated by Claude (needs review)
  source          — price source: url | 'cache' | 'api' | 'ai_estimate' | 'scan'
  qty_from_tz     — volume from TZ (LIST_FROM_TZ_PROJECT only)
  qty_from_project — volume from project docs (LIST_FROM_TZ_PROJECT only)
  discrepancy     — mismatch between qty_from_tz and qty_from_project
  scan_math_error — arithmetic error found in scanned document (SCAN_TO_EXCEL)
"""
from alembic import op
import sqlalchemy as sa

revision = '026'
down_revision = '025'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('estimate_items', sa.Column('is_estimated',    sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('estimate_items', sa.Column('source',          sa.String(256), nullable=True))
    op.add_column('estimate_items', sa.Column('qty_from_tz',     sa.Float(), nullable=True))
    op.add_column('estimate_items', sa.Column('qty_from_project',sa.Float(), nullable=True))
    op.add_column('estimate_items', sa.Column('discrepancy',     sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('estimate_items', sa.Column('scan_math_error', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('estimate_items', 'scan_math_error')
    op.drop_column('estimate_items', 'discrepancy')
    op.drop_column('estimate_items', 'qty_from_project')
    op.drop_column('estimate_items', 'qty_from_tz')
    op.drop_column('estimate_items', 'source')
    op.drop_column('estimate_items', 'is_estimated')
