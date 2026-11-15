
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.database import get_db

from app.models.attendance import Attendance
from app.models.deployment import Deployment
from app.models.guard import Guard
from app.models.leave import GuardLeave
from app.models.payroll import Payroll
from app.models.security_post import SecurityPost
from app.models.user import User, UserRole

from app.schemas.dashboard import OperationsDashboardResponse
from app.utils.dependencies import require_roles


router = APIRouter(
    prefix="/dashboard",
    tags=["Operations Dashboard"],
)


MANAGER_ROLES = (
    UserRole.SUPER_ADMIN,
    UserRole.HR,
    UserRole.OPERATIONS_MANAGER,
)


# --------------------------------------------------
# OPERATIONS DASHBOARD
# --------------------------------------------------

@router.get(
    "/operations",
    response_model=OperationsDashboardResponse,
)
def get_operations_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGER_ROLES)),
):
    today = date.today()
    current_month = today.month
    current_year = today.year

    # --------------------------------------------------
    # GUARD COUNTS
    # --------------------------------------------------

    total_guards = (
        db.query(func.count(Guard.id))
        .scalar()
        or 0
    )

    active_guards = (
        db.query(func.count(Guard.id))
        .filter(
            Guard.is_active.is_(True),
            Guard.employment_status == "ACTIVE",
        )
        .scalar()
        or 0
    )

    # --------------------------------------------------
    # ACTIVE DEPLOYMENTS
    # --------------------------------------------------

    active_deployments = (
        db.query(func.count(Deployment.id))
        .join(Guard, Guard.id == Deployment.guard_id)
        .filter(
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

    # --------------------------------------------------
    # ACTIVE SECURITY POSTS
    # --------------------------------------------------

    active_posts = (
        db.query(func.count(SecurityPost.id))
        .filter(SecurityPost.is_active.is_(True))
        .scalar()
        or 0
    )

    # --------------------------------------------------
    # REQUIRED GUARD POSITIONS
    # --------------------------------------------------

    required_guard_positions = (
        db.query(func.coalesce(func.sum(SecurityPost.required_guards), 0))
        .filter(SecurityPost.is_active.is_(True))
        .scalar()
        or 0
    )

    # --------------------------------------------------
    # DEPLOYED GUARD POSITIONS
    # Count distinct guards assigned to active posts
    # and effective deployments today.
    # --------------------------------------------------

    deployed_guard_positions = (
        db.query(func.count(func.distinct(Deployment.guard_id)))
        .join(Guard, Guard.id == Deployment.guard_id)
        .join(
            SecurityPost,
            SecurityPost.id == Deployment.security_post_id,
        )
        .filter(
            Deployment.status == "ACTIVE",
            Deployment.start_date <= today,
            or_(
                Deployment.end_date.is_(None),
                Deployment.end_date >= today,
            ),
            SecurityPost.is_active.is_(True),
            Guard.is_active.is_(True),
            Guard.employment_status == "ACTIVE",
        )
        .scalar()
        or 0
    )

    vacant_positions = max(
        required_guard_positions - deployed_guard_positions,
        0,
    )

    # --------------------------------------------------
    # GUARDS ON APPROVED LEAVE TODAY
    # Count distinct active guards.
    # --------------------------------------------------

    guards_on_leave_today = (
        db.query(func.count(func.distinct(GuardLeave.guard_id)))
        .join(
            Guard,
            Guard.id == GuardLeave.guard_id,
        )
        .filter(
            GuardLeave.status == "APPROVED",
            GuardLeave.start_date <= today,
            GuardLeave.end_date >= today,
            Guard.is_active.is_(True),
            Guard.employment_status == "ACTIVE",
        )
        .scalar()
        or 0
    )

    # --------------------------------------------------
    # PRESENT TODAY
    # --------------------------------------------------

    present_today = (
        db.query(func.count(Attendance.id))
        .filter(
            Attendance.attendance_date == today,
            Attendance.check_in.isnot(None),
            Attendance.status.in_(
                ["IN_PROGRESS", "PRESENT"]
            ),
        )
        .scalar()
        or 0
    )

    # --------------------------------------------------
    # MONTHLY PAYROLL TOTAL
    # --------------------------------------------------

    monthly_payroll_total = (
        db.query(
            func.coalesce(func.sum(Payroll.payable_amount), 0)
        )
        .filter(
            Payroll.month == current_month,
            Payroll.year == current_year,
        )
        .scalar()
        or 0
    )

    # --------------------------------------------------
    # MONTHLY PAYROLL PAID
    # --------------------------------------------------

    monthly_payroll_paid = (
        db.query(
            func.coalesce(func.sum(Payroll.payable_amount), 0)
        )
        .filter(
            Payroll.month == current_month,
            Payroll.year == current_year,
            Payroll.status == "PAID",
        )
        .scalar()
        or 0
    )

    # --------------------------------------------------
    # MONTHLY PAYROLL PENDING
    # --------------------------------------------------

    monthly_payroll_pending = (
        db.query(
            func.coalesce(func.sum(Payroll.payable_amount), 0)
        )
        .filter(
            Payroll.month == current_month,
            Payroll.year == current_year,
            Payroll.status.in_(["DRAFT", "APPROVED"]),
        )
        .scalar()
        or 0
    )

    # --------------------------------------------------
    # RETURN DASHBOARD DATA
    # --------------------------------------------------

    return OperationsDashboardResponse(
        total_guards=total_guards,
        active_guards=active_guards,
        active_deployments=active_deployments,
        active_posts=active_posts,
        required_guard_positions=required_guard_positions,
        deployed_guard_positions=deployed_guard_positions,
        vacant_positions=vacant_positions,
        present_today=present_today,
        guards_on_leave_today=guards_on_leave_today,
        monthly_payroll_total=monthly_payroll_total,
        monthly_payroll_paid=monthly_payroll_paid,
        monthly_payroll_pending=monthly_payroll_pending,
    )


# --------------------------------------------------
# GET DETAILED LIST OF GUARDS ON LEAVE TODAY
# --------------------------------------------------

@router.get("/guards-on-leave-today")
def get_guards_on_leave_today(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGER_ROLES)),
):
    today = date.today()

    records = (
        db.query(
            GuardLeave,
            Guard,
            Deployment,
            SecurityPost,
        )
        .join(
            Guard,
            Guard.id == GuardLeave.guard_id,
        )
        .outerjoin(
            Deployment,
            and_(
                Deployment.guard_id == Guard.id,
                Deployment.status == "ACTIVE",
                Deployment.start_date <= today,
                or_(
                    Deployment.end_date.is_(None),
                    Deployment.end_date >= today,
                ),
            ),
        )
        .outerjoin(
            SecurityPost,
            SecurityPost.id == Deployment.security_post_id,
        )
        .filter(
            GuardLeave.status == "APPROVED",
            GuardLeave.start_date <= today,
            GuardLeave.end_date >= today,
            Guard.is_active.is_(True),
            Guard.employment_status == "ACTIVE",
        )
        .order_by(
            Guard.full_name.asc(),
            GuardLeave.start_date.asc(),
        )
        .all()
    )

    result = {}

    for leave, guard, deployment, post in records:

        if leave.id not in result:
            result[leave.id] = {
                "id": leave.id,
                "guard_id": guard.id,
                "security_id": getattr(
                    guard,
                    "security_id",
                    None,
                ),
                "guard_name": guard.full_name,
                "start_date": leave.start_date,
                "end_date": leave.end_date,
                "reason": leave.reason,
                "status": leave.status,
                "assigned_posts": [],
            }

        if deployment and post:
            assignment = {
                "post_name": post.post_name,
                "shift_type": deployment.shift_type,
            }

            if assignment not in result[leave.id]["assigned_posts"]:
                result[leave.id]["assigned_posts"].append(assignment)

    return {
        "date": today,
        "total": len(result),
        "guards": list(result.values()),
    }





