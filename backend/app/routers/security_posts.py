from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Site, SecurityPost, User, UserRole
from app.schemas.security_post import (
    SecurityPostCreate,
    SecurityPostUpdate,
    SecurityPostResponse,
)
from app.utils.dependencies import require_roles


router = APIRouter(
    prefix="/security-posts",
    tags=["Security Posts"],
)

MANAGERS = (
    UserRole.SUPER_ADMIN,
    UserRole.OPERATIONS_MANAGER,
)


@router.post("", response_model=SecurityPostResponse, status_code=201)
def create_post(
    data: SecurityPostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGERS)),
):
    site = db.query(Site).filter(
        Site.id == data.site_id,
        Site.is_active.is_(True),
    ).first()

    if not site:
        raise HTTPException(404, "Active site not found")

    post = SecurityPost(**data.model_dump())
    db.add(post)

    try:
        db.commit()
        db.refresh(post)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Post code already exists")

    return post


@router.get("", response_model=list[SecurityPostResponse])
def list_posts(
    site_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(
            UserRole.SUPER_ADMIN,
            UserRole.HR,
            UserRole.OPERATIONS_MANAGER,
        )
    ),
):
    query = db.query(SecurityPost).filter(
        SecurityPost.is_active.is_(True)
    )

    if site_id is not None:
        query = query.filter(SecurityPost.site_id == site_id)

    return query.order_by(SecurityPost.post_name).all()


@router.get("/{post_id}", response_model=SecurityPostResponse)
def get_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(
            UserRole.SUPER_ADMIN,
            UserRole.HR,
            UserRole.OPERATIONS_MANAGER,
        )
    ),
):
    post = db.query(SecurityPost).filter(
        SecurityPost.id == post_id,
        SecurityPost.is_active.is_(True),
    ).first()

    if not post:
        raise HTTPException(404, "Security post not found")

    return post


@router.patch("/{post_id}", response_model=SecurityPostResponse)
def update_post(
    post_id: int,
    data: SecurityPostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGERS)),
):
    post = db.query(SecurityPost).filter(
        SecurityPost.id == post_id,
        SecurityPost.is_active.is_(True),
    ).first()

    if not post:
        raise HTTPException(404, "Security post not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(post, field, value)

    db.commit()
    db.refresh(post)

    return post


@router.delete("/{post_id}", status_code=204)
def deactivate_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.SUPER_ADMIN)
    ),
):
    post = db.query(SecurityPost).filter(
        SecurityPost.id == post_id,
        SecurityPost.is_active.is_(True),
    ).first()

    if not post:
        raise HTTPException(404, "Security post not found")

    post.is_active = False
    db.commit()