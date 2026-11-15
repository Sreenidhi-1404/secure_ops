
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.guard import Guard
from app.models.leave import GuardLeave
from app.models.user import User, UserRole
from app.schemas.leave import LeaveCreate, LeaveReview, LeaveResponse
from app.utils.dependencies import get_current_user


router = APIRouter(prefix="/leaves", tags=["Leaves"])

MANAGER_ROLES = {
    UserRole.SUPER_ADMIN,
    UserRole.HR,
    UserRole.OPERATIONS_MANAGER,
}


def get_active_guard_for_user(db: Session, user: User) -> Guard:
    """Find the active guard record matching the logged-in user's email."""
    if not user.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has no email linked to a guard record. Contact HR.",
        )

    guard = (
        db.query(Guard)
        .filter(
            Guard.email == user.email,
            Guard.is_active.is_(True),
        )
        .first()
    )

    if not guard:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No active guard record is linked to your account. Contact HR to check your registered email.",
        )

    return guard


def ensure_manager(user: User) -> None:
    if user.role not in MANAGER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR, Operations Managers, and Super Admins can perform this action.",
        )


@router.post("/", response_model=LeaveResponse, status_code=status.HTTP_201_CREATED)
def create_leave(
    data: LeaveCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.end_date < data.start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="End date cannot be before start date.",
        )

    if current_user.role == UserRole.GUARD:
        # A guard cannot choose or impersonate another guard.
        guard = get_active_guard_for_user(db, current_user)
    elif current_user.role in MANAGER_ROLES:
        if data.guard_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Managers must provide guard_id.",
            )

        guard = db.query(Guard).filter(
            Guard.id == data.guard_id,
            Guard.is_active.is_(True),
        ).first()

        if not guard:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Active guard not found.",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your role cannot apply for leave.",
        )

    leave = GuardLeave(
        guard_id=guard.id,
        start_date=data.start_date,
        end_date=data.end_date,
        reason=data.reason.strip(),
        status="PENDING",
    )

    db.add(leave)
    db.commit()
    db.refresh(leave)
    return leave


@router.get("/", response_model=list[LeaveResponse])
def list_leaves(
    leave_status: str | None = Query(default=None, alias="status"),
    guard_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(GuardLeave)

    if current_user.role == UserRole.GUARD:
        # Guards can only view their own requests.
        guard = get_active_guard_for_user(db, current_user)
        query = query.filter(GuardLeave.guard_id == guard.id)
    elif current_user.role in MANAGER_ROLES:
        # Managers can filter requests by guard.
        if guard_id is not None:
            query = query.filter(GuardLeave.guard_id == guard_id)
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your role cannot view leave requests.",
        )

    if leave_status:
        allowed_statuses = {"PENDING", "APPROVED", "REJECTED"}
        normalized_status = leave_status.upper()

        if normalized_status not in allowed_statuses:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Status must be PENDING, APPROVED, or REJECTED.",
            )

        query = query.filter(GuardLeave.status == normalized_status)

    return query.order_by(GuardLeave.created_at.desc()).all()


@router.patch("/{leave_id}/review", response_model=LeaveResponse)
def review_leave(
    leave_id: int,
    data: LeaveReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_manager(current_user)

    leave = db.query(GuardLeave).filter(
        GuardLeave.id == leave_id
    ).first()

    if not leave:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found.",
        )

    if leave.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending leave requests can be reviewed.",
        )

    leave.status = data.status
    leave.reviewed_by = current_user.id
    leave.reviewed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(leave)
    return leave
