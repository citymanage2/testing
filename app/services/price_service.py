"""In-memory price cache loaded from the database."""
from sqlalchemy import select
from app.database import SessionLocal
from app.models.price import PriceWork, PriceMaterial


class PriceService:
    def __init__(self):
        self._works: dict[str, dict] = {}   # name -> {unit, min_price}
        self._materials: dict[str, dict] = {}  # name -> {unit, price}

    async def load_cache(self):
        async with SessionLocal() as db:
            works = (await db.execute(select(PriceWork))).scalars().all()
            self._works = {w.name.lower(): {"unit": w.unit, "price": w.min_price} for w in works}
            mats = (await db.execute(select(PriceMaterial))).scalars().all()
            self._materials = {m.name.lower(): {"unit": m.unit, "price": m.price} for m in mats}

    async def reload_cache(self):
        await self.load_cache()

    def lookup_work(self, name: str) -> float | None:
        return self._works.get(name.lower(), {}).get("price")

    def lookup_material(self, name: str) -> float | None:
        return self._materials.get(name.lower(), {}).get("price")


price_service = PriceService()
