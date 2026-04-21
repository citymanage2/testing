"""
Сервис расчёта слоёв цен (Фаза 3).

Отвечает за:
  1. Автосчёт слоя COST из каталога компании.
  2. Глубокое копирование структуры сметы при ветвлении (branch).
  3. Сравнение двух смет/веток (diff по позициям и ценам).
  4. Итоговые суммы по всем слоям (summary).

Принцип: вся арифметика — Python, Claude не считает.
"""
from __future__ import annotations

import uuid
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.estimate_v2 import (
    Estimate, EstimateSection, EstimatePosition, PriceLayer,
)
from app.models.catalog_item import CatalogItem, CatalogPrice
from app.models.price_source import PriceSource

logger = logging.getLogger(__name__)

_ZERO = Decimal("0")


# ─── Вспомогательные структуры ────────────────────────────────────────────────

@dataclass
class LayerTotals:
    work: Decimal = field(default_factory=lambda: _ZERO)
    material: Decimal = field(default_factory=lambda: _ZERO)

    @property
    def total(self) -> Decimal:
        return self.work + self.material


@dataclass
class EstimateSummary:
    estimate_id: str
    estimate_name: str
    positions_count: int
    layers: dict[str, LayerTotals]       # layer_type → LayerTotals
    overhead_pct: float
    transport_pct: float
    contingency_pct: float
    # Производные
    cost_total_with_overhead: Decimal = _ZERO
    margin: Decimal = _ZERO             # client - cost
    margin_pct: float = 0.0             # margin / client * 100

    def __post_init__(self):
        client = self.layers.get("client", LayerTotals()).total
        cost_base = self.layers.get("cost", LayerTotals()).total
        overhead = cost_base * Decimal(str(self.overhead_pct / 100))
        transport = cost_base * Decimal(str(self.transport_pct / 100))
        contingency = cost_base * Decimal(str(self.contingency_pct / 100))
        self.cost_total_with_overhead = cost_base + overhead + transport + contingency
        self.margin = client - self.cost_total_with_overhead
        self.margin_pct = float(self.margin / client * 100) if client else 0.0


@dataclass
class PositionDiff:
    position_name: str
    unit: str
    quantity: Decimal
    # Значения слоёв в смете A
    a_layers: dict[str, Decimal]
    # Значения слоёв в смете B (None если позиции нет)
    b_layers: Optional[dict[str, Decimal]]
    diff_type: str   # only_a | only_b | changed | unchanged


@dataclass
class BranchCompareResult:
    estimate_a_id: str
    estimate_b_id: str
    only_in_a: list[PositionDiff]
    only_in_b: list[PositionDiff]
    changed: list[PositionDiff]
    unchanged_count: int
    total_a: dict[str, Decimal]   # layer_type → total
    total_b: dict[str, Decimal]


# ─── 1. Автосчёт слоя COST ────────────────────────────────────────────────────

