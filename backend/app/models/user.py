from sqlalchemy import Column, Integer, String, Boolean, DateTime, Table, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.models.base import Base

user_account_access = Table(
    "user_account_access",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("account_id", Integer, ForeignKey("facebook_accounts.id", ondelete="CASCADE"), primary_key=True),
)

user_sheet_access = Table(
    "user_sheet_access",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("sheet_id", Integer, ForeignKey("google_sheets.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=True)
    password_hash = Column(String(255), nullable=True)
    role = Column(String(20), default="marketer", nullable=False)
    avatar = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    accessible_accounts = relationship(
        "FacebookAccount", secondary=user_account_access, back_populates="authorized_users"
    )
    accessible_sheets = relationship(
        "GoogleSheet", secondary=user_sheet_access, back_populates="authorized_users"
    )
