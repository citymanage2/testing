from datetime import datetime
from uuid import UUID
from pydantic import BaseModel

class EstimateItemSchema(BaseModel):
    id: UUID
    position: int
    type: str
    name: str
    unit: str
    quantity: float
    work_price: float
    mat_price: float
    section: str | None
    notes: str | None
    is_analogue: bool
    original_item_id: UUID | None
    analogue_note: str | None

    model_config = {"from_attributes": True}

class EstimateItemsResponse(BaseModel):
    items: list[EstimateItemSchema]
    vat_rate: float
    total_work: float
    total_mat: float
    total: float
    total_vat: float

class EstimateStatusUpdate(BaseModel):
    status: str
    updated_by: str

class VersionResponse(BaseModel):
    id: UUID
    version_number: int
    change_type: str
    change_description: str | None
    created_by: str
    created_at: datetime

    model_config = {"from_attributes": True}

class OptimizeExecuteRequest(BaseModel):
    item_ids: list[str]

class ApplyAnalogueRequest(BaseModel):
    name: str
    price: float
    unit: str
    supplier: str
    source_url: str | None = None
    analogue_note: str
