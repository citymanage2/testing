"""Pydantic-схемы для архитектуры v2: сметы, разделы, позиции, слои цен."""
from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field


# ─── PriceSource ─────────────────────────────────────────────────────────────

class PriceSourceCreate(BaseModel):
    name: str
    source_type: str  # pricelist|fsnb|internal|manual
    url: Optional[str] = None
    reference_date: Optional[date] = None
    company_id: Optional[str] = None


class PriceSourceResponse(BaseModel):
    id: str
    company_id: Optional[str]
    name: str
    source_type: str
    url: Optional[str]
    reference_date: Optional[date]
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── ProjectMember ────────────────────────────────────────────────────────────

class ProjectMemberCreate(BaseModel):
    user_id: str
    role: str  # estimator|project_manager|director|sales_manager|supply_manager


class ProjectMemberUpdate(BaseModel):
    role: str


class ProjectMemberResponse(BaseModel):
    id: str
    project_id: str
    user_id: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── CatalogItem / CatalogPrice ───────────────────────────────────────────────

class CatalogItemCreate(BaseModel):
    item_type: str  # work|material
    name: str
    unit: str = "шт"
    code: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    company_id: Optional[str] = None


class CatalogItemUpdate(BaseModel):
    name: Optional[str] = None
    unit: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    is_active: Optional[bool] = None


class CatalogItemResponse(BaseModel):
    id: str
    company_id: Optional[str]
    item_type: str
    code: Optional[str]
    name: str
    unit: str
    description: Optional[str]
    category: Optional[str]
    subcategory: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CatalogPriceCreate(BaseModel):
    catalog_item_id: str
    price_source_id: str
    work_price: Decimal = Decimal("0")
    material_price: Decimal = Decimal("0")
    effective_date: date


class CatalogPriceResponse(BaseModel):
    id: str
    catalog_item_id: str
    price_source_id: str
    work_price: Decimal
    material_price: Decimal
    effective_date: date
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Estimate ─────────────────────────────────────────────────────────────────

class EstimateCreate(BaseModel):
    project_id: str
    name: str
    description: Optional[str] = None
    estimate_type: str = "client"       # client|subcontract
    calculation_method: str = "manual"  # manual|ai
    parent_id: Optional[str] = None
    version_name: Optional[str] = None


class EstimateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    version_name: Optional[str] = None


class EstimateStatusTransition(BaseModel):
    status: str
    reason: Optional[str] = None


class EstimateResponse(BaseModel):
    id: str
    project_id: str
    name: str
    description: Optional[str]
    status: str
    is_locked: bool
    parent_id: Optional[str]
    version_name: Optional[str]
    estimate_type: str
    calculation_method: str
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── EstimateSection ──────────────────────────────────────────────────────────

class SectionCreate(BaseModel):
    name: str
    order_index: int = 0
    parent_id: Optional[str] = None


class SectionUpdate(BaseModel):
    name: Optional[str] = None
    order_index: Optional[int] = None
    parent_id: Optional[str] = None


class SectionResponse(BaseModel):
    id: str
    estimate_id: str
    parent_id: Optional[str]
    name: str
    order_index: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── EstimatePosition ─────────────────────────────────────────────────────────

class PositionCreate(BaseModel):
    name: str
    unit: str = "шт"
    quantity: Decimal = Decimal("1")
    section_id: Optional[str] = None
    catalog_item_id: Optional[str] = None
    row_type: str = "item"
    order_index: int = 0


class PositionUpdate(BaseModel):
    name: Optional[str] = None
    unit: Optional[str] = None
    quantity: Optional[Decimal] = None
    section_id: Optional[str] = None
    catalog_item_id: Optional[str] = None
    row_type: Optional[str] = None
    order_index: Optional[int] = None


class PositionResponse(BaseModel):
    id: str
    estimate_id: str
    section_id: Optional[str]
    catalog_item_id: Optional[str]
    row_type: str
    name: str
    unit: str
    quantity: Decimal
    order_index: int
    created_at: datetime
    updated_at: datetime
    layers: list["PriceLayerResponse"] = []

    model_config = {"from_attributes": True}


# ─── PriceLayer ───────────────────────────────────────────────────────────────

class PriceLayerCreate(BaseModel):
    layer_type: str  # client|cost|subcontract|actual
    work_price: Decimal = Decimal("0")
    material_price: Decimal = Decimal("0")
    price_source_id: Optional[str] = None
    notes: Optional[str] = None


class PriceLayerUpdate(BaseModel):
    work_price: Optional[Decimal] = None
    material_price: Optional[Decimal] = None
    price_source_id: Optional[str] = None
    notes: Optional[str] = None


class PriceLayerResponse(BaseModel):
    id: str
    position_id: str
    layer_type: str
    work_price: Decimal
    material_price: Decimal
    total: Decimal
    price_source_id: Optional[str]
    notes: Optional[str]

    model_config = {"from_attributes": True}


PositionResponse.model_rebuild()


# ─── Фаза 3: расчёт себестоимости, итоги, сравнение веток ────────────────────

class CostCalcRequest(BaseModel):
    overhead_pct: float = Field(0.0, ge=0.0)        # накладные расходы, %
    transport_pct: float = Field(0.0, ge=0.0)       # транспортные расходы, %
    contingency_pct: float = Field(0.0, ge=0.0)     # непредвиденные, %
    price_source_id: Optional[str] = None           # источник для слоя COST (если известен)


class LayerTotalsSchema(BaseModel):
    work: Decimal
    material: Decimal
    total: Decimal


class EstimateSummaryResponse(BaseModel):
    estimate_id: str
    estimate_name: str
    positions_count: int
    layers: dict[str, LayerTotalsSchema]   # layer_type → суммы
    overhead_pct: float
    transport_pct: float
    contingency_pct: float
    cost_total_with_overhead: Decimal
    margin: Decimal           # client - cost (с накладными)
    margin_pct: float         # маржа в %


class PositionDiffSchema(BaseModel):
    position_name: str
    unit: str
    quantity: Decimal
    a_layers: Optional[dict[str, Decimal]]
    b_layers: Optional[dict[str, Decimal]]
    diff_type: str    # only_a | only_b | changed | unchanged


class BranchCompareResponse(BaseModel):
    estimate_a_id: str
    estimate_b_id: str
    only_in_a: list[PositionDiffSchema]
    only_in_b: list[PositionDiffSchema]
    changed: list[PositionDiffSchema]
    unchanged_count: int
    total_a: dict[str, Decimal]
    total_b: dict[str, Decimal]


class EstimateExtrasUpdate(BaseModel):
    overhead_pct: Optional[float] = None
    transport_pct: Optional[float] = None
    contingency_pct: Optional[float] = None
