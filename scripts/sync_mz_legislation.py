#!/usr/bin/env python3
"""Synchronizuje projekty MZ z RCL i opcjonalnie streszcza nowe pozycje przez OpenAI."""

from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys
import zipfile
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

SOURCE_URL = (
    "https://legislacja.gov.pl/lista?_typeId=1&title=&createDateFrom=&createDateTo="
    "&applicantId=1&number=&_isUEAct=on&_isTKAct=on&_isActEstablishingNumber=on"
    "&_isSeparateMode=on&_isDU=on&_isNumerSejm=on#list"
)
OUTPUT = Path(__file__).resolve().parents[1] / "data" / "mz-legislation.json"
PERMANENT_IDS = {"rcl-mz-projects", "mz-work-register", "mz-legislation-hub"}
USER_AGENT = "HospitalAPP-public-monitor/0.7 (+https://github.com/GuzyM/szpitale)"
MAX_PROJECTS = 40
MAX_DOCUMENT_BYTES = 15 * 1024 * 1024
MAX_AI_CHARS = 55_000


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[tuple[str, str]] = []
        self.text: list[str] = []
        self._href: str | None = None
        self._anchor_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "a":
            self._href = dict(attrs).get("href")
            self._anchor_text = []

    def handle_data(self, data: str) -> None:
        cleaned = re.sub(r"\s+", " ", data).strip()
        if cleaned:
            self.text.append(cleaned)
            if self._href:
                self._anchor_text.append(cleaned)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self._href:
            self.links.append((self._href, " ".join(self._anchor_text).strip()))
            self._href = None
            self._anchor_text = []


def request_bytes(url: str, timeout: int, accept: str = "*/*") -> tuple[bytes, str]:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": accept})
    with urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status} dla {url}")
        length = response.headers.get("Content-Length")
        if length and int(length) > MAX_DOCUMENT_BYTES:
            raise RuntimeError(f"Plik jest za duży: {url}")
        data = response.read(MAX_DOCUMENT_BYTES + 1)
        if len(data) > MAX_DOCUMENT_BYTES:
            raise RuntimeError(f"Plik jest za duży: {url}")
        return data, response.headers.get("Content-Type", "")


def request_text(url: str, timeout: int) -> str:
    data, content_type = request_bytes(url, timeout, "text/html,application/xhtml+xml")
    charset = "utf-8"
    match = re.search(r"charset=([\w-]+)", content_type, re.I)
    if match:
        charset = match.group(1)
    return data.decode(charset, errors="replace")


def load_existing() -> dict:
    if not OUTPUT.exists():
        return {"meta": {}, "items": []}
    return json.loads(OUTPUT.read_text(encoding="utf-8"))


def normalize_project_url(href: str) -> str | None:
    absolute = urljoin(SOURCE_URL, href)
    parsed = urlparse(absolute)
    if parsed.netloc.lower() != "legislacja.gov.pl":
        return None
    match = re.search(r"/projekt/(\d+)", parsed.path, re.I)
    if not match:
        return None
    return f"https://legislacja.gov.pl/projekt/{match.group(1)}"


def extract_project_links(html: str) -> list[tuple[str, str]]:
    parser = LinkParser()
    parser.feed(html)
    result: list[tuple[str, str]] = []
    seen: set[str] = set()
    for href, title in parser.links:
        url = normalize_project_url(href)
        if not url or url in seen or len(title) < 18:
            continue
        seen.add(url)
        result.append((url, title))
    return result[:MAX_PROJECTS]


def extract_date(text: str) -> str | None:
    patterns = (
        r"Data utworzenia\s*:?\s*(\d{1,2})[.-](\d{1,2})[.-](\d{4})",
        r"(\d{1,2})[.-](\d{1,2})[.-](\d{4})",
    )
    for pattern in patterns:
        match = re.search(pattern, text, re.I)
        if match:
            day, month, year = map(int, match.groups())
            try:
                return f"{year:04d}-{month:02d}-{day:02d}"
            except ValueError:
                pass
    return None


def clean_visible_text(html: str) -> str:
    without_noise = re.sub(r"<(script|style|nav|footer)\b.*?</\1>", " ", html, flags=re.I | re.S)
    without_tags = re.sub(r"<[^>]+>", " ", without_noise)
    return re.sub(r"\s+", " ", unescape(without_tags)).strip()


