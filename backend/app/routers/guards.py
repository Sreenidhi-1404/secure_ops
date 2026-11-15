
from datetime import date
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.guard import Guard
from app.models.user import User, UserRole
from app.schemas.guard import (
    GuardCreate,
    GuardUpdate,
    GuardResponse,
)
from app.utils.dependencies import require_roles


router = APIRouter(
    prefix="/guards",
    tags=["Guards"],
)

MANAGERS = (
    UserRole.SUPER_ADMIN,
    UserRole.HR,
    UserRole.OPERATIONS_MANAGER,
)


# CREATE GUARD
@router.post("/", response_model=GuardResponse, status_code=201)
def create_guard(
    guard_data: GuardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGERS)),
):
    # Validate joining date
    if guard_data.joining_date > date.today():
        raise HTTPException(
            status_code=400,
            detail="Joining date cannot be in the future",
        )

    # Validate date of birth
    if (
        guard_data.date_of_birth
        and guard_data.date_of_birth >= guard_data.joining_date
    ):
        raise HTTPException(
            status_code=400,
            detail="Date of birth must be before joining date",
        )

    # Check duplicate email
    if guard_data.email:
        email = str(guard_data.email).strip().lower()

        existing_email = (
            db.query(Guard)
            .filter(Guard.email == email)
            .first()
        )

        if existing_email:
            raise HTTPException(
                status_code=409,
                detail="A guard with this email already exists",
            )
    else:
        email = None

    # Create a temporary unique security ID
    temporary_id = f"T-{uuid.uuid4().hex[:20]}"

    guard = Guard(
        security_id=temporary_id,
        full_name=guard_data.full_name,
        gender=guard_data.gender,
        date_of_birth=guard_data.date_of_birth,
        phone=guard_data.phone,
        email=email,
        address=guard_data.address,
        emergency_contact_name=guard_data.emergency_contact_name,
        emergency_contact_phone=guard_data.emergency_contact_phone,
        joining_date=guard_data.joining_date,
        monthly_salary=guard_data.monthly_salary,
        employment_status="ACTIVE",
        verification_status="PENDING",
        is_active=True,
        created_by=current_user.id,
    )

    try:
        db.add(guard)
        db.flush()

        # Generate the final ID using the database-generated guard ID
        guard.security_id = f"SEC-{guard.id:06d}"

        db.commit()
        db.refresh(guard)

        return guard

    except Exception:
        db.rollback()
        raise


# GET ALL GUARDS
@router.get("/", response_model=list[GuardResponse])
def get_guards(
    employment_status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGERS)),
):
    query = db.query(Guard).filter(Guard.is_active.is_(True))

    if employment_status:
        query = query.filter(
            Guard.employment_status == employment_status.upper()
        )

    return query.order_by(Guard.id.desc()).all()


# GET ONE GUARD
@router.get("/{guard_id}", response_model=GuardResponse)
def get_guard(
    guard_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGERS)),
):
    guard = db.query(Guard).filter(Guard.id == guard_id).first()

    if not guard:
        raise HTTPException(
            status_code=404,
            detail="Guard not found",
        )

    return guard


# UPDATE GUARD
@router.patch("/{guard_id}", response_model=GuardResponse)
def update_guard(
    guard_id: int,
    guard_data: GuardUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGERS)),
):
    guard = db.query(Guard).filter(Guard.id == guard_id).first()

    if not guard:
        raise HTTPException(
            status_code=404,
            detail="Guard not found",
        )

    update_data = guard_data.model_dump(exclude_unset=True)

    # Normalize email and prevent duplicate addresses
    if "email" in update_data and update_data["email"]:
        update_data["email"] = str(update_data["email"]).strip().lower()

        existing_email = (
            db.query(Guard)
            .filter(
                Guard.email == update_data["email"],
                Guard.id != guard_id,
            )
            .first()
        )

        if existing_email:
            raise HTTPException(
                status_code=409,
                detail="A guard with this email already exists",
            )

    for field, value in update_data.items():
        setattr(guard, field, value)

    try:
        db.commit()
        db.refresh(guard)
        return guard

    except Exception:
        db.rollback()
        raise


# RELIEVE GUARD
@router.post("/{guard_id}/relieve", response_model=GuardResponse)
def relieve_guard(
    guard_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.SUPER_ADMIN, UserRole.HR)
    ),
):
    guard = db.query(Guard).filter(Guard.id == guard_id).first()

    if not guard:
        raise HTTPException(
            status_code=404,
            detail="Guard not found",
        )

    if guard.employment_status == "RELIEVED":
        raise HTTPException(
            status_code=400,
            detail="Guard is already relieved",
        )

    guard.employment_status = "RELIEVED"
    guard.is_active = False

    db.commit()
    db.refresh(guard)

    return guard
