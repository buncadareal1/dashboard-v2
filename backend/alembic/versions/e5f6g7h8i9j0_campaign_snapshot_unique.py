"""add unique constraint for campaign daily snapshots

Revision ID: e5f6g7h8i9j0
Revises: d4e5f6g7h8i9
Create Date: 2026-04-07 19:00:00.000000
"""
from alembic import op

revision = "e5f6g7h8i9j0"
down_revision = "d4e5f6g7h8i9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Unique constraint: one snapshot per campaign per day per account
    op.create_unique_constraint(
        "uq_campaign_account_ext_date",
        "campaigns",
        ["account_id", "campaign_ext_id", "date"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_campaign_account_ext_date", "campaigns", type_="unique")
