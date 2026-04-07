"""add budget_reports table

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-06 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "b2c3d4e5f6g7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "budget_reports",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("campaign_name", sa.String(500), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("spend", sa.Float(), server_default="0"),
        sa.Column("total_leads", sa.Integer(), server_default="0"),
        sa.Column("f1_leads", sa.Integer(), server_default="0"),
        sa.Column("nurturing_leads", sa.Integer(), server_default="0"),
        sa.Column("cpl", sa.Float(), server_default="0"),
        sa.Column("cost_per_f1", sa.Float(), server_default="0"),
        sa.Column("qualify_rate", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_budget_reports_id", "budget_reports", ["id"])
    op.create_index(
        "ix_budget_reports_campaign_date",
        "budget_reports",
        ["campaign_name", "date"],
    )
    op.create_unique_constraint(
        "uq_budget_report_campaign_date",
        "budget_reports",
        ["campaign_name", "date"],
    )


def downgrade() -> None:
    op.drop_table("budget_reports")
