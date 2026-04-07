from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.models.base import Base
from app.models.user import user_account_access


class FacebookAccount(Base):
    __tablename__ = "facebook_accounts"

    id = Column(Integer, primary_key=True, index=True)
    account_name = Column(String(200), nullable=False)
    ad_account_id = Column(String(100), unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # --- Token storage (Sprint 1: B-FB.1) ---
    access_token = Column(Text, nullable=True)  # encrypted via Fernet
    token_expires_at = Column(DateTime, nullable=True)
    last_synced_at = Column(DateTime, nullable=True)
    last_sync_error = Column(Text, nullable=True)

    authorized_users = relationship(
        "User", secondary=user_account_access, back_populates="accessible_accounts"
    )
