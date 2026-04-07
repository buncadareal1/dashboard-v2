from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index
from datetime import datetime, timezone

from app.models.base import Base


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    phone = Column(String(50), nullable=True)
    source = Column(String(200), nullable=True)
    status = Column(String(50), default="MỚI")
    bitrix_id = Column(String(50), unique=True, index=True, nullable=True)
    account_id = Column(Integer, ForeignKey("facebook_accounts.id"), index=True, nullable=True)
    campaign_name = Column(String(500), nullable=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), index=True, nullable=True)
    assigned_user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_leads_status_created", "status", "created_at"),
        Index("ix_leads_source_status", "source", "status"),
        Index("ix_leads_account_created", "account_id", "created_at"),
    )
