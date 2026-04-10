"""
Main task processing pipeline.
Each task type calls Claude with appropriate context and produces results.
"""
import uuid
import json
from datetime import datetime, timezone
from sqlalchemy import select
from app.database import SessionLocal
from app.models.task import Task
from app.models.task_input_file import TaskInputFile
from app.models.task_result import TaskResult
from app.models.estimate_item import EstimateItem
from app.services import claude_service
from app.services.claude_service import OPUS, SONNET, MAX_TOKENS_SMETA
from app.services.price_service import price_service
from app.services.excel_service import build_estimate_excel
from app.services.pdf_service import build_report_pdf
from app.services.snapshot_service import snapshot_service
from app.services.file_extractor import file_to_claude_part

_PRICE_CONTEXT = (
    "Используй реальные рыночные цены России на 2024-2025 год. "
    "Для материалов указывай цены из известных источников: Леруа Мерлен (leroymerlin.ru), "
    "Петрович (petrovich.ru), OBI (obi.ru), ВсеИнструменты (vseinstrumenti.ru), "
    "Строительный двор и региональных поставщиков. "
    "Цены на работы — по рыночным ставкам строительных бригад в данном регионе. "
    "Не занижай и не завышай цены — они должны быть близки к реальным рыночным."
)

TASK_SYSTEMS = {
    "LIST_FROM_TZ": "Ты эксперт-сметчик. Из технического задания составь структурированный перечень работ и материалов в формате JSON.",
    "LIST_FROM_TZ_PROJECT": "Ты эксперт-сметчик. Из ТЗ и проектной документации составь детальный перечень работ и материалов в формате JSON.",
    "LIST_FROM_PROJECT": "Ты эксперт-сметчик. Из проектной документации извлеки все работы и материалы в формате JSON.",
    "RESEARCH_PROJECT": "Ты эксперт-аналитик. Проанализируй проектную документацию и составь аналитический отчёт.",
    "SMETA_FROM_LIST": f"Ты эксперт-сметчик. По перечню работ и материалов составь полную смету с ценами. {_PRICE_CONTEXT}",
    "SMETA_FROM_TZ": f"Ты эксперт-сметчик. По техническому заданию составь полную смету с ценами. {_PRICE_CONTEXT}",
    "SMETA_FROM_TZ_PROJECT": f"Ты эксперт-сметчик. По ТЗ и проектной документации составь детальную смету с ценами. {_PRICE_CONTEXT}",
    "SMETA_FROM_PROJECT": f"Ты эксперт-сметчик. По проектной документации составь полную смету с ценами. {_PRICE_CONTEXT}",
    "SMETA_FROM_EDC_PROJECT": f"Ты эксперт-сметчик. Обработай файл EDC вместе с проектом и составь смету. {_PRICE_CONTEXT}",
    "SMETA_FROM_GRAND_PROJECT": f"Ты эксперт-сметчик. Обработай XML-экспорт из Гранд-смета вместе с проектом. {_PRICE_CONTEXT}",
    "SCAN_TO_EXCEL": "Ты OCR-эксперт. Распознай содержимое скана сметы и верни структурированные данные в формате JSON.",
    "COMPARE_PROJECT_SMETA": "Ты эксперт-аудитор. Сравни проектную документацию со сметой, найди расхождения и составь отчёт.",
}

SMETA_TYPES = {
    "SMETA_FROM_LIST", "SMETA_FROM_TZ", "SMETA_FROM_TZ_PROJECT",
    "SMETA_FROM_PROJECT", "SMETA_FROM_EDC_PROJECT", "SMETA_FROM_GRAND_PROJECT", "SCAN_TO_EXCEL",
}

# Задачи с проектной документацией требуют Opus — большой контекст, максимальная точность.
# Остальные задачи (ТЗ, списки, OCR, отчёты) достаточно обрабатываются Sonnet.
TASK_MODELS = {
    "SMETA_FROM_PROJECT":      OPUS,
    "SMETA_FROM_TZ_PROJECT":   OPUS,
    "SMETA_FROM_EDC_PROJECT":  OPUS,
    "SMETA_FROM_GRAND_PROJECT": OPUS,
    "LIST_FROM_TZ_PROJECT":    OPUS,
    "LIST_FROM_PROJECT":       OPUS,
}

