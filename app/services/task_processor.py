"""
Main task processing pipeline.
Each task type calls Claude with appropriate context and produces results.
"""
import uuid
import json
import base64
from datetime import datetime, timezone
from sqlalchemy import select
from app.database import SessionLocal
from app.models.task import Task
from app.models.task_input_file import TaskInputFile
from app.models.task_result import TaskResult
from app.models.estimate_item import EstimateItem
from app.services import claude_service
from app.services.price_service import price_service
from app.services.excel_service import build_estimate_excel
from app.services.pdf_service import build_report_pdf
from app.services.snapshot_service import snapshot_service

TASK_SYSTEMS = {
    "LIST_FROM_TZ": "Ты эксперт-сметчик. Из технического задания составь структурированный перечень работ и материалов в формате JSON.",
    "LIST_FROM_TZ_PROJECT": "Ты эксперт-сметчик. Из ТЗ и проектной документации составь детальный перечень работ и материалов в формате JSON.",
    "LIST_FROM_PROJECT": "Ты эксперт-сметчик. Из проектной документации извлеки все работы и материалы в формате JSON.",
    "RESEARCH_PROJECT": "Ты эксперт-аналитик. Проанализируй проектную документацию и составь аналитический отчёт.",
    "SMETA_FROM_LIST": "Ты эксперт-сметчик. По перечню работ и материалов составь полную смету с ценами в формате JSON.",
    "SMETA_FROM_TZ": "Ты эксперт-сметчик. По техническому заданию составь полную смету с ценами в формате JSON.",
    "SMETA_FROM_TZ_PROJECT": "Ты эксперт-сметчик. По ТЗ и проектной документации составь детальную смету с ценами в формате JSON.",
    "SMETA_FROM_PROJECT": "Ты эксперт-сметчик. По проектной документации составь полную смету с ценами в формате JSON.",
    "SMETA_FROM_EDC_PROJECT": "Ты эксперт-сметчик. Обработай файл EDC вместе с проектом и составь смету в формате JSON.",
    "SMETA_FROM_GRAND_PROJECT": "Ты эксперт-сметчик. Обработай XML-экспорт из Гранд-смета вместе с проектом, составь смету в формате JSON.",
    "SCAN_TO_EXCEL": "Ты OCR-эксперт. Распознай содержимое скана сметы и верни структурированные данные в формате JSON.",
    "COMPARE_PROJECT_SMETA": "Ты эксперт-аудитор. Сравни проектную документацию со сметой, найди расхождения и составь отчёт.",
}

SMETA_TYPES = {
    "SMETA_FROM_LIST", "SMETA_FROM_TZ", "SMETA_FROM_TZ_PROJECT",
    "SMETA_FROM_PROJECT", "SMETA_FROM_EDC_PROJECT", "SMETA_FROM_GRAND_PROJECT", "SCAN_TO_EXCEL",
}

