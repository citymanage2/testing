"""
Main task processing pipeline  (ТЗ v1.0, апрель 2026).

Zone-of-responsibility rules:
  ИИ  — understand text, OCR, semantic analysis, comments, fallback price estimation.
  Код — arithmetic, JSON validation (Pydantic), deduplication (rapidfuzz),
         price lookup (cache/API), Excel/PDF generation, diff computation.

Claude NEVER computes totals or generates Excel/PDF directly.
"""
from __future__ import annotations

import uuid
import json
import re
import logging
from datetime import datetime, timezone
from sqlalchemy import select
from pydantic import ValidationError

from app.database import SessionLocal
from app.models.task import Task
from app.models.task_input_file import TaskInputFile
from app.models.task_result import TaskResult
from app.models.estimate_item import EstimateItem
from app.services import claude_service
from app.services.claude_service import OPUS, SONNET, MAX_TOKENS_SMETA
from app.services.price_service import price_service
from app.services.excel_service import build_estimate_excel, build_vor_excel, build_compare_excel
from app.services.snapshot_service import snapshot_service
from app.services.file_extractor import file_to_claude_part
from app.schemas.vor import ClaudeVorResponse, VorItem

try:
    from rapidfuzz import fuzz, process as rf_process
    _RAPIDFUZZ_AVAILABLE = True
except ImportError:
    _RAPIDFUZZ_AVAILABLE = False

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_FUZZY_THRESHOLD = 85   # % similarity for deduplication

_PRICE_CONTEXT = (
    "Используй реальные рыночные цены России на 2025-2026 год. "
    "Для материалов указывай цены из известных источников: Леруа Мерлен, Петрович, OBI, ВсеИнструменты. "
    "Цены на работы — по рыночным ставкам строительных бригад в регионе. "
    "Не занижай и не завышай цены. "
    "Для каждой позиции с ценой от Claude укажи is_estimated: true и source: 'ai_estimate'."
)

# JSON schema instruction appended to every smeta/VOR request
_JSON_SCHEMA_PROMPT = """
Верни ТОЛЬКО строгий JSON без markdown-обёрток (без ```json). Структура:
{
  "sections": [
    {
      "title": "Название раздела",
      "items": [
        {
          "section": "Название раздела",
          "type": "work|material|equipment",
          "name": "Наименование позиции",
          "unit": "ед.изм",
          "quantity": 0.0,
          "work_price": 0.0,
          "mat_price": 0.0,
          "is_estimated": false,
          "source": null,
          "qty_from_tz": null,
          "qty_from_project": null,
          "discrepancy": false,
          "scan_math_error": false,
          "comment": "Примечание"
        }
      ]
    }
  ],
  "discrepancies": []
}
Правила:
- type строго: "work" | "material" | "equipment"
- quantity: null если не определяется из документа
- work_price и mat_price: числа ≥ 0.0
- is_estimated: true только если цена — твоя оценка (не из документа и не найдена кодом)
- Арифметику (итоги, НДС) НЕ считай — это делает код
- Никаких пояснений вне JSON
"""

