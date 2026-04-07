from sqlalchemy import Column, Integer, String, Numeric, Boolean, Date
from app.models.base import Base


class MarketingAnalytics(Base):
    __tablename__ = "marketing_analytics"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(String(20), nullable=False)
    campaign_objective = Column(String(100))
    platform = Column(String(50))
    ad_placement = Column(String(50))
    device_type = Column(String(50))
    operating_system = Column(String(50))
    creative_format = Column(String(50))
    creative_size = Column(String(20))
    ad_copy_length = Column(String(20))
    has_call_to_action = Column(Boolean)
    creative_emotion = Column(String(50))
    creative_age_days = Column(Integer)
    target_audience_age = Column(String(20))
    target_audience_gender = Column(String(20))
    audience_interest_category = Column(String(100))
    income_bracket = Column(String(50))
    purchase_intent_score = Column(String(20))
    retargeting_flag = Column(Boolean)
    start_date = Column(Date)
    quarter = Column(Integer)
    day_of_week = Column(String(20))
    hour_of_day = Column(Integer)
    campaign_day = Column(Integer)
    quality_score = Column(Integer)
    actual_cpc = Column(Numeric(10, 2))
    impressions = Column(Integer)
    clicks = Column(Integer)
    conversions = Column(Integer)
    ad_spend = Column(Numeric(12, 2))
    revenue = Column(Numeric(12, 2))
    bounce_rate = Column(Numeric(6, 2))
    avg_session_duration_seconds = Column(Numeric(10, 2))
    pages_per_session = Column(Numeric(6, 2))
    industry_vertical = Column(String(100))
    budget_tier = Column(String(20))
    ctr = Column(Numeric(8, 3))
    cpc = Column(Numeric(10, 2))
    conversion_rate = Column(Numeric(8, 3))
    cpa = Column(Numeric(12, 2))
    roas = Column(Numeric(8, 2))
    profit = Column(Numeric(12, 2))


class DashboardCampaign(Base):
    __tablename__ = "dashboard_campaigns"

    id = Column(Integer, primary_key=True, index=True)
    campaign_name = Column(String(500), nullable=False)
    spend = Column(Numeric(14, 2), default=0)
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    ctr = Column(Numeric(8, 4), default=0)
    engagements = Column(Integer, default=0)
    orders = Column(Integer, default=0)
    conversion_rate = Column(Numeric(8, 2), default=0)
    cpl = Column(Numeric(12, 2), default=0)
    cpc = Column(Numeric(10, 2), default=0)
    roas = Column(Numeric(8, 2), default=0)


class FbBitrix24Merged(Base):
    __tablename__ = "fb_bitrix24_merged"

    id = Column(Integer, primary_key=True, index=True)
    campaign_name = Column(String(500), nullable=False)
    spend = Column(Numeric(14, 2), default=0)
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    ctr = Column(Numeric(8, 4), default=0)
    leads_b24 = Column(Integer, default=0)
    closed_deals = Column(Integer, default=0)
    close_rate = Column(Numeric(8, 2), default=0)
    real_cpl = Column(Numeric(12, 2), default=0)
    cost_per_deal = Column(Numeric(12, 2), default=0)
