from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.guard import Guard
from app.models.deployment import Deployment
from app.models.attendance import Attendance
from app.models.leave import GuardLeave
from app.models.payroll import Payroll
from app.models.user import User, UserRole
from app.utils.dependencies import require_roles


router = APIRouter(
    prefix="/guards",
    tags=["Guard Service History"],
)

MANAGER_ROLES = (
    UserRole.SUPER_ADMIN,
    UserRole.HR,
    UserRole.OPERATIONS_MANAGER,
)


@router.get("/{guard_id}/history")
def get_guard_history(
    guard_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(*MANAGER_ROLES)
    ),
):
    guard = db.query(Guard).filter(
        Guard.id == guard_id
    ).first()

    if not guard:
        raise HTTPException(
            status_code=404,
            detail="Guard not found",
        )

    deployments = db.query(Deployment).filter(
        Deployment.guard_id == guard_id
    ).order_by(Deployment.start_date.desc()).all()

    attendance = db.query(Attendance).filter(
        Attendance.guard_id == guard_id
    ).order_by(Attendance.attendance_date.desc()).all()

    leaves = db.query(GuardLeave).filter(
        GuardLeave.guard_id == guard_id
    ).order_by(GuardLeave.start_date.desc()).all()

    payroll_records = db.query(Payroll).filter(
        Payroll.guard_id == guard_id
    ).order_by(
        Payroll.year.desc(),
        Payroll.month.desc(),
    ).all()

    return {
        "guard": {
            "id": guard.id,
            "security_id": guard.security_id,
            "full_name": guard.full_name,
            "phone": guard.phone,
            "email": guard.email,
            "joining_date": guard.joining_date,
            "employment_status": guard.employment_status,
            "verification_status": guard.verification_status,
            "monthly_salary": guard.monthly_salary,
        },
        "deployment_history": [
            {
                "id": d.id,
                "security_post_id": d.security_post_id,
                "start_date": d.start_date,
                "end_date": d.end_date,
                "shift_type": d.shift_type,
                "status": d.status,
                "notes": d.notes,
            }
            for d in deployments
        ],
        "attendance_history": [
            {
                "id": a.id,
                "deployment_id": a.deployment_id,
                "attendance_date": a.attendance_date,
                "check_in": a.check_in,
                "check_out": a.check_out,
                "status": a.status,
                "notes": a.notes,
            }
            for a in attendance
        ],
        "leave_history": [
            {
                "id": leave.id,
                "start_date": leave.start_date,
                "end_date": leave.end_date,
                "reason": leave.reason,
                "status": leave.status,
                "reviewed_by": leave.reviewed_by,
                "reviewed_at": leave.reviewed_at,
            }
            for leave in leaves
        ],
        "payroll_history": [
            {
                "id": p.id,
                "month": p.month,
                "year": p.year,
                "monthly_salary": p.monthly_salary,
                "present_days": p.present_days,
                "payable_amount": p.payable_amount,
                "status": p.status,
                "approved_at": p.approved_at,
                "paid_at": p.paid_at,
                "payment_reference": p.payment_reference,
            }
            for p in payroll_records
        ],
    }