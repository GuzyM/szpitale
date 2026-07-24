#!/usr/bin/env python3
"""Buduje trwały rejestr projektów MZ z Rządowego Procesu Legislacyjnego.

Skrypt zapisuje wyłącznie publiczną metrykę projektu i link do źródła.
Nie pobiera załączników i nie korzysta z OpenAI API.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urljoin, urlparse, urlunparse
from urllib.request import Request, urlopen

SOURCE_URL = (
    "https://legislacja.gov.pl/lista?_typeId=1&title=&createDateFrom=&createDateTo="
    "&applicantId=1&number=&_isUEAct=on&_isTKAct=on&_isActEstablishingNumber=on"
    "&_isSeparateMode=on&_isDU=on&_isNumerSejm=on#list"
)
OUTPUT = Path(__file__).resolve().parents[1] / "data" / "mz-legislation.json"
USER_AGENT = "HospitalAPP-public-monitor/0.8 (+https://github.com/GuzyM/szpitale)"
MAX_LIST_PAGES = 25
MAX_PROJECTS_PER_RUN = 250
MAX_PAGE_BYTES = 4 * 1024 * 1024


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
        if not cleaned:
            return
        self.text.append(cleaned)
        if self._href:
            self._anchor_text.append(cleaned)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self._href:
            self.links.append((self._href, " ".join(self._anchor_text).strip()))
            self._href = None
            self._anchor_text = []


def request_text(url: str, timeout: int) -> str:
    request = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/json",
        },
    )
    with urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status} dla {url}")
        length = response.headers.get("Content-Length")
        if length and int(length) > MAX_PAGE_BYTES:
            raise RuntimeError(f"Strona jest za duża: {url}")
        data = response.read(MAX_PAGE_BYTES + 1)
        if len(data) > MAX_PAGE_BYTES:
            raise RuntimeError(f"Strona jest za duża: {url}")
        content_type = response.headers.get("Content-Type", "")
    charset = "utf-8"
    match = re.search(r"charset=([\w-]+)", content_type, re.I)
    if match:
        charset = match.group(1)
    return data.decode(charset, errors="replace")


def load_existing() -> dict:
    if not OUTPUT.exists():
        return {"meta": {}, "items": []}
    return json.loads(OUTPUT.read_text(encoding="utf-8"))


def clean_visible_text(html: str) -> str:
    without_noise = re.sub(
        r"<(script|style|nav|footer)\b.*?</\1>",
        " ",
        html,
        flags=re.I | re.S,
    )
    without_tags = re.sub(r"<[^>]+>", " ", without_noise)
    return re.sub(r"\s+", " ", unescape(without_tags)).strip()


def normalize_project_url(href: str) -> str | None:
    absolute = urljoin(SOURCE_URL, unescape(href).replace("\\/", "/"))
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
    results: dict[str, str] = {}

    for href, title in parser.links:
        url = normalize_project_url(href)
        if url:
            results[url] = title.strip()

    # RCL bywa aplikacją dynamiczną. Identyfikatory projektów mogą być obecne
    # w osadzonym JSON-ie, mimo że nie ma ich jeszcze w zwykłych znacznikach <a>.
    for match in re.finditer(r"(?:https?:)?(?:\\/|/)+projekt(?:\\/|/)+(\d+)", html, re.I):
        url = f"https://legislacja.gov.pl/projekt/{match.group(1)}"
        results.setdefault(url, "")

    return list(results.items())


def normalize_list_page_url(href: str) -> str | None:
    absolute = urljoin(SOURCE_URL, unescape(href))
    parsed = urlparse(absolute)
    if parsed.netloc.lower() != "legislacja.gov.pl" or parsed.path.rstrip("/") != "/lista":
        return None
    query = parse_qs(parsed.query, keep_blank_values=True)
    if not any(key.lower() in {"page", "p", "strona", "pageindex"} for key in query):
        return None
    source_query = parse_qs(urlparse(SOURCE_URL).query, keep_blank_values=True)
    source_query.update(query)
    return urlunparse(
        (
            "https",
            "legislacja.gov.pl",
            "/lista",
            "",
            urlencode(source_query, doseq=True),
            "",
        )
    )


def extract_list_page_urls(html: str) -> list[str]:
    parser = LinkParser()
    parser.feed(html)
    urls: list[str] = []
    for href, _ in parser.links:
        url = normalize_list_page_url(href)
        if url and url not in urls:
            urls.append(url)
    return urls


def crawl_project_links(timeout: int) -> list[tuple[str, str]]:
    queue = [SOURCE_URL]
    visited: set[str] = set()
    projects: dict[str, str] = {}

    while queue and len(visited) < MAX_LIST_PAGES and len(projects) < MAX_PROJECTS_PER_RUN:
        page_url = queue.pop(0)
        if page_url in visited:
            continue
        visited.add(page_url)
        html = request_text(page_url, timeout)
        for project_url, title in extract_project_links(html):
            if project_url not in projects or len(title) > len(projects[project_url]):
                projects[project_url] = title
        for next_url in extract_list_page_urls(html):
            if next_url not in visited and next_url not in queue:
                queue.append(next_url)

    return list(projects.items())[:MAX_PROJECTS_PER_RUN]


def extract_date(text: str) -> str | None:
    patterns = (
        r"(?:Data utworzenia|Data publikacji|Opublikowano)\s*:?\s*(\d{1,2})[.-](\d{1,2})[.-](\d{4})",
        r"(\d{1,2})[.-](\d{1,2})[.-](\d{4})",
    )
    for pattern in patterns:
        match = re.search(pattern, text, re.I)
        if not match:
            continue
        day, month, year = map(int, match.groups())
        try:
            return datetime(year, month, day).date().isoformat()
        except ValueError:
            continue
    return None


def infer_act_type(title: str, visible: str) -> str:
    text = f"{title} {visible[:2500]}".lower()
    rules = (
        ("projekt ustawy", "Projekt ustawy"),
        ("rozporządzenia rady ministrów", "Projekt rozporządzenia Rady Ministrów"),
        ("rozporządzenia ministra zdrowia", "Projekt rozporządzenia Ministra Zdrowia"),
        ("projekt rozporządzenia", "Projekt rozporządzenia"),
        ("projekt obwieszczenia", "Projekt obwieszczenia"),
        ("projekt uchwały", "Projekt uchwały"),
    )
    for needle, label in rules:
        if needle in text:
            return label
    return "Projekt aktu prawnego"


def extract_title(list_title: str, parser: LinkParser, html: str) -> str:
    candidates = [list_title.strip()] if len(list_title.strip()) >= 18 else []
    title_tag = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
    if title_tag:
        candidates.append(clean_visible_text(title_tag.group(1)))
    candidates.extend(
        text
        for text in parser.text
        if len(text) >= 18
        and (
            text.lower().startswith("projekt ")
            or "projekt ustawy" in text.lower()
            or "projekt rozporządzenia" in text.lower()
        )
    )
    candidates = [candidate for candidate in candidates if candidate]
    if not candidates:
        return "Projekt Ministerstwa Zdrowia"
    return max(candidates, key=len)[:1200]


def sentence_count(text: str | None) -> int:
    if not text:
        return 0
    return len([part for part in re.split(r"(?<=[.!?])\s+", text.strip()) if part])


def ready_summary(existing: dict | None) -> tuple[str | None, str]:
    if not existing:
        return None, "pending"
    summary = str(existing.get("summary") or "").strip()
    status = existing.get("summaryStatus")
    provider = existing.get("summaryProvider")
    if sentence_count(summary) == 5 and (
        status == "ready" or provider in {"chatgpt", "manual", "openai"}
    ):
        return summary, "ready"
    return None, "pending"


def build_project(
    url: str,
    list_title: str,
    existing: dict | None,
    checked_at: str,
    timeout: int,
    baseline: bool = False,
) -> dict:
    html = request_text(url, timeout)
    visible = clean_visible_text(html)
    parser = LinkParser()
    parser.feed(html)
    title = extract_title(list_title, parser, html)
    act_type = infer_act_type(title, visible)
    publication_date = extract_date(visible) or (existing or {}).get("publicationDate")
    fingerprint_source = "\n".join((title, act_type, visible[:80_000]))
    fingerprint = hashlib.sha256(fingerprint_source.encode("utf-8")).hexdigest()
    is_new = existing is None and (
        not baseline or publication_date == checked_at[:10]
    )
    is_updated = bool(existing and existing.get("sourceFingerprint") != fingerprint)
    summary, summary_status = ready_summary(existing)

    if is_new:
        short_status = "Nowy projekt"
    elif existing is None:
        short_status = "Dodany do rejestru"
    elif is_updated:
        short_status = "Zaktualizowany"
    else:
        short_status = (existing or {}).get("shortStatus") or "W toku"
        if short_status == "Nowy projekt":
            short_status = "W toku"

    return {
        "id": f"rcl-{url.rsplit('/', 1)[-1]}",
        "type": act_type,
        "title": title,
        "publicationDate": publication_date,
        "updatedAt": checked_at if is_updated else (existing or {}).get("updatedAt"),
        "date": publication_date,
        "dateLabel": "Aktualizacja" if is_updated else "Publikacja",
        "shortStatus": short_status,
        "summary": summary,
        "summaryStatus": summary_status,
        "summaryProvider": (existing or {}).get("summaryProvider") if summary else None,
        "firstSeenAt": (existing or {}).get("firstSeenAt") or checked_at,
        "lastSeenAt": checked_at,
        "isNew": is_new,
        "sourceFingerprint": fingerprint,
        "url": url,
        "source": "Rządowy Proces Legislacyjny",
    }


def merge_history(
    existing_items: list[dict],
    fetched_projects: list[dict],
    checked_at: str,
) -> list[dict]:
    fetched_by_id = {item["id"]: item for item in fetched_projects}
    merged = list(fetched_projects)

    for existing in existing_items:
        item_id = existing.get("id")
        if not item_id or item_id in fetched_by_id or not str(item_id).startswith("rcl-"):
            continue
        historical = {**existing, "isNew": False}
        if historical.get("shortStatus") == "Nowy projekt":
            historical["shortStatus"] = "Zapisany w historii"
        historical.setdefault("summaryStatus", "pending")
        historical.setdefault("lastSeenAt", historical.get("firstSeenAt") or checked_at)
        merged.append(historical)

    merged.sort(
        key=lambda item: (
            item.get("publicationDate") or item.get("date") or "",
            item.get("firstSeenAt") or "",
        ),
        reverse=True,
    )
    return merged


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--timeout", type=int, default=35)
    args = parser.parse_args()
    existing_data = load_existing()
    existing_items = [
        item
        for item in existing_data.get("items", [])
        if str(item.get("id", "")).startswith("rcl-")
        and item.get("id") != "rcl-mz-projects"
    ]
    existing_by_id = {item.get("id"): item for item in existing_items}
    baseline = not existing_items
    checked_at = datetime.now(timezone.utc).isoformat(timespec="seconds")

    try:
        links = crawl_project_links(args.timeout)
    except Exception as error:
        print(f"BŁĄD: nie udało się pobrać listy RCL: {error}", file=sys.stderr)
        return 1

    if not links:
        print(
            "BŁĄD: RCL zwrócił 0 projektów MZ. Nie zapisuję pozornej aktualizacji.",
            file=sys.stderr,
        )
        return 1

    fetched_projects: list[dict] = []
    failures = 0
    for url, title in links:
        project_id = f"rcl-{url.rsplit('/', 1)[-1]}"
        try:
            fetched_projects.append(
                build_project(
                    url,
                    title,
                    existing_by_id.get(project_id),
                    checked_at,
                    args.timeout,
                    baseline,
                )
            )
        except Exception as error:
            failures += 1
            print(f"Nie udało się przetworzyć {url}: {error}", file=sys.stderr)

    if not fetched_projects:
        print("BŁĄD: nie udało się przetworzyć żadnego projektu MZ.", file=sys.stderr)
        return 1

    history = merge_history(existing_items, fetched_projects, checked_at)
    new_count = sum(1 for item in fetched_projects if item.get("isNew"))
    updated_count = sum(1 for item in fetched_projects if item.get("shortStatus") == "Zaktualizowany")
    meta = {
        **existing_data.get("meta", {}),
        "title": "Legislacja Ministerstwa Zdrowia",
        "checkedAt": checked_at,
        "sourceStatus": "projects-extracted",
        "sourceUrl": SOURCE_URL,
        "sourceLabel": "Rządowy Proces Legislacyjny · wnioskodawca: Ministerstwo Zdrowia",
        "projectCount": len(history),
        "visibleAtSourceCount": len(fetched_projects),
        "newSincePreviousCheck": new_count,
        "updatedSincePreviousCheck": updated_count,
        "failedProjectCount": failures,
        "summaryMode": "chatgpt-manual",
        "note": "Rejestr zachowuje każdy wykryty projekt. GitHub zapisuje metrykę i link, bez załączników i bez OpenAI API.",
    }
    OUTPUT.write_text(
        json.dumps({"meta": meta, "items": history}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Rejestr: {len(history)} projektów; nowe: {new_count}; "
        f"zaktualizowane: {updated_count}; błędy szczegółów: {failures}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
