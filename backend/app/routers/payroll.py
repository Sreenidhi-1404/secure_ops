import calendar
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.attendance import Attendance
from app.models.guard import Guard
from app.models.payroll import Payroll
from app.models.user import User, UserRole
from app.schemas.payroll import PayrollGenerate, PayrollResponse
from app.utils.dependencies import require_roles


router = APIRouter(prefix="/payroll", tags=["Payroll"])

PAYROLL_ROLES = (UserRole.SUPER_ADMIN, UserRole.HR)


class PaymentDetails(BaseModel):
    payment_reference: str = Field(min_length=1, max_length=100)


def get_payroll_or_404(db: Session, payroll_id: int) -> Payroll:
    payroll = (
        db.query(Payroll)
        .filter(Payroll.id == payroll_id)
        .with_for_update()
        .first()
    )

    if not payroll:
        raise HTTPException(
            status_code=404,
            detail="Payroll record not found.",
        )

    return payroll


def calculate_payroll(
    db: Session,
    guard: Guard,
    month: int,
    year: int,
):
    start_date = date(year, month, 1)

    if month == 12:
        next_month = date(year + 1, 1, 1)
    else:
        next_month = date(year, month + 1, 1)

    days_in_month = calendar.monthrange(year, month)[1]

    attendance_dates = (
        db.query(Attendance.attendance_date)
        .filter(
            Attendance.guard_id == guard.id,
            Attendance.attendance_date >= start_date,
            Attendance.attendance_date < next_month,
            Attendance.status == "PRESENT",
        )
        .distinct()
        .all()
    )

    present_days = len(attendance_dates)

    monthly_salary = Decimal(str(guard.monthly_salary))

    payable_amount = (
        monthly_salary
        * Decimal(present_days)
        / Decimal(days_in_month)
    ).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )

    return {
        "monthly_salary": monthly_salary,
        "days_in_month": days_in_month,
        "present_days": present_days,
        "payable_amount": payable_amount,
    }


@router.post(
    "/generate",
    response_model=PayrollResponse,
)
def generate_payroll(
    payload: PayrollGenerate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*PAYROLL_ROLES)),
):
    guard = (
        db.query(Guard)
        .filter(Guard.id == payload.guard_id)
        .first()
    )

    if not guard:
        raise HTTPException(
            status_code=404,
            detail="Guard not found.",
        )

    existing = (
        db.query(Payroll)
        .filter(
            Payroll.guard_id == payload.guard_id,
            Payroll.month == payload.month,
            Payroll.year == payload.year,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail=(
                "Payroll already exists for this guard and month. "
                "Recalculate it if it is still a draft."
            ),
        )

    values = calculate_payroll(
        db,
        guard,
        payload.month,
        payload.year,
    )

    payroll = Payroll(
        guard_id=payload.guard_id,
        month=payload.month,
        year=payload.year,
        monthly_salary=values["monthly_salary"],
        days_in_month=values["days_in_month"],
        present_days=values["present_days"],
        payable_amount=values["payable_amount"],
        status="DRAFT",
    )

    try:
        db.add(payroll)
        db.commit()
        db.refresh(payroll)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Payroll already exists for this guard and month.",
        )

    return payroll


@router.get("/", response_model=list[PayrollResponse])
def list_payroll(
    guard_id: int | None = None,
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=2000, le=2100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*PAYROLL_ROLES)),
):
    query = db.query(Payroll)

    if guard_id is not None:
        query = query.filter(Payroll.guard_id == guard_id)

    if month is not None:
        query = query.filter(Payroll.month == month)

    if year is not None:
        query = query.filter(Payroll.year == year)

    return query.order_by(
        Payroll.year.desc(),
        Payroll.month.desc(),
        Payroll.id.desc(),
    ).all()


@router.get("/{payroll_id}", response_model=PayrollResponse)
def get_payroll(
    payroll_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*PAYROLL_ROLES)),
):
    return get_payroll_or_404(db, payroll_id)


@router.post(
    "/{payroll_id}/recalculate",
    response_model=PayrollResponse,
)
def recalculate_draft_payroll(
    payroll_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*PAYROLL_ROLES)),
):
    payroll = get_payroll_or_404(db, payroll_id)

    if payroll.status != "DRAFT":
        raise HTTPException(
            status_code=400,
            detail="Only draft payroll can be recalculated.",
        )

    guard = (
        db.query(Guard)
        .filter(Guard.id == payroll.guard_id)
        .first()
    )

    if not guard:
        raise HTTPException(
            status_code=404,
            detail="Guard not found.",
        )

    values = calculate_payroll(
        db,
        guard,
        payroll.month,
        payroll.year,
    )

    payroll.monthly_salary = values["monthly_salary"]
    payroll.days_in_month = values["days_in_month"]
    payroll.present_days = values["present_days"]
    payroll.payable_amount = values["payable_amount"]

    db.commit()
    db.refresh(payroll)

    return payroll


@router.post(
    "/{payroll_id}/approve",
    response_model=PayrollResponse,
)
def approve_payroll(
    payroll_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*PAYROLL_ROLES)),
):
    payroll = get_payroll_or_404(db, payroll_id)

    if payroll.status != "DRAFT":
        raise HTTPException(
            status_code=400,
            detail="Only draft payroll can be approved.",
        )

    if payroll.present_days < 0 or payroll.days_in_month <= 0:
        raise HTTPException(
            status_code=400,
            detail="Payroll attendance calculation is invalid.",
        )

    if payroll.present_days > payroll.days_in_month:
        raise HTTPException(
            status_code=400,
            detail="Present days cannot exceed days in the month.",
        )

    if payroll.payable_amount < 0:
        raise HTTPException(
            status_code=400,
            detail="Payable amount cannot be negative.",
        )

    payroll.status = "APPROVED"
    payroll.approved_by = current_user.id
    payroll.approved_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(payroll)

    return payroll


@router.post(
    "/{payroll_id}/pay",
    response_model=PayrollResponse,
)
def mark_payroll_paid(
    payroll_id: int,
    payload: PaymentDetails,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*PAYROLL_ROLES)),
):
    payroll = get_payroll_or_404(db, payroll_id)

    if payroll.status == "PAID":
        raise HTTPException(
            status_code=409,
            detail="This payroll has already been marked as paid.",
        )

    if payroll.status != "APPROVED":
        raise HTTPException(
            status_code=400,
            detail="Only approved payroll can be marked as paid.",
        )

    reference = payload.payment_reference.strip()

    if not reference:
        raise HTTPException(
            status_code=422,
            detail="Payment reference cannot be blank.",
        )

    if payroll.payable_amount < 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot pay a negative payroll amount.",
        )

    payroll.payment_reference = reference
    payroll.paid_at = datetime.now(timezone.utc)
    payroll.status = "PAID"

    db.commit()
    db.refresh(payroll)

    return payroll