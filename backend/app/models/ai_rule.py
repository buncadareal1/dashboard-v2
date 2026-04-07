from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from datetime import datetime, timezone

from app.models.base import Base


class AiRule(Base):
    __tablename__ = "ai_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    metric = Column(String(20), nullable=False)
    operator = Column(String(5), nullable=False)
    threshold = Column(String(50), nullable=False)
    min_spend = Column(Integer, default=50)
    action = Column(String(20), nullable=False)
    budget_increase = Column(Integer, default=20)
    active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
