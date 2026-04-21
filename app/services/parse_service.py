"""
Сервис парсинга входных файлов для архитектуры v2.

Поддерживает:
  - Excel (.xlsx) произвольного формата — смета заказчика.
  - PDF — смета или ТЗ (через Claude vision/document API).
  - DOCX — ТЗ в текстовом виде (через Claude text API).

Возвращает список ParsedPosition — промежуточная нормализованная структура,
единая для всех форматов входных данных.
"""
from __future__ import annotations

import io
import logging
import re
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


# ─── Промежуточная структура ──────────────────────────────────────────────────

@dataclass
class ParsedPosition:
    name: str
    unit: str = "шт"
    quantity: float = 1.0
    section: str = ""
    order_index: int = 0
    row_type: str = "item"            # item | header | total
    # Цена заказчика (если указана в документе)
    client_work_price: float = 0.0
    client_material_price: float = 0.0
    # Вспомогательное
    notes: str = ""
    original_row: Optional[dict] = field(default=None, repr=False)


# ─── Excel-парсер (произвольный формат клиента) ───────────────────────────────

# Ключевые слова для автоопределения столбцов
_COL_NAME_KW    = ("наименован", "работ", "услуг", "позиция", "description", "name")
_COL_UNIT_KW    = ("ед", "unit", "изм")
_COL_QTY_KW     = ("кол", "объём", "объем", "qty", "quantity")
_COL_WP_KW      = ("цена раб", "стоим раб", "work price", "цена тр")
_COL_MP_KW      = ("цена мат", "стоим мат", "mat price", "материал")
_COL_TOTAL_KW   = ("итого", "сумм", "total", "стоимость")
_COL_SECTION_KW = ("раздел", "section", "глава", "часть")


def _match_col(header: str, keywords: tuple[str, ...]) -> bool:
    h = header.lower().strip()
    return any(kw in h for kw in keywords)


def _to_float(val) -> float:
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    s = re.sub(r"[^\d.,\-]", "", str(val)).replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


def parse_excel_client(data: bytes) -> list[ParsedPosition]:
    """
    Умный парсер Excel-сметы заказчика.
    Определяет структуру по заголовкам, поддерживает произвольную раскладку столбцов.
    """
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    # Берём первый лист
    ws = wb.worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    wb.close()

    if not rows:
        return []

    # Ищем строку-заголовок (первые 10 строк)
    col_map: dict[str, int] = {}
    header_row_idx = 0
    for idx, row in enumerate(rows[:10]):
        cells = [str(c).strip() if c is not None else "" for c in row]
        hits = sum(
            1 for c in cells
            if _match_col(c, _COL_NAME_KW + _COL_UNIT_KW + _COL_QTY_KW)
        )
        if hits >= 2:
            # Найден заголовок
            header_row_idx = idx
            for ci, cell in enumerate(cells):
                if _match_col(cell, _COL_SECTION_KW) and "name" not in col_map:
                    col_map["section"] = ci
                if _match_col(cell, _COL_NAME_KW) and "name" not in col_map:
                    col_map["name"] = ci
                if _match_col(cell, _COL_UNIT_KW) and "unit" not in col_map:
                    col_map["unit"] = ci
                if _match_col(cell, _COL_QTY_KW) and "qty" not in col_map:
                    col_map["qty"] = ci
                if _match_col(cell, _COL_WP_KW) and "wp" not in col_map:
                    col_map["wp"] = ci
                if _match_col(cell, _COL_MP_KW) and "mp" not in col_map:
                    col_map["mp"] = ci
                if _match_col(cell, _COL_TOTAL_KW) and "total" not in col_map:
                    col_map["total"] = ci
            break

    # Если заголовок не найден — позиционное чтение (как в legacy-парсере)
    if not col_map:
        logger.warning(
            "parse_excel_client: заголовок столбцов не найден в первых 10 строках. "
            "Применяется позиционный fallback (name=D, unit=E, qty=F, wp=G, mp=H). "
            "Результат может быть некорректным."
        )
        col_map = {"name": 3, "unit": 4, "qty": 5, "wp": 6, "mp": 7}
        header_row_idx = 0

    positions: list[ParsedPosition] = []
    current_section = ""
    order = 0

    for row in rows[header_row_idx + 1:]:
        if not row or not any(v is not None for v in row):
            continue

        def cell(key: str):
            ci = col_map.get(key)
            if ci is None or ci >= len(row):
                return None
            return row[ci]

        name_val = cell("name")
        if name_val is None:
            continue
        name = str(name_val).strip()
        if not name or name.upper() in ("ИТОГО", "TOTAL", "ВСЕГО", "None"):
            continue

        unit = str(cell("unit") or "шт").strip() or "шт"
        raw_qty = _to_float(cell("qty"))
        if raw_qty == 0.0 and cell("qty") is not None:
            logger.warning("parse_excel_client: qty=0 в строке %r, подставляем 1.0.", name)
        qty = raw_qty or 1.0
        wp = _to_float(cell("wp"))
        mp = _to_float(cell("mp"))

        # Если нет wp/mp но есть total — считаем всё работой
        if wp == 0 and mp == 0:
            total = _to_float(cell("total"))
            if total and qty:
                wp = round(total / qty, 2)

        # Определяем тип строки: раздел (заголовок) или позиция
        section_val = cell("section")
        if section_val:
            current_section = str(section_val).strip()

        row_type = "item"
        # Эвристика: если unit пустой и нет qty/цены — это заголовок раздела
        is_header_hint = (
            qty == 1.0 and wp == 0.0 and mp == 0.0
            and (unit == "шт" or not unit.strip())
            and len(name) > 5
            and not re.search(r"\d", str(cell("qty") or ""))
        )
        if is_header_hint:
            row_type = "header"
            current_section = name

        positions.append(ParsedPosition(
            name=name,
            unit=unit,
            quantity=qty,
            section=current_section,
            order_index=order,
            row_type=row_type,
            client_work_price=wp,
            client_material_price=mp,
            original_row={k: row[v] for k, v in col_map.items() if v < len(row)},
        ))
        order += 1

    return positions


# ─── PDF / DOCX-парсер (через Claude) ────────────────────────────────────────

_PARSE_SYSTEM = """Ты — ИИ-парсер строительных смет и ТЗ.
Тебе передаётся документ. Твоя задача — извлечь все позиции работ и материалов.

Верни СТРОГО JSON-массив (без markdown-обёрток):
[
  {
    "section": "Раздел или глава (пустая строка если нет)",
    "name": "Наименование работ или материала",
    "unit": "ед.изм (шт/м2/м3/п.м/кг/т/компл/услуга и т.д.)",
    "quantity": 1.0,
    "client_work_price": 0.0,
    "client_material_price": 0.0,
    "row_type": "item",
    "notes": ""
  }
]

Правила:
- row_type = "header" только для строк-заголовков разделов (без объёма и цены).
- row_type = "item" для реальных позиций.
- Цены только те, что явно указаны в документе. Если нет — ставь 0.
- Не изобретай позиции. Только то, что есть в документе.
- Если документ — ТЗ без цен, ставь все цены 0.
- quantity: только числа. Если не указано — 1.0.
"""


async def parse_pdf_client(data: bytes, filename: str = "document.pdf") -> list[ParsedPosition]:
    """Парсит PDF-смету или ТЗ через Claude, возвращает список ParsedPosition."""
    import base64
    from app.services import claude_service

    content = [
        {
            "type": "document",
            "source": {
                "type": "base64",
                "media_type": "application/pdf",
                "data": base64.standard_b64encode(data).decode(),
            },
        },
        {"type": "text", "text": f"Файл: {filename}\nИзвлеки все позиции работ и материалов."},
    ]

    result = await claude_service.complete_json(
        system=_PARSE_SYSTEM,
        messages=[{"role": "user", "content": content}],
        max_tokens=16000,
        model=claude_service.SONNET,
    )

    return _json_to_positions(result)


async def parse_docx_client(data: bytes, filename: str = "document.docx") -> list[ParsedPosition]:
    """Парсит DOCX-ТЗ через Claude, возвращает список ParsedPosition."""
    from app.services.file_extractor import extract_docx_text
    from app.services import claude_service

    text = extract_docx_text(data)
    content = [{"type": "text", "text": f"Файл: {filename}\n\n{text}"}]

    result = await claude_service.complete_json(
        system=_PARSE_SYSTEM,
        messages=[{"role": "user", "content": content}],
        max_tokens=16000,
        model=claude_service.SONNET,
    )

    return _json_to_positions(result)


def _json_to_positions(data: dict | list) -> list[ParsedPosition]:
    """Конвертирует Claude JSON-ответ в список ParsedPosition."""
    if isinstance(data, dict):
        # Может вернуть {"positions": [...]} или {"sections": [...]}
        items = data.get("positions") or data.get("items") or data.get("sections") or []
        if items and isinstance(items[0], dict) and "items" in items[0]:
            # Вложенные секции → разворачиваем
            flat = []
            for sec in items:
                for item in sec.get("items", []):
                    item.setdefault("section", sec.get("title", ""))
                    flat.append(item)
            items = flat
    else:
        items = data if isinstance(data, list) else []

    positions = []
    for i, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip()
        if not name:
            continue
        raw_qty = item.get("quantity", 1.0)
        if raw_qty == 0:
            logger.warning("_json_to_positions: qty=0 для позиции %r, подставляем 1.0.", name)
        positions.append(ParsedPosition(
            name=name,
            unit=str(item.get("unit", "шт")).strip() or "шт",
            quantity=float(raw_qty or 1.0),
            section=str(item.get("section", "")).strip(),
            order_index=i,
            row_type=str(item.get("row_type", "item")),
            client_work_price=float(item.get("client_work_price", 0.0) or 0.0),
            client_material_price=float(item.get("client_material_price", 0.0) or 0.0),
            notes=str(item.get("notes", "")).strip(),
        ))
    return positions
