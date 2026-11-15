from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Guard(Base):
    __tablename__ = "guards"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )

    security_id: Mapped[str] = mapped_column(
        String(30), unique=True, index=True, nullable=False
    )

    full_name: Mapped[str] = mapped_column(
        String(120), nullable=False
    )

    gender: Mapped[str | None] = mapped_column(
        String(30), nullable=True
    )

    date_of_birth: Mapped[date | None] = mapped_column(
        Date, nullable=True
    )

    phone: Mapped[str] = mapped_column(
        String(20), nullable=False
    )

    email: Mapped[str | None] = mapped_column(
        String(150), unique=True, nullable=True
    )

    address: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )

    emergency_contact_name: Mapped[str | None] = mapped_column(
        String(120), nullable=True
    )

    emergency_contact_phone: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )

    joining_date: Mapped[date] = mapped_column(
        Date, nullable=False
    )

    monthly_salary: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
    )

    employment_status: Mapped[str] = mapped_column(
        String(30), default="ACTIVE", nullable=False
    )

    verification_status: Mapped[str] = mapped_column(
        String(30), default="PENDING", nullable=False
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )

    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )