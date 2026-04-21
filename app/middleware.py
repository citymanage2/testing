"""HTTP-middleware для наблюдаемости v2.

RequestLoggingMiddleware:
  - Назначает каждому запросу уникальный X-Request-ID (8 hex-символов).
  - Логирует: метод, путь, статус, длительность (мс) и request_id.
  - При необработанном исключении логирует traceback с тем же request_id.
  - Сохраняет request_id в request.state для использования в обработчиках (500-handler).
"""
import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("app.request")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = uuid.uuid4().hex[:8]
        request.state.request_id = request_id

        start = time.monotonic()
        try:
            response = await call_next(request)
        except Exception:
            raise  # исключение логируется в глобальном exception_handler (main.py)

        duration_ms = round((time.monotonic() - start) * 1000)
        logger.info(
            "%s %s → %d (%dms) id=%s",
            request.method, request.url.path,
            response.status_code, duration_ms, request_id,
        )
        response.headers["X-Request-ID"] = request_id
        return response
