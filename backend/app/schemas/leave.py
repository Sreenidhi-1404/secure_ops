from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class LeaveCreate(BaseModel):
    # Managers must provide guard_id; guard accounts are linked by the backend.
    guard_id: int | None = Field(default=None, gt=0)
    start_date: date
    end_date: date
    reason: str = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("End date cannot be before start date")
        if self.reason != self.reason.strip():
            self.reason = self.reason.strip()
        if not self.reason:
            raise ValueError("Reason cannot be empty")
        return self


class LeaveReview(BaseModel):
    status: str

    @model_validator(mode="after")
    def validate_status(self):
        if self.status not in {"APPROVED", "REJECTED"}:
            raise ValueError("Status must be APPROVED or REJECTED")
        return self


class LeaveResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    guard_id: int
    start_date: date
    end_date: date
    reason: str
    status: str
    reviewed_by: int | None
    reviewed_at: datetime | None
    created_at: datetime
