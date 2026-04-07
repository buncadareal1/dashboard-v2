"""add projects, units, lead_bookings tables

Revision ID: c3d4e5f6g7h8
Revises: b2c3d4e5f6g7
Create Date: 2026-04-07 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "c3d4e5f6g7h8"
down_revision = "b2c3d4e5f6g7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ===== projects =====
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("slug", sa.String(120), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="running"),
        sa.Column("owner_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("total_units", sa.Integer(), server_default="0"),
        sa.Column("sold_units", sa.Integer(), server_default="0"),
        sa.Column("total_budget", sa.Float(), server_default="0"),
        sa.Column("total_revenue", sa.Float(), server_default="0"),
        sa.Column("channels", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_projects_id", "projects", ["id"])
    op.create_index("ix_projects_slug", "projects", ["slug"])
    op.create_index("ix_projects_status", "projects", ["status"])

    # ===== units =====
    op.create_table(
        "units",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "project_id",
            sa.Integer(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("unit_code", sa.String(50), nullable=False),
        sa.Column("transaction_date", sa.Date(), nullable=True),
        sa.Column("sale_price", sa.Float(), server_default="0"),
        sa.Column("lead_source", sa.String(100), nullable=True),
        sa.Column("mkt_employee_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("status", sa.String(20), server_default="deal"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_units_id", "units", ["id"])
    op.create_index("ix_units_project_id", "units", ["project_id"])
    op.create_index("ix_units_project_status", "units", ["project_id", "status"])

    # ===== lead_bookings (Option A — additive, no changes to leads table) =====
    op.create_table(
        "lead_bookings",
        sa.Column(
            "lead_id",
            sa.Integer(),
            sa.ForeignKey("leads.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("booked_at", sa.DateTime(), nullable=False),
        sa.Column("booked_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("lead_bookings")
    op.drop_index("ix_units_project_status", table_name="units")
    op.drop_index("ix_units_project_id", table_name="units")
    op.drop_index("ix_units_id", table_name="units")
    op.drop_table("units")
    op.drop_index("ix_projects_status", table_name="projects")
    op.drop_index("ix_projects_slug", table_name="projects")
    op.drop_index("ix_projects_id", table_name="projects")
    op.drop_table("projects")
