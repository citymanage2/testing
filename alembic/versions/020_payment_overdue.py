from alembic import op

revision = '0020'
down_revision = '0019'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE project_payments ADD COLUMN IF NOT EXISTS act_id VARCHAR(256);
    """)
    op.execute("""
        ALTER TABLE project_payments ADD COLUMN IF NOT EXISTS due_date DATE;
    """)
    op.execute("""
        ALTER TABLE project_payments ADD COLUMN IF NOT EXISTS is_overdue BOOLEAN DEFAULT FALSE;
    """)


def downgrade():
    op.execute("ALTER TABLE project_payments DROP COLUMN IF EXISTS act_id;")
    op.execute("ALTER TABLE project_payments DROP COLUMN IF EXISTS due_date;")
    op.execute("ALTER TABLE project_payments DROP COLUMN IF EXISTS is_overdue;")
