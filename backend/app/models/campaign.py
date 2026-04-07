from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Date, ForeignKey, Index, UniqueConstraint
from datetime import datetime, timezone

from app.models.base import Base


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("facebook_accounts.id"), index=True, nullable=True)
    campaign_ext_id = Column(String(100), index=True, nullable=True)
    name = Column(String(500), nullable=False)
    assigned_user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), index=True, nullable=True)
    spend = Column(Float, default=0)
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    engagements = Column(Integer, default=0)
    purchases = Column(Integer, default=0)
    status = Column(String(50), nullable=True)
    source_sheet = Column(String(200), nullable=True)
    date = Column(Date, index=True, nullable=True)
    synced_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # --- Marketing Analytics extended fields ---
    campaign_objective = Column(String(100), nullable=True)
    platform = Column(String(50), nullable=True)
    ad_placement = Column(String(100), nullable=True)
    industry_vertical = Column(String(100), nullable=True)
    budget_tier = Column(String(50), nullable=True)

    device_type = Column(String(50), nullable=True)
    operating_system = Column(String(50), nullable=True)

    creative_format = Column(String(50), nullable=True)
    creative_size = Column(String(50), nullable=True)
    ad_copy_length = Column(String(20), nullable=True)
    has_call_to_action = Column(Boolean, default=False)
    creative_emotion = Column(String(50), nullable=True)
    creative_age_days = Column(Integer, nullable=True)

    target_audience_age = Column(String(20), nullable=True)
    target_audience_gender = Column(String(20), nullable=True)
    audience_interest_category = Column(String(100), nullable=True)
    income_bracket = Column(String(50), nullable=True)
    purchase_intent_score = Column(String(20), nullable=True)
    retargeting_flag = Column(Boolean, default=False)

    quarter = Column(Integer, nullable=True)
    day_of_week = Column(String(20), nullable=True)
    hour_of_day = Column(Integer, nullable=True)
    campaign_day = Column(Integer, nullable=True)

    quality_score = Column(Integer, nullable=True)
    actual_cpc = Column(Float, nullable=True)
    revenue = Column(Float, default=0)
    conversions = Column(Integer, default=0)

    bounce_rate = Column(Float, nullable=True)
    avg_session_duration = Column(Float, nullable=True)
    pages_per_session = Column(Float, nullable=True)

    ctr = Column(Float, nullable=True)
    cpc = Column(Float, nullable=True)
    conversion_rate = Column(Float, nullable=True)
    cpa = Column(Float, nullable=True)
    roas = Column(Float, nullable=True)
    profit = Column(Float, nullable=True)

    __table_args__ = (
        Index("ix_campaigns_account_date", "account_id", "date"),
        Index("ix_campaigns_platform_objective", "platform", "campaign_objective"),
    )


class CampaignLeadMatch(Base):
    __tablename__ = "campaign_lead_matches"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), index=True)
    match_score = Column(Float, nullable=True)
    matched_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
