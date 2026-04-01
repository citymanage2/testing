import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from sqlalchemy import select
from app.config import settings
from app.database import engine, SessionLocal
from app.models import Base
from app.models.user import User
from app.services.price_service import price_service
from app.routers import auth, tasks, projects, admin, results
from app.routers import company, contractors, catalog, calculator, documents, project_card, work_acceptances, ai_assist
from app.routers import project_lifecycle, project_docs, contracts, work_schedule, client_acts, purchase_requests, notifications

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

    yield
    await engine.dispose()


app = FastAPI(title="СМ Смета", version="1.0.0", lifespan=lifespan)

_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.get("/health")
async def health():
    return {"status": "ok"}
