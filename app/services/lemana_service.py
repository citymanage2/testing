"""
Lemana Pro (бывший Leroy Merlin Russia) — поиск материалов через мобильный API.

Для работы нужен LEMANA_API_KEY — ключ из мобильного приложения.
Как получить: перехватить трафик приложения через Charles Proxy / Burp Suite,
найти заголовок Apikey в запросах к mobile.api-lmn.ru.

Документация по API: https://github.com/Gafret/Lemana-Pro-Parser
"""
import httpx
from app.config import settings

_SEARCH_URL = "https://mobile.api-lmn.ru/mobile/v2/search"
_PRODUCT_URL = "https://lemana.pro/catalog/p/{sku}/"

# Базовые заголовки мобильного приложения
_BASE_HEADERS = {
    "User-Agent": "ktor-client",
    "Accept": "application/json",
    "Host": "mobile.api-lmn.ru",
    "Content-Type": "application/json",
    "mobile-platform": "ios",
    "app-version": "4.26.0",
}


def _headers() -> dict:
    h = dict(_BASE_HEADERS)
    if settings.lemana_api_key:
        h["Apikey"] = settings.lemana_api_key
    return h


def _best_price(product: dict) -> float:
    """Вернуть актуальную цену (со скидкой или обычную)."""
    for key in ("discount_price", "discountPrice", "salePrice", "regular_price", "regularPrice", "price"):
        v = product.get(key)
        if v and float(v) > 0:
            return float(v)
    # price may be nested
    price_obj = product.get("prices") or product.get("priceInfo") or {}
    if isinstance(price_obj, dict):
        for key in ("sale", "discount", "regular", "base"):
            v = price_obj.get(key)
            if v and float(v) > 0:
                return float(v)
    return 0.0


def _extract_items(data: dict) -> list:
    """Извлечь список товаров из разных форматов ответа API."""
    for path in [
        ["products", "items"],
        ["products"],
        ["items"],
        ["data", "items"],
        ["data"],
    ]:
        obj = data
        for key in path:
            obj = obj.get(key) if isinstance(obj, dict) else None
        if isinstance(obj, list) and obj:
            return obj
    return []


async def search_lemana(query: str, limit: int = 5) -> list[dict]:
    """
    Поиск товаров на Леман Про по названию.
    Возвращает список: [{name, price, url, sku, source}]
    """
    if not settings.lemana_api_key:
        return [{"error": "LEMANA_API_KEY не задан. Добавьте его в переменные окружения на Render."}]

    region = settings.lemana_region_id

    # Пробуем несколько форматов запроса — API мог измениться
    payloads = [
        {"query": query, "limitCount": limit, "limitFrom": 0, "regionsId": region,
         "availability": True, "showProducts": True, "showFacets": False, "showServices": False},
        {"text": query, "limitCount": limit, "limitFrom": 0, "regionsId": region,
         "availability": True, "showProducts": True, "showFacets": False, "showServices": False},
        {"searchQuery": query, "limitCount": limit, "limitFrom": 0, "regionsId": region,
         "showProducts": True, "showFacets": False},
    ]

    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        for payload in payloads:
            try:
                resp = await client.post(_SEARCH_URL, json=payload, headers=_headers())
                if resp.status_code == 401:
                    return [{"error": "Неверный LEMANA_API_KEY (401 Unauthorized)"}]
                if resp.status_code != 200:
                    continue
                data = resp.json()
                items = _extract_items(data)
                if not items:
                    continue

                results = []
                for p in items[:limit]:
                    sku = str(p.get("id") or p.get("sku") or p.get("articleNumber") or "")
                    name = p.get("name") or p.get("title") or p.get("displayName") or ""
                    price = _best_price(p)
                    unit = p.get("unit") or p.get("measureUnit") or "шт"
                    url = _PRODUCT_URL.format(sku=sku) if sku else "https://lemana.pro"
                    results.append({
                        "name": name,
                        "price": price,
                        "unit": unit,
                        "url": url,
                        "sku": sku,
                        "source": "Леман Про",
                    })
                return results

            except (httpx.TimeoutException, httpx.ConnectError):
                continue
            except Exception:
                continue

    return [{"error": "Товары не найдены. Проверьте LEMANA_API_KEY или попробуйте позже."}]