async def calculate_cost_layer(
    db: AsyncSession,
    estimate_id: str,
    overhead_pct: float = 0.0,
    transport_pct: float = 0.0,
    contingency_pct: float = 0.0,
    price_source_id: Optional[str] = None,
) -> dict:
    """
    Для каждой позиции сметы с catalog_item_id берёт актуальную CatalogPrice
    и создаёт / обновляет PriceLayer(cost).

    Возвращает статистику: updated, skipped, no_catalog_price.
    Накладные сохраняются в estimate.extras.
    """
    # Обновляем overhead в смете
    estimate = await db.get(Estimate, estimate_id)
    if not estimate:
        raise ValueError(f"Смета {estimate_id} не найдена")

    extras = dict(estimate.extras or {})
    extras.update(
        overhead_pct=overhead_pct,
        transport_pct=transport_pct,
        contingency_pct=contingency_pct,
    )
    estimate.extras = extras
    estimate.updated_at = datetime.now(timezone.utc)

    # Все позиции сметы
    positions_result = await db.execute(
        select(EstimatePosition)
        .where(EstimatePosition.estimate_id == estimate_id)
        .where(EstimatePosition.row_type == "item")
    )
    positions = positions_result.scalars().all()

    # Только позиции с привязкой к каталогу
    positions_with_catalog = [p for p in positions if p.catalog_item_id]
    skipped = len(positions) - len(positions_with_catalog)

    if not positions_with_catalog:
        return {"updated": 0, "skipped_no_catalog": skipped, "skipped_no_price": 0}

    catalog_item_ids = list({p.catalog_item_id for p in positions_with_catalog})
    pos_ids = [p.id for p in positions_with_catalog]

    # Пакетная загрузка актуальных цен каталога (1 запрос вместо N)
    # ORDER BY desc → первая запись для каждого item_id — самая свежая
    cp_result = await db.execute(
        select(CatalogPrice)
        .where(CatalogPrice.catalog_item_id.in_(catalog_item_ids))
        .order_by(CatalogPrice.effective_date.desc())
    )
    latest_price: dict[str, CatalogPrice] = {}
    for cp in cp_result.scalars().all():
        if cp.catalog_item_id not in latest_price:
            latest_price[cp.catalog_item_id] = cp

    # Пакетная загрузка существующих слоёв COST (1 запрос вместо N)
    existing_result = await db.execute(
        select(PriceLayer)
        .where(PriceLayer.position_id.in_(pos_ids))
        .where(PriceLayer.layer_type == "cost")
    )
    existing_layers: dict[str, PriceLayer] = {
        layer.position_id: layer for layer in existing_result.scalars().all()
    }

    updated = no_catalog_price = 0

    for pos in positions_with_catalog:
        catalog_price = latest_price.get(pos.catalog_item_id)
        if not catalog_price:
            no_catalog_price += 1
            continue

        wp = catalog_price.work_price
        mp = catalog_price.material_price
        total = (wp + mp) * pos.quantity

        existing = existing_layers.get(pos.id)
        if existing:
            existing.work_price = wp
            existing.material_price = mp
            existing.total = total
            if price_source_id:
                existing.price_source_id = price_source_id
        else:
            db.add(PriceLayer(
                id=str(uuid.uuid4()),
                position_id=pos.id,
                layer_type="cost",
                work_price=wp,
                material_price=mp,
                total=total,
                price_source_id=price_source_id or catalog_price.price_source_id,
            ))

        updated += 1

    # Коммит намеренно убран из сервиса — роутер коммитит сам
    return {"updated": updated, "skipped_no_catalog": skipped, "skipped_no_price": no_catalog_price}


# ─── 2. Глубокое копирование структуры сметы (ветвление) ─────────────────────

