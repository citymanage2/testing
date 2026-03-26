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


@app.get("/health")
async def health():
    return {"status": "ok"}
