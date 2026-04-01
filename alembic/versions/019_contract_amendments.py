from alembic import op

revision = '0019'
down_revision = '0018'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS contract_amendments (
            id VARCHAR PRIMARY KEY,
            contract_id VARCHAR NOT NULL REFERENCES subcontractor_contracts(id) ON DELETE CASCADE,
            amendment_number VARCHAR(64) NOT NULL,
            description TEXT,
            amount_delta FLOAT DEFAULT 0,
            status VARCHAR(16) NOT NULL DEFAULT 'draft',
            signed_at DATE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_contract_amendments_contract_id ON contract_amendments(contract_id);
    """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS contract_amendments;")