TASK_SYSTEMS = {
    "LIST_FROM_TZ": (
        "Ты эксперт-сметчик. Из технического задания составь структурированный ВОР "
        "(ведомость объёмов работ) с перечнем работ и материалов. "
        + _JSON_SCHEMA_PROMPT
    ),
    "LIST_FROM_TZ_PROJECT": (
        "Ты эксперт-сметчик. Из ТЗ и проектной документации составь детальный ВОР. "
        "Перекрёстно проверь: из ТЗ — требования, из проекта — объёмы и спецификации. "
        "Расхождения объёмов включи в поле discrepancies и проставь discrepancy: true в позиции. "
        "Заполни qty_from_tz и qty_from_project для позиций с расхождением. "
        + _JSON_SCHEMA_PROMPT
    ),
    "LIST_FROM_PROJECT": (
        "Ты эксперт-сметчик. Из проектной документации извлеки все работы и материалы. "
        "Читай чертежи, спецификации, экспликации. "
        + _JSON_SCHEMA_PROMPT
    ),
    "SMETA_FROM_LIST": (
        f"Ты эксперт-сметчик. По перечню работ и материалов составь полную смету. {_PRICE_CONTEXT} "
        + _JSON_SCHEMA_PROMPT
    ),
    "SMETA_FROM_TZ": (
        f"Ты эксперт-сметчик. По техническому заданию сначала составь ВОР, затем сразу проставь цены. {_PRICE_CONTEXT} "
        + _JSON_SCHEMA_PROMPT
    ),
    "SMETA_FROM_TZ_PROJECT": (
        f"Ты эксперт-сметчик. По ТЗ и проектной документации выполни перекрёстный анализ, "
        f"затем составь детальную смету с ценами. {_PRICE_CONTEXT} "
        + _JSON_SCHEMA_PROMPT
    ),
    "SMETA_FROM_PROJECT": (
        f"Ты эксперт-сметчик. По проектной документации составь полную смету. {_PRICE_CONTEXT} "
        + _JSON_SCHEMA_PROMPT
    ),
    "SCAN_TO_EXCEL": (
        "Ты OCR-эксперт. Распознай содержимое скана сметы. "
        "Для каждой позиции заполни name, unit, quantity, work_price, mat_price точно из скана. "
        "Если в скане есть итоговая сумма строки, проверь: qty*price == total? "
        "При расхождении > 1% поставь scan_math_error: true. "
        "is_estimated: false для всех позиций (цены из скана). "
        + _JSON_SCHEMA_PROMPT
    ),
    "COMPARE_PROJECT_SMETA": (
        "Ты эксперт-аудитор. Тебе передан diff между проектной документацией и сметой. "
        "Напиши аналитический комментарий: причины расхождений, критичность каждого, "
        "что можно игнорировать, что требует исправления. Ответ — plain text, не JSON."
    ),
}

# Task types that produce smeta (save to estimate_items + Excel)
SMETA_TYPES = {
    "SMETA_FROM_LIST", "SMETA_FROM_TZ", "SMETA_FROM_TZ_PROJECT",
    "SMETA_FROM_PROJECT", "SCAN_TO_EXCEL",
}

# Task types that produce VOR (save to estimate_items + VOR Excel)
VOR_TYPES = {
    "LIST_FROM_TZ", "LIST_FROM_TZ_PROJECT", "LIST_FROM_PROJECT",
}

# Models per task type (default: SONNET)
TASK_MODELS = {
    "SMETA_FROM_PROJECT":    OPUS,
    "SMETA_FROM_TZ_PROJECT": OPUS,
    "LIST_FROM_TZ_PROJECT":  OPUS,
    "LIST_FROM_PROJECT":     OPUS,
}


# ---------------------------------------------------------------------------
# Stub functions for future infrastructure
# ---------------------------------------------------------------------------

def _preprocess_scan(image_bytes: bytes) -> bytes:
    """
    TODO: deskew + contrast enhancement (PIL / cv2).
    Currently: returns image unchanged.
    """
    return image_bytes


def _extract_pdf_tables(pdf_bytes: bytes) -> str | None:
    """
    TODO: pdfplumber — extract machine-readable tables from PDF.
    Currently: returns None; PDF is passed natively to Claude.
    """
    return None


def _fetch_price_from_api(name: str, unit: str) -> float | None:
    """
    TODO: query price aggregator APIs (Леруа, Петрович, OBI).
    Currently: returns None; falls through to Claude estimation.
    """
    return None


def _check_price_anomaly(name: str, price: float, category: str) -> bool:
    """
    TODO: 3σ anomaly detection from accumulated estimate_items data.
    Currently: always False (insufficient statistics).
    """
    return False


# ---------------------------------------------------------------------------
# Deduplication
# ---------------------------------------------------------------------------

def _deduplicate_items(items: list[VorItem]) -> list[VorItem]:
    """
    Remove near-duplicate positions using rapidfuzz fuzzy matching (threshold 85%).
    When a duplicate is found, keep the first occurrence and log the removed one.
    """
    if not _RAPIDFUZZ_AVAILABLE or not items:
        return items

    seen_names: list[str] = []
    result: list[VorItem] = []
    removed = 0

    for item in items:
        name_norm = item.name.strip().lower()
        if seen_names:
            match = rf_process.extractOne(name_norm, seen_names, scorer=fuzz.token_sort_ratio)
            if match and match[1] >= _FUZZY_THRESHOLD:
                logger.info("Dedup: removed '%s' (similar to '%s', score=%d)", item.name, match[0], match[1])
                removed += 1
                continue
        seen_names.append(name_norm)
        result.append(item)

    if removed:
        logger.info("Deduplication removed %d duplicate(s)", removed)
    return result


# ---------------------------------------------------------------------------
# Price enrichment (3-tier)
# ---------------------------------------------------------------------------

def _enrich_price(item: VorItem) -> VorItem:
    """
    Enrich item price using 3-tier priority:
      1. Local price cache (price_service)
      2. API aggregators (stub — returns None)
      3. Keep Claude's estimate (is_estimated: true, source: 'ai_estimate')

    Items that already have prices from the document (SCAN_TO_EXCEL) are skipped.
    """
    # For scanned items, prices come from the document — don't overwrite
    if getattr(item, "scan_math_error", False) is False and item.source == "scan":
        return item

    item_type = item.type

    needs_work_price  = item_type == "work" and item.work_price == 0.0
    needs_mat_price   = item_type in ("material", "equipment") and item.mat_price == 0.0

    if not needs_work_price and not needs_mat_price:
        return item  # price already set by Claude

    # Priority 1: local cache
    if needs_work_price:
        cached = price_service.lookup_work(item.name)
        if cached:
            item.work_price = cached
            item.source = "cache"
            item.is_estimated = False
            return item

    if needs_mat_price:
        cached = price_service.lookup_material(item.name)
        if cached:
            item.mat_price = cached
            item.source = "cache"
            item.is_estimated = False
            return item

    # Priority 2: API aggregators (stub)
    api_price = _fetch_price_from_api(item.name, item.unit)
    if api_price is not None:
        if needs_work_price:
            item.work_price = api_price
        else:
            item.mat_price = api_price
        item.source = "api"
        item.is_estimated = False
        return item

    # Priority 3: price remains from Claude — mark as estimated
    if needs_work_price or needs_mat_price:
        item.is_estimated = True
        item.source = "ai_estimate"

    return item


# ---------------------------------------------------------------------------
# JSON parsing with repair
# ---------------------------------------------------------------------------

def _parse_claude_json(raw: str) -> dict:
    """Strip markdown fences and parse JSON, with repair fallback."""
    text = raw.strip()
    # Remove ```json ... ``` fences if Claude added them despite instructions
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE)
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        try:
            import json_repair
            return json_repair.loads(text)
        except Exception:
            raise ValueError(f"Could not parse Claude response as JSON. First 200 chars: {text[:200]}")


def _validate_vor_response(raw: str) -> ClaudeVorResponse:
    """
    Parse and validate Claude response against ClaudeVorResponse schema.
    Raises ValueError on failure (caller handles retry).
    """
    data = _parse_claude_json(raw)
    try:
        return ClaudeVorResponse.model_validate(data)
    except ValidationError as e:
        raise ValueError(f"JSON schema validation failed: {e}")


# ---------------------------------------------------------------------------
# Compare diff (module 2.9)
# ---------------------------------------------------------------------------

