"""
Thin wrapper around the Anthropic Claude API.
All AI calls go through here so the rest of the codebase stays clean.
"""
import json
from json_repair import repair_json
from anthropic import AsyncAnthropic
from app.config import settings

client = AsyncAnthropic(api_key=settings.anthropic_api_key)

MODEL = "claude-opus-4-6"
MAX_TOKENS = 16000


async def complete(system: str, messages: list[dict], max_tokens: int = MAX_TOKENS) -> str:
    import asyncio
    from anthropic import APIStatusError
    for attempt in range(5):
        try:
            response = await client.messages.create(
                model=MODEL, max_tokens=max_tokens, system=system, messages=messages,
            )
            return response.content[0].text
        except APIStatusError as e:
            if e.status_code == 529 and attempt < 4:
                await asyncio.sleep(2 ** attempt)
                continue
            raise


async def complete_json(system: str, messages: list[dict], max_tokens: int = MAX_TOKENS) -> dict | list:
    text = await complete(system, messages, max_tokens)
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
