from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Client, User, UserRole
from app.schemas.client import (
    ClientCreate,
    ClientUpdate,
    ClientResponse,
)
from app.utils.dependencies import (
    get_current_user,
    require_roles,
)

router = APIRouter(prefix="/clients", tags=["Clients"])


@router.post(
    "",
    response_model=ClientResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_client(
    data: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(
            UserRole.SUPER_ADMIN,
            UserRole.OPERATIONS_MANAGER,
        )
    ),
):
    existing = db.query(Client).filter(
        Client.client_code == data.client_code
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Client code already exists",
        )

    client = Client(
        **data.model_dump(),
        created_by=current_user.id,
    )

    db.add(client)

    try:
        db.commit()
        db.refresh(client)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Client code already exists",
        )

    return client


@router.get("", response_model=list[ClientResponse])
def list_clients(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(
            UserRole.SUPER_ADMIN,
            UserRole.HR,
            UserRole.OPERATIONS_MANAGER,
        )
    ),
):
    return (
        db.query(Client)
        .filter(Client.is_active.is_(True))
        .order_by(Client.company_name)
        .all()
    )


@router.get("/{client_id}", response_model=ClientResponse)
def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(
            UserRole.SUPER_ADMIN,
            UserRole.HR,
            UserRole.OPERATIONS_MANAGER,
        )
    ),
):
    client = db.query(Client).filter(
        Client.id == client_id,
        Client.is_active.is_(True),
    ).first()

    if not client:
        raise HTTPException(
            status_code=404,
            detail="Client not found",
        )

    return client


@router.patch("/{client_id}", response_model=ClientResponse)
def update_client(
    client_id: int,
    data: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(
            UserRole.SUPER_ADMIN,
            UserRole.OPERATIONS_MANAGER,
        )
    ),
):
    client = db.query(Client).filter(
        Client.id == client_id,
        Client.is_active.is_(True),
    ).first()

    if not client:
        raise HTTPException(
            status_code=404,
            detail="Client not found",
        )

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(client, field, value)

    db.commit()
    db.refresh(client)

    return client


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.SUPER_ADMIN)
    ),
):
    client = db.query(Client).filter(
        Client.id == client_id,
        Client.is_active.is_(True),
    ).first()

    if not client:
        raise HTTPException(
            status_code=404,
            detail="Client not found",
        )

    # Preserve historical records instead of permanently deleting.
    client.is_active = False
    db.commit()