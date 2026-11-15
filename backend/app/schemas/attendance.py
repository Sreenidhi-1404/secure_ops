
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class AttendanceCheckIn(BaseModel):
    deployment_id: int = Field(gt=0)
    notes: str | None = Field(default=None, max_length=500)


class AttendanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    guard_id: int
    deployment_id: int
    attendance_date: date
    check_in: datetime
    check_out: datetime | None
    status: str
    notes: str | None
    created_at: datetime
