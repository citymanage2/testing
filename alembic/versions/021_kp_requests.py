from alembic import op

revision = '021'
down_revision = '020'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS kp_requests (
            id VARCHAR PRIMARY KEY,
            project_id VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            estimate_item_id VARCHAR REFERENCES estimate_items(id) ON DELETE SET NULL,
            supplier_id VARCHAR REFERENCES contractors(id) ON DELETE SET NULL,
            item_name VARCHAR(256) NOT NULL,
            unit VARCHAR(32),
            quantity FLOAT DEFAULT 1.0,
            unit_price FLOAT DEFAULT 0.0,
            total FLOAT DEFAULT 0.0,
            notes TEXT,
            status VARCHAR(16) NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_kp_requests_project_id ON kp_requests(project_id);
    """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS kp_requests;")
