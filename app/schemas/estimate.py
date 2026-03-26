from typing import Optional
from pydantic import BaseModel


class EstimateItemSchema(BaseModel):
    id: str
    position: int
    section: str
    type: str
    name: str
    unit: str
    quantity: float
    price_work: float
    price_material: float
    total: float
    is_analogue: bool
    is_optimized: bool
    source_url: Optional[str] = None

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj, **kwargs):
        return cls(
            id=str(obj.id), position=obj.position, section=obj.section,
            type=obj.type, name=obj.name, unit=obj.unit, quantity=obj.quantity,
            price_work=obj.work_price, price_material=obj.mat_price, total=obj.total,
            is_analogue=obj.is_analogue, is_optimized=obj.is_optimized, source_url=obj.source_url,
        )


class EstimateItemUpdate(BaseModel):
    section: Optional[str] = None
    name: Optional[str] = None
    unit: Optional[str] = None
    quantity: Optional[float] = None
    work_price: Optional[float] = None
    mat_price: Optional[float] = None
    source_url: Optional[str] = None


class EstimateItemsResponse(BaseModel):
    items: list[EstimateItemSchema]
    vat_rate: float
    total_work: float
    total_mat: float
    total: float
    total_vat: float


class EstimateStatusUpdate(BaseModel):
    status: str
    updated_by: Optional[str] = None


class VersionResponse(BaseModel):
    id: str
    version_number: int
    change_type: str
    change_description: str
    created_at: str

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj, **kwargs):
        return cls(
            id=str(obj.id), version_number=obj.version_number,
            change_type=obj.change_type, change_description=obj.change_description,
            created_at=obj.created_at.isoformat(),
        )


class OptimizeExecuteRequest(BaseModel):
    item_ids: list[str]


class ApplyAnalogueRequest(BaseModel):
    analogue_id: str


class MoveTaskRequest(BaseModel):
    project_id: str


class ProjectTotals(BaseModel):
    total_work: float
    total_mat: float
    total: float
    total_vat: float
    tasks_count: int


class PairCheckResult(BaseModel):
    ok: bool
    materials_without_work: list[str]
    works_without_material: list[str]
    summary: str
