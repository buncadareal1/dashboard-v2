from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.models.base import Base
from app.models.user import user_sheet_access


class GoogleSheet(Base):
    __tablename__ = "google_sheets"

    id = Column(Integer, primary_key=True, index=True)
    sheet_name = Column(String(200), nullable=False)
    sheet_id = Column(String(255), unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    authorized_users = relationship(
        "User", secondary=user_sheet_access, back_populates="accessible_sheets"
    )
