
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    Integer,
    String,
    Date,
    DateTime,
    ForeignKey,
)

from app.database import Base


class GuardReplacement(Base):
    __tablename__ = "guard_replacements"

    id = Column(Integer, primary_key=True, index=True)

    old_deployment_id = Column(
        Integer,
        ForeignKey("deployments.id"),
        nullable=False,
    )

    new_deployment_id = Column(
        Integer,
        ForeignKey("deployments.id"),
        nullable=False,
    )

    outgoing_guard_id = Column(
        Integer,
        ForeignKey("guards.id"),
        nullable=False,
    )

    incoming_guard_id = Column(
        Integer,
        ForeignKey("guards.id"),
        nullable=False,
    )

    security_post_id = Column(
        Integer,
        ForeignKey("security_posts.id"),
        nullable=False,
    )

    replacement_date = Column(Date, nullable=False)

    shift_type = Column(String(50), nullable=False)

    reason = Column(String(500), nullable=False)

    replaced_by_user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
