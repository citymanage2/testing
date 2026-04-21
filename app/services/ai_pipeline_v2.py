"""
AI-пайплайн v2: нормализация входных позиций и создание сметы-черновика.

Этапы:
  1. Сопоставление с каталогом — Claude находит ближайший catalog_item для каждой позиции.
  2. Создание Estimate + EstimateSection + EstimatePosition + PriceLayer(CLIENT).
  3. Проверка достоверности — позиции без цены или источника помечаются флагом.

Принцип: Claude работает только с семантикой (сопоставление, нормализация).
Всё создание объектов в БД — Python-код.
"""
from __future__ import annotations

import uuid
import logging
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.estimate_v2 import Estimate, EstimateSection, EstimatePosition, PriceLayer
from app.models.price_source import PriceSource
from app.models.catalog_item import CatalogItem
from app.services.parse_service import ParsedPosition
from app.services import claude_service

logger = logging.getLogger(__name__)


# ─── Результат нормализации одной позиции ─────────────────────────────────────

class NormalizedPosition:
    __slots__ = (
        "parsed", "catalog_item_id", "normalized_name",
        "normalized_unit", "needs_review",
    )

    def __init__(
        self,
        parsed: ParsedPosition,
        catalog_item_id: Optional[str] = None,
        normalized_name: Optional[str] = None,
        normalized_unit: Optional[str] = None,
        needs_review: bool = False,
    ):
        self.parsed = parsed
        self.catalog_item_id = catalog_item_id
        self.normalized_name = normalized_name or parsed.name
        self.normalized_unit = normalized_unit or parsed.unit
        self.needs_review = needs_review


# ─── Промпт сопоставления с каталогом ────────────────────────────────────────

_MATCH_SYSTEM = """Ты — ИИ-помощник сметчика. Твоя задача — сопоставить позиции входной сметы с каталогом работ и материалов компании.

Верни СТРОГО JSON-массив без markdown. Каждый элемент:
{
  "input_index": 0,
  "catalog_id": "uuid или null если нет совпадения",
  "normalized_name": "нормализованное наименование",
  "normalized_unit": "нормализованная ед.изм.",
  "needs_review": false,
  "review_reason": ""
}

Правила:
- catalog_id: uuid из каталога если есть близкое совпадение (семантическое, не точное), иначе null.
- normalized_name: приведи к стандартному наименованию из каталога или, если нет совпадения, исправь орфографию.
- normalized_unit: приведи к стандарту (м2, м3, п.м, шт, кг, т, компл, услуга).
- needs_review: true если цена 0 (нет цены заказчика) или наименование неоднозначное.
- Не придумывай catalog_id. Используй только те, что в каталоге ниже.
"""

# Лимит позиций в одном запросе к Claude (чтобы не превышать контекст)
_BATCH_SIZE = 50


async def normalize_positions(
    positions: list[ParsedPosition],
    catalog_items: list[CatalogItem],
) -> list[NormalizedPosition]:
    """
    Сопоставляет позиции с каталогом через Claude.
    Возвращает список NormalizedPosition.

    Принцип безопасности:
    - catalog_id от Claude проверяется против известного набора ID из каталога.
    - При провале AI или неожиданном формате ответа — needs_review=True (консервативно).
    """
    if not positions:
        return []

    # Строим множество допустимых ID для быстрой проверки
    valid_catalog_ids: set[str] = {item.id for item in catalog_items}

    # Формируем компактный каталог для промпта
    catalog_text = "\n".join(
        f'{item.id} | {item.item_type} | {item.name} | {item.unit}'
        for item in catalog_items
    ) or "Каталог пуст."

    normalized: list[NormalizedPosition] = []

    for batch_start in range(0, len(positions), _BATCH_SIZE):
        batch = positions[batch_start:batch_start + _BATCH_SIZE]

        input_text = "\n".join(
            f'{i} | {p.name} | {p.unit} | wp={p.client_work_price} mp={p.client_material_price}'
            for i, p in enumerate(batch)
        )

        prompt = (
            f"=== Каталог компании ===\n{catalog_text}\n\n"
            f"=== Входные позиции (index | name | unit | цены) ===\n{input_text}\n\n"
            "Верни JSON-массив сопоставлений."
        )

        ai_failed = False
        try:
            result = await claude_service.complete_json(
                system=_MATCH_SYSTEM,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=8000,
                model=claude_service.SONNET,
            )
        except Exception as e:
            logger.warning("Ошибка сопоставления с каталогом: %s. Все позиции батча помечены needs_review.", e)
            result = []
            ai_failed = True

        # Строим индекс ответов Claude
        match_map: dict[int, dict] = {}
        if isinstance(result, list):
            for m in result:
                if isinstance(m, dict) and "input_index" in m:
                    match_map[int(m["input_index"])] = m
        else:
            # Claude вернул dict или что-то неожиданное — считаем провалом
            logger.warning(
                "normalize_positions: неожиданный тип ответа Claude (%s). "
                "Все позиции батча помечены needs_review.",
                type(result).__name__,
            )
            ai_failed = True

        for i, parsed in enumerate(batch):
            m = match_map.get(i, {})

            # Валидируем catalog_id: принимаем только UUID, известные нам из каталога
            raw_id = m.get("catalog_id") or None
            catalog_item_id: str | None = None
            if raw_id and raw_id in valid_catalog_ids:
                catalog_item_id = raw_id
            elif raw_id:
                logger.warning(
                    "normalize_positions: Claude вернул несуществующий catalog_id=%r для позиции %r. Игнорируем.",
                    raw_id, parsed.name,
                )

            # При провале AI помечаем needs_review=True (консервативно)
            needs_review = ai_failed or bool(m.get("needs_review", False))

            normalized.append(NormalizedPosition(
                parsed=parsed,
                catalog_item_id=catalog_item_id,
                normalized_name=m.get("normalized_name") or parsed.name,
                normalized_unit=m.get("normalized_unit") or parsed.unit,
                needs_review=needs_review,
            ))

    return normalized


