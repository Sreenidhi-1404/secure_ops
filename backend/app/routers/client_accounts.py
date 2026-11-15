from pydantic import BaseModel, EmailStr, Field
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.models.client import Client
from app.utils.security import hash_password
from app.utils.dependencies import require_roles


router = APIRouter(
    prefix="/admin/client-accounts",
    tags=["Client Account Management"],
)


class ClientAccountCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    client_id: int = Field(gt=0)


@router.post("/", status_code=201)
def create_client_account(
    data: ClientAccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.SUPER_ADMIN)
    ),
):
    client = db.query(Client).filter(
        Client.id == data.client_id,
        Client.is_active.is_(True),
    ).first()

    if not client:
        raise HTTPException(
            status_code=404,
            detail="Active client company not found",
        )

    existing_user = db.query(User).filter(
        User.email == str(data.email).lower()
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists",
        )

    user = User(
        full_name=data.full_name.strip(),
        email=str(data.email).lower(),
        password_hash=hash_password(data.password),
        role=UserRole.CLIENT,
        client_id=client.id,
        is_active=True,
    )

    db.add(user)

    try:
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise

    return {
        "message": "Client account created successfully",
        "user_id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role.value,
        "client_id": user.client_id,
        "company_name": client.company_name,
    }