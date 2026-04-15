"""
Thin wrapper around the Anthropic Claude API.
All AI calls go through here so the rest of the codebase stays clean.

Model selection guidelines:
  OPUS    — smeta from project docs (large context, max accuracy required)
  SONNET  — smeta from TZ/list, OCR, reports, analogue search
  HAIKU   — optimization suggestions (simple JSON, high volume)
"""
import json
from json_repair import repair_json
from anthropic import AsyncAnthropic
from app.config import settings

client = AsyncAnthropic(api_key=settings.anthropic_api_key)

OPUS = "claude-opus-4-6"
SONNET = "claude-sonnet-4-6"
HAIKU = "claude-haiku-4-5-20251001"

# Default for callers that don't specify a model
MODEL = OPUS
MAX_TOKENS = 16000
MAX_TOKENS_SMETA = 32000  # Estimates can be large — use higher limit


async def complete(
    system: str,
    messages: list[dict],
    max_tokens: int = MAX_TOKENS,
    model: str = MODEL,
    chunk_callback=None,  # async callable(chunks_received: int) | None
    chunk_callback_interval: int = 15,  # call every N chunks
) -> str:
    """
    Call Claude and return the full text response.
    Uses streaming to avoid the 10-minute timeout on long requests.

    chunk_callback — optional async function called every chunk_callback_interval chunks.
    Use it to update progress while Claude is generating a long response.
    """
    import asyncio
    from anthropic import APIStatusError, APIConnectionError, APITimeoutError

    _RETRYABLE_STATUS = {429, 500, 502, 503, 529}

    for attempt in range(5):
        try:
            chunks: list[str] = []
            chunk_count = 0
            async with client.messages.stream(
                model=model,
                max_tokens=max_tokens,
                system=system,
                messages=messages,
            ) as stream:
                async for text in stream.text_stream:
                    chunks.append(text)
                    chunk_count += 1
                    if chunk_callback and chunk_count % chunk_callback_interval == 0:
                        await chunk_callback(chunk_count)
            return "".join(chunks)
        except APIStatusError as e:
            if e.status_code in _RETRYABLE_STATUS and attempt < 4:
                await asyncio.sleep(2 ** attempt)
                continue
            raise
        except (APIConnectionError, APITimeoutError):
            if attempt < 4:
                await asyncio.sleep(2 ** attempt)
                continue
            raise


async def complete_json(system: str, messages: list[dict], max_tokens: int = MAX_TOKENS, model: str = MODEL) -> dict | list:
    text = await complete(system, messages, max_tokens, model)
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text
        text = text.rsplit("```", 1)[0].strip()
    # Find JSON boundaries
    start = text.find("{") if "{" in text else text.find("[")
    if start == -1:
        raise ValueError("No JSON found in response")
    text = text[start:]
    end = text.rfind("}") if text[0] == "{" else text.rfind("]")
    if end == -1:
        raise json.JSONDecodeError("Unterminated JSON", text, len(text))
    text = text[:end + 1]
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return json.loads(repair_json(text))
