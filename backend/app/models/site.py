from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Integer, String, Text
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Site(Base):
    __tablename__ = "sites"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )

    site_code: Mapped[str] = mapped_column(
        String(30), unique=True, index=True, nullable=False
    )

    site_name: Mapped[str] = mapped_column(
        String(150), nullable=False
    )

    branch_id: Mapped[int] = mapped_column(
        ForeignKey("branches.id"), nullable=False, index=True
    )

    address: Mapped[str] = mapped_column(
        Text, nullable=False
    )

    city: Mapped[str] = mapped_column(
        String(100), nullable=False
    )

    state: Mapped[str] = mapped_column(
        String(100), nullable=False
    )

    site_contact: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )

    contact_phone: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )