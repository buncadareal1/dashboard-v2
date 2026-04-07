"""
Real Estate Projects router — Phase B.

Endpoints:
  GET    /api/projects             — list all
  POST   /api/projects             — create (admin)
  GET    /api/projects/{id}        — detail
  PUT    /api/projects/{id}        — update (admin)
  DELETE /api/projects/{id}        — delete (admin)
  GET    /api/projects/{id}/units  — list units
  POST   /api/projects/{id}/units  — add unit (admin)
  POST   /api/leads/{id}/booking   — mark lead as Booking (Option A)
  DELETE /api/leads/{id}/booking   — unmark booking
"""
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, Project, Unit, LeadBooking, Lead
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectOut,
    UnitCreate,
    UnitOut,
    LeadBookingCreate,
    LeadBookingOut,
)

logger = logging.getLogger("smartland")

router = APIRouter(prefix="/api", tags=["projects"])


def _admin_only(user: User) -> None:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Yêu cầu quyền quản trị")


# ================ Projects ================

@router.get("/projects", response_model=list[ProjectOut])
def list_projects(
    status: str | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    q = db.query(Project)
    if status:
        q = q.filter(Project.status == status)
    return q.order_by(Project.created_at.desc()).all()


@router.post("/projects", response_model=ProjectOut, status_code=201)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _admin_only(user)
    if db.query(Project).filter(Project.slug == payload.slug).first():
        raise HTTPException(status_code=409, detail="Slug đã tồn tại")
    p = Project(**payload.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án")
    return p


@router.put("/projects/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _admin_only(user)
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _admin_only(user)
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án")
    db.delete(p)
    db.commit()


# ================ Units ================

@router.get("/projects/{project_id}/units", response_model=list[UnitOut])
def list_units(
    project_id: int,
    status: str | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    q = db.query(Unit).filter(Unit.project_id == project_id)
    if status:
        q = q.filter(Unit.status == status)
    return q.order_by(Unit.transaction_date.desc().nullslast()).all()


@router.post("/projects/{project_id}/units", response_model=UnitOut, status_code=201)
def create_unit(
    project_id: int,
    payload: UnitCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _admin_only(user)
    if not db.query(Project).filter(Project.id == project_id).first():
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án")
    u = Unit(project_id=project_id, **payload.model_dump())
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


# ================ Lead Bookings (Option A — additive) ================

@router.post("/leads/{lead_id}/booking", response_model=LeadBookingOut, status_code=201)
def mark_booking(
    lead_id: int,
    payload: LeadBookingCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not db.query(Lead).filter(Lead.id == lead_id).first():
        raise HTTPException(status_code=404, detail="Không tìm thấy lead")
    existing = db.query(LeadBooking).filter(LeadBooking.lead_id == lead_id).first()
    if existing:
        return existing
    booking = LeadBooking(
        lead_id=lead_id,
        booked_by_user_id=user.id,
        note=payload.note,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


@router.delete("/leads/{lead_id}/booking", status_code=204)
def unmark_booking(
    lead_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    booking = db.query(LeadBooking).filter(LeadBooking.lead_id == lead_id).first()
    if booking:
        db.delete(booking)
        db.commit()
