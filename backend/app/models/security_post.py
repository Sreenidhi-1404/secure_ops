from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Integer, String, Text
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SecurityPost(Base):
    __tablename__ = "security_posts"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )

    post_code: Mapped[str] = mapped_column(
        String(30), unique=True, index=True, nullable=False
    )

    post_name: Mapped[str] = mapped_column(
        String(120), nullable=False
    )

    site_id: Mapped[int] = mapped_column(
        ForeignKey("sites.id"), nullable=False, index=True
    )

    description: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    required_guards: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1
    )

    shift_type: Mapped[str] = mapped_column(
        String(30), nullable=False, default="GENERAL"
    )

    is_armed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )