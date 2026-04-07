"""
Real Estate Project domain models — Phase B extension.

These are ADDITIVE to the legacy schema. They DO NOT modify Lead, Campaign,
or bitrix24.py. The Bitrix24 webhook handler keeps writing to `leads` as before.
"""
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    Date,
    ForeignKey,
    Index,
    Text,
)
from sqlalchemy.orm import relationship

from app.models.base import Base


class Project(Base):
    """Real estate project (e.g. Vinhomes Grand Park)."""

    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(120), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    location = Column(String(255), nullable=True)
    status = Column(String(20), default="running", nullable=False)  # running|warning|paused
    owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    total_units = Column(Integer, default=0)
    sold_units = Column(Integer, default=0)
    total_budget = Column(Float, default=0)  # VND
    total_revenue = Column(Float, default=0)  # VND
    channels = Column(String(255), nullable=True)  # CSV: "facebook,google,tiktok"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    units = relationship("Unit", back_populates="project", cascade="all, delete-orphan")

    __table_args__ = (Index("ix_projects_status", "status"),)


class Unit(Base):
    """Individual apartment / unit sold within a project."""

    __tablename__ = "units"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    unit_code = Column(String(50), nullable=False)  # e.g. "VH-A-0101"
    transaction_date = Column(Date, nullable=True)
    sale_price = Column(Float, default=0)  # VND
    lead_source = Column(String(100), nullable=True)  # "Facebook Ads", "Google", ...
    mkt_employee_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(20), default="deal")  # deal | booking
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    project = relationship("Project", back_populates="units")

    __table_args__ = (
        Index("ix_units_project_status", "project_id", "status"),
    )


class LeadBooking(Base):
    """
    Manual booking flag — bảng phụ Option A.
    Không sửa Lead model, không sửa bitrix24.py.
    """

    __tablename__ = "lead_bookings"

    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), primary_key=True)
    booked_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    booked_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    note = Column(Text, nullable=True)
