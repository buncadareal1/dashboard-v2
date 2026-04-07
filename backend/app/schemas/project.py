"""Pydantic schemas for Project / Unit / LeadBooking."""
from datetime import datetime, date
from typing import Literal

from pydantic import BaseModel, Field

ProjectStatus = Literal["running", "warning", "paused"]


class ProjectBase(BaseModel):
    name: str
    location: str | None = None
    status: ProjectStatus = "running"
    owner_user_id: int | None = None
    total_units: int = 0
    sold_units: int = 0
    total_budget: float = 0
    total_revenue: float = 0
    channels: str | None = None  # CSV: "facebook,google"


class ProjectCreate(ProjectBase):
    slug: str = Field(..., min_length=1, max_length=120)


class ProjectUpdate(BaseModel):
    name: str | None = None
    location: str | None = None
    status: ProjectStatus | None = None
    owner_user_id: int | None = None
    total_units: int | None = None
    sold_units: int | None = None
    total_budget: float | None = None
    total_revenue: float | None = None
    channels: str | None = None


class ProjectOut(ProjectBase):
    id: int
    slug: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UnitBase(BaseModel):
    unit_code: str
    transaction_date: date | None = None
    sale_price: float = 0
    lead_source: str | None = None
    mkt_employee_id: int | None = None
    status: Literal["deal", "booking"] = "deal"


class UnitCreate(UnitBase):
    pass


class UnitOut(UnitBase):
    id: int
    project_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class LeadBookingOut(BaseModel):
    lead_id: int
    booked_at: datetime
    booked_by_user_id: int | None = None
    note: str | None = None

    model_config = {"from_attributes": True}


class LeadBookingCreate(BaseModel):
    note: str | None = None
