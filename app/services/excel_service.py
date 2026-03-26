"""Generate Excel estimate file from EstimateItem list."""
import io
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter


def build_estimate_excel(items) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Смета"

    # Header
    headers = ["№", "Раздел", "Тип", "Наименование", "Ед.", "Кол-во", "Цена работ", "Цена мат.", "Стоимость"]
    bold = Font(bold=True)
    fill = PatternFill(fill_type="solid", fgColor="D9E1F2")
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.font = bold
        cell.fill = fill
        cell.alignment = Alignment(horizontal="center", wrap_text=True)

    # Data rows
    for item in items:
        row = [
            item.position, item.section, item.type, item.name,
            item.unit, item.quantity, item.work_price, item.mat_price, item.total,
        ]
        ws.append(row)

    # Totals
    ws.append([])
    total_row = ws.max_row + 1
    ws.cell(row=total_row, column=4, value="ИТОГО").font = bold
    ws.cell(row=total_row, column=9, value=f"=SUM(I2:I{total_row-2})").font = bold

    # Column widths
    widths = [5, 20, 12, 50, 8, 8, 14, 14, 14]
    for col, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(col)].width = w

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