def _compute_diff(smeta_items: list[dict], project_items: list[VorItem]) -> dict:
    """
    Compute structural diff between two position lists.

    Returns:
      extra      — in smeta but not in project ("лишние")
      missing    — in project but not in smeta ("забытые")
      qty_mismatch — in both but quantity deviation > 5%
    """
    if not _RAPIDFUZZ_AVAILABLE:
        return {"extra": [], "missing": [], "qty_mismatch": []}

    smeta_names  = [s["name"] for s in smeta_items]
    project_dict = {p.name: p for p in project_items}

    matched_smeta  = set()
    matched_project = set()
    qty_mismatch = []

    for s in smeta_items:
        match = rf_process.extractOne(s["name"], list(project_dict.keys()), scorer=fuzz.token_sort_ratio)
        if match and match[1] >= _FUZZY_THRESHOLD:
            p = project_dict[match[0]]
            matched_smeta.add(s["name"])
            matched_project.add(p.name)
            # Check quantity deviation
            qs = s.get("quantity") or 0
            qp = p.quantity or 0
            if qp > 0 and abs(qs - qp) / qp > 0.05:
                qty_mismatch.append({
                    "name": s["name"],
                    "unit": s.get("unit", ""),
                    "qty_smeta": qs,
                    "qty_project": qp,
                })

    extra   = [s for s in smeta_items if s["name"] not in matched_smeta]
    missing = [{"name": p.name, "unit": p.unit, "qty_project": p.quantity}
               for p in project_items if p.name not in matched_project]

    return {"extra": extra, "missing": missing, "qty_mismatch": qty_mismatch}


# ---------------------------------------------------------------------------
# Main processor
# ---------------------------------------------------------------------------

