"""Generate PDF report from text content."""
from fpdf import FPDF


def build_report_pdf(text: str) -> bytes:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # Use built-in helvetica (no Unicode) — replace Cyrillic if needed
    pdf.set_font("Helvetica", size=12)

    for line in text.split("\n"):
        # FPDF built-in fonts don't support Cyrillic; encode safely
        safe_line = line.encode("latin-1", errors="replace").decode("latin-1")
        pdf.multi_cell(0, 8, safe_line)

    return pdf.output()
