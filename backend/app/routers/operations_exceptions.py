from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.guard import Guard
from app.models.deployment import Deployment
from app.models.security_post import SecurityPost
from app.models.leave import GuardLeave
from app.models.payroll import Payroll
from app.models.user import User, UserRole
from app.utils.dependencies import require_roles


router = APIRouter(
    prefix="/operations",
    tags=["Operations Exceptions"],
)

MANAGER_ROLES = (
    UserRole.SUPER_ADMIN,
    UserRole.HR,
    UserRole.OPERATIONS_MANAGER,
)


@router.get("/exceptions")
def get_operations_exceptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(*MANAGER_ROLES)
    ),
):
    today = date.today()

    # 1. Active deployments overlapping approved leave
    active_deployments = db.query(Deployment).filter(
        Deployment.status == "ACTIVE",
        Deployment.start_date <= today,
    ).all()

    leave_conflicts = []

    for deployment in active_deployments:
        leaves = db.query(GuardLeave).filter(
            GuardLeave.guard_id == deployment.guard_id,
            GuardLeave.status == "APPROVED",
            GuardLeave.start_date <= (
                deployment.end_date or date.max
            ),
            GuardLeave.end_date >= deployment.start_date,
        ).all()

        for leave in leaves:
            leave_conflicts.append({
                "deployment_id": deployment.id,
                "guard_id": deployment.guard_id,
                "leave_id": leave.id,
                "leave_start": str(leave.start_date),
                "leave_end": str(leave.end_date),
                "issue": "Active deployment overlaps approved leave",
            })

    # 2. Vacant positions at active security posts
    posts = db.query(SecurityPost).filter(
        SecurityPost.is_active.is_(True)
    ).all()

    vacant_posts = []

    for post in posts:
        deployed_count = db.query(Deployment).filter(
            Deployment.security_post_id == post.id,
            Deployment.status == "ACTIVE",
            Deployment.start_date <= today,
        ).count()

        vacant = max(
            (post.required_guards or 0) - deployed_count,
            0,
        )

        if vacant > 0:
            vacant_posts.append({
                "post_id": post.id,
                "post_name": post.post_name,
                "required_guards": post.required_guards,
                "deployed_guards": deployed_count,
                "vacant_positions": vacant,
            })

    # 3. Active guards without an active deployment
    deployed_guard_ids = db.query(
        Deployment.guard_id
    ).filter(
        Deployment.status == "ACTIVE",
        Deployment.start_date <= today,
    ).distinct().all()

    deployed_ids = {row[0] for row in deployed_guard_ids}

    unassigned_guards = db.query(Guard).filter(
        Guard.is_active.is_(True),
        Guard.employment_status == "ACTIVE",
    ).all()

    unassigned_guards = [
        {
            "guard_id": guard.id,
            "security_id": guard.security_id,
            "full_name": guard.full_name,
        }
        for guard in unassigned_guards
        if guard.id not in deployed_ids
    ]

    # 4. Leave requests awaiting review
    pending_leaves = db.query(GuardLeave).filter(
        GuardLeave.status == "PENDING"
    ).count()

    # 5. Payroll awaiting approval or payment
    pending_payroll = db.query(Payroll).filter(
        Payroll.status.in_(["DRAFT", "APPROVED"])
    ).count()

    return {
        "report_date": str(today),
        "leave_deployment_conflicts": leave_conflicts,
        "vacant_posts": vacant_posts,
        "unassigned_active_guards": unassigned_guards,
        "pending_leave_requests": pending_leaves,
        "payroll_awaiting_action": pending_payroll,
        "total_issues": (
            len(leave_conflicts)
            + len(vacant_posts)
            + len(unassigned_guards)
            + pending_leaves
            + pending_payroll
        ),
    }