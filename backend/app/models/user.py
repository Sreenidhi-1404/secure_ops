from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, Enum as SQLEnum
from sqlalchemy import Integer, String , ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base




class UserRole(str, Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    HR = "HR"
    OPERATIONS_MANAGER = "OPERATIONS_MANAGER"
    SUPERVISOR = "SUPERVISOR"
    CLIENT = "CLIENT"
    GUARD = "GUARD"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True
    )

    full_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    email: Mapped[str] = mapped_column(
        String(150),
        unique=True,
        index=True,
        nullable=False
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    role: Mapped[UserRole] = mapped_column(
        SQLEnum(UserRole),
        nullable=False,
        default=UserRole.GUARD
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
    
    
    client_id: Mapped[int | None] = mapped_column(
        ForeignKey("clients.id"),
        nullable=True,
        index=True,
    )