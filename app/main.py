import asyncio
import logging
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from passlib.context import CryptContext
from sqlalchemy import select, text
from app.config import settings
from app.database import engine, SessionLocal
from app.middleware import RequestLoggingMiddleware
from app.models import Base
from app.models.user import User
from app.services.price_service import price_service
from app.services.warranty_scheduler import warranty_scheduler_loop
from app.routers import auth, tasks, projects, admin, results
from app.routers import company, contractors, catalog, calculator, documents, project_card, work_acceptances, ai_assist
from app.routers import project_lifecycle, project_docs, contracts, work_schedule, client_acts, purchase_requests, notifications
from app.routers import warranty, kp_requests
# v2 architecture
from app.routers import estimates_v2, catalog_v2, price_sources
from app.routers import work_stages, warehouse, material_requests_v2
from app.routers import project_members, finance_v2
from app.routers import assistant_v2

logger = logging.getLogger("app.main")

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Seed default users
    async with SessionLocal() as db:
        for username, password, role in [
            ("user", settings.user_password, "user"),
            ("admin", settings.admin_password, "admin"),
        ]:
            existing = (await db.execute(select(User).where(User.username == username))).scalar_one_or_none()
            if not existing:
                db.add(User(id=str(uuid.uuid4()), username=username, hashed_password=pwd_ctx.hash(password), role=role))
        await db.commit()

    # Load price cache
    try:
        await price_service.load_cache()
    except Exception:
        pass

    # Start warranty notification scheduler
    scheduler_task = asyncio.create_task(warranty_scheduler_loop())

    yield

    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        pass
    await engine.dispose()


