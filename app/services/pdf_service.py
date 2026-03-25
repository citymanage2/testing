# app/services/pdf_service.py
"""
Генерация PDF отчёта сравнения (COMPARE_PROJECT_SMETA).
Использует fpdf2 — нет системных зависимостей.
"""
import io
from fpdf import FPDF
from app.config import settings

class SmetaPDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(46, 95, 163)
        self.cell(0, 10, "Smeta AI — Отчёт сравнения", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(128)
        self.cell(0, 10, f"Стр. {self.page_no()}", align="C")


def generate_comparison_report(comparison_data: dict) -> bytes:
    """
    comparison_data — распарсенный JSON-ответ Claude для COMPARE_PROJECT_SMETA.
    Структура: {summary, discrepancies, missing_in_smeta, missing_in_project, recommendations}
    """
    pdf = SmetaPDF(orientation="P", unit="mm", format="A4")
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    summary = comparison_data.get("summary", {})
    discrepancies = comparison_data.get("discrepancies", [])
    recommendations = comparison_data.get("recommendations", [])

    # Сводные карточки
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(0)
    pdf.cell(0, 8, "Сводная информация", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", size=10)

    for label, value in [
        ("Итого по проекту:", f"{summary.get('project_total', 0):,.2f} руб."),
        ("Итого по смете:", f"{summary.get('smeta_total', 0):,.2f} руб."),
        ("Расхождение:", f"{summary.get('difference', 0):,.2f} руб. ({summary.get('difference_pct', 0):.1f}%)"),
    ]:
        pdf.cell(70, 7, label)
        pdf.cell(0, 7, value, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)

    # Таблица расхождений
    if discrepancies:
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 8, "Расхождения", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "B", 9)

        col_widths = [80, 30, 30, 25, 25]
        headers = ["Наименование", "По проекту", "По смете", "Разница %", "Статус"]
        for w, h in zip(col_widths, headers):
            pdf.cell(w, 7, h, border=1)
        pdf.ln()

        pdf.set_font("Helvetica", size=9)
        for d in discrepancies:
            severity_color = {
                "critical": (192, 57, 43),
                "warning": (214, 137, 16),
                "ok": (30, 126, 52),
            }.get(d.get("severity", "ok"), (0, 0, 0))

            pdf.cell(80, 6, str(d.get("name", ""))[:50], border=1)
            pdf.cell(30, 6, f"{d.get('project_value') or '-'}", border=1, align="R")
            pdf.cell(30, 6, f"{d.get('smeta_value') or '-'}", border=1, align="R")
            pdf.cell(25, 6, f"{d.get('difference_pct', 0):.1f}%", border=1, align="R")
            pdf.set_text_color(*severity_color)
            pdf.cell(25, 6, d.get("severity", ""), border=1, align="C")
            pdf.set_text_color(0)
            pdf.ln()
        pdf.ln(5)

    # Рекомендации
    if recommendations:
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 8, "Рекомендации", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", size=10)
        for i, rec in enumerate(recommendations, 1):
            pdf.multi_cell(0, 6, f"{i}. {rec}")
        pdf.ln(3)

    return pdf.output()
