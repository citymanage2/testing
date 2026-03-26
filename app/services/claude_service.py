"""
Thin wrapper around the Anthropic Claude API.
All AI calls go through here so the rest of the codebase stays clean.
"""
import json
from anthropic import AsyncAnthropic
from app.config import settings

client = AsyncAnthropic(api_key=settings.anthropic_api_key)

MODEL = "claude-opus-4-6"
MAX_TOKENS = 8192


async def complete(system: str, messages: list[dict], max_tokens: int = MAX_TOKENS) -> str:
    """Send messages to Claude and return the text response."""
    response = await client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=messages,
    )
    return response.content[0].text


async def complete_json(system: str, messages: list[dict], max_tokens: int = MAX_TOKENS) -> dict | list:
    """Send messages to Claude, expect JSON response, return parsed object."""
    text = await complete(system, messages, max_tokens)
    # Strip markdown fences if present
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text
        text = text.rsplit("```", 1)[0].strip()
    return json.loads(text)
