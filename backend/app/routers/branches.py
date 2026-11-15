from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Branch, Client, User, UserRole
from app.schemas.branch import (
    BranchCreate,
    BranchUpdate,
    BranchResponse,
)
from app.utils.dependencies import require_roles


router = APIRouter(
    prefix="/branches",
    tags=["Branches"],
)


MANAGERS = (
    UserRole.SUPER_ADMIN,
    UserRole.OPERATIONS_MANAGER,
)


@router.post("", response_model=BranchResponse, status_code=201)
def create_branch(
    data: BranchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGERS)),
):
    client = db.query(Client).filter(
        Client.id == data.client_id,
        Client.is_active.is_(True),
    ).first()

    if not client:
        raise HTTPException(
            status_code=404,
            detail="Active client not found",
        )

    existing = db.query(Branch).filter(
        Branch.branch_code == data.branch_code,
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Branch code already exists",
        )

    branch = Branch(**data.model_dump())
    db.add(branch)

    try:
        db.commit()
        db.refresh(branch)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Branch code already exists",
        )

    return branch


@router.get("", response_model=list[BranchResponse])
def list_branches(
    client_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(
            UserRole.SUPER_ADMIN,
            UserRole.HR,
            UserRole.OPERATIONS_MANAGER,
        )
    ),
):
    query = db.query(Branch).filter(
        Branch.is_active.is_(True),
    )

    if client_id is not None:
        query = query.filter(Branch.client_id == client_id)

    return query.order_by(Branch.branch_name).all()


@router.get("/{branch_id}", response_model=BranchResponse)
def get_branch(
    branch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(
            UserRole.SUPER_ADMIN,
            UserRole.HR,
            UserRole.OPERATIONS_MANAGER,
        )
    ),
):
    branch = db.query(Branch).filter(
        Branch.id == branch_id,
        Branch.is_active.is_(True),
    ).first()

    if not branch:
        raise HTTPException(
            status_code=404,
            detail="Branch not found",
        )

    return branch


@router.patch("/{branch_id}", response_model=BranchResponse)
def update_branch(
    branch_id: int,
    data: BranchUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*MANAGERS)),
):
    branch = db.query(Branch).filter(
        Branch.id == branch_id,
        Branch.is_active.is_(True),
    ).first()

    if not branch:
        raise HTTPException(
            status_code=404,
            detail="Branch not found",
        )

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(branch, field, value)

    db.commit()
    db.refresh(branch)

    return branch


@router.delete("/{branch_id}", status_code=204)
def deactivate_branch(
    branch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.SUPER_ADMIN)
    ),
):
    branch = db.query(Branch).filter(
        Branch.id == branch_id,
        Branch.is_active.is_(True),
    ).first()

    if not branch:
        raise HTTPException(
            status_code=404,
            detail="Branch not found",
        )

    branch.is_active = False
    db.commit()