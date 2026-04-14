"""
Pydantic v2 schemas for Claude responses.
All 9 task modules return JSON validated against these schemas.

Claude MUST return strict JSON (no markdown wrappers).
Arithmetic (totals, VAT, etc.) is computed by code, never by Claude.
"""
from __future__ import annotations
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


class VorItem(BaseModel):
    """Single position in a bill of quantities or estimate."""

    section: str = Field(default="", description="Work section / category")
    type: Literal["work", "material", "equipment"] = Field(
        default="work",
        description="Position type: work | material | equipment",
    )
    name: str = Field(..., min_length=1, description="Position name")
    unit: str = Field(default="шт", description="Unit of measurement")
    quantity: Optional[float] = Field(
        default=None,
        description="Volume/quantity; null if not determinable from the document",
    )
    work_price: float = Field(default=0.0, description="Unit price for labour (0.0 if N/A)")
    mat_price: float = Field(default=0.0, description="Unit price for material (0.0 if N/A)")

    # Price provenance — filled by code after enrichment, Claude sets initial value
    is_estimated: bool = Field(
        default=False,
        description="True if price was estimated by Claude (needs human review)",
    )
    source: Optional[str] = Field(
        default=None,
        description="Price source: url | 'cache' | 'api' | 'ai_estimate' | null",
    )

    # Cross-source volume tracking (LIST_FROM_TZ_PROJECT only)
    qty_from_tz: Optional[float] = Field(
        default=None,
        description="Volume from TZ (LIST_FROM_TZ_PROJECT only)",
    )
    qty_from_project: Optional[float] = Field(
        default=None,
        description="Volume from project docs (LIST_FROM_TZ_PROJECT only)",
    )
    discrepancy: bool = Field(
        default=False,
        description="True if qty_from_tz != qty_from_project or other mismatch found",
    )

    # Scan OCR flag
    scan_math_error: bool = Field(
        default=False,
        description="True if qty*price != total in the scanned document (SCAN_TO_EXCEL only)",
    )

    comment: Optional[str] = Field(
        default=None,
        description="Claude note: assumptions, ambiguities, price rationale",
    )

    @model_validator(mode="after")
    def _strip_name(self) -> "VorItem":
        self.name = self.name.strip()
        return self


class VorSection(BaseModel):
    """Section grouping a list of positions."""

    title: str = Field(default="", description="Section title")
    items: list[VorItem] = Field(default_factory=list)


class ClaudeVorResponse(BaseModel):
    """
    Top-level wrapper for all Claude responses across all 9 task modules.

    Fields meta.total_items and meta.items_without_qty are computed by code
    after validation — Claude must NOT fill them.
    """

    sections: list[VorSection] = Field(default_factory=list)
    discrepancies: list[str] = Field(
        default_factory=list,
        description="Textual descriptions of found discrepancies (modules 2.2, 2.9)",
    )

    @field_validator("discrepancies", mode="before")
    @classmethod
    def _coerce_discrepancies(cls, v: Any) -> list[str]:
        """
        Claude sometimes returns discrepancies as list of dicts instead of strings.
        Normalise any item to a string regardless of its shape.
        """
        if not isinstance(v, list):
            return []
        result = []
        for item in v:
            if isinstance(item, str):
                result.append(item)
            elif isinstance(item, dict):
                # Try common keys Claude uses, fall back to full repr
                text = (
                    item.get("description")
                    or item.get("text")
                    or item.get("message")
                    or item.get("detail")
                    or str(item)
                )
                result.append(str(text))
            else:
                result.append(str(item))
        return result

    # Computed by code after parsing — Claude leaves these at defaults
    class Meta(BaseModel):
        total_items: int = 0
        items_without_qty: int = 0

    meta: Meta = Field(default_factory=Meta)

    def all_items(self) -> list[VorItem]:
        """Flat list of all items across all sections."""
        result = []
        for section in self.sections:
            for item in section.items:
                # Carry section title down to item if item.section is blank
                if not item.section:
                    item.section = section.title
                result.append(item)
        return result

    @model_validator(mode="after")
    def _compute_meta(self) -> "ClaudeVorResponse":
        items = self.all_items()
        self.meta.total_items = len(items)
        self.meta.items_without_qty = sum(1 for i in items if i.quantity is None)
        return self
