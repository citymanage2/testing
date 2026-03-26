from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine
from app.models import Base  # импортирует все модели
from app.services.price_service import price_service
from app.routers import auth, tasks, projects, admin, results


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Старт: прогреть кэш прайсов
    await price_service.load_cache()
    yield
    await engine.dispose()


app = FastAPI(title="Smeta AI", lifespan=lifespan)

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
