
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, aliased

from app.database import get_db

from app.models.deployment import Deployment
from app.models.guard import Guard
from app.models.security_post import SecurityPost
from app.models.user import User, UserRole
from app.models.leave import GuardLeave
from app.models.guard_replacement import GuardReplacement

from app.schemas.deployment import (
    DeploymentCreate,
    DeploymentUpdate,
    DeploymentResponse,
)

from app.utils.dependencies import require_roles


router = APIRouter(
    prefix="/deployments",
    tags=["Deployments"],
)


MANAGERS = (
    UserRole.SUPER_ADMIN,
    UserRole.HR,
    UserRole.OPERATIONS_MANAGER,
)


# --------------------------------------------------
# HELPER: CHECK APPROVED LEAVE
# --------------------------------------------------

def has_approved_leave(
    db: Session,
    guard_id: int,
    start_date: date,
    end_date: date | None,
) -> bool:

    query = db.query(GuardLeave).filter(
        GuardLeave.guard_id == guard_id,
        GuardLeave.status == "APPROVED",
        GuardLeave.start_date <= (end_date or date.max),
        GuardLeave.end_date >= start_date,
    )

    return query.first() is not None


# --------------------------------------------------
# CREATE DEPLOYMENT
# --------------------------------------------------

@router.post(
    "/",
    response_model=DeploymentResponse,
    status_code=201,
)
def create_deployment(
    deployment_data: DeploymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGERS)),
):

    if deployment_data.start_date > date.today():
        raise HTTPException(
            status_code=400,
            detail="Deployment start date cannot be in the future",
        )

    if (
        deployment_data.end_date
        and deployment_data.end_date < deployment_data.start_date
    ):
        raise HTTPException(
            status_code=400,
            detail="End date cannot be before start date",
        )

    guard = db.query(Guard).filter(
        Guard.id == deployment_data.guard_id,
        Guard.is_active.is_(True),
        Guard.employment_status == "ACTIVE",
    ).first()

    if not guard:
        raise HTTPException(
            status_code=404,
            detail="Active guard not found",
        )

    post = db.query(SecurityPost).filter(
        SecurityPost.id == deployment_data.security_post_id
    ).first()

    if not post:
        raise HTTPException(
            status_code=404,
            detail="Security post not found",
        )

    existing = db.query(Deployment).filter(
        Deployment.guard_id == deployment_data.guard_id,
        Deployment.status == "ACTIVE",
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="This guard already has an active deployment",
        )

    active_count = db.query(Deployment).filter(
        Deployment.security_post_id == deployment_data.security_post_id,
        Deployment.shift_type == deployment_data.shift_type.strip().upper(),
        Deployment.status == "ACTIVE",
    ).count()

    if active_count >= post.required_guards:
        raise HTTPException(
            status_code=409,
            detail="This security post and shift are already fully staffed",
        )

    if has_approved_leave(
        db,
        guard_id=deployment_data.guard_id,
        start_date=deployment_data.start_date,
        end_date=deployment_data.end_date,
    ):
        raise HTTPException(
            status_code=409,
            detail="Guard has approved leave during this deployment period",
        )

    deployment = Deployment(
        guard_id=deployment_data.guard_id,
        security_post_id=deployment_data.security_post_id,
        start_date=deployment_data.start_date,
        end_date=deployment_data.end_date,
        shift_type=deployment_data.shift_type.strip().upper(),
        status="ACTIVE",
        notes=deployment_data.notes,
    )

    try:
        db.add(deployment)
        db.commit()
        db.refresh(deployment)
        return deployment

    except Exception:
        db.rollback()
        raise


# --------------------------------------------------
# GET ALL DEPLOYMENTS
# --------------------------------------------------

@router.get(
    "/",
    response_model=list[DeploymentResponse],
)
def get_deployments(
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGERS)),
):

    query = db.query(Deployment)

    if status:
        query = query.filter(
            Deployment.status == status.strip().upper()
        )

    return query.order_by(Deployment.id.desc()).all()


# --------------------------------------------------
# STAFFING SUMMARY
# --------------------------------------------------

@router.get("/staffing-summary")
def get_staffing_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGERS)),
):

    today = date.today()

    posts = db.query(SecurityPost).filter(
        SecurityPost.is_active.is_(True)
    ).all()

    summary = []

    for post in posts:

        active_count = (
            db.query(func.count(func.distinct(Deployment.guard_id)))
            .join(Guard, Guard.id == Deployment.guard_id)
            .filter(
                Deployment.security_post_id == post.id,
                Deployment.shift_type == post.shift_type.strip().upper(),
                Deployment.status == "ACTIVE",
                Deployment.start_date <= today,
                or_(
                    Deployment.end_date.is_(None),
                    Deployment.end_date >= today,
                ),
                Guard.is_active.is_(True),
                Guard.employment_status == "ACTIVE",
            )
            .scalar()
            or 0
        )

        required = post.required_guards or 0

        summary.append({
            "security_post_id": post.id,
            "post_code": post.post_code,
            "post_name": post.post_name,
            "shift_type": post.shift_type,
            "required_guards": required,
            "active_guards": active_count,
            "vacant_positions": max(required - active_count, 0),
            "is_fully_staffed": active_count >= required,
        })

    return summary


