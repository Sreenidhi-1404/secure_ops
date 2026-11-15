
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


class DeploymentCreate(BaseModel):
    guard_id: int = Field(gt=0)
    security_post_id: int = Field(gt=0)
    start_date: date
    end_date: date | None = None
    shift_type: str = Field(min_length=1, max_length=30)
    notes: str | None = Field(default=None, max_length=500)


class DeploymentUpdate(BaseModel):
    end_date: date | None = None
    shift_type: str | None = Field(default=None, min_length=1, max_length=30)
    status: str | None = None
    notes: str | None = Field(default=None, max_length=500)


class DeploymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    guard_id: int
    security_post_id: int
    start_date: date
    end_date: date | None
    shift_type: str
    status: str
    notes: str | None
    created_at: datetime