# ─── Создание сметы-черновика в БД ────────────────────────────────────────────

async def create_draft_estimate(
    db: AsyncSession,
    project_id: str,
    estimate_name: str,
    normalized: list[NormalizedPosition],
    created_by: str,
    source_name: str = "Смета заказчика",
    source_type: str = "pricelist",
) -> Estimate:
    """
    Создаёт смету-черновик из нормализованных позиций:
    - 1 PriceSource (CLIENT)
    - 1 Estimate (draft)
    - EstimateSection для каждой уникальной секции
    - EstimatePosition + PriceLayer(CLIENT) для каждой позиции
    """
    now = datetime.now(timezone.utc)

    # Источник цен — документ заказчика
    price_source = PriceSource(
        id=str(uuid.uuid4()),
        name=source_name,
        source_type=source_type,
        reference_date=date.today(),
        created_at=now,
    )
    db.add(price_source)

    # Смета
    estimate = Estimate(
        id=str(uuid.uuid4()),
        project_id=project_id,
        name=estimate_name,
        status="draft",
        is_locked=False,
        estimate_type="client",
        calculation_method="ai",
        created_by=created_by,
        created_at=now,
        updated_at=now,
    )
    db.add(estimate)
    await db.flush()  # нужен id до создания разделов

    # Разделы — уникальные section из позиций, порядок сохраняется
    section_map: dict[str, EstimateSection] = {}
    section_order = 0
    for np in normalized:
        sec_name = np.parsed.section or ""
        if sec_name and sec_name not in section_map:
            sec = EstimateSection(
                id=str(uuid.uuid4()),
                estimate_id=estimate.id,
                name=sec_name,
                order_index=section_order,
                created_at=now,
            )
            db.add(sec)
            section_map[sec_name] = sec
            section_order += 1

    await db.flush()  # нужны id разделов

    # Позиции + слои цен — все добавляем без промежуточных flush.
    # pos.id известен заранее (uuid4), поэтому PriceLayer(position_id=pos.id) корректен
    # без отдельного flush на каждую позицию.
    for np in normalized:
        sec_obj = section_map.get(np.parsed.section or "")
        pos_id = str(uuid.uuid4())
        pos = EstimatePosition(
            id=pos_id,
            estimate_id=estimate.id,
            section_id=sec_obj.id if sec_obj else None,
            catalog_item_id=np.catalog_item_id,
            row_type=np.parsed.row_type,
            name=np.normalized_name,
            unit=np.normalized_unit,
            quantity=Decimal(str(np.parsed.quantity)),
            order_index=np.parsed.order_index,
            created_at=now,
            updated_at=now,
        )
        db.add(pos)

        # Слой CLIENT — цена заказчика (даже если 0, слой создаём всегда)
        wp = Decimal(str(np.parsed.client_work_price))
        mp = Decimal(str(np.parsed.client_material_price))
        total = (wp + mp) * pos.quantity
        layer = PriceLayer(
            id=str(uuid.uuid4()),
            position_id=pos_id,
            layer_type="client",
            work_price=wp,
            material_price=mp,
            total=total,
            price_source_id=price_source.id,
            notes="требует проверки" if np.needs_review else None,
        )
        db.add(layer)

    await db.commit()
    await db.refresh(estimate)
    return estimate


# ─── Точка входа: полный пайплайн ────────────────────────────────────────────

async def run_import_pipeline(
    db: AsyncSession,
    project_id: str,
    estimate_name: str,
    positions: list[ParsedPosition],
    created_by: str,
    source_name: str = "Смета заказчика",
    use_ai_normalization: bool = True,
) -> tuple[Estimate, int, int]:
    """
    Полный пайплайн импорта:
      1. Загрузка каталога из БД.
      2. AI-нормализация (опционально).
      3. Создание черновика сметы.

    Возвращает (estimate, total_positions, needs_review_count).
    """
    # Загружаем каталог (активные позиции), детерминированный порядок по имени
    _CATALOG_LIMIT = 500
    catalog_items: list[CatalogItem] = []
    if use_ai_normalization:
        result = await db.execute(
            select(CatalogItem)
            .where(CatalogItem.is_active.is_(True))
            .order_by(CatalogItem.name)
            .limit(_CATALOG_LIMIT)
        )
        catalog_items = list(result.scalars().all())
        if len(catalog_items) == _CATALOG_LIMIT:
            logger.warning(
                "run_import_pipeline: каталог обрезан до %d позиций. "
                "Позиции за пределами лимита недоступны для AI-сопоставления.",
                _CATALOG_LIMIT,
            )

    # Нормализация
    if use_ai_normalization and positions:
        normalized = await normalize_positions(positions, catalog_items)
    else:
        # Без AI — заворачиваем ParsedPosition в NormalizedPosition как есть
        normalized = [NormalizedPosition(p, needs_review=(p.client_work_price == 0 and p.row_type == "item")) for p in positions]

    # Создание черновика
    estimate = await create_draft_estimate(
        db=db,
        project_id=project_id,
        estimate_name=estimate_name,
        normalized=normalized,
        created_by=created_by,
        source_name=source_name,
    )

    total = sum(1 for n in normalized if n.parsed.row_type == "item")
    needs_review = sum(1 for n in normalized if n.needs_review and n.parsed.row_type == "item")

    return estimate, total, needs_review