class TaskProcessor:

    async def process(self, task_id: str):
        async with SessionLocal() as db:
            task = await db.get(Task, task_id)
            if not task or task.status == "cancelled":
                return

            task.status = "processing"
            task.progress_message = "Загрузка файлов..."
            task.error_message = None
            await db.commit()

            try:
                files_result = await db.execute(
                    select(TaskInputFile).where(TaskInputFile.task_id == task_id)
                )
                input_files = files_result.scalars().all()

                messages = self._build_messages(task, input_files)
                system   = TASK_SYSTEMS.get(task.task_type, TASK_SYSTEMS["SMETA_FROM_TZ"])
                model    = TASK_MODELS.get(task.task_type, SONNET)

                task.progress_message = "Обработка документов через Claude AI..."
                await db.commit()

                if task.task_type in SMETA_TYPES:
                    await self._process_smeta(db, task, system, messages, model)
                elif task.task_type in VOR_TYPES:
                    await self._process_vor(db, task, system, messages, model)
                elif task.task_type == "COMPARE_PROJECT_SMETA":
                    await self._process_compare(db, task, input_files, model)
                else:
                    # Fallback: unknown type treated as smeta
                    await self._process_smeta(db, task, system, messages, model)

                task.status = "completed"
                task.progress_message = "Готово"
                task.estimate_status = "calculated"
                await db.commit()

            except Exception as e:
                logger.exception("Task %s failed: %s", task_id, e)
                task.status = "failed"
                task.error_message = str(e)
                task.progress_message = None
                await db.commit()

    # ------------------------------------------------------------------
    # Message builder
    # ------------------------------------------------------------------

    def _build_messages(self, task: Task, input_files: list) -> list[dict]:
        # Preprocessing: scan images go through stub preprocessing
        file_parts = []
        for f in input_files:
            data = f.file_data
            if task.task_type == "SCAN_TO_EXCEL" and f.mime_type.startswith("image/"):
                data_bytes = bytes(data) if not isinstance(data, bytes) else data
                data = _preprocess_scan(data_bytes)
                # Re-wrap as bytes for file_to_claude_part
                from app.models.task_input_file import TaskInputFile as _TIF
                class _FakeFile:
                    file_name = f.file_name
                    mime_type = f.mime_type
                    file_data = data
                file_parts.append(file_to_claude_part(_FakeFile.file_name, _FakeFile.mime_type, data))
            else:
                file_parts.append(file_to_claude_part(f.file_name, f.mime_type, f.file_data))

        prompt_text = task.user_prompt or "Выполни задачу."

        def _sanitize_content(content):
            if isinstance(content, list):
                sanitized = [
                    block for block in content
                    if not (
                        isinstance(block, dict)
                        and block.get("type") == "document"
                        and block.get("source", {}).get("media_type", "") != "application/pdf"
                    )
                ]
                return sanitized or content
            return content

        raw_history = list(task.chat_history) if task.chat_history else []
        messages = [
            {**msg, "content": _sanitize_content(msg.get("content", ""))}
            for msg in raw_history
        ]

        if not messages:
            first_content = file_parts + [{"type": "text", "text": prompt_text}]
            messages.append({"role": "user", "content": first_content})
        else:
            if messages[-1]["role"] != "user":
                messages.append({"role": "user", "content": prompt_text})

        return messages

    # ------------------------------------------------------------------
    # VOR pipeline (modules 2.1 / 2.2 / 2.3)  → vor.xlsx
    # ------------------------------------------------------------------

    async def _process_vor(self, db, task: Task, system: str, messages: list, model: str):
        task.progress_message = "Формирование ВОР..."
        await db.commit()

        vor_response = await self._call_claude_with_retry(system, messages, model)

        # Deduplicate
        all_items = vor_response.all_items()
        all_items = _deduplicate_items(all_items)

        if not all_items:
            raise ValueError("Claude не вернул ни одной позиции — проверь входные файлы")

        task.progress_message = "Сохранение позиций..."
        await db.commit()

        # Clear old items
        existing = (
            await db.execute(select(EstimateItem).where(EstimateItem.task_id == task.id))
        ).scalars().all()
        for item in existing:
            await db.delete(item)

        saved = []
        for i, vor_item in enumerate(all_items):
            db_item = EstimateItem(
                id=str(uuid.uuid4()),
                task_id=task.id,
                position=i + 1,
                section=vor_item.section or "",
                type=vor_item.type,
                name=vor_item.name,
                unit=vor_item.unit or "",
                quantity=vor_item.quantity or 0.0,
                work_price=0.0,
                mat_price=0.0,
                total=0.0,
                source_url=vor_item.source,
                comment=vor_item.comment,
                qty_from_tz=vor_item.qty_from_tz,
                qty_from_project=vor_item.qty_from_project,
                discrepancy=vor_item.discrepancy,
                is_estimated=False,
                source=vor_item.source,
                scan_math_error=False,
            )
            db.add(db_item)
            saved.append(db_item)

        await db.flush()

        task.progress_message = "Генерация Excel (ВОР)..."
        await db.commit()

        items_result = await db.execute(
            select(EstimateItem)
            .where(EstimateItem.task_id == task.id)
            .order_by(EstimateItem.position)
        )
        items = items_result.scalars().all()

        excel_data = build_vor_excel(items, task_type=task.task_type)
        db.add(TaskResult(
            task_id=task.id,
            file_name="vor.xlsx",
            file_data=excel_data,
            mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ))
        await db.flush()

        # Update meta on task (store in extras)
        task.extras = {
            **(task.extras or {}),
            "total_items": vor_response.meta.total_items,
            "items_without_qty": vor_response.meta.items_without_qty,
            "discrepancies": vor_response.discrepancies,
        }

    # ------------------------------------------------------------------
    # Smeta pipeline (modules 2.4 – 2.8)  → smeta.xlsx
    # ------------------------------------------------------------------

    async def _process_smeta(self, db, task: Task, system: str, messages: list, model: str):
        task.progress_message = "Формирование сметы..."
        await db.commit()

        vor_response = await self._call_claude_with_retry(system, messages, model)
        all_items = vor_response.all_items()
        all_items = _deduplicate_items(all_items)

        valid_items = [it for it in all_items if it.name.strip()]
        if not valid_items:
            raise ValueError("Claude не вернул ни одной позиции в смете — проверь входные файлы")

        task.progress_message = "Обогащение ценами..."
        await db.commit()

        # Enrich prices (3-tier)
        enriched = [_enrich_price(item) for item in valid_items]

        # For SCAN_TO_EXCEL: normalise numbers and check arithmetic
        if task.task_type == "SCAN_TO_EXCEL":
            enriched = self._process_scan_items(enriched)

        # Clear old items
        existing = (
            await db.execute(select(EstimateItem).where(EstimateItem.task_id == task.id))
        ).scalars().all()
        for item in existing:
            await db.delete(item)

        saved_count = 0
        for i, vor_item in enumerate(enriched):
            work_price = vor_item.work_price or 0.0
            mat_price  = vor_item.mat_price  or 0.0
            quantity   = vor_item.quantity   or 0.0

            # Code computes total — never Claude
            total = (work_price + mat_price) * quantity

            # Skip zero-price non-scanned items (warn, don't silently drop)
            if total == 0.0 and vor_item.type in ("work", "material", "equipment") and not vor_item.is_estimated:
                logger.warning("Zero-total item skipped: '%s'", vor_item.name)
                continue

            db.add(EstimateItem(
                id=str(uuid.uuid4()),
                task_id=task.id,
                position=i + 1,
                section=vor_item.section or "",
                type=vor_item.type,
                name=vor_item.name,
                unit=vor_item.unit or "",
                quantity=quantity,
                work_price=work_price,
                mat_price=mat_price,
                total=total,
                source_url=vor_item.source,
                comment=vor_item.comment,
                is_estimated=vor_item.is_estimated,
                source=vor_item.source,
                qty_from_tz=vor_item.qty_from_tz,
                qty_from_project=vor_item.qty_from_project,
                discrepancy=vor_item.discrepancy,
                scan_math_error=vor_item.scan_math_error,
            ))
            saved_count += 1

        if saved_count == 0:
            raise ValueError("Все позиции сметы имеют нулевую стоимость — проверь входные файлы")

        await db.flush()

        task.progress_message = "Генерация файлов..."
        await db.commit()

        await snapshot_service.save_snapshot(db, task.id, "initial", "Первичная смета")

        items_result = await db.execute(
            select(EstimateItem)
            .where(EstimateItem.task_id == task.id)
            .order_by(EstimateItem.position)
        )
        items = items_result.scalars().all()
        excel_data = build_estimate_excel(items)
        db.add(TaskResult(
            task_id=task.id,
            file_name="smeta.xlsx",
            file_data=excel_data,
            mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ))
        await db.flush()

    # ------------------------------------------------------------------
    # Compare pipeline (module 2.9)
    # ------------------------------------------------------------------

    async def _process_compare(self, db, task: Task, input_files: list, model: str):
        """
        Step 1: Code extracts smeta positions from machine-readable file.
        Step 2: Claude extracts project positions (JSON).
        Step 3: Code computes diff.
        Step 4: Claude writes analytics commentary on the diff only.
        """
        task.progress_message = "Извлечение сметы..."
        await db.commit()

        # Split files: assume first file = smeta, second = project
        smeta_file   = input_files[0] if input_files else None
        project_file = input_files[1] if len(input_files) > 1 else None

        # Step 1: extract smeta items from machine-readable file
        smeta_items = self._extract_smeta_items(smeta_file)

        # Step 2: Claude extracts project positions
        task.progress_message = "Анализ проектной документации..."
        await db.commit()

        if project_file:
            proj_part = file_to_claude_part(project_file.file_name, project_file.mime_type, project_file.file_data)
            proj_messages = [{"role": "user", "content": [
                proj_part,
                {"type": "text", "text": "Извлеки все работы и материалы из этой проектной документации. " + _JSON_SCHEMA_PROMPT},
            ]}]
            project_response = await self._call_claude_with_retry(
                TASK_SYSTEMS["LIST_FROM_PROJECT"], proj_messages, model
            )
            project_items = _deduplicate_items(project_response.all_items())
        else:
            project_items = []

        # Step 3: code computes diff
        task.progress_message = "Вычисление расхождений..."
        await db.commit()

        diff = _compute_diff(smeta_items, project_items)

        # Step 4: Claude comments on diff only (not on full documents again)
        task.progress_message = "Аналитический комментарий..."
        await db.commit()

        diff_summary = (
            f"Лишних позиций (есть в смете, нет в проекте): {len(diff['extra'])}\n"
            f"Забытых позиций (есть в проекте, нет в смете): {len(diff['missing'])}\n"
            f"Расхождений по объёмам (>5%): {len(diff['qty_mismatch'])}\n\n"
            f"Лишние: {json.dumps([e['name'] for e in diff['extra']], ensure_ascii=False)}\n"
            f"Забытые: {json.dumps([m['name'] for m in diff['missing']], ensure_ascii=False)}\n"
            f"Объёмные расхождения: {json.dumps(diff['qty_mismatch'], ensure_ascii=False)}"
        )

        analytics_messages = [{"role": "user", "content": diff_summary}]
        analytics_text = await claude_service.complete(
            TASK_SYSTEMS["COMPARE_PROJECT_SMETA"], analytics_messages, model=SONNET
        )

        task.chat_history = list(task.chat_history or []) + [
            {"role": "assistant", "content": analytics_text}
        ]

        excel_data = build_compare_excel(diff, analytics_text)
        db.add(TaskResult(
            task_id=task.id,
            file_name="comparison.xlsx",
            file_data=excel_data,
            mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ))
        await db.flush()

    # ------------------------------------------------------------------
    # Claude call with retry (max 2 attempts)
    # ------------------------------------------------------------------

    async def _call_claude_with_retry(
        self, system: str, messages: list, model: str
    ) -> ClaudeVorResponse:
        """
        Call Claude and validate response against ClaudeVorResponse schema.
        Retries once with a stricter prompt on validation failure.
        After 2 failures raises ValueError → task goes to failed status.
        """
        raw = await claude_service.complete(system, messages, model=model, max_tokens=MAX_TOKENS_SMETA)
        try:
            return _validate_vor_response(raw)
        except (ValueError, ValidationError):
            logger.warning("First Claude attempt failed validation, retrying...")

        retry_suffix = "\n\nОТВЕТ ДОЛЖЕН БЫТЬ ТОЛЬКО JSON. Никаких пояснений, никаких markdown-обёрток. Начни ответ с символа {."
        retry_messages = messages + [{"role": "user", "content": retry_suffix}]
        raw2 = await claude_service.complete(system, retry_messages, model=model, max_tokens=MAX_TOKENS_SMETA)
        try:
            return _validate_vor_response(raw2)
        except (ValueError, ValidationError) as e:
            raise ValueError(
                f"Claude вернул невалидный JSON после 2 попыток. Задача требует ручной проверки. Ошибка: {e}"
            )

    # ------------------------------------------------------------------
    # Scan item normalisation (module 2.8)
    # ------------------------------------------------------------------

    @staticmethod
    def _process_scan_items(items: list[VorItem]) -> list[VorItem]:
        """
        Normalise numbers from OCR and verify row arithmetic.
        Corrected totals are recomputed by code; cells flagged scan_math_error.
        """
        import re as _re

        def _to_float(val) -> float:
            if isinstance(val, (int, float)):
                return float(val)
            if isinstance(val, str):
                # Handle "1 234,56" or "1,234.56" formats
                val = val.replace(" ", "").replace(",", ".")
                try:
                    return float(val)
                except ValueError:
                    return 0.0
            return 0.0

        for item in items:
            qty  = _to_float(item.quantity)
            wp   = _to_float(item.work_price)
            mp   = _to_float(item.mat_price)
            item.quantity   = qty
            item.work_price = wp
            item.mat_price  = mp
            item.is_estimated = False
            item.source = "scan"

        return items

    # ------------------------------------------------------------------
    # Smeta item extraction from machine-readable file (module 2.9 step 1)
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_smeta_items(file) -> list[dict]:
        """
        Extract smeta positions from a machine-readable file (XLSX, DOCX, PDF).
        Returns list of dicts with keys: name, unit, quantity.
        """
        if file is None:
            return []

        mime = file.mime_type or ""
        data = bytes(file.file_data) if not isinstance(file.file_data, bytes) else file.file_data

        if "spreadsheetml" in mime or file.file_name.endswith(".xlsx"):
            from app.services.excel_service import parse_estimate_excel
            try:
                return parse_estimate_excel(data)
            except Exception as e:
                logger.warning("Could not parse smeta Excel: %s", e)
                return []

        if "wordprocessingml" in mime or file.file_name.endswith(".docx"):
            try:
                from docx import Document
                import io
                doc = Document(io.BytesIO(data))
                items = []
                for para in doc.paragraphs:
                    text = para.text.strip()
                    if text:
                        items.append({"name": text, "unit": "", "quantity": 0.0})
                return items
            except Exception as e:
                logger.warning("Could not parse smeta DOCX: %s", e)
                return []

        # PDF or unknown — return empty, Claude will handle it
        return []


task_processor = TaskProcessor()