async def copy_estimate_structure(
    db: AsyncSession,
    source_estimate_id: str,
    new_estimate_id: str,
) -> None:
    """
    Копирует разделы, позиции и слои цен из source_estimate_id в new_estimate_id.
    Все ID заменяются новыми, внутренние ссылки перепривязываются.
    """
    now = datetime.now(timezone.utc)

    # ── Разделы ──────────────────────────────────────────────────────────────
    sec_result = await db.execute(
        select(EstimateSection)
        .where(EstimateSection.estimate_id == source_estimate_id)
        .order_by(EstimateSection.order_index)
    )
    source_sections = sec_result.scalars().all()

    section_id_map: dict[str, str] = {}   # old_id → new_id
    new_sections_by_old: dict[str, EstimateSection] = {}

    for sec in source_sections:
        new_id = str(uuid.uuid4())
        section_id_map[sec.id] = new_id
        new_sec = EstimateSection(
            id=new_id,
            estimate_id=new_estimate_id,
            parent_id=None,  # заполним позже
            name=sec.name,
            order_index=sec.order_index,
            created_at=now,
        )
        db.add(new_sec)
        new_sections_by_old[sec.id] = new_sec

    # Перепривязываем parent_id для вложенных разделов
    for sec in source_sections:
        if sec.parent_id:
            new_sections_by_old[sec.id].parent_id = section_id_map.get(sec.parent_id)

    await db.flush()

    # ── Позиции ───────────────────────────────────────────────────────────────
    pos_result = await db.execute(
        select(EstimatePosition)
        .where(EstimatePosition.estimate_id == source_estimate_id)
        .order_by(EstimatePosition.order_index)
    )
    source_positions = pos_result.scalars().all()

    position_id_map: dict[str, str] = {}  # old_id → new_id

    for pos in source_positions:
        new_id = str(uuid.uuid4())
        position_id_map[pos.id] = new_id
        db.add(EstimatePosition(
            id=new_id,
            estimate_id=new_estimate_id,
            section_id=section_id_map.get(pos.section_id) if pos.section_id else None,
            catalog_item_id=pos.catalog_item_id,
            row_type=pos.row_type,
            name=pos.name,
            unit=pos.unit,
            quantity=pos.quantity,
            order_index=pos.order_index,
            stage_id=pos.stage_id,
            created_at=now,
            updated_at=now,
        ))

    await db.flush()

    # ── Слои цен ──────────────────────────────────────────────────────────────
    if source_positions:
        old_pos_ids = [p.id for p in source_positions]
        layer_result = await db.execute(
            select(PriceLayer).where(PriceLayer.position_id.in_(old_pos_ids))
        )
        source_layers = layer_result.scalars().all()

        for layer in source_layers:
            new_pos_id = position_id_map.get(layer.position_id)
            if not new_pos_id:
                continue
            db.add(PriceLayer(
                id=str(uuid.uuid4()),
                position_id=new_pos_id,
                layer_type=layer.layer_type,
                work_price=layer.work_price,
                material_price=layer.material_price,
                total=layer.total,
                price_source_id=layer.price_source_id,
                notes=layer.notes,
            ))

    await db.flush()


# ─── 3. Итоговые суммы по смете ───────────────────────────────────────────────

async def get_estimate_summary(db: AsyncSession, estimate_id: str) -> EstimateSummary:
    """Считает итоги по всем слоям цен для сметы."""
    estimate = await db.get(Estimate, estimate_id)
    if not estimate:
        raise ValueError(f"Смета {estimate_id} не найдена")

    pos_result = await db.execute(
        select(EstimatePosition)
        .where(EstimatePosition.estimate_id == estimate_id)
        .where(EstimatePosition.row_type == "item")
    )
    positions = pos_result.scalars().all()

    pos_ids = [p.id for p in positions]
    layers_by_type: dict[str, LayerTotals] = {}

    if pos_ids:
        pos_qty_map: dict[str, Decimal] = {p.id: p.quantity for p in positions}
        layer_result = await db.execute(
            select(PriceLayer).where(PriceLayer.position_id.in_(pos_ids))
        )
        for layer in layer_result.scalars().all():
            qty = pos_qty_map.get(layer.position_id, Decimal("1"))
            t = layers_by_type.setdefault(layer.layer_type, LayerTotals())
            t.work += layer.work_price * qty
            t.material += layer.material_price * qty

    extras = estimate.extras or {}
    return EstimateSummary(
        estimate_id=estimate_id,
        estimate_name=estimate.name,
        positions_count=len(positions),
        layers=layers_by_type,
        overhead_pct=float(extras.get("overhead_pct", 0)),
        transport_pct=float(extras.get("transport_pct", 0)),
        contingency_pct=float(extras.get("contingency_pct", 0)),
    )


# ─── 4. Сравнение двух веток ──────────────────────────────────────────────────