ESTIMATE_JSON_PROMPT = """
Верни смету строго в JSON:
{
  "items": [
    {
      "section": "Раздел",
      "type": "Работа|Материал",
      "name": "Наименование",
      "unit": "ед.изм",
      "quantity": 0,
      "work_price": 0,
      "mat_price": 0
    }
  ]
}
Без пояснений, только JSON.
"""


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
                # Load input files
                files_result = await db.execute(select(TaskInputFile).where(TaskInputFile.task_id == task_id))
                input_files = files_result.scalars().all()

                # Build messages for Claude
                messages = self._build_messages(task, input_files)
                system = TASK_SYSTEMS.get(task.task_type, TASK_SYSTEMS["SMETA_FROM_TZ"])

                task.progress_message = "Обработка документов через Claude AI..."
                await db.commit()

                if task.task_type in SMETA_TYPES:
                    await self._process_smeta(db, task, system, messages)
                else:
                    await self._process_report(db, task, system, messages)

                task.status = "completed"
                task.progress_message = "Готово"
                task.estimate_status = "calculated"
                await db.commit()

            except Exception as e:
                task.status = "failed"
                task.error_message = str(e)
                task.progress_message = None
                await db.commit()

    def _build_messages(self, task: Task, input_files: list) -> list[dict]:
        content = []

        # Add previous chat context
        for msg in task.chat_history:
            pass  # will be handled below

        # Build current message content with files
        parts = []
        for f in input_files:
            if f.mime_type in ("image/jpeg", "image/png", "image/gif", "image/webp"):
                parts.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": f.mime_type,
                        "data": base64.standard_b64encode(f.file_data).decode(),
                    },
                })
            else:
                # For non-image files, include as document if supported, else as text description
                try:
                    parts.append({
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": f.mime_type,
                            "data": base64.standard_b64encode(f.file_data).decode(),
                        },
                    })
                except Exception:
                    parts.append({"type": "text", "text": f"[Файл: {f.file_name}]"})

        prompt_text = task.user_prompt or "Выполни задачу."
        parts.append({"type": "text", "text": prompt_text})

        # Full conversation: previous history + current request
        messages = list(task.chat_history) if task.chat_history else []
        if not messages:
            messages.append({"role": "user", "content": parts if len(parts) > 1 else parts[0] if parts else prompt_text})
        else:
            messages.append({"role": "user", "content": parts if len(parts) > 1 else (parts[0] if parts else prompt_text)})

        return messages

    async def _process_smeta(self, db, task: Task, system: str, messages: list):
        # Add JSON format instruction
        json_messages = messages + [{"role": "user", "content": ESTIMATE_JSON_PROMPT}] if messages[-1].get("content") != ESTIMATE_JSON_PROMPT else messages

        task.progress_message = "Формирование сметы..."
        await db.commit()

        try:
            result = await claude_service.complete_json(system, json_messages)
        except json.JSONDecodeError:
            # Retry with explicit JSON request
            retry_msg = messages + [{"role": "user", "content": "Верни ТОЛЬКО JSON без пояснений. " + ESTIMATE_JSON_PROMPT}]
            result = await claude_service.complete_json(system, retry_msg)

        raw_items = result.get("items", result) if isinstance(result, dict) else result

        task.progress_message = "Обогащение ценами..."
        await db.commit()

        # Delete existing items
        existing = (await db.execute(select(EstimateItem).where(EstimateItem.task_id == task.id))).scalars().all()
        for item in existing:
            await db.delete(item)

        # Save new items with prices from price service
        for i, raw in enumerate(raw_items):
            name = raw.get("name", "")
            item_type = raw.get("type", "Работа")
            work_price = float(raw.get("work_price", 0) or 0)
            mat_price = float(raw.get("mat_price", 0) or 0)
            quantity = float(raw.get("quantity", 1) or 1)

            # Enrich from price cache
            if item_type == "Работа" and work_price == 0:
                cached = price_service.lookup_work(name)
                if cached:
                    work_price = cached
            elif item_type == "Материал" and mat_price == 0:
                cached = price_service.lookup_material(name)
                if cached:
                    mat_price = cached

            total = (work_price + mat_price) * quantity
            db.add(EstimateItem(
                id=str(uuid.uuid4()),
                task_id=task.id,
                position=i + 1,
                section=raw.get("section", ""),
                type=item_type,
                name=name,
                unit=raw.get("unit", ""),
                quantity=quantity,
                work_price=work_price,
                mat_price=mat_price,
                total=total,
            ))

        await db.flush()

        task.progress_message = "Генерация файлов..."
        await db.commit()

        # Save snapshot
        await snapshot_service.save_snapshot(db, task.id, "initial", "Первичная смета")

        # Generate Excel
        items_result = await db.execute(select(EstimateItem).where(EstimateItem.task_id == task.id).order_by(EstimateItem.position))
        items = items_result.scalars().all()
        excel_data = build_estimate_excel(items)
        db.add(TaskResult(task_id=task.id, file_name="smeta.xlsx", file_data=excel_data, mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
        await db.flush()

    async def _process_report(self, db, task: Task, system: str, messages: list):
        task.progress_message = "Генерация отчёта..."
        await db.commit()

        text = await claude_service.complete(system, messages)

        task.chat_history = task.chat_history + [{"role": "assistant", "content": text}]

        pdf_data = build_report_pdf(text)
        db.add(TaskResult(task_id=task.id, file_name="report.pdf", file_data=pdf_data, mime_type="application/pdf"))
        await db.flush()


task_processor = TaskProcessor()