def candidate_documents(html: str, project_url: str) -> list[tuple[str, str]]:
    parser = LinkParser()
    parser.feed(html)
    preferred: list[tuple[int, str, str]] = []
    for href, label in parser.links:
        absolute = urljoin(project_url, href)
        parsed = urlparse(absolute)
        if parsed.netloc.lower() != "legislacja.gov.pl":
            continue
        haystack = f"{label} {parsed.path}".lower()
        if not re.search(r"\.(pdf|docx|rtf)(?:$|\?)", absolute, re.I):
            continue
        score = 0
        if "uzasadn" in haystack:
            score += 30
        if "ocena skutków" in haystack or "osr" in haystack:
            score += 25
        if "projekt" in haystack:
            score += 20
        if "tabela" in haystack or "raport" in haystack:
            score -= 10
        preferred.append((score, absolute, label or Path(parsed.path).name))
    preferred.sort(key=lambda item: item[0], reverse=True)
    return [(url, label) for _, url, label in preferred[:3]]


def extract_pdf(data: bytes) -> str:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(data))
    return "\n".join((page.extract_text() or "") for page in reader.pages[:80])


def extract_docx(data: bytes) -> str:
    from docx import Document
    document = Document(io.BytesIO(data))
    return "\n".join(paragraph.text for paragraph in document.paragraphs)


def extract_rtf(data: bytes) -> str:
    from striprtf.striprtf import rtf_to_text
    return rtf_to_text(data.decode("utf-8", errors="replace"))


def extract_document_text(url: str, timeout: int) -> str:
    data, content_type = request_bytes(url, timeout)
    path = urlparse(url).path.lower()
    if path.endswith(".pdf") or "pdf" in content_type.lower():
        return extract_pdf(data)
    if path.endswith(".docx") or "wordprocessingml" in content_type.lower():
        return extract_docx(data)
    if path.endswith(".rtf") or "rtf" in content_type.lower():
        return extract_rtf(data)
    return ""


def five_sentence_fallback(title: str, detail_text: str) -> str:
    compact = re.sub(r"\s+", " ", detail_text).strip()
    fragments = [
        f"Ministerstwo Zdrowia opublikowało projekt: {title.rstrip('.')}.",
        "HospitalAPP wykrył nową pozycję w oficjalnym serwisie Rządowego Procesu Legislacyjnego.",
        "Automatyczne streszczenie przez ChatGPT oczekuje na skonfigurowanie klucza OpenAI API.",
        "Do czasu utworzenia streszczenia należy sprawdzić projekt, uzasadnienie i ocenę skutków regulacji w źródle.",
        "Treść projektu i dokumenty źródłowe są dostępne po użyciu przycisku „Otwórz źródło”.",
    ]
    if compact:
        fragments[2] = f"Z publicznej metryki wynika: {compact[:280].rstrip(' ,;:')}."
    return " ".join(fragments)


def count_sentences(text: str) -> int:
    return len([part for part in re.split(r"(?<=[.!?])\s+", text.strip()) if part])


def summarize_with_openai(title: str, source_url: str, source_text: str, timeout: int) -> str | None:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None
    payload = {
        "model": os.environ.get("OPENAI_MODEL", "gpt-4.1-mini"),
        "instructions": (
            "Jesteś analitykiem legislacji ochrony zdrowia w Polsce. "
            "Napisz po polsku dokładnie 5 pełnych zdań, bez punktów i nagłówka. "
            "Wyjaśnij czego dotyczy projekt, najważniejszą zmianę, kogo dotyczy, "
            "możliwy wpływ na szpitale oraz etap/ograniczenie wynikające z materiału. "
            "Nie dopowiadaj faktów, których nie ma w materiale."
        ),
        "input": f"Tytuł: {title}\nŹródło: {source_url}\n\nMateriał:\n{source_text[:MAX_AI_CHARS]}",
        "max_output_tokens": 700,
    }
    request = Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=max(timeout, 60)) as response:
            result = json.loads(response.read().decode("utf-8"))
        summary = (result.get("output_text") or "").strip()
        if not summary:
            for block in result.get("output", []):
                for content in block.get("content", []):
                    if content.get("type") == "output_text":
                        summary += content.get("text", "")
            summary = summary.strip()
        if count_sentences(summary) != 5:
            raise RuntimeError(f"Model zwrócił {count_sentences(summary)} zdań zamiast 5")
        return summary
    except (HTTPError, URLError, TimeoutError, RuntimeError, ValueError) as error:
        print(f"Nie udało się utworzyć streszczenia OpenAI: {error}", file=sys.stderr)
        return None


