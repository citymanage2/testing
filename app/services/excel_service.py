# app/services/excel_service.py
"""
Генерация .xlsx.
generate_list(items) → байты файла (для LIST_* задач)
generate_smeta(items, vat_rate) → байты файла (для SMETA_* задач)
"""
import io
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

HEADER_FILL = PatternFill("solid", fgColor="4472C4")
TOTAL_FILL = PatternFill("solid", fgColor="D9E1F2")
HEADER_FONT = Font(bold=True, color="FFFFFF", name="Arial", size=10)
NORMAL_FONT = Font(name="Arial", size=10)
THIN = Side(style="thin", color="CCCCCC")
ALL_BORDERS = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

def _header_row(ws, columns: list[str]):
    for col, title in enumerate(columns, 1):
        cell = ws.cell(row=1, column=col, value=title)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", wrap_text=True)
        cell.border = ALL_BORDERS

def _auto_width(ws):
    for col in ws.columns:
        max_len = max((len(str(c.value or "")) for c in col), default=10)
        ws.column_dimensions[get_column_letter(col[0].column)].width = min(max_len + 4, 60)

def generate_list(items: list[dict]) -> bytes:
    wb = Workbook()
    # Лист 1: Перечень (все позиции)
    ws_all = wb.active
    ws_all.title = "Перечень"
    _header_row(ws_all, ["№", "Тип", "Наименование", "Ед.изм.", "Кол-во", "Раздел", "Примечания"])
    for i, item in enumerate(items, 1):
        row = [i, item.get("type"), item.get("name"), item.get("unit"),
               item.get("quantity"), item.get("section"), item.get("notes")]
        for col, val in enumerate(row, 1):
            cell = ws_all.cell(row=i+1, column=col, value=val)
            cell.font = NORMAL_FONT
            cell.border = ALL_BORDERS

    # Лист 2: Работы
    ws_w = wb.create_sheet("Работы")
    works = [it for it in items if it.get("type") == "Работа"]
    _header_row(ws_w, ["№", "Наименование", "Ед.изм.", "Кол-во"])
    for i, item in enumerate(works, 1):
        for col, val in enumerate([i, item["name"], item["unit"], item["quantity"]], 1):
            ws_w.cell(row=i+1, column=col, value=val).font = NORMAL_FONT

    # Лист 3: Материалы
    ws_m = wb.create_sheet("Материалы")
    mats = [it for it in items if it.get("type") == "Материал"]
    _header_row(ws_m, ["№", "Наименование", "Ед.изм.", "Кол-во"])
    for i, item in enumerate(mats, 1):
        for col, val in enumerate([i, item["name"], item["unit"], item["quantity"]], 1):
            ws_m.cell(row=i+1, column=col, value=val).font = NORMAL_FONT

    for ws in [ws_all, ws_w, ws_m]:
        _auto_width(ws)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def generate_smeta(items: list[dict], vat_rate: float = 20.0) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Смета"
    _header_row(ws, ["№", "Раздел", "Тип", "Наименование", "Ед.", "Кол-во",
                     "Цена работ", "Цена материалов", "Стоимость работ",
                     "Стоимость материалов", "Итого"])

    # Группировка по разделам
    from itertools import groupby
    items_sorted = sorted(items, key=lambda x: (x.get("section") or "Без раздела"))
    row = 2
    total_work = total_mat = 0.0

    for section, group in groupby(items_sorted, key=lambda x: x.get("section") or "Без раздела"):
        group_list = list(group)
        sec_work = sec_mat = 0.0

        for i, item in enumerate(group_list, 1):
            qty = item.get("quantity", 0)
            wp = item.get("work_price", 0)
            mp = item.get("mat_price", 0)
            cost_w = qty * wp
            cost_m = qty * mp
            sec_work += cost_w
            sec_mat += cost_m

            values = [i, section if i == 1 else "", item.get("type"), item.get("name"),
                      item.get("unit"), qty, wp, mp, cost_w, cost_m, cost_w + cost_m]
            for col, val in enumerate(values, 1):
                cell = ws.cell(row=row, column=col, value=val)
                cell.font = NORMAL_FONT
                cell.border = ALL_BORDERS
                if col in (7, 8, 9, 10, 11):
                    cell.number_format = '#,##0.00'
            row += 1

        # Итог по разделу
        for col in range(1, 12):
            cell = ws.cell(row=row, column=col)
            cell.fill = TOTAL_FILL
            cell.font = Font(bold=True, name="Arial", size=10)
            cell.border = ALL_BORDERS
        ws.cell(row=row, column=3, value=f"Итого по разделу: {section}")
        ws.cell(row=row, column=9, value=sec_work).number_format = '#,##0.00'
        ws.cell(row=row, column=10, value=sec_mat).number_format = '#,##0.00'
        ws.cell(row=row, column=11, value=sec_work + sec_mat).number_format = '#,##0.00'
        total_work += sec_work
        total_mat += sec_mat
        row += 2  # пустая строка между разделами

    # Итоговые строки
    total = total_work + total_mat
    vat_amount = total * vat_rate / 100
    for label, value in [
        ("Итого работы:", total_work),
        ("Итого материалы:", total_mat),
        ("Итого без НДС:", total),
        (f"НДС {vat_rate:.0f}%:", vat_amount),
        ("ИТОГО С НДС:", total + vat_amount),
    ]:
        for col in range(1, 12):
            cell = ws.cell(row=row, column=col)
            cell.fill = TOTAL_FILL
            cell.font = Font(bold=True, name="Arial", size=10)
            cell.border = ALL_BORDERS
        ws.cell(row=row, column=3, value=label)
        ws.cell(row=row, column=11, value=value).number_format = '#,##0.00'
        row += 1

    _auto_width(ws)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