app = FastAPI(
    title="СМ Смета",
    version="2.0.0",
    description=(
        "Внутренняя система управления строительными проектами. "
        "API v2: сметы, ГПР, склад, финансы, ИИ-ассистент."
    ),
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────────────────
# CORS должен быть добавлен ПОСЛЕ RequestLoggingMiddleware (порядок: снаружи → внутрь)
app.add_middleware(RequestLoggingMiddleware)
_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Глобальный обработчик необработанных исключений ──────────────────────────
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    from fastapi import HTTPException
    from fastapi.exception_handlers import http_exception_handler
    # HTTPException обрабатывается FastAPI штатно — не перехватываем
    if isinstance(exc, HTTPException):
        return await http_exception_handler(request, exc)
    request_id = getattr(request.state, "request_id", "unknown")
    logger.exception(
        "500 Unhandled | request_id=%s %s %s",
        request_id, request.method, request.url.path,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Внутренняя ошибка сервера", "request_id": request_id},
    )

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
app.include_router(projects.router, prefix="/projects", tags=["projects"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
app.include_router(results.router, prefix="/results", tags=["results"])
app.include_router(company.router, prefix="/company", tags=["company"])
app.include_router(contractors.router, prefix="/contractors", tags=["contractors"])
app.include_router(catalog.router, prefix="/catalog", tags=["catalog"])
app.include_router(calculator.router, prefix="/calculator", tags=["calculator"])
app.include_router(documents.router, prefix="/projects", tags=["documents"])
app.include_router(project_card.router, prefix="/projects", tags=["project-card"])
app.include_router(work_acceptances.router, prefix="/projects", tags=["work-acceptances"])
app.include_router(ai_assist.router, prefix="/projects", tags=["ai-assist"])
app.include_router(project_lifecycle.router, prefix="/projects", tags=["project-lifecycle"])
app.include_router(project_docs.router, prefix="/projects", tags=["project-docs"])
app.include_router(contracts.router, prefix="/projects", tags=["contracts"])
app.include_router(work_schedule.router, prefix="/projects", tags=["work-schedule"])
app.include_router(client_acts.router, prefix="/projects", tags=["client-acts"])
app.include_router(purchase_requests.router, prefix="/projects", tags=["purchase-requests"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
app.include_router(warranty.router, prefix="/projects", tags=["warranty"])
app.include_router(kp_requests.router, prefix="/projects", tags=["kp-requests"])
# v2 architecture
app.include_router(price_sources.router, prefix="/v2/price-sources", tags=["v2-price-sources"])
app.include_router(catalog_v2.router, prefix="/v2/catalog", tags=["v2-catalog"])
app.include_router(estimates_v2.router, prefix="/v2/estimates", tags=["v2-estimates"])
app.include_router(work_stages.router, prefix="/v2/work-stages", tags=["v2-work-stages"])
app.include_router(warehouse.router, prefix="/v2/warehouses", tags=["v2-warehouses"])
app.include_router(material_requests_v2.router, prefix="/v2/material-requests", tags=["v2-material-requests"])
app.include_router(project_members.router, prefix="/v2/projects/{project_id}/members", tags=["v2-project-members"])
app.include_router(finance_v2.router, prefix="/v2", tags=["v2-finance"])
app.include_router(assistant_v2.router, prefix="/v2", tags=["v2-assistant"])


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok"}


@app.get("/v2/health", tags=["v2-system"])
async def health_v2():
    """Расширенная проверка: статус сервера + доступность БД."""
    db_status = "ok"
    db = SessionLocal()
    try:
        await asyncio.wait_for(db.execute(text("SELECT 1")), timeout=3.0)
    except asyncio.TimeoutError:
        db_status = "timeout"
    except Exception as e:
        db_status = f"error: {type(e).__name__}"
    finally:
        await db.close()

    overall = "ok" if db_status == "ok" else "degraded"
    return {
        "status": overall,
        "db": db_status,
        "version": app.version,
    }


# ── Сценарии по ролям (документация через API) ────────────────────────────────

_SCENARIOS = [
    {
        "role": "estimator",
        "name": "Сметчик",
        "scenarios": [
            {
                "id": "S1",
                "title": "Импорт сметы заказчика",
                "steps": [
                    "POST /v2/estimates/import — загрузить Excel/PDF/DOCX с use_ai=true",
                    "GET /v2/estimates/{id}/summary — проверить итоги по слоям",
                    "GET /v2/estimates — найти позиции с needs_review=true",
                    "POST /v2/estimates/{id}/calculate-cost — рассчитать себестоимость из каталога",
                    "GET /v2/estimates/{id}/summary — убедиться в марже",
                    "PATCH /v2/estimates/{id}/status — перевести в 'internal'",
                ],
            },
            {
                "id": "S2",
                "title": "Ветвление и согласование сметы",
                "steps": [
                    "POST /v2/estimates/{id}/branch — создать ветку",
                    "GET /v2/estimates/{id}/compare/{branch_id} — сравнить ветки",
                    "PATCH /v2/estimates/{id}/status — перевести в 'to_client'",
                    "PATCH /v2/estimates/{id}/status — подписать ('signed')",
                ],
            },
        ],
    },
    {
        "role": "project_manager",
        "name": "Менеджер проекта",
        "scenarios": [
            {
                "id": "S3",
                "title": "Ведение ГПР",
                "steps": [
                    "POST /v2/work-stages — создать этапы иерархически",
                    "PATCH /v2/work-stages/{id}/assign-position — привязать позиции сметы к этапам",
                    "GET /v2/work-stages/with-positions — просмотреть плановые объёмы",
                    "PATCH /v2/work-stages/{id} — обновить статус (in_progress / done)",
                ],
            },
            {
                "id": "S4",
                "title": "Заявка на материалы",
                "steps": [
                    "POST /v2/material-requests — создать заявку",
                    "POST /v2/material-requests/{id}/items — добавить позиции",
                    "POST /v2/material-requests/{id}/transition?new_status=submitted — подать",
                    "POST /v2/material-requests/{id}/transition?new_status=approved — одобрить (резервирует склад)",
                    "POST /v2/material-requests/{id}/transition?new_status=delivered — закрыть (зачисляет на склад)",
                ],
            },
        ],
    },
    {
        "role": "director",
        "name": "Руководитель / финансист",
        "scenarios": [
            {
                "id": "S5",
                "title": "Финансовый дашборд проекта",
                "steps": [
                    "GET /v2/projects/{id}/plan-fact — план/факт: выручка, себестоимость, маржа, ГПР",
                    "GET /v2/projects/{id}/forecast — прогноз до конца проекта",
                    "GET /v2/projects/{id}/alerts — детерминированные алерты (перерасход, риски)",
                    "GET /v2/company/pl — П&У по всем проектам компании",
                ],
            },
            {
                "id": "S6",
                "title": "ИИ-ассистент проекта",
                "steps": [
                    "POST /v2/projects/{id}/assistant {question: 'Как дела с маржой?', module: 'finance'}",
                    "Ассистент строит контекст (сметы, ГПР, факт) и отвечает по существу",
                ],
            },
        ],
    },
    {
        "role": "supply_manager",
        "name": "Снабженец",
        "scenarios": [
            {
                "id": "S7",
                "title": "Управление складом",
                "steps": [
                    "POST /v2/warehouses — создать склад",
                    "POST /v2/warehouses/{id}/movements — оприходовать материалы (receipt)",
                    "GET /v2/warehouses/{id}/stock — проверить остатки и резервы",
                    "POST /v2/warehouses/{id}/movements — выдать на объект (issue)",
                ],
            },
        ],
    },
]


@app.get("/v2/scenarios", tags=["v2-system"])
async def list_scenarios():
    """Ключевые сценарии работы по ролям. Используется для приёмочного тестирования."""
    return {"scenarios_by_role": _SCENARIOS}
