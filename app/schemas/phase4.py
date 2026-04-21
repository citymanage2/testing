"""Pydantic-схемы Фазы 4: ГПР, склад, заявки на материалы."""
from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field


# ─── WorkStage (ГПР) ──────────────────────────────────────────────────────────

class WorkStageCreate(BaseModel):
    name: str
    description: Optional[str] = None
    parent_id: Optional[str] = None
    plan_start: Optional[date] = None
    plan_end: Optional[date] = None
    depends_on: list[str] = []
    order_index: int = 0


class WorkStageUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[str] = None
    status: Optional[str] = None
    plan_start: Optional[date] = None
    plan_end: Optional[date] = None
    actual_start: Optional[date] = None
    actual_end: Optional[date] = None
    depends_on: Optional[list[str]] = None
    order_index: Optional[int] = None


class WorkStageResponse(BaseModel):
    id: str
    project_id: str
    parent_id: Optional[str]
    name: str
    description: Optional[str]
    status: str
    plan_start: Optional[date]
    plan_end: Optional[date]
    actual_start: Optional[date]
    actual_end: Optional[date]
    depends_on: Optional[list[str]]
    order_index: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StagePositionAssign(BaseModel):
    """Привязка позиции сметы к этапу ГПР (stage_id берётся из URL).
    detach=True — открепить позицию от любого этапа.
    """
    position_id: str
    detach: bool = False


class StageWithPositions(WorkStageResponse):
    """Этап с агрегированными плановыми объёмами из привязанных позиций."""
    positions_count: int = 0
    client_total: Decimal = Decimal("0")
    cost_total: Decimal = Decimal("0")


# ─── Warehouse ────────────────────────────────────────────────────────────────

class WarehouseCreate(BaseModel):
    name: str
    warehouse_type: str = "central"    # central | site
    project_id: Optional[str] = None
    address: Optional[str] = None


class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = None


class WarehouseResponse(BaseModel):
    id: str
    name: str
    warehouse_type: str
    project_id: Optional[str]
    address: Optional[str]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class StockItemResponse(BaseModel):
    id: str
    warehouse_id: str
    catalog_item_id: str
    quantity: Decimal
    reserved_quantity: Decimal
    available: Decimal        # quantity - reserved_quantity
    unit: str
    updated_at: datetime

    model_config = {"from_attributes": True}


class StockMovementCreate(BaseModel):
    catalog_item_id: str
    quantity: Decimal = Field(gt=Decimal("0"))  # движение всегда положительное
    movement_type: str        # receipt | issue | transfer | write_off
    from_warehouse_id: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    notes: Optional[str] = None


class StockMovementResponse(BaseModel):
    id: str
    warehouse_id: str
    from_warehouse_id: Optional[str]
    catalog_item_id: str
    quantity: Decimal
    movement_type: str
    reference_type: Optional[str]
    reference_id: Optional[str]
    notes: Optional[str]
    created_by: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── MaterialRequest ──────────────────────────────────────────────────────────

class MaterialRequestCreate(BaseModel):
    project_id: str
    title: str
    stage_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    notes: Optional[str] = None


class MaterialRequestUpdate(BaseModel):
    title: Optional[str] = None
    stage_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    notes: Optional[str] = None
    # status намеренно отсутствует: все смены статуса — через POST /transition


class MaterialRequestResponse(BaseModel):
    id: str
    project_id: str
    stage_id: Optional[str]
    warehouse_id: Optional[str]
    title: str
    status: str
    requested_by: str
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RequestItemCreate(BaseModel):
    name: str
    unit: str = "шт"
    quantity_planned: Decimal
    catalog_item_id: Optional[str] = None
    estimate_position_id: Optional[str] = None
    notes: Optional[str] = None


class RequestItemUpdate(BaseModel):
    name: Optional[str] = None
    unit: Optional[str] = None
    quantity_planned: Optional[Decimal] = None
    quantity_actual: Optional[Decimal] = None
    catalog_item_id: Optional[str] = None
    notes: Optional[str] = None


class RequestItemResponse(BaseModel):
    id: str
    request_id: str
    catalog_item_id: Optional[str]
    estimate_position_id: Optional[str]
    name: str
    unit: str
    quantity_planned: Decimal
    quantity_actual: Decimal
    notes: Optional[str]

    model_config = {"from_attributes": True}


class MaterialRequestWithItems(MaterialRequestResponse):
    items: list[RequestItemResponse] = []
