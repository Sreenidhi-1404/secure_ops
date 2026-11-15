from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Branch, Site, User, UserRole
from app.schemas.site import SiteCreate, SiteUpdate, SiteResponse
from app.utils.dependencies import require_roles


router = APIRouter(prefix="/sites", tags=["Sites"])

MANAGERS = (
    UserRole.SUPER_ADMIN,
    UserRole.OPERATIONS_MANAGER,
)


@router.post("", response_model=SiteResponse, status_code=201)
def create_site(
    data: SiteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGERS)),
):
    branch = db.query(Branch).filter(
        Branch.id == data.branch_id,
        Branch.is_active.is_(True),
    ).first()

    if not branch:
        raise HTTPException(404, "Active branch not found")

    site = Site(**data.model_dump())
    db.add(site)

    try:
        db.commit()
        db.refresh(site)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Site code already exists")

    return site


@router.get("", response_model=list[SiteResponse])
def list_sites(
    branch_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(
            UserRole.SUPER_ADMIN,
            UserRole.HR,
            UserRole.OPERATIONS_MANAGER,
        )
    ),
):
    query = db.query(Site).filter(Site.is_active.is_(True))

    if branch_id is not None:
        query = query.filter(Site.branch_id == branch_id)

    return query.order_by(Site.site_name).all()


@router.get("/{site_id}", response_model=SiteResponse)
def get_site(
    site_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(
            UserRole.SUPER_ADMIN,
            UserRole.HR,
            UserRole.OPERATIONS_MANAGER,
        )
    ),
):
    site = db.query(Site).filter(
        Site.id == site_id,
        Site.is_active.is_(True),
    ).first()

    if not site:
        raise HTTPException(404, "Site not found")

    return site


@router.patch("/{site_id}", response_model=SiteResponse)
def update_site(
    site_id: int,
    data: SiteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGERS)),
):
    site = db.query(Site).filter(
        Site.id == site_id,
        Site.is_active.is_(True),
    ).first()

    if not site:
        raise HTTPException(404, "Site not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(site, field, value)

    db.commit()
    db.refresh(site)

    return site


@router.delete("/{site_id}", status_code=204)
def deactivate_site(
    site_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.SUPER_ADMIN)
    ),
):
    site = db.query(Site).filter(
        Site.id == site_id,
        Site.is_active.is_(True),
    ).first()

    if not site:
        raise HTTPException(404, "Site not found")

    site.is_active = False
    db.commit()