from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime, timezone

from app.models.base import Base


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    username = Column(String(100), nullable=False)
    action = Column(String(500), nullable=False)
    action_type = Column(String(50), nullable=False)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