async def compare_estimates(
    db: AsyncSession,
    estimate_a_id: str,
    estimate_b_id: str,
) -> BranchCompareResult:
    """
    Сравнивает позиции двух смет/веток.
    Сопоставление: по catalog_item_id (приоритет) или по нормализованному имени.
    """

    async def _load(est_id: str):
        pos_r = await db.execute(
            select(EstimatePosition)
            .where(EstimatePosition.estimate_id == est_id)
            .where(EstimatePosition.row_type == "item")
        )
        positions = pos_r.scalars().all()
        pos_ids = [p.id for p in positions]
        layer_map: dict[str, dict[str, Decimal]] = {}   # pos_id → {layer_type: total}
        if pos_ids:
            lr = await db.execute(
                select(PriceLayer).where(PriceLayer.position_id.in_(pos_ids))
            )
            for lay in lr.scalars().all():
                layer_map.setdefault(lay.position_id, {})[lay.layer_type] = lay.total
        return positions, layer_map

    positions_a, layers_a = await _load(estimate_a_id)
    positions_b, layers_b = await _load(estimate_b_id)

    # Индекс B: catalog_item_id → pos (приоритет), иначе lower(name) → [pos, ...]
    # Список вместо одного значения: при дублирующихся именах берём первую незаматченную позицию
    b_by_cat: dict[str, EstimatePosition] = {}
    b_by_name: dict[str, list[EstimatePosition]] = {}
    for p in positions_b:
        if p.catalog_item_id:
            b_by_cat[p.catalog_item_id] = p
        b_by_name.setdefault(p.name.lower().strip(), []).append(p)

    matched_b_ids: set[str] = set()
    only_in_a: list[PositionDiff] = []
    changed: list[PositionDiff] = []
    unchanged_count = 0

    def _layers_for(pos_id, layer_map) -> dict[str, Decimal]:
        return layer_map.get(pos_id, {})

    for pa in positions_a:
        # Ищем пару в B
        pb = None
        if pa.catalog_item_id:
            pb = b_by_cat.get(pa.catalog_item_id)
        if pb is None:
            candidates = b_by_name.get(pa.name.lower().strip(), [])
            pb = next((c for c in candidates if c.id not in matched_b_ids), None)

        a_lay = _layers_for(pa.id, layers_a)

        if pb is None:
            only_in_a.append(PositionDiff(
                position_name=pa.name, unit=pa.unit, quantity=pa.quantity,
                a_layers=a_lay, b_layers=None, diff_type="only_a",
            ))
            continue

        matched_b_ids.add(pb.id)
        b_lay = _layers_for(pb.id, layers_b)

        # Сравниваем по всем слоям
        all_layer_types = set(a_lay) | set(b_lay)
        has_diff = any(
            abs(a_lay.get(lt, _ZERO) - b_lay.get(lt, _ZERO)) >= Decimal("0.01")
            for lt in all_layer_types
        )

        if has_diff:
            changed.append(PositionDiff(
                position_name=pa.name, unit=pa.unit, quantity=pa.quantity,
                a_layers=a_lay, b_layers=b_lay, diff_type="changed",
            ))
        else:
            unchanged_count += 1

    # Позиции только в B
    only_in_b: list[PositionDiff] = [
        PositionDiff(
            position_name=pb.name, unit=pb.unit, quantity=pb.quantity,
            a_layers=None, b_layers=_layers_for(pb.id, layers_b), diff_type="only_b",
        )
        for pb in positions_b if pb.id not in matched_b_ids
    ]

    # Итоги по каждой смете
    def _totals(positions, layer_map) -> dict[str, Decimal]:
        totals: dict[str, Decimal] = {}
        for p in positions:
            for lt, val in layer_map.get(p.id, {}).items():
                totals[lt] = totals.get(lt, _ZERO) + val
        return totals

    return BranchCompareResult(
        estimate_a_id=estimate_a_id,
        estimate_b_id=estimate_b_id,
        only_in_a=only_in_a,
        only_in_b=only_in_b,
        changed=changed,
        unchanged_count=unchanged_count,
        total_a=_totals(positions_a, layers_a),
        total_b=_totals(positions_b, layers_b),
    )
