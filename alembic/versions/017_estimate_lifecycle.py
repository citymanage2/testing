from alembic import op

revision = '017'
down_revision = '016'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimate_type VARCHAR(16) DEFAULT 'main';
    """)
    op.execute("""
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS estimate_item_log (
            id VARCHAR PRIMARY KEY,
            task_id VARCHAR REFERENCES tasks(id) ON DELETE CASCADE,
            item_id VARCHAR REFERENCES estimate_items(id) ON DELETE SET NULL,
            user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
            action VARCHAR(16) NOT NULL,
            field_name VARCHAR(64),
            old_value TEXT,
            new_value TEXT,
            changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_estimate_item_log_task_id ON estimate_item_log(task_id);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_estimate_item_log_item_id ON estimate_item_log(item_id);
    """)


def downgrade():
    op.execute("DROP TABLE estimate_item_log;")
    op.execute("ALTER TABLE tasks DROP COLUMN IF EXISTS estimate_type;")
    op.execute("ALTER TABLE tasks DROP COLUMN IF EXISTS is_approved;")
