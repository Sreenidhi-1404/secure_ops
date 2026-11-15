from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.models.client import Client
from app.models.branch import Branch
from app.models.site import Site
from app.models.security_post import SecurityPost
from app.models.deployment import Deployment
from app.models.attendance import Attendance
from app.utils.dependencies import require_roles

router = APIRouter(
    prefix="/client-portal",
    tags=["Client Portal"],
)


def get_linked_client(
    db: Session,
    current_user: User,
):
    if current_user.role != UserRole.CLIENT:
        raise HTTPException(
            status_code=403,
            detail="Client account required",
        )

    if current_user.client_id is None:
        raise HTTPException(
            status_code=403,
            detail="Your user account is not linked to a client company",
        )

    client = db.query(Client).filter(
        Client.id == current_user.client_id,
        Client.is_active.is_(True),
    ).first()

    if not client:
        raise HTTPException(
            status_code=403,
            detail="Linked client is unavailable",
        )

    return client


@router.get("/overview")
def client_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.CLIENT)
    ),
):
    client = get_linked_client(db, current_user)

    branches = db.query(Branch).filter(
        Branch.client_id == client.id
    ).all()

    branch_ids = [branch.id for branch in branches]

    sites = []
    if branch_ids:
        sites = db.query(Site).filter(
            Site.branch_id.in_(branch_ids)
        ).all()

    site_ids = [site.id for site in sites]

    posts = []
    if site_ids:
        posts = db.query(SecurityPost).filter(
            SecurityPost.site_id.in_(site_ids),
            SecurityPost.is_active.is_(True),
        ).all()

    post_ids = [post.id for post in posts]

    deployments = []
    if post_ids:
        deployments = db.query(Deployment).filter(
            Deployment.security_post_id.in_(post_ids),
            Deployment.status == "ACTIVE",
        ).all()

    deployment_ids = [d.id for d in deployments]

    attendance_today = 0
    if deployment_ids:
        from datetime import date

        attendance_today = db.query(Attendance).filter(
            Attendance.deployment_id.in_(deployment_ids),
            Attendance.attendance_date == date.today(),
            Attendance.status == "PRESENT",
        ).count()

    return {
        "client": {
            "id": client.id,
            "client_code": client.client_code,
            "company_name": client.company_name,
        },
        "total_branches": len(branches),
        "total_sites": len(sites),
        "active_security_posts": len(posts),
        "active_deployments": len(deployments),
        "attendance_records_today": attendance_today,
    }