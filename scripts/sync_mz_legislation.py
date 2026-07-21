#!/usr/bin/env python3
"""Odświeża publiczne linki legislacyjne MZ używane przez HospitalAPP."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen


SOURCE_URL = (
    "https://legislacja.gov.pl/lista?_typeId=1&title=&createDateFrom=&createDateTo="
    "&applicantId=1&number=&_isUEAct=on&_isTKAct=on&_isActEstablishingNumber=on"
    "&_isSeparateMode=on&_isDU=on&_isNumerSejm=on#list"
)
OUTPUT = Path(__file__).resolve().parents[1] / "data" / "mz-legislation.json"


class ProjectLinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._href: str | None = None
        self._text: list[str] = []
        self.links: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        href = dict(attrs).get("href")
        if href:
            self._href = href
            self._text = []

    def handle_data(self, data: str) -> None:
        if self._href:
            self._text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() != "a" or not self._href:
            return
        title = re.sub(r"\s+", " ", " ".join(self._text)).strip()
        self.links.append((self._href, title))
        self._href = None
        self._text = []


def load_existing() -> dict:
    if not OUTPUT.exists():
        return {"meta": {}, "items": []}
    return json.loads(OUTPUT.read_text(encoding="utf-8"))


def fetch_source(timeout: int) -> str:
    request = Request(
        SOURCE_URL,
        headers={
            "User-Agent": "HospitalAPP-public-monitor/0.6 (+https://github.com/GuzyM/szpitale)",
            "Accept": "text/html,application/xhtml+xml"
        },
    )
    with urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status}")
        return response.read().decode(response.headers.get_content_charset() or "utf-8", errors="replace")


def extract_projects(html: str) -> list[dict]:
    parser = ProjectLinkParser()
    parser.feed(html)
    projects: list[dict] = []
    seen: set[str] = set()
    for href, title in parser.links:
        absolute = urljoin(SOURCE_URL, href)
        parsed = urlparse(absolute)
        path = parsed.path.lower()
        if parsed.netloc != "legislacja.gov.pl":
            continue
        if not any(marker in path for marker in ("/projekt/", "/proces/", "/dokument/")):
            continue
        if len(title) < 18 or absolute in seen:
            continue
        seen.add(absolute)
        projects.append({
            "id": f"rcl-{len(projects) + 1}",
            "type": "Projekt Ministerstwa Zdrowia",
            "title": title,
            "summary": "Przejdź do oficjalnej karty projektu, aby sprawdzić dokumenty, daty i przebieg prac.",
            "date": None,
            "url": absolute,
            "source": "legislacja.gov.pl",
        })
    return projects[:60]


def main() -> int:
    argument_parser = argparse.ArgumentParser()
    argument_parser.add_argument("--timeout", type=int, default=30)
    args = argument_parser.parse_args()

    existing = load_existing()
    try:
        html = fetch_source(args.timeout)
    except Exception as error:  # noqa: BLE001 - zadanie ma zachować ostatni poprawny plik
        print(f"Nie udało się sprawdzić legislacja.gov.pl: {error}")
        return 0

    extracted = extract_projects(html)
    permanent_items = [
        item for item in existing.get("items", [])
        if item.get("id") in {"rcl-mz-projects", "mz-work-register", "mz-legislation-hub"}
    ]
    previous_projects = [
        item for item in existing.get("items", [])
        if item.get("id") not in {"rcl-mz-projects", "mz-work-register", "mz-legislation-hub"}
    ]
    items = extracted + permanent_items if extracted else previous_projects + permanent_items
    meta = {
        **existing.get("meta", {}),
        "checkedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sourceStatus": "projects-extracted" if extracted else "source-checked",
        "sourceUrl": SOURCE_URL,
        "sourceLabel": "Rządowy Proces Legislacyjny · wnioskodawca: Ministerstwo Zdrowia",
    }
    OUTPUT.write_text(
        json.dumps({"meta": meta, "items": items}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Sprawdzono źródło MZ; znaleziono {len(extracted)} bezpośrednich kart projektów.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
