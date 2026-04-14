# ВОР-пайплайн: рефакторинг по ТЗ v1.0

## Задача
Привести систему в соответствие с ТЗ «Сервис автоматизации сметных расчётов» v1.0 (апрель 2026).
Ключевые изменения: переименование Перечень→ВОР, удаление 3 типов задач, новая JSON-схема,
разграничение зон ответственности ИИ/код, fuzzy-дедупликация, 3-уровневое обогащение цен.

## Фазы

### [x] Фаза 1 — Создание плана

### [x] Фаза 2 — Pydantic-схемы (app/schemas/vor.py)
- VorItem, VorSection, ClaudeVorResponse
- Единая схема для всех 9 модулей

### [x] Фаза 3 — Модель БД (app/models/estimate_item.py)
- Добавить: is_estimated (bool), source (str), qty_from_tz (float),
  qty_from_project (float), discrepancy (bool), scan_math_error (bool)

### [x] Фаза 4 — Excel-сервис (app/services/excel_service.py)
- build_vor_excel() — новый, для ВОР-задач (vor.xlsx)
- build_estimate_excel() — расширить: лист «Требуют проверки», подсветка флагов
- build_compare_excel() — новый, для модуля 2.9

### [x] Фаза 5 — Task processor (app/services/task_processor.py)
- Новые системные промпты (строгий JSON по схеме sections→items)
- Удалить: RESEARCH_PROJECT, SMETA_FROM_EDC_PROJECT, SMETA_FROM_GRAND_PROJECT
- ВОР-задачи → Excel вместо PDF
- 3-уровневое обогащение цен (кэш → API-stub → Claude is_estimated)
- Pydantic-валидация с retry (max 2)
- Fuzzy-дедупликация (rapidfuzz ≥ 85%)
- COMPARE: code diff → Claude комментирует только diff
- SCAN: заглушка preprocessing → Claude OCR → код нормализует числа

### [x] Фаза 6 — Модель задач (app/models/task.py)
- Убрать из TASK_TYPES: RESEARCH_PROJECT, SMETA_FROM_EDC_PROJECT, SMETA_FROM_GRAND_PROJECT

### [x] Фаза 7 — Фронтенд (frontend/src/pages/TaskCreate.tsx)
- Переименовать labels: Перечень→ВОР, Смета из перечня→Смета из ВОР
- Убрать 3 типа

### [x] Фаза 8 — Миграция БД (alembic/versions/026_vor_fields.py)

## Заглушки (TODO — требуют отдельной инфраструктуры)
- API агрегаторов цен (Леруа, Петрович, OBI) — _fetch_price_from_api()
- cv2/OpenCV preprocessing сканов — _preprocess_scan()
- pdfplumber извлечение таблиц — _extract_pdf_tables()
- 3σ-аномалии цен — _check_price_anomaly()

## Итог
- [x] Реализован целиком (2026-04-14)
- Что осталось: заглушки внешних интеграций (_fetch_price_from_api, _preprocess_scan, _extract_pdf_tables, _check_price_anomaly)
