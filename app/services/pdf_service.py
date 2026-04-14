"""Generate PDF report from text content."""
from fpdf import FPDF


def build_report_pdf(text: str) -> bytes:
    pdf = FPDF()
    pdf.set_margins(15, 15, 15)
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_font("Helvetica", size=10)

    # Effective column width: page width minus left+right margins
    col_w = pdf.w - pdf.l_margin - pdf.r_margin

    for line in text.split("\n"):
        # Built-in Helvetica has no Cyrillic; replace unsupported chars
        safe_line = line.encode("latin-1", errors="replace").decode("latin-1")

        if not safe_line.strip():
            pdf.ln(4)
            continue

        # Break any word longer than 80 chars so fpdf doesn't choke on it
        safe_line = _break_long_words(safe_line, 80)

        try:
            pdf.multi_cell(col_w, 5, safe_line)
        except Exception:
            # Last-resort: split into small chunks and render each on its own line
            for chunk in [safe_line[i:i + 60] for i in range(0, max(len(safe_line), 1), 60)]:
                try:
                    pdf.multi_cell(col_w, 5, chunk)
                except Exception:
                    pdf.ln(5)

    return pdf.output()


def _break_long_words(text: str, max_word: int) -> str:
    """Insert spaces into words longer than max_word to prevent fpdf overflow."""
    words = text.split(" ")
    result = []
    for word in words:
        if len(word) > max_word:
            chunks = [word[i:i + max_word] for i in range(0, len(word), max_word)]
            result.append(" ".join(chunks))
        else:
            result.append(word)
    return " ".join(result)