# --------------------------------------------------
# REPLACEMENT HISTORY
# IMPORTANT: KEEP THIS ABOVE /{deployment_id}
# --------------------------------------------------

@router.get("/replacement-history")
def get_replacement_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGERS)),
):

    outgoing_guard = aliased(Guard)
    incoming_guard = aliased(Guard)

    records = (
        db.query(
            GuardReplacement.id,
            GuardReplacement.old_deployment_id,
            GuardReplacement.new_deployment_id,
            GuardReplacement.outgoing_guard_id,
            outgoing_guard.full_name.label("outgoing_guard_name"),
            GuardReplacement.incoming_guard_id,
            incoming_guard.full_name.label("incoming_guard_name"),
            GuardReplacement.security_post_id,
            SecurityPost.post_name.label("post_name"),
            GuardReplacement.replacement_date,
            GuardReplacement.shift_type,
            GuardReplacement.reason,
            GuardReplacement.created_at,
        )
        .join(
            outgoing_guard,
            outgoing_guard.id == GuardReplacement.outgoing_guard_id,
        )
        .join(
            incoming_guard,
            incoming_guard.id == GuardReplacement.incoming_guard_id,
        )
        .join(
            SecurityPost,
            SecurityPost.id == GuardReplacement.security_post_id,
        )
        .order_by(GuardReplacement.id.desc())
        .all()
    )

    return [
        {
            "id": record.id,
            "old_deployment_id": record.old_deployment_id,
            "new_deployment_id": record.new_deployment_id,
            "outgoing_guard_id": record.outgoing_guard_id,
            "outgoing_guard_name": record.outgoing_guard_name,
            "incoming_guard_id": record.incoming_guard_id,
            "incoming_guard_name": record.incoming_guard_name,
            "security_post_id": record.security_post_id,
            "post_name": record.post_name,
            "replacement_date": record.replacement_date,
            "shift_type": record.shift_type,
            "reason": record.reason,
            "created_at": record.created_at,
        }
        for record in records
    ]


# --------------------------------------------------
# GET ONE DEPLOYMENT
# --------------------------------------------------

@router.get(
    "/{deployment_id}",
    response_model=DeploymentResponse,
)
def get_deployment(
    deployment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGERS)),
):

    deployment = db.query(Deployment).filter(
        Deployment.id == deployment_id
    ).first()

    if not deployment:
        raise HTTPException(
            status_code=404,
            detail="Deployment not found",
        )

    return deployment


# --------------------------------------------------
# UPDATE DEPLOYMENT
# --------------------------------------------------

@router.patch(
    "/{deployment_id}",
    response_model=DeploymentResponse,
)
def update_deployment(
    deployment_id: int,
    deployment_data: DeploymentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGERS)),
):

    deployment = db.query(Deployment).filter(
        Deployment.id == deployment_id
    ).first()

    if not deployment:
        raise HTTPException(
            status_code=404,
            detail="Deployment not found",
        )

    update_data = deployment_data.model_dump(exclude_unset=True)

    if deployment.status != "ACTIVE" and update_data:
        raise HTTPException(
            status_code=400,
            detail="Only active deployments can be updated",
        )

    if "end_date" in update_data:
        end_date = update_data["end_date"]

        if end_date and end_date < deployment.start_date:
            raise HTTPException(
                status_code=400,
                detail="End date cannot be before start date",
            )

    if "shift_type" in update_data and update_data["shift_type"]:
        update_data["shift_type"] = (
            update_data["shift_type"].strip().upper()
        )

    if "status" in update_data:
        new_status = update_data["status"]

        if new_status not in ("ACTIVE", "COMPLETED", "CANCELLED"):
            raise HTTPException(
                status_code=400,
                detail="Status must be ACTIVE, COMPLETED, or CANCELLED",
            )

        if new_status != "ACTIVE":
            update_data["end_date"] = (
                update_data.get("end_date") or date.today()
            )

    for field, value in update_data.items():
        setattr(deployment, field, value)

    try:
        db.commit()
        db.refresh(deployment)
        return deployment

    except Exception:
        db.rollback()
        raise


# --------------------------------------------------
# COMPLETE DEPLOYMENT
# --------------------------------------------------

