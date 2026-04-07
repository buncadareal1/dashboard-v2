from sqlalchemy import Column, Integer, String, Float, Date, DateTime, UniqueConstraint, Index
from datetime import datetime, timezone

from app.models.base import Base


class BudgetReport(Base):
    __tablename__ = "budget_reports"

    id = Column(Integer, primary_key=True, index=True)
    campaign_name = Column(String(500), nullable=False)
    date = Column(Date, nullable=False)
    spend = Column(Float, default=0)
    total_leads = Column(Integer, default=0)
    f1_leads = Column(Integer, default=0)
    nurturing_leads = Column(Integer, default=0)
    cpl = Column(Float, default=0)
    cost_per_f1 = Column(Float, default=0)
    qualify_rate = Column(Float, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("campaign_name", "date", name="uq_budget_report_campaign_date"),
        Index("ix_budget_reports_campaign_date", "campaign_name", "date"),
    )
