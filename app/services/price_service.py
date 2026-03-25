# app/services/price_service.py
import difflib
from app.config import settings

class PriceService:
    def __init__(self):
        self._works: dict[str, float] = {}
        self._materials: dict[str, float] = {}

    def _normalize(self, name: str) -> str:
        return " ".join(name.lower().strip().split())

    async def load_cache(self):
        from app.database import SessionLocal
        from app.models.price import PriceWork, PriceMaterial
        from sqlalchemy import select
        async with SessionLocal() as db:
            works = (await db.execute(select(PriceWork))).scalars().all()
            self._works = {self._normalize(w.name): w.min_price for w in works}

            mats = (await db.execute(select(PriceMaterial))).scalars().all()
            self._materials = {self._normalize(m.name): m.price for m in mats}

    async def reload_cache(self):
        self._works.clear()
        self._materials.clear()
        await self.load_cache()

    async def lookup(self, name: str, type_: str) -> float | None:
        cache = self._works if type_ == "work" else self._materials
        normalized = self._normalize(name)

        if normalized in cache:
            return cache[normalized]

        matches = difflib.get_close_matches(normalized, cache.keys(), n=1, cutoff=0.8)
        if matches:
            return cache[matches[0]]

        return await self._claude_lookup(name, type_)

    async def _claude_lookup(self, name: str, type_: str) -> float | None:
        from app.services.claude_service import claude_service
        type_label = "работы" if type_ == "work" else "материала"
        prompt = (
            f"Найди актуальную рыночную цену {type_label} '{name}' "
            f"в городе {settings.search_city}. "
            f"Ответь ТОЛЬКО числом — ценой в рублях за единицу измерения. "
            f"Без пояснений, только число."
        )
        try:
            response = await claude_service.complete(
                messages=[{"role": "user", "content": prompt}],
                task_type="SMETA_FROM_TZ",
                use_web_search=True,
            )
            return float(response.strip().replace(",", ".").replace(" ", ""))
        except Exception:
            return None

price_service = PriceService()
