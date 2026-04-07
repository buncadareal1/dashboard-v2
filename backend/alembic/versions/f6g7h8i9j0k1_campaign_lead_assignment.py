"""add assigned_user_id to campaigns and leads, campaign_id FK to leads

Revision ID: f6g7h8i9j0k1
Revises: e5f6g7h8i9j0
Create Date: 2026-04-07 20:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "f6g7h8i9j0k1"
down_revision = "e5f6g7h8i9j0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Campaign: assigned_user_id
    op.add_column("campaigns", sa.Column("assigned_user_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_campaigns_assigned_user", "campaigns", "users",
        ["assigned_user_id"], ["id"],
    )
    op.create_index("ix_campaigns_assigned_user_id", "campaigns", ["assigned_user_id"])

    # Campaign: project_id (B-LINK, doing now to avoid extra migration)
    op.add_column("campaigns", sa.Column("project_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_campaigns_project", "campaigns", "projects",
        ["project_id"], ["id"],
    )
    op.create_index("ix_campaigns_project_id", "campaigns", ["project_id"])

    # Lead: assigned_user_id
    op.add_column("leads", sa.Column("assigned_user_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_leads_assigned_user", "leads", "users",
        ["assigned_user_id"], ["id"],
    )
    op.create_index("ix_leads_assigned_user_id", "leads", ["assigned_user_id"])

    # Lead: campaign_id FK (replaces string-based campaign_name matching)
    op.add_column("leads", sa.Column("campaign_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_leads_campaign", "leads", "campaigns",
        ["campaign_id"], ["id"],
    )
    op.create_index("ix_leads_campaign_id", "leads", ["campaign_id"])


def downgrade() -> None:
    op.drop_index("ix_leads_campaign_id", table_name="leads")
    op.drop_constraint("fk_leads_campaign", "leads", type_="foreignkey")
    op.drop_column("leads", "campaign_id")

    op.drop_index("ix_leads_assigned_user_id", table_name="leads")
    op.drop_constraint("fk_leads_assigned_user", "leads", type_="foreignkey")
    op.drop_column("leads", "assigned_user_id")

    op.drop_index("ix_campaigns_project_id", table_name="campaigns")
    op.drop_constraint("fk_campaigns_project", "campaigns", type_="foreignkey")
    op.drop_column("campaigns", "project_id")

    op.drop_index("ix_campaigns_assigned_user_id", table_name="campaigns")
    op.drop_constraint("fk_campaigns_assigned_user", "campaigns", type_="foreignkey")
    op.drop_column("campaigns", "assigned_user_id")
