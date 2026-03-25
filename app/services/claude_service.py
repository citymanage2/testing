# app/services/claude_service.py
import asyncio
import anthropic
from app.config import settings

MAX_TOKENS = {
    "LIST_FROM_TZ": 8000,
    "LIST_FROM_TZ_PROJECT": 8000,
    "LIST_FROM_PROJECT": 8000,
    "RESEARCH_PROJECT": 8000,
    "SCAN_TO_EXCEL": 4000,
    "SMETA_FROM_LIST": 16000,
    "SMETA_FROM_TZ": 16000,
    "SMETA_FROM_TZ_PROJECT": 16000,
    "SMETA_FROM_PROJECT": 16000,
    "SMETA_FROM_EDC_PROJECT": 16000,
    "SMETA_FROM_GRAND_PROJECT": 16000,
    "COMPARE_PROJECT_SMETA": 16000,
}

class ClaudeService:
    def __init__(self):
        self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    async def complete(
        self,
        messages: list[dict],
        task_type: str,
        system: str = "",
        use_web_search: bool = False,
    ) -> str:
        max_tokens = MAX_TOKENS.get(task_type, 16000)
        tools = [{"type": "web_search_20250305", "name": "web_search"}] if use_web_search else []

        delays = [60, 120, 240]
        last_error = None

        for attempt, delay in enumerate([0] + delays):
            if delay:
                await asyncio.sleep(delay)
            try:
                kwargs: dict = dict(
                    model="claude-sonnet-4-6",
                    max_tokens=max_tokens,
                    temperature=0.1,
                    messages=messages,
                )
                if system:
                    kwargs["system"] = system
                if tools:
                    kwargs["tools"] = tools

                response = await self.client.messages.create(**kwargs)

                return "".join(
                    block.text for block in response.content
                    if hasattr(block, "text")
                )

            except anthropic.RateLimitError as e:
                last_error = e
                if attempt == len(delays):
                    raise
            except anthropic.APIStatusError as e:
                if e.status_code == 529:
                    last_error = e
                    if attempt == len(delays):
                        raise
                else:
                    raise

        raise last_error

claude_service = ClaudeService()
