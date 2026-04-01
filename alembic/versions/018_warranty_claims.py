from alembic import op

revision = '0018'
down_revision = '0017'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS warranty_claims (
            id VARCHAR PRIMARY KEY,
            project_id VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            title VARCHAR(256) NOT NULL,
            description TEXT,
            status VARCHAR(16) NOT NULL DEFAULT 'open',
            claimed_at DATE,
            deadline DATE,
            resolved_at DATE,
            assigned_to VARCHAR(128),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_warranty_claims_project_id ON warranty_claims(project_id);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_warranty_claims_status ON warranty_claims(status);
    """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS warranty_claims;")
