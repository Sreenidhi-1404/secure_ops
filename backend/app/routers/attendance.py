
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.attendance import Attendance
from app.models.deployment import Deployment
from app.models.guard import Guard
from app.models.leave import GuardLeave
from app.models.user import User, UserRole
from app.utils.dependencies import require_roles


router = APIRouter(prefix="/attendance", tags=["Attendance"])

MANAGERS = (
    UserRole.SUPER_ADMIN,
    UserRole.HR,
    UserRole.OPERATIONS_MANAGER,
)


@router.post("/check-in")
def check_in(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGERS)),
):
    deployment_id = payload.get("deployment_id")
    notes = payload.get("notes")

    if not deployment_id:
        raise HTTPException(
            status_code=422,
            detail="Deployment ID is required.",
        )

    if notes is not None and not isinstance(notes, str):
        raise HTTPException(
            status_code=422,
            detail="Notes must be text.",
        )

    if isinstance(notes, str):
        notes = notes.strip() or None
        if len(notes or "") > 500:
            raise HTTPException(
                status_code=422,
                detail="Notes cannot exceed 500 characters.",
            )

    deployment = (
        db.query(Deployment)
        .filter(Deployment.id == deployment_id)
        .first()
    )

    if not deployment:
        raise HTTPException(
            status_code=404,
            detail="Deployment not found.",
        )

    if str(deployment.status).upper() != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail="Only active deployments can be checked in.",
        )

    today = date.today()

    if deployment.start_date and deployment.start_date > today:
        raise HTTPException(
            status_code=400,
            detail="This deployment has not started yet.",
        )

    if deployment.end_date and deployment.end_date < today:
        raise HTTPException(
            status_code=400,
            detail="This deployment has already ended.",
        )

    guard = (
        db.query(Guard)
        .filter(Guard.id == deployment.guard_id)
        .first()
    )

    if not guard or not guard.is_active:
        raise HTTPException(
            status_code=400,
            detail="The assigned guard is not active.",
        )

    # Check approved leave BEFORE creating attendance.
    approved_leave = (
        db.query(GuardLeave)
        .filter(
            GuardLeave.guard_id == deployment.guard_id,
            GuardLeave.status == "APPROVED",
            GuardLeave.start_date <= today,
            GuardLeave.end_date >= today,
        )
        .first()
    )

    if approved_leave:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Check-in blocked. This guard has approved leave "
                f"from {approved_leave.start_date} "
                f"to {approved_leave.end_date}."
            ),
        )

    existing = (
        db.query(Attendance)
        .filter(
            Attendance.deployment_id == deployment_id,
            Attendance.attendance_date == today,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Attendance already exists for this deployment today.",
        )

    attendance = Attendance(
        guard_id=deployment.guard_id,
        deployment_id=deployment_id,
        attendance_date=today,
        check_in=datetime.now(timezone.utc),
        status="IN_PROGRESS",
        notes=notes,
    )

    try:
        db.add(attendance)
        db.commit()
        db.refresh(attendance)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Attendance already exists for this deployment today.",
        )

    return attendance


@router.post("/{attendance_id}/check-out")
def check_out(
    attendance_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGERS)),
):
    attendance = (
        db.query(Attendance)
        .filter(Attendance.id == attendance_id)
        .first()
    )

    if not attendance:
        raise HTTPException(
            status_code=404,
            detail="Attendance record not found.",
        )

    if attendance.check_out is not None:
        raise HTTPException(
            status_code=409,
            detail="This attendance record has already been checked out.",
        )

    check_out_time = datetime.now(timezone.utc)

    if attendance.check_in:
        check_in_time = attendance.check_in

        if check_in_time.tzinfo is None:
            check_in_time = check_in_time.replace(tzinfo=timezone.utc)

        if check_out_time < check_in_time:
            raise HTTPException(
                status_code=400,
                detail="Check-out cannot be earlier than check-in.",
            )

    attendance.check_out = check_out_time
    attendance.status = "PRESENT"

    db.commit()
    db.refresh(attendance)

    return attendance


@router.get("/")
def list_attendance(
    guard_id: int | None = None,
    attendance_date: date | None = None,
    status: str | None = None,
    incomplete_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGERS)),
):
    query = db.query(Attendance)

    if guard_id is not None:
        query = query.filter(Attendance.guard_id == guard_id)

    if attendance_date is not None:
        query = query.filter(
            Attendance.attendance_date == attendance_date
        )

    if status:
        normalized_status = status.strip().upper()
        allowed_statuses = {"PRESENT", "IN_PROGRESS"}

        if normalized_status not in allowed_statuses:
            raise HTTPException(
                status_code=422,
                detail="Status must be PRESENT or IN_PROGRESS.",
            )

        query = query.filter(Attendance.status == normalized_status)

    if incomplete_only:
        query = query.filter(Attendance.check_out.is_(None))

    return (
        query.order_by(
            Attendance.attendance_date.desc(),
            Attendance.check_in.desc(),
        )
        .all()
    )
