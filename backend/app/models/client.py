from datetime import datetime

from sqlalchemy import (
    Boolean, DateTime, ForeignKey,
    Integer, String, Text
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )

    client_code: Mapped[str] = mapped_column(
        String(30), unique=True, index=True, nullable=False
    )

    company_name: Mapped[str] = mapped_column(
        String(150), nullable=False
    )

    industry: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )

    contact_person: Mapped[str] = mapped_column(
        String(100), nullable=False
    )

    email: Mapped[str] = mapped_column(
        String(150), nullable=False
    )

    phone: Mapped[str] = mapped_column(
        String(20), nullable=False
    )

    address: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    city: Mapped[str] = mapped_column(
        String(100), nullable=False
    )

    state: Mapped[str] = mapped_column(
        String(100), nullable=False
    )

    pincode: Mapped[str | None] = mapped_column(
        String(10), nullable=True
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )

    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.now,
        nullable=False
    )