"""add token storage fields to facebook_accounts

Revision ID: d4e5f6g7h8i9
Revises: c3d4e5f6g7h8
Create Date: 2026-04-07 18:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "d4e5f6g7h8i9"
down_revision = "c3d4e5f6g7h8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("facebook_accounts", sa.Column("access_token", sa.Text(), nullable=True))
    op.add_column("facebook_accounts", sa.Column("token_expires_at", sa.DateTime(), nullable=True))
    op.add_column("facebook_accounts", sa.Column("last_synced_at", sa.DateTime(), nullable=True))
    op.add_column("facebook_accounts", sa.Column("last_sync_error", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("facebook_accounts", "last_sync_error")
    op.drop_column("facebook_accounts", "last_synced_at")
    op.drop_column("facebook_accounts", "token_expires_at")
    op.drop_column("facebook_accounts", "access_token")