@router.post(
    "/{deployment_id}/complete",
    response_model=DeploymentResponse,
)
def complete_deployment(
    deployment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGERS)),
):

    deployment = db.query(Deployment).filter(
        Deployment.id == deployment_id
    ).first()

    if not deployment:
        raise HTTPException(
            status_code=404,
            detail="Deployment not found",
        )

    if deployment.status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail="Deployment is not active",
        )

    deployment.status = "COMPLETED"
    deployment.end_date = date.today()

    try:
        db.commit()
        db.refresh(deployment)
        return deployment

    except Exception:
        db.rollback()
        raise


# --------------------------------------------------
# REPLACEMENT REQUEST SCHEMA
# --------------------------------------------------

class GuardReplacementRequest(BaseModel):
    replacement_guard_id: int = Field(gt=0)
    reason: str = Field(min_length=3, max_length=500)


# --------------------------------------------------
# REPLACE GUARD
# --------------------------------------------------

@router.post(
    "/{deployment_id}/replace",
    response_model=DeploymentResponse,
)
def replace_guard(
    deployment_id: int,
    payload: GuardReplacementRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGERS)),
):

    old_deployment = (
        db.query(Deployment)
        .filter(Deployment.id == deployment_id)
        .with_for_update()
        .first()
    )

    if not old_deployment:
        raise HTTPException(
            status_code=404,
            detail="Deployment not found.",
        )

    if old_deployment.status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail="Only active deployments can be replaced.",
        )

    reason = payload.reason.strip()

    if len(reason) < 3:
        raise HTTPException(
            status_code=422,
            detail="Please provide a meaningful replacement reason.",
        )

    replacement_guard = (
        db.query(Guard)
        .filter(
            Guard.id == payload.replacement_guard_id,
            Guard.is_active.is_(True),
            Guard.employment_status == "ACTIVE",
        )
        .first()
    )

    if not replacement_guard:
        raise HTTPException(
            status_code=404,
            detail="Replacement guard not found or inactive.",
        )

    if replacement_guard.id == old_deployment.guard_id:
        raise HTTPException(
            status_code=400,
            detail="Replacement guard must be different.",
        )

    existing = (
        db.query(Deployment)
        .filter(
            Deployment.guard_id == replacement_guard.id,
            Deployment.status == "ACTIVE",
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Replacement guard already has an active deployment.",
        )

    post = (
        db.query(SecurityPost)
        .filter(SecurityPost.id == old_deployment.security_post_id)
        .first()
    )

    if not post:
        raise HTTPException(
            status_code=404,
            detail="Security post not found.",
        )

    active_count = (
        db.query(Deployment)
        .filter(
            Deployment.security_post_id == old_deployment.security_post_id,
            Deployment.shift_type == old_deployment.shift_type,
            Deployment.status == "ACTIVE",
        )
        .count()
    )

    # The old deployment is completed and replaced.
    # This operation must not increase the post's staffing count.
    if active_count > post.required_guards:
        raise HTTPException(
            status_code=409,
            detail="Staffing count exceeds the post's required capacity.",
        )

    replacement_date = date.today()
    old_guard_id = old_deployment.guard_id
    old_deployment_id = old_deployment.id

    try:

        # Complete the outgoing guard's deployment.
        old_deployment.status = "COMPLETED"
        old_deployment.end_date = replacement_date

        old_deployment.notes = (
            f"{old_deployment.notes or ''}\n"
            f"Replaced by guard ID {replacement_guard.id} "
            f"on {replacement_date.isoformat()}. "
            f"Reason: {reason}"
        ).strip()

        # Create the incoming guard's deployment.
        new_deployment = Deployment(
            guard_id=replacement_guard.id,
            security_post_id=old_deployment.security_post_id,
            start_date=replacement_date,
            end_date=None,
            shift_type=old_deployment.shift_type,
            status="ACTIVE",
            notes=(
                f"Replacement for deployment ID {old_deployment_id}. "
                f"Outgoing guard ID: {old_guard_id}. "
                f"Reason: {reason}"
            ),
        )

        db.add(new_deployment)

        # Flush to generate the new deployment ID.
        db.flush()

        # Save replacement history in the same transaction.
        history = GuardReplacement(
            old_deployment_id=old_deployment_id,
            new_deployment_id=new_deployment.id,
            outgoing_guard_id=old_guard_id,
            incoming_guard_id=replacement_guard.id,
            security_post_id=old_deployment.security_post_id,
            replacement_date=replacement_date,
            shift_type=old_deployment.shift_type,
            reason=reason,
            replaced_by_user_id=current_user.id,
        )

        db.add(history)

        db.commit()
        db.refresh(new_deployment)

        return new_deployment

    except Exception:
        db.rollback()
        raise
