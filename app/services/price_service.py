"""In-memory price cache loaded from the database."""
from sqlalchemy import select
from app.database import SessionLocal
from app.models.price import PriceWork, PriceMaterial

_FUZZY_THRESHOLD = 80  # minimum similarity score (0-100) to accept a match


class PriceService:
    def __init__(self):
        self._works: dict[str, dict] = {}     # name_lower -> {unit, price}
        self._materials: dict[str, dict] = {}  # name_lower -> {unit, price}
        self._work_keys: list[str] = []
        self._material_keys: list[str] = []

    async def load_cache(self):
        async with SessionLocal() as db:
            works = (await db.execute(select(PriceWork))).scalars().all()
            self._works = {w.name.lower(): {"unit": w.unit, "price": w.min_price} for w in works}
            mats = (await db.execute(select(PriceMaterial))).scalars().all()
            self._materials = {m.name.lower(): {"unit": m.unit, "price": m.price} for m in mats}
        self._work_keys = list(self._works.keys())
        self._material_keys = list(self._materials.keys())

    async def reload_cache(self):
        await self.load_cache()

    def _fuzzy_lookup(self, name: str, mapping: dict, keys: list[str]) -> float | None:
        key = name.lower()
        # Exact match first (fastest path)
        if key in mapping:
            return mapping[key].get("price")
        if not keys:
            return None
        try:
            from rapidfuzz import process, fuzz
            match = process.extractOne(key, keys, scorer=fuzz.token_set_ratio)
            if match and match[1] >= _FUZZY_THRESHOLD:
                return mapping[match[0]].get("price")
        except ImportError:
            pass
        return None

    def lookup_work(self, name: str) -> float | None:
        return self._fuzzy_lookup(name, self._works, self._work_keys)

    def lookup_material(self, name: str) -> float | None:
        return self._fuzzy_lookup(name, self._materials, self._material_keys)


price_service = PriceService()
