"""Generate and parse Excel estimate files."""
import io
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

_HEADER_FILL = PatternFill(fill_type="solid", fgColor="D9E1F2")
_OPT_FILL = PatternFill(fill_type="solid", fgColor="FFF3CD")
_ANALOGUE_FILL = PatternFill(fill_type="solid", fgColor="C8E6C9")
_BOLD = Font(bold=True)


def build_estimate_excel(items, filter_type: str = "all") -> bytes:
    if filter_type == "works":
        items = [i for i in items if i.type == "Работа"]
    elif filter_type == "materials":
        items = [i for i in items if i.type == "Материал"]

    wb = Workbook()
    ws = wb.active
    ws.title = {"works": "Работы", "materials": "Материалы"}.get(filter_type, "Смета")

    headers = ["№", "Раздел", "Тип", "Наименование", "Ед.", "Кол-во", "Цена работ", "Цена мат.", "Стоимость", "Источник"]
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.font = _BOLD
        cell.fill = _HEADER_FILL
        cell.alignment = Alignment(horizontal="center", wrap_text=True)

    for item in items:
        ws.append([
            item.position, item.section, item.type, item.name,
            item.unit, item.quantity, item.work_price, item.mat_price, item.total,
            getattr(item, "source_url", None) or "",
        ])
        row = ws.max_row
        if getattr(item, "is_optimized", False):
            for c in range(1, 11):
                ws.cell(row=row, column=c).fill = _OPT_FILL
        elif getattr(item, "is_analogue", False):
            for c in range(1, 11):
                ws.cell(row=row, column=c).fill = _ANALOGUE_FILL

    ws.append([])
    tr = ws.max_row + 1
    ws.cell(row=tr, column=4, value="ИТОГО").font = _BOLD
    ws.cell(row=tr, column=9, value=f"=SUM(I2:I{tr-2})").font = _BOLD

    for col, w in enumerate([5, 20, 12, 50, 8, 8, 14, 14, 14, 30], 1):
        ws.column_dimensions[get_column_letter(col)].width = w

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def parse_estimate_excel(data: bytes) -> list[dict]:
    """Parse uploaded Excel and return list of item dicts."""
    wb = load_workbook(io.BytesIO(data), read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(min_row=2, values_only=True)) if ws else []
    items = []
    for i, row in enumerate(rows):
        if not row or not any(row):
            continue
        # Try to parse: position, section, type, name, unit, qty, work_price, mat_price
        try:
            name = str(row[3]).strip() if row[3] else (str(row[0]).strip() if row[0] else "")
            if not name or name.upper() == "ИТОГО":
                continue
            items.append({
                "position": i + 1,
                "section": str(row[1]).strip() if row[1] else "",
                "type": str(row[2]).strip() if row[2] else "Работа",
                "name": name,
                "unit": str(row[4]).strip() if row[4] else "шт",
                "quantity": float(row[5]) if row[5] else 1.0,
                "work_price": float(row[6]) if row[6] else 0.0,
                "mat_price": float(row[7]) if row[7] else 0.0,
                "source_url": str(row[9]).strip() if len(row) > 9 and row[9] else None,
            })
        except (ValueError, TypeError):
            continue
    return items