def build_project(url: str, list_title: str, existing: dict | None, checked_at: str, timeout: int) -> dict:
    html = request_text(url, timeout)
    visible = clean_visible_text(html)
    title = list_title.strip()
    page_parser = LinkParser()
    page_parser.feed(html)
    for text in page_parser.text:
        if text.lower().startswith("projekt ") and len(text) > len(title):
            title = text
            break
    first_seen = existing.get("firstSeenAt") if existing else checked_at
    documents = candidate_documents(html, url)
    document_texts: list[str] = []
    document_links: list[dict] = []
    for document_url, label in documents:
        try:
            text = re.sub(r"\s+", " ", extract_document_text(document_url, timeout)).strip()
            if text:
                document_texts.append(text)
            document_links.append({"title": label, "url": document_url})
        except Exception as error:
            print(f"Nie udało się odczytać dokumentu {document_url}: {error}", file=sys.stderr)

    prior_summary = existing.get("summary") if existing else None
    prior_ai = bool(existing and existing.get("summaryProvider") == "openai")
    combined = "\n\n".join([visible, *document_texts])
    ai_summary = prior_summary if prior_ai else summarize_with_openai(title, url, combined, timeout)
    summary = ai_summary or prior_summary or five_sentence_fallback(title, visible)

    return {
        "id": f"rcl-{url.rsplit('/', 1)[-1]}",
        "type": "Projekt Ministerstwa Zdrowia",
        "title": title,
        "summary": summary,
        "summaryProvider": "openai" if ai_summary else (existing or {}).get("summaryProvider", "pending-openai"),
        "date": extract_date(visible),
        "firstSeenAt": first_seen,
        "isNew": first_seen[:10] == checked_at[:10],
        "url": url,
        "source": "legislacja.gov.pl",
        "documents": document_links,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--timeout", type=int, default=35)
    args = parser.parse_args()
    existing_data = load_existing()
    existing_by_id = {item.get("id"): item for item in existing_data.get("items", [])}
    checked_at = datetime.now(timezone.utc).isoformat(timespec="seconds")

    try:
        source_html = request_text(SOURCE_URL, args.timeout)
        links = extract_project_links(source_html)
    except Exception as error:
        print(f"BŁĄD: nie udało się pobrać listy RCL: {error}", file=sys.stderr)
        return 1

    if not links:
        print("BŁĄD: RCL zwrócił 0 projektów MZ. Nie zapisuję pozornej aktualizacji.", file=sys.stderr)
        return 1

    projects: list[dict] = []
    failures = 0
    for url, title in links:
        project_id = f"rcl-{url.rsplit('/', 1)[-1]}"
        try:
            projects.append(build_project(url, title, existing_by_id.get(project_id), checked_at, args.timeout))
        except Exception as error:
            failures += 1
            print(f"Nie udało się przetworzyć {url}: {error}", file=sys.stderr)

    if not projects:
        print("BŁĄD: nie udało się przetworzyć żadnego projektu MZ.", file=sys.stderr)
        return 1

    permanent = [item for item in existing_data.get("items", []) if item.get("id") in PERMANENT_IDS]
    projects.sort(key=lambda item: (item.get("date") or "", item.get("firstSeenAt") or ""), reverse=True)
    meta = {
        **existing_data.get("meta", {}),
        "checkedAt": checked_at,
        "sourceStatus": "projects-extracted",
        "sourceUrl": SOURCE_URL,
        "sourceLabel": "Rządowy Proces Legislacyjny · wnioskodawca: Ministerstwo Zdrowia",
        "projectCount": len(projects),
        "failedProjectCount": failures,
        "aiSummariesEnabled": bool(os.environ.get("OPENAI_API_KEY", "").strip()),
    }
    OUTPUT.write_text(
        json.dumps({"meta": meta, "items": projects + permanent}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Zapisano {len(projects)} projektów MZ; błędy szczegółów: {failures}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