@router.get("/replacement-alerts")
def get_replacement_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGER_ROLES)),
):
    today = date.today()

    records = (
        db.query(
            GuardLeave,
            Guard,
            Deployment,
            SecurityPost,
        )
        .join(
            Guard,
            Guard.id == GuardLeave.guard_id,
        )
        .join(
            Deployment,
            Deployment.guard_id == Guard.id,
        )
        .join(
            SecurityPost,
            SecurityPost.id == Deployment.security_post_id,
        )
        .filter(
            # Approved leave covering today
            GuardLeave.status == "APPROVED",
            GuardLeave.start_date <= today,
            GuardLeave.end_date >= today,

            # Guard must be active
            Guard.is_active.is_(True),
            Guard.employment_status == "ACTIVE",

            # Deployment must be active and effective today
            Deployment.status == "ACTIVE",
            Deployment.start_date <= today,
            or_(
                Deployment.end_date.is_(None),
                Deployment.end_date >= today,
            ),

            # Post must be active
            SecurityPost.is_active.is_(True),
        )
        .order_by(
            SecurityPost.post_name.asc(),
            Guard.full_name.asc(),
        )
        .all()
    )

    alerts = {}

    for leave, guard, deployment, post in records:
        if deployment.id not in alerts:
            alerts[deployment.id] = {
                "deployment_id": deployment.id,
                "guard_id": guard.id,
                "guard_name": guard.full_name,
                "security_id": getattr(
                    guard,
                    "security_id",
                    None,
                ),
                "security_post_id": post.id,
                "post_name": post.post_name,
                "shift_type": deployment.shift_type,
                "alert_type": "REPLACEMENT_REQUIRED",
                "message": (
                    "Assigned guard is on approved leave. "
                    "A replacement is required."
                ),
                "leave_periods": [],
            }

        period = {
            "leave_id": leave.id,
            "start_date": leave.start_date,
            "end_date": leave.end_date,
            "reason": leave.reason,
        }

        if period not in alerts[deployment.id]["leave_periods"]:
            alerts[deployment.id]["leave_periods"].append(period)

    alert_list = list(alerts.values())

    return {
        "date": today,
        "total": len(alert_list),
        "alerts": alert_list,
    }
