from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class GuardLeave(Base):
    __tablename__ = "guard_leaves"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )

    guard_id: Mapped[int] = mapped_column(
        ForeignKey("guards.id"), nullable=False, index=True
    )

    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)

    reason: Mapped[str] = mapped_column(
        String(500), nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(20), default="PENDING", nullable=False
    )

    reviewed_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )

    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )