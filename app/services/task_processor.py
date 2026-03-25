# app/services/task_processor.py
import asyncio
import base64
import io
import json
import re
import uuid
from datetime import datetime, timezone

import structlog
from sqlalchemy import select

from app.database import SessionLocal
from app.models.task import Task, TASK_TYPES
from app.models.task_input_file import TaskInputFile
from app.models.task_result import TaskResult
from app.models.estimate_item import EstimateItem
from app.config import settings

logger = structlog.get_logger()

SYSTEM_PROMPTS = {
    "LIST_FROM_TZ": """
Ты — эксперт-сметчик. Проанализируй техническое задание и составь подробный перечень работ и материалов.

Ответь ТОЛЬКО валидным JSON без markdown-обёртки:
{
  "items": [
    {
      "type": "Работа" | "Материал",
      "name": "Наименование",
      "unit": "ед.изм.",
      "quantity": число,
      "section": "Раздел/этап или null",
      "notes": "Примечания или null"
    }
  ]
}
""",
    "SMETA_FROM_TZ": """
Ты — эксперт-сметчик. По техническому заданию составь детальную смету строительных работ.

Ответь ТОЛЬКО валидным JSON без markdown-обёртки:
{
  "items": [
    {
      "type": "Работа" | "Материал",
      "name": "Наименование",
      "unit": "ед.изм.",
      "quantity": число,
      "work_price": число или 0,
      "mat_price": число или 0,
      "section": "Раздел/этап",
      "notes": "Примечания или null"
    }
  ]
}

Для работ заполняй work_price, для материалов — mat_price.
Если цену не знаешь — оставь 0, система обогатит ценами из прайс-листа.
""",
    "SCAN_TO_EXCEL": """
Ты — эксперт-сметчик. Извлеки данные из скана сметы.

Ответь ТОЛЬКО валидным JSON без markdown-обёртки:
{
  "items": [
    {
      "type": "Работа" | "Материал",
      "name": "Наименование",
      "unit": "ед.изм.",
      "quantity": число,
      "work_price": число или 0,
      "mat_price": число или 0,
      "section": "Раздел или null",
      "notes": null
    }
  ]
}
""",
    "COMPARE_PROJECT_SMETA": """
Ты — эксперт-сметчик. Сравни проектную документацию со сметой.

Ответь ТОЛЬКО валидным JSON без markdown-обёртки:
{
  "summary": {
    "project_total": число,
    "smeta_total": число,
    "difference": число,
    "difference_pct": число
  },
  "discrepancies": [
    {
      "name": "Наименование позиции",
      "project_value": число или null,
      "smeta_value": число или null,
      "difference_pct": число,
      "severity": "critical" | "warning" | "ok"
    }
  ],
  "missing_in_smeta": ["позиция 1", "позиция 2"],
  "missing_in_project": ["позиция 1"],
  "recommendations": ["рекомендация 1", "рекомендация 2"]
}
""",
}

# For task types not explicitly listed, use SMETA_FROM_TZ prompt
DEFAULT_SYSTEM_PROMPT = SYSTEM_PROMPTS["SMETA_FROM_TZ"]


async def _decode_file(input_file: TaskInputFile) -> dict:
    if input_file.mime_type in ("image/jpeg", "image/png"):
        return {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": input_file.mime_type,
                "data": base64.b64encode(input_file.file_data).decode(),
            }
        }
    elif input_file.mime_type == "application/pdf":
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(input_file.file_data))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        return {"type": "text", "text": f"[PDF: {input_file.file_name}]\n{text}"}
    elif input_file.mime_type in (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel"
    ):
        from openpyxl import load_workbook
        wb = load_workbook(io.BytesIO(input_file.file_data), read_only=True)
        rows = []
        for ws in wb.worksheets:
            rows.append(f"[Лист: {ws.title}]")
            for row in ws.iter_rows(values_only=True):
                if any(c is not None for c in row):
                    rows.append("\t".join(str(c or "") for c in row))
        return {"type": "text", "text": "\n".join(rows)}
    elif input_file.mime_type in ("text/xml", "application/xml"):
        text = input_file.file_data.decode("utf-8", errors="replace")
        return {"type": "text", "text": f"[XML: {input_file.file_name}]\n{text}"}
    else:
        return {"type": "text", "text": f"[Файл: {input_file.file_name}]"}


def _parse_claude_response(response_text: str) -> list[dict]:
    clean = re.sub(r"```(?:json)?\s*", "", response_text).strip()
    clean = clean.rstrip("`").strip()
    data = json.loads(clean)
    return data.get("items", [])


async def _enrich_with_prices(items: list[dict]) -> list[dict]:
    from app.services.price_service import price_service
    for item in items:
        if item.get("work_price", 0) == 0 and item["type"] == "Работа":
            price = await price_service.lookup(item["name"], "work")
            if price:
                item["work_price"] = price
        if item.get("mat_price", 0) == 0 and item["type"] == "Материал":
            price = await price_service.lookup(item["name"], "material")
            if price:
                item["mat_price"] = price
    return items


class TaskProcessor:

    async def process(self, task_id: uuid.UUID) -> None:
        async with SessionLocal() as db:
            try:
                task = await db.get(Task, task_id)
                if not task:
                    return
                if task.status == "cancelled":
                    return

                task.status = "processing"
                task.progress_message = "Загрузка файлов..."
                await db.commit()

                # Load input files
                result = await db.execute(
                    select(TaskInputFile)
                    .where(TaskInputFile.task_id == task_id)
                    .order_by(TaskInputFile.file_index)
                )
                input_files = result.scalars().all()

                # Decode files for Claude
                task.progress_message = "Анализ документов..."
                await db.commit()

                content_blocks = []
                for f in input_files:
                    block = await _decode_file(f)
                    content_blocks.append(block)

                # Build messages
                messages = list(task.chat_history) if task.chat_history else []
                if not messages:
                    # First call
                    user_content = content_blocks.copy()
                    if task.user_prompt:
                        user_content.append({"type": "text", "text": task.user_prompt})
                    if not user_content:
                        user_content = [{"type": "text", "text": "Проанализируй документы и выполни задачу."}]
                    messages = [{"role": "user", "content": user_content}]
                else:
                    # Chat continuation — last message is already from user (via /message endpoint)
                    pass

                system_prompt = SYSTEM_PROMPTS.get(task.task_type, DEFAULT_SYSTEM_PROMPT)

                # Call Claude
                task.progress_message = "Обращение к Claude AI..."
                await db.commit()

                from app.services.claude_service import claude_service
                response_text = await claude_service.complete(
                    messages=messages,
                    task_type=task.task_type,
                    system=system_prompt,
                )

                # Update chat history
                task.chat_history = messages + [{"role": "assistant", "content": response_text}]
                await db.commit()

                # Parse response
                task.progress_message = "Обработка результатов..."
                await db.commit()

                if task.task_type == "COMPARE_PROJECT_SMETA":
                    # PDF output
                    clean = re.sub(r"```(?:json)?\s*", "", response_text).strip().rstrip("`")
                    comparison_data = json.loads(clean)

                    from app.services.pdf_service import generate_comparison_report
                    pdf_bytes = generate_comparison_report(comparison_data)

                    task_result = TaskResult(
                        task_id=task_id,
                        file_name="comparison_report.pdf",
                        mime_type="application/pdf",
                        file_data=pdf_bytes,
                    )
                    db.add(task_result)

                else:
                    # Parse items list
                    items = _parse_claude_response(response_text)

                    # Enrich with prices
                    task.progress_message = "Обогащение ценами..."
                    await db.commit()
                    items = await _enrich_with_prices(items)

                    # Save estimate items
                    for idx, item_data in enumerate(items):
                        estimate_item = EstimateItem(
                            task_id=task_id,
                            position=idx,
                            type=item_data.get("type", "Работа"),
                            name=item_data.get("name", ""),
                            unit=item_data.get("unit", "шт"),
                            quantity=float(item_data.get("quantity", 0)),
                            work_price=float(item_data.get("work_price", 0)),
                            mat_price=float(item_data.get("mat_price", 0)),
                            section=item_data.get("section"),
                            notes=item_data.get("notes"),
                        )
                        db.add(estimate_item)

                    # Generate Excel file
                    task.progress_message = "Генерация Excel..."
                    await db.commit()

                    from app.services.excel_service import generate_list, generate_smeta
                    is_list_type = task.task_type.startswith("LIST_") or task.task_type == "RESEARCH_PROJECT"
                    if is_list_type:
                        excel_bytes = generate_list(items)
                        file_name = "list.xlsx"
                    else:
                        excel_bytes = generate_smeta(items, settings.vat_rate)
                        file_name = "smeta.xlsx"

                    task_result = TaskResult(
                        task_id=task_id,
                        file_name=file_name,
                        mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        file_data=excel_bytes,
                    )
                    db.add(task_result)

                task.status = "completed"
                task.estimate_status = "calculated"
                task.progress_message = None
                await db.commit()

            except Exception as e:
                logger.error("task_processing_failed", task_id=str(task_id), error=str(e))
                try:
                    task = await db.get(Task, task_id)
                    if task:
                        task.status = "failed"
                        task.error_message = str(e)
                        task.progress_message = None
                        await db.commit()
                except Exception:
                    pass


task_processor = TaskProcessor()
