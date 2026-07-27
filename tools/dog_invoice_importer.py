#!/usr/bin/env python3
"""
Setup:
- pip install pandas openpyxl pdfplumber pymupdf pillow pytesseract
- macOS OCR dependency: brew install tesseract

Usage notes:
- Set ROOT_FOLDER to the parent folder that contains your invoice subfolders.
- Subfolders can be named however you want, including year/month layouts like 2025/januari or 2026/februari.
- The script scans recursively, so it does not require month folders to be numbered.
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from html import escape
from pathlib import Path
from typing import Iterable

import fitz  # PyMuPDF
import pandas as pd
import pdfplumber
import pytesseract
from PIL import Image

ROOT_FOLDER = "/Users/Paul/documents/Elise/Babs/facturen"
OUTPUT_FILE = "dog_expenses.xlsx"
HTML_REPORT_FILE = "dog_expenses_report.html"
MAIN_SHEET_NAME = "expenses"
STATE_SHEET_NAME = "_import_state"
SUMMARY_CATEGORY_SHEET_NAME = "totals_by_category"
SUMMARY_YEAR_SHEET_NAME = "totals_by_year"
SUMMARY_CATEGORY_YEAR_SHEET_NAME = "totals_cat_year"
NO_AMOUNT_SHEET_NAME = "no_amount_review"
SUPPORTED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
CATEGORIES = [
    "Voer",
    "Verzorging",
    "Kleding",
    "Speeltjes",
    "Training",
    "Verzekering",
]
CATEGORY_KEYWORDS = {
    "Voer": [
        "voer",
        "brok",
        "brokken",
        "voeding",
        "food",
        "kibble",
        "snack",
        "snacks",
        "treat",
        "treats",
    ],
    "Verzorging": [
        "verzorging",
        "groom",
        "grooming",
        "shampoo",
        "borstel",
        "brush",
        "nagel",
        "nail",
        "vacht",
        "fur",
        "hygiene",
    ],
    "Kleding": [
        "kleding",
        "jas",
        "jacket",
        "coat",
        "trui",
        "shirt",
        "harnas",
        "harness",
        "schoen",
        "boot",
        "regenjas",
    ],
    "Speeltjes": [
        "speeltje",
        "speeltjes",
        "toy",
        "toys",
        "bal",
        "ball",
        "kauw",
        "chew",
        "plush",
        "tug",
    ],
    "Training": [
        "training",
        "cursus",
        "course",
        "trainer",
        "puppy class",
        "obedience",
        "behavior",
        "gedrag",
        "workshop",
        "les",
    ],
    "Verzekering": [
        "verzekering",
        "verzekeraar",
        "insurance",
        "premium",
        "premie",
        "polis",
        "policy",
        "dekking",
    ],
}
OUTPUT_COLUMNS = [
    "source_key",
    "file_name",
    "date",
    "detected_amount",
    "suggested_category",
    "category",
    "final_amount",
    "ignore",
    "no_amount_reviewed",
    "notes",
]
KEYWORD_PATTERNS = [
    "total",
    "totaal",
    "amount due",
    "te betalen",
    "paid",
    "betaald",
]
AMOUNT_PATTERN = re.compile(
    r"(?<!\d)(?:EUR\s*|€\s*)?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{2})(?!\d)",
    re.IGNORECASE,
)
DATE_PATTERNS = [
    re.compile(r"(?<!\d)((?:19|20)\d{2})[-_/](0[1-9]|1[0-2])[-_/](0[1-9]|[12]\d|3[01])(?!\d)"),
    re.compile(r"(?<!\d)((?:19|20)\d{2})[-_/](0[1-9]|1[0-2])(?!\d)"),
]
MONTH_NAMES = {
    "01": ("januari", "january", "jan"),
    "02": ("februari", "february", "feb"),
    "03": ("maart", "march", "mrt", "mar"),
    "04": ("april", "apr"),
    "05": ("mei", "may"),
    "06": ("juni", "june", "jun"),
    "07": ("juli", "july", "jul"),
    "08": ("augustus", "august", "aug"),
    "09": ("september", "sep", "sept"),
    "10": ("oktober", "october", "okt", "oct"),
    "11": ("november", "nov"),
    "12": ("december", "dec"),
}
MONTH_NUMBER_LOOKUP = {
    alias: month_number
    for month_number, aliases in MONTH_NAMES.items()
    for alias in aliases
}
MONTH_LABEL_LOOKUP = {month_number: aliases[0].capitalize() for month_number, aliases in MONTH_NAMES.items()}


@dataclass
class ProcessResult:
    source_key: str
    file_name: str
    date: str
    detected_amount: str
    suggested_category: str


def scan_invoice_files(root_folder: Path) -> list[Path]:
    return sorted(
        path
        for path in root_folder.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS and path.name != OUTPUT_FILE
    )


def extract_pdf_text_with_pdfplumber(file_path: Path) -> str:
    text_parts: list[str] = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            if page_text.strip():
                text_parts.append(page_text)
    return "\n".join(text_parts).strip()


def extract_pdf_text_with_fitz(file_path: Path) -> str:
    text_parts: list[str] = []
    with fitz.open(file_path) as document:
        for page in document:
            page_text = page.get_text("text") or ""
            if page_text.strip():
                text_parts.append(page_text)
    return "\n".join(text_parts).strip()


def extract_text_from_pdf(file_path: Path) -> str:
    try:
        text = extract_pdf_text_with_pdfplumber(file_path)
        if text:
            return text
    except Exception:
        pass

    return extract_pdf_text_with_fitz(file_path)


def extract_text_from_image(file_path: Path) -> str:
    with Image.open(file_path) as image:
        return pytesseract.image_to_string(image).strip()


def extract_text(file_path: Path) -> str:
    if file_path.suffix.lower() == ".pdf":
        return extract_text_from_pdf(file_path)
    return extract_text_from_image(file_path)


def normalize_amount(amount_text: str) -> Decimal | None:
    cleaned = amount_text.strip().replace(" ", "")
    if "," in cleaned and "." in cleaned:
        if cleaned.rfind(",") > cleaned.rfind("."):
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif "," in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")

    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return None


def extract_amounts_from_lines(lines: Iterable[str]) -> list[Decimal]:
    amounts: list[Decimal] = []
    for line in lines:
        for match in AMOUNT_PATTERN.findall(line):
            parsed = normalize_amount(match)
            if parsed is not None:
                amounts.append(parsed)
    return amounts


def find_best_amount(text: str) -> Decimal | None:
    if not text.strip():
        return None

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    keyword_lines = [
        line
        for line in lines
        if any(keyword in line.lower() for keyword in KEYWORD_PATTERNS)
    ]

    keyword_amounts = extract_amounts_from_lines(keyword_lines)
    if keyword_amounts:
        return max(keyword_amounts)

    all_amounts = extract_amounts_from_lines(lines)
    if all_amounts:
        return max(all_amounts)

    return None


def format_amount(amount: Decimal | None) -> str:
    if amount is None:
        return ""
    return f"{amount:.2f}"


def extract_date_from_text(source_text: str) -> str:
    for pattern in DATE_PATTERNS:
        match = pattern.search(source_text)
        if not match:
            continue
        parts = match.groups()
        if len(parts) == 3:
            year, month, day = parts
            return f"{year}-{month}-{day}"
        year, month = parts
        return f"{year}-{month}"
    return ""


def extract_date(file_path: Path, root_folder: Path) -> str:
    relative_path = file_path.relative_to(root_folder).as_posix()
    date_value = extract_date_from_text(relative_path)
    if date_value:
        return date_value
    return extract_date_from_text(file_path.stem)


def extract_year(value: str) -> str:
    match = re.search(r"((?:19|20)\d{2})", value)
    return match.group(1) if match else ""


def extract_month(value: str) -> str:
    normalized = str(value).lower()

    date_match = re.search(r"(?:19|20)\d{2}[-_/](0[1-9]|1[0-2])(?:[-_/](0[1-9]|[12]\d|3[01]))?", normalized)
    if date_match:
        month_number = date_match.group(1)
        return MONTH_LABEL_LOOKUP.get(month_number, "")

    path_tokens = re.split(r"[^a-z0-9]+", normalized)
    for token in path_tokens:
        if token in MONTH_NUMBER_LOOKUP:
            return MONTH_LABEL_LOOKUP[MONTH_NUMBER_LOOKUP[token]]
        if re.fullmatch(r"0[1-9]|1[0-2]", token):
            return MONTH_LABEL_LOOKUP.get(token, "")
    return ""


def detect_category(text: str, file_path: Path, root_folder: Path) -> str:
    haystack = f"{file_path.relative_to(root_folder).as_posix()}\n{text}".lower()
    scores = {
        category: sum(1 for keyword in keywords if keyword in haystack)
        for category, keywords in CATEGORY_KEYWORDS.items()
    }
    best_category, best_score = max(scores.items(), key=lambda item: item[1], default=("", 0))
    if best_score > 0:
        return best_category
    return ""


def load_existing_workbook(output_path: Path) -> pd.DataFrame:
    if not output_path.exists():
        return pd.DataFrame(columns=OUTPUT_COLUMNS)

    existing_df = pd.read_excel(output_path, sheet_name=MAIN_SHEET_NAME, engine="openpyxl")
    for column in OUTPUT_COLUMNS:
        if column not in existing_df.columns:
            existing_df[column] = ""
    return existing_df[OUTPUT_COLUMNS].fillna("")


def load_known_source_keys(output_path: Path, existing_df: pd.DataFrame) -> set[str]:
    if not output_path.exists():
        return set()

    workbook = pd.ExcelFile(output_path, engine="openpyxl")
    if STATE_SHEET_NAME in workbook.sheet_names:
        state_df = pd.read_excel(output_path, sheet_name=STATE_SHEET_NAME, engine="openpyxl")
        if "source_key" in state_df.columns:
            return {str(value).strip() for value in state_df["source_key"] if str(value).strip()}

    return {str(value).strip() for value in existing_df["source_key"] if str(value).strip()}


def build_result(file_path: Path, root_folder: Path) -> ProcessResult:
    text = extract_text(file_path)
    amount = find_best_amount(text)
    return ProcessResult(
        source_key=file_path.relative_to(root_folder).as_posix(),
        file_name=file_path.name,
        date=extract_date(file_path, root_folder),
        detected_amount=format_amount(amount),
        suggested_category=detect_category(text, file_path, root_folder),
    )


def append_new_rows(existing_df: pd.DataFrame, new_results: list[ProcessResult]) -> pd.DataFrame:
    if not new_results:
        return existing_df.copy()

    new_df = pd.DataFrame(
        [
            {
                "source_key": result.source_key,
                "file_name": result.file_name,
                "date": result.date,
                "detected_amount": result.detected_amount,
                "suggested_category": result.suggested_category,
                "category": "",
                "final_amount": "",
                "ignore": "",
                "no_amount_reviewed": "",
                "notes": "",
            }
            for result in new_results
        ],
        columns=OUTPUT_COLUMNS,
    )
    return pd.concat([existing_df, new_df], ignore_index=True)


def to_bool_flag(value: object) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "y", "ja"}


def resolve_effective_amount(row: pd.Series) -> Decimal | None:
    final_amount = normalize_amount(str(row.get("final_amount", "")))
    if final_amount is not None:
        return final_amount
    return normalize_amount(str(row.get("detected_amount", "")))


def resolve_category(row: pd.Series) -> str:
    manual_category = str(row.get("category", "")).strip()
    if manual_category:
        return manual_category
    return str(row.get("suggested_category", "")).strip()


def escape_excel_formula_text(value: str) -> str:
    return value.replace('"', '""')


def build_file_link(file_path: Path) -> str:
    return f'=HYPERLINK("{escape_excel_formula_text(file_path.as_uri())}", "Open file")'


def build_category_summary(dataframe: pd.DataFrame) -> pd.DataFrame:
    totals: dict[str, Decimal] = {}
    for _, row in dataframe.iterrows():
        if to_bool_flag(row.get("ignore", "")):
            continue
        amount = resolve_effective_amount(row)
        if amount is None:
            continue
        category = resolve_category(row) or "Uncategorized"
        totals[category] = totals.get(category, Decimal("0")) + amount

    summary_rows = [
        {"category": category, "total_amount": f"{total:.2f}"}
        for category, total in sorted(totals.items())
    ]
    return pd.DataFrame(summary_rows, columns=["category", "total_amount"])


def build_year_summary(dataframe: pd.DataFrame) -> pd.DataFrame:
    totals: dict[str, Decimal] = {}
    for _, row in dataframe.iterrows():
        if to_bool_flag(row.get("ignore", "")):
            continue
        amount = resolve_effective_amount(row)
        if amount is None:
            continue
        year_source = str(row.get("date", "")).strip() or str(row.get("source_key", "")).strip()
        year = extract_year(year_source)
        if not year:
            year = "Unknown"
        totals[year] = totals.get(year, Decimal("0")) + amount

    summary_rows = [
        {"year": year, "total_amount": f"{total:.2f}"}
        for year, total in sorted(totals.items())
    ]
    return pd.DataFrame(summary_rows, columns=["year", "total_amount"])


def build_category_year_summary(dataframe: pd.DataFrame) -> pd.DataFrame:
    totals: dict[tuple[str, str], Decimal] = {}
    for _, row in dataframe.iterrows():
        if to_bool_flag(row.get("ignore", "")):
            continue
        amount = resolve_effective_amount(row)
        if amount is None:
            continue
        year_source = str(row.get("date", "")).strip() or str(row.get("source_key", "")).strip()
        year = extract_year(year_source) or "Unknown"
        category = resolve_category(row) or "Uncategorized"
        totals[(year, category)] = totals.get((year, category), Decimal("0")) + amount

    summary_rows = [
        {"year": year, "category": category, "total_amount": f"{total:.2f}"}
        for (year, category), total in sorted(totals.items())
    ]
    return pd.DataFrame(summary_rows, columns=["year", "category", "total_amount"])


def build_no_amount_review_df(dataframe: pd.DataFrame, root_folder: Path) -> pd.DataFrame:
    review_rows: list[dict[str, str]] = []
    for _, row in dataframe.iterrows():
        if to_bool_flag(row.get("ignore", "")):
            continue
        if to_bool_flag(row.get("no_amount_reviewed", "")):
            continue
        if resolve_effective_amount(row) is not None:
            continue

        source_key = str(row.get("source_key", "")).strip()
        if not source_key:
            continue

        file_path = root_folder / source_key
        review_rows.append(
            {
                "source_key": source_key,
                "file_name": str(row.get("file_name", "")).strip(),
                "date": str(row.get("date", "")).strip(),
                "suggested_category": str(row.get("suggested_category", "")).strip(),
                "category": str(row.get("category", "")).strip(),
                "notes": str(row.get("notes", "")).strip(),
                "file_link": build_file_link(file_path),
                "how_to_remove": "Set final_amount/category or mark no_amount_reviewed=yes in expenses",
            }
        )

    return pd.DataFrame(
        review_rows,
        columns=[
            "source_key",
            "file_name",
            "date",
            "suggested_category",
            "category",
            "notes",
            "file_link",
            "how_to_remove",
        ],
    )


def build_year_detail_dfs(dataframe: pd.DataFrame) -> dict[str, pd.DataFrame]:
    year_rows: dict[str, list[dict[str, str]]] = {}

    for _, row in dataframe.iterrows():
        if to_bool_flag(row.get("ignore", "")):
            continue
        amount = resolve_effective_amount(row)
        if amount is None:
            continue

        source_key = str(row.get("source_key", "")).strip()
        date_value = str(row.get("date", "")).strip()
        year = extract_year(date_value or source_key)
        if not year:
            continue

        month = extract_month(date_value or source_key)
        year_rows.setdefault(year, []).append(
            {
                "month": month,
                "file_name": str(row.get("file_name", "")).strip(),
                "date": date_value,
                "category": resolve_category(row) or "Uncategorized",
                "amount": f"{amount:.2f}",
                "source_key": source_key,
                "notes": str(row.get("notes", "")).strip(),
            }
        )

    detail_dfs: dict[str, pd.DataFrame] = {}
    month_order = {label: index for index, label in enumerate(MONTH_LABEL_LOOKUP.values(), start=1)}
    for year, rows in year_rows.items():
        sorted_rows = sorted(
            rows,
            key=lambda item: (
                month_order.get(item["month"], 99),
                item["date"],
                item["file_name"],
            ),
        )
        detail_dfs[year] = pd.DataFrame(
            sorted_rows,
            columns=["month", "file_name", "date", "category", "amount", "source_key", "notes"],
        )

    return detail_dfs


def decimal_to_float(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return float(value)


def build_dashboard_payload(dataframe: pd.DataFrame, root_folder: Path) -> dict[str, object]:
    visible_rows: list[dict[str, object]] = []
    missing_rows: list[dict[str, object]] = []
    year_totals: dict[str, float] = defaultdict(float)
    category_totals: dict[str, float] = defaultdict(float)
    category_year_totals: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    year_month_category_totals: dict[str, dict[tuple[str, str], float]] = defaultdict(lambda: defaultdict(float))
    month_order = {label: index for index, label in enumerate(MONTH_LABEL_LOOKUP.values(), start=1)}

    for _, row in dataframe.iterrows():
        source_key = str(row.get("source_key", "")).strip()
        if not source_key:
            continue

        ignored = to_bool_flag(row.get("ignore", ""))
        reviewed_missing = to_bool_flag(row.get("no_amount_reviewed", ""))
        file_name = str(row.get("file_name", "")).strip()
        date_value = str(row.get("date", "")).strip()
        category = resolve_category(row) or "Uncategorized"
        detected_amount = str(row.get("detected_amount", "")).strip()
        final_amount = str(row.get("final_amount", "")).strip()
        notes = str(row.get("notes", "")).strip()
        effective_amount = resolve_effective_amount(row)
        year = extract_year(date_value or source_key) or "Unknown"
        month = extract_month(date_value or source_key) or "Onbekend"
        file_uri = (root_folder / source_key).as_uri()

        base_row = {
            "source_key": source_key,
            "file_name": file_name,
            "date": date_value,
            "category": category,
            "suggested_category": str(row.get("suggested_category", "")).strip(),
            "detected_amount": detected_amount,
            "final_amount": final_amount,
            "effective_amount": decimal_to_float(effective_amount),
            "ignore": ignored,
            "no_amount_reviewed": reviewed_missing,
            "notes": notes,
            "year": year,
            "month": month,
            "file_uri": file_uri,
        }

        visible_rows.append(base_row)

        if ignored:
            continue

        if effective_amount is None and not reviewed_missing:
            missing_rows.append(base_row)
            continue

        if effective_amount is None:
            continue

        amount_float = float(effective_amount)
        year_totals[year] += amount_float
        category_totals[category] += amount_float
        category_year_totals[year][category] += amount_float
        year_month_category_totals[year][(month, category)] += amount_float

    year_cards = [
        {"year": year, "total_amount": round(total, 2)}
        for year, total in sorted(year_totals.items())
    ]
    category_cards = [
        {"category": category, "total_amount": round(total, 2)}
        for category, total in sorted(category_totals.items())
    ]
    category_year_rows = [
        {"year": year, "category": category, "total_amount": round(total, 2)}
        for year, categories in sorted(category_year_totals.items())
        for category, total in sorted(categories.items())
    ]
    year_detail_sections = [
        {
            "year": year,
            "rows": sorted(
                [
                    {
                        "month": month,
                        "month_order": month_order.get(month, 99),
                        "category": category,
                        "amount": round(total, 2),
                    }
                    for (month, category), total in rows.items()
                ],
                key=lambda item: (item["month_order"], item["category"]),
            ),
        }
        for year, rows in sorted(year_month_category_totals.items())
    ]

    return {
        "generated_file": HTML_REPORT_FILE,
        "year_totals": year_cards,
        "category_totals": category_cards,
        "category_year_totals": category_year_rows,
        "missing_rows": missing_rows,
        "all_rows": visible_rows,
        "year_details": year_detail_sections,
    }


def render_html_report(payload: dict[str, object], output_path: Path) -> None:
    title = "Dog Expenses Dashboard"
    json_payload = json.dumps(payload, ensure_ascii=False)
    html = """<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>__TITLE__</title>
  <style>
    :root {{
      --bg: #f6f2e8;
      --panel: #fffdf8;
      --panel-strong: #efe4d1;
      --ink: #1e1c18;
      --muted: #6e665d;
      --accent: #ad6c2f;
      --accent-soft: #e9c89e;
      --border: #dbcdb8;
      --danger: #9a3b2f;
      --shadow: 0 12px 30px rgba(73, 46, 20, 0.10);
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(233, 200, 158, 0.45), transparent 30%),
        linear-gradient(180deg, #f8f3ea 0%, #f1ebdf 100%);
    }}
    .wrap {{
      max-width: 1280px;
      margin: 0 auto;
      padding: 32px 20px 48px;
    }}
    .hero {{
      background: linear-gradient(135deg, rgba(173, 108, 47, 0.18), rgba(255,255,255,0.75));
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 28px;
      box-shadow: var(--shadow);
      margin-bottom: 24px;
    }}
    h1, h2, h3 {{ margin: 0 0 12px; }}
    p {{ margin: 0; color: var(--muted); line-height: 1.5; }}
    .controls {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin: 24px 0;
    }}
    .control, .panel {{
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 18px;
      box-shadow: var(--shadow);
    }}
    .control {{ padding: 14px; }}
    label {{ display: block; font-size: 13px; font-weight: 700; margin-bottom: 8px; color: var(--muted); }}
    select, input {{
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 10px 12px;
      font: inherit;
      background: #fff;
      color: var(--ink);
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
      margin-bottom: 24px;
    }}
    .card {{
      padding: 18px;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 18px;
      box-shadow: var(--shadow);
    }}
    .eyebrow {{ font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }}
    .amount {{ font-size: 32px; font-weight: 800; margin-top: 10px; }}
    .layout {{
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 18px;
      align-items: start;
    }}
    .panel {{
      padding: 18px;
      margin-bottom: 18px;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }}
    th, td {{
      text-align: left;
      padding: 10px 8px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
    }}
    th {{ color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }}
    .pill {{
      display: inline-block;
      padding: 5px 10px;
      border-radius: 999px;
      background: var(--panel-strong);
      font-size: 12px;
      font-weight: 700;
    }}
    .danger {{
      color: var(--danger);
      font-weight: 700;
    }}
    .year-section + .year-section {{ margin-top: 20px; }}
    a {{ color: var(--accent); text-decoration: none; font-weight: 700; }}
    a:hover {{ text-decoration: underline; }}
    .empty {{
      color: var(--muted);
      padding: 18px 0 6px;
    }}
    @media (max-width: 960px) {{
      .layout {{ grid-template-columns: 1fr; }}
      .wrap {{ padding: 20px 14px 36px; }}
      .hero {{ padding: 20px; }}
    }}
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <h1>Dog Expenses Dashboard</h1>
      <p>Gebruik Excel om bedragen en categorieën te corrigeren. Gebruik dit rapport om snel te zien waar het geld per jaar, maand en categorie naartoe gaat.</p>
    </section>

    <section class="controls">
      <div class="control">
        <label for="yearFilter">Jaar</label>
        <select id="yearFilter"><option value="">Alle jaren</option></select>
      </div>
      <div class="control">
        <label for="categoryFilter">Categorie</label>
        <select id="categoryFilter"><option value="">Alle categorieën</option></select>
      </div>
      <div class="control">
        <label for="monthFilter">Maand</label>
        <select id="monthFilter"><option value="">Alle maanden</option></select>
      </div>
      <div class="control">
        <label for="searchInput">Zoeken</label>
        <input id="searchInput" type="search" placeholder="Bestandsnaam of notities">
      </div>
    </section>

    <section class="grid" id="topCards"></section>

    <section class="layout">
      <div>
        <div class="panel">
          <h2>Uitgaven</h2>
          <p id="tableSummary"></p>
          <div id="expensesTable"></div>
        </div>
        <div class="panel">
          <h2>Jaaroverzichten per maand</h2>
          <div id="yearDetails"></div>
        </div>
      </div>
      <div>
        <div class="panel">
          <h2>Totalen per categorie per jaar</h2>
          <div id="categoryYearTable"></div>
        </div>
        <div class="panel">
          <h2>Geen bedrag gevonden</h2>
          <p>Deze documenten hebben nog aandacht nodig. Zodra je in Excel een <span class="pill">final_amount</span> invult of <span class="pill">no_amount_reviewed=yes</span> zet, verdwijnen ze uit deze lijst.</p>
          <div id="missingTable"></div>
        </div>
      </div>
    </section>
  </div>

  <script>
    const payload = __JSON_PAYLOAD__;
    const euro = new Intl.NumberFormat("nl-NL", {{ style: "currency", currency: "EUR" }});
    const monthOrder = ["Januari","Februari","Maart","April","Mei","Juni","Juli","Augustus","September","Oktober","November","December","Onbekend"];

    function fileHref(uri) {{
      return uri || "#";
    }}

    function uniqueSorted(values, customOrder = null) {{
      const items = [...new Set(values.filter(Boolean))];
      if (customOrder) {{
        return items.sort((a, b) => {{
          const ai = customOrder.indexOf(a);
          const bi = customOrder.indexOf(b);
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.localeCompare(b, "nl");
        }});
      }}
      return items.sort((a, b) => a.localeCompare(b, "nl"));
    }}

    function fillSelect(id, values, customOrder = null) {{
      const select = document.getElementById(id);
      for (const value of uniqueSorted(values, customOrder)) {{
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      }}
    }}

    function getFilters() {{
      return {{
        year: document.getElementById("yearFilter").value,
        category: document.getElementById("categoryFilter").value,
        month: document.getElementById("monthFilter").value,
        search: document.getElementById("searchInput").value.trim().toLowerCase(),
      }};
    }}

    function matchesFilters(row, filters) {{
      if (row.ignore) return false;
      if (filters.year && row.year !== filters.year) return false;
      if (filters.category && row.category !== filters.category) return false;
      if (filters.month && row.month !== filters.month) return false;
      if (filters.search) {{
        const haystack = [row.file_name, row.notes, row.source_key].join(" ").toLowerCase();
        if (!haystack.includes(filters.search)) return false;
      }}
      return row.effective_amount !== null;
    }}

    function renderCards(rows) {{
      const total = rows.reduce((sum, row) => sum + (row.effective_amount || 0), 0);
      const count = rows.length;
      const categories = new Set(rows.map(row => row.category).filter(Boolean)).size;
      const years = new Set(rows.map(row => row.year).filter(Boolean)).size;
      const cards = [
        {{ label: "Totaal zichtbaar", value: euro.format(total) }},
        {{ label: "Aantal uitgaven", value: String(count) }},
        {{ label: "Categorieën in selectie", value: String(categories) }},
        {{ label: "Jaren in selectie", value: String(years) }},
      ];
      document.getElementById("topCards").innerHTML = cards.map(card => `
        <article class="card">
          <div class="eyebrow">${{card.label}}</div>
          <div class="amount">${{card.value}}</div>
        </article>
      `).join("");
    }}

    function renderExpensesTable(rows) {{
      document.getElementById("tableSummary").textContent = `${rows.length} uitgaven in beeld`;
      if (!rows.length) {{
        document.getElementById("expensesTable").innerHTML = `<div class="empty">Geen uitgaven voor deze filters.</div>`;
        return;
      }}
      const html = `
        <table>
          <thead>
            <tr>
              <th>Jaar</th>
              <th>Maand</th>
              <th>Bestand</th>
              <th>Categorie</th>
              <th>Bedrag</th>
              <th>Document</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                <td>${row.year}</td>
                <td>${row.month}</td>
                <td><strong>${escapeHtml(row.file_name)}</strong><br><span class="eyebrow">${escapeHtml(row.source_key)}</span></td>
                <td><span class="pill">${escapeHtml(row.category)}</span></td>
                <td>${euro.format(row.effective_amount || 0)}</td>
                <td><a href="${fileHref(row.file_uri)}" target="_blank" rel="noopener">Open</a></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
      document.getElementById("expensesTable").innerHTML = html;
    }}

    function renderCategoryYearTable(filters) {{
      const rows = payload.category_year_totals.filter(row => !filters.year || row.year === filters.year);
      if (!rows.length) {{
        document.getElementById("categoryYearTable").innerHTML = `<div class="empty">Geen totalen voor deze selectie.</div>`;
        return;
      }}
      document.getElementById("categoryYearTable").innerHTML = `
        <table>
          <thead>
            <tr><th>Jaar</th><th>Categorie</th><th>Totaal</th></tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                <td>${row.year}</td>
                <td>${escapeHtml(row.category)}</td>
                <td>${euro.format(row.total_amount)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    }}

    function renderMissingTable(filters) {{
      const rows = payload.missing_rows.filter(row => {{
        if (filters.year && row.year !== filters.year) return false;
        if (filters.category && row.category !== filters.category && row.suggested_category !== filters.category) return false;
        if (filters.month && row.month !== filters.month) return false;
        if (filters.search) {{
          const haystack = [row.file_name, row.notes, row.source_key].join(" ").toLowerCase();
          if (!haystack.includes(filters.search)) return false;
        }}
        return true;
      }});
      if (!rows.length) {{
        document.getElementById("missingTable").innerHTML = `<div class="empty">Geen openstaande documenten zonder bedrag.</div>`;
        return;
      }}
      document.getElementById("missingTable").innerHTML = `
        <table>
          <thead>
            <tr><th>Bestand</th><th>Datum</th><th>Categorie</th><th>Document</th></tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                <td><span class="danger">${escapeHtml(row.file_name)}</span><br><span class="eyebrow">${escapeHtml(row.source_key)}</span></td>
                <td>${escapeHtml(row.date || "-")}</td>
                <td>${escapeHtml(row.category || row.suggested_category || "Nog geen categorie")}</td>
                <td><a href="${fileHref(row.file_uri)}" target="_blank" rel="noopener">Open</a></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    }}

    function renderYearDetails(filters) {{
      const sections = payload.year_details.filter(section => !filters.year || section.year === filters.year);
      if (!sections.length) {{
        document.getElementById("yearDetails").innerHTML = `<div class="empty">Geen jaardetails beschikbaar.</div>`;
        return;
      }}
      document.getElementById("yearDetails").innerHTML = sections.map(section => {{
        const rows = section.rows.filter(row => {{
          if (filters.category && row.category !== filters.category) return false;
          if (filters.month && row.month !== filters.month) return false;
          if (filters.search) {{
            const haystack = [row.file_name, row.notes, row.source_key].join(" ").toLowerCase();
            if (!haystack.includes(filters.search)) return false;
          }}
          return true;
        }});
        if (!rows.length) return "";
        return `
          <div class="year-section">
            <h3>${section.year}</h3>
            <table>
              <thead>
                <tr><th>Maand</th><th>Categorie</th><th>Totaal</th></tr>
              </thead>
              <tbody>
                ${rows.map(row => `
                  <tr>
                    <td>${row.month}</td>
                    <td>${escapeHtml(row.category)}</td>
                    <td>${euro.format(row.amount)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `;
      }}).join("") || `<div class="empty">Geen jaardetails voor deze filters.</div>`;
    }}

    function escapeHtml(value) {{
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }}

    function render() {{
      const filters = getFilters();
      const filteredRows = payload.all_rows.filter(row => matchesFilters(row, filters));
      renderCards(filteredRows);
      renderExpensesTable(filteredRows);
      renderCategoryYearTable(filters);
      renderMissingTable(filters);
      renderYearDetails(filters);
    }}

    fillSelect("yearFilter", payload.all_rows.map(row => row.year));
    fillSelect("categoryFilter", payload.all_rows.map(row => row.category));
    fillSelect("monthFilter", payload.all_rows.map(row => row.month), monthOrder);

    document.getElementById("yearFilter").addEventListener("change", render);
    document.getElementById("categoryFilter").addEventListener("change", render);
    document.getElementById("monthFilter").addEventListener("change", render);
    document.getElementById("searchInput").addEventListener("input", render);

    render();
  </script>
</body>
</html>
"""
    html = (
        html.replace("{{", "{")
        .replace("}}", "}")
        .replace("__TITLE__", escape(title))
        .replace("__JSON_PAYLOAD__", json_payload)
    )
    output_path.write_text(html, encoding="utf-8")


def save_workbook(
    dataframe: pd.DataFrame,
    output_path: Path,
    known_source_keys: set[str],
    root_folder: Path,
) -> None:
    category_summary_df = build_category_summary(dataframe)
    year_summary_df = build_year_summary(dataframe)
    category_year_summary_df = build_category_year_summary(dataframe)
    no_amount_review_df = build_no_amount_review_df(dataframe, root_folder)
    year_detail_dfs = build_year_detail_dfs(dataframe)

    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        dataframe.to_excel(writer, index=False, sheet_name=MAIN_SHEET_NAME)
        category_summary_df.to_excel(writer, index=False, sheet_name=SUMMARY_CATEGORY_SHEET_NAME)
        year_summary_df.to_excel(writer, index=False, sheet_name=SUMMARY_YEAR_SHEET_NAME)
        category_year_summary_df.to_excel(writer, index=False, sheet_name=SUMMARY_CATEGORY_YEAR_SHEET_NAME)
        no_amount_review_df.to_excel(writer, index=False, sheet_name=NO_AMOUNT_SHEET_NAME)
        for year, detail_df in sorted(year_detail_dfs.items()):
            detail_df.to_excel(writer, index=False, sheet_name=f"{year}_monthly")
        pd.DataFrame({"source_key": sorted(known_source_keys)}).to_excel(
            writer,
            index=False,
            sheet_name=STATE_SHEET_NAME,
        )
        writer.book[STATE_SHEET_NAME].sheet_state = "hidden"


def save_html_report(dataframe: pd.DataFrame, root_folder: Path) -> Path:
    output_path = root_folder / HTML_REPORT_FILE
    payload = build_dashboard_payload(dataframe, root_folder)
    render_html_report(payload, output_path)
    return output_path


def main() -> None:
    root_folder = Path(ROOT_FOLDER).expanduser()
    if not root_folder.exists() or not root_folder.is_dir():
        raise SystemExit(f"ROOT_FOLDER does not exist or is not a folder: {root_folder}")

    output_path = root_folder / OUTPUT_FILE
    invoice_files = scan_invoice_files(root_folder)
    existing_df = load_existing_workbook(output_path)
    known_source_keys = load_known_source_keys(output_path, existing_df)

    new_results: list[ProcessResult] = []
    skipped_files: list[tuple[Path, str]] = []
    no_amount_files: list[str] = []

    for file_path in invoice_files:
        source_key = file_path.relative_to(root_folder).as_posix()
        if source_key in known_source_keys:
            continue

        try:
            result = build_result(file_path, root_folder)
        except Exception as exc:
            skipped_files.append((file_path, str(exc)))
            continue

        if not result.detected_amount:
            no_amount_files.append(result.source_key)

        new_results.append(result)
        known_source_keys.add(result.source_key)

    updated_df = append_new_rows(existing_df, new_results)
    save_workbook(updated_df, output_path, known_source_keys, root_folder)
    html_report_path = save_html_report(updated_df, root_folder)

    print(f"Scanned files: {len(invoice_files)}")
    print(f"New rows added: {len(new_results)}")
    print(f"Files skipped due to errors: {len(skipped_files)}")
    print(f"Files with no detected amount: {len(no_amount_files)}")
    print(f"Available categories: {', '.join(CATEGORIES)}")

    if skipped_files:
        print("\nSkipped files:")
        for file_path, error in skipped_files:
            print(f"- {file_path}: {error}")

    if no_amount_files:
        print("\nFiles with no detected amount:")
        for source_key in no_amount_files:
            print(f"- {source_key}")

    print(f"\nWorkbook saved to: {output_path}")
    print(f"HTML report saved to: {html_report_path}")


if __name__ == "__main__":
    main()