ESTIMATE_JSON_PROMPT = """
Верни смету строго в JSON (без пояснений, только JSON):
{
  "items": [
    {
      "section": "Раздел сметы",
      "type": "Работа|Материал",
      "name": "Точное наименование (для материалов — с маркой/артикулом)",
      "unit": "ед.изм",
      "quantity": 0,
      "work_price": 0,
      "mat_price": 0,
      "source_url": "https://... (для материалов — URL страницы товара или сайта поставщика, для работ — null)",
      "comment": "Логика формирования цены: для работ — обоснование ставки (норма, сложность, регион); для материалов — обоснование цены (источник, аналог, рыночная стоимость)"
    }
  ]
}
Важно: цены должны быть реальными рыночными. Для материалов укажи source_url. Поле comment ОБЯЗАТЕЛЬНО заполни для каждой позиции — укажи логику и источник формирования цены.
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
                model = TASK_MODELS.get(task.task_type, SONNET)

                task.progress_message = "Обработка документов через Claude AI..."
                await db.commit()

                if task.task_type in SMETA_TYPES:
                    await self._process_smeta(db, task, system, messages, model)
                else:
                    await self._process_report(db, task, system, messages, model)

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
        # Convert uploaded files to Claude content blocks (DOCX/XLSX/XML are extracted to text)
        file_parts = [file_to_claude_part(f.file_name, f.mime_type, f.file_data) for f in input_files]

        prompt_text = task.user_prompt or "Выполни задачу."

        # Sanitize history: drop legacy non-PDF document blocks that Anthropic rejects
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
            # First call: attach files + prompt in one user message
            first_content = file_parts + [{"type": "text", "text": prompt_text}]
            messages.append({"role": "user", "content": first_content})
        else:
            # Subsequent call (user replied in chat): files were already in the history,
            # just append the latest user message as-is (already added by send_message endpoint).
            # If the last message is already the user's, don't duplicate it.
            if messages[-1]["role"] != "user":
                messages.append({"role": "user", "content": prompt_text})

        return messages

    async def _process_smeta(self, db, task: Task, system: str, messages: list, model: str):
        # Add JSON format instruction
        json_messages = messages + [{"role": "user", "content": ESTIMATE_JSON_PROMPT}] if messages[-1].get("content") != ESTIMATE_JSON_PROMPT else messages

        task.progress_message = "Формирование сметы..."
        await db.commit()

        try:
            result = await claude_service.complete_json(system, json_messages, max_tokens=MAX_TOKENS_SMETA, model=model)
        except json.JSONDecodeError:
            # Retry with explicit JSON request
            retry_msg = messages + [{"role": "user", "content": "Верни ТОЛЬКО JSON без пояснений. " + ESTIMATE_JSON_PROMPT}]
            result = await claude_service.complete_json(system, retry_msg, max_tokens=MAX_TOKENS_SMETA, model=model)

        raw_items = result.get("items", result) if isinstance(result, dict) else result
        if not isinstance(raw_items, list):
            raise ValueError(f"Claude вернул неожиданный формат сметы: {type(raw_items)}")

        # Validate: drop positions without name or with zero totals after enrichment
        valid_items = [r for r in raw_items if isinstance(r, dict) and r.get("name", "").strip()]
        if not valid_items:
            raise ValueError("Claude не вернул ни одной позиции в смете — проверь входные файлы")

        task.progress_message = "Обогащение ценами..."
        await db.commit()

        # Delete existing items
        existing = (await db.execute(select(EstimateItem).where(EstimateItem.task_id == task.id))).scalars().all()
        for item in existing:
            await db.delete(item)

        saved_count = 0
        # Save new items with prices from price service
        for i, raw in enumerate(valid_items):
            name = raw.get("name", "").strip()
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
            # Skip positions where both prices are zero after enrichment — likely garbage rows
            if total == 0 and item_type in ("Работа", "Материал"):
                continue
            source_url = raw.get("source_url") or None
            comment = raw.get("comment") or None
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
                source_url=source_url,
                comment=comment,
            ))
            saved_count += 1

        if saved_count == 0:
            raise ValueError("Все позиции сметы имеют нулевую стоимость — проверь входные файлы")

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

    async def _process_report(self, db, task: Task, system: str, messages: list, model: str):
        task.progress_message = "Генерация отчёта..."
        await db.commit()

        text = await claude_service.complete(system, messages, model=model)

        task.chat_history = task.chat_history + [{"role": "assistant", "content": text}]

        pdf_data = build_report_pdf(text)
        db.add(TaskResult(task_id=task.id, file_name="report.pdf", file_data=pdf_data, mime_type="application/pdf"))
        await db.flush()


task_processor = TaskProcessor()
