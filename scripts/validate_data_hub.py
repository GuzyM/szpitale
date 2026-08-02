#!/usr/bin/env python3
"""Walidacja publikowanych, przetworzonych danych HospitalAPP Data Hub."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
HUB = ROOT / "data-hub"
MAX_SHARD_SIZE = 5 * 1024 * 1024
FORBIDDEN_CONTENT_KEYS = {
    "content",
    "documentbody",
    "filebytes",
    "pdfbase64",
    "rawdocument",
    "rawhtml",
    "xmlcontent",
}


def fail(message: str) -> None:
    raise ValueError(message)


def read_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        fail(f"Brak pliku: {path.relative_to(ROOT)}")
    except json.JSONDecodeError as error:
        fail(f"Nieprawidłowy JSON w {path.relative_to(ROOT)}: {error}")


def local_path(web_path: str) -> Path:
    if not web_path.startswith("./"):
        fail(f"Ścieżka Data Hub musi zaczynać się od ./: {web_path}")
    path = (ROOT / web_path[2:]).resolve()
    if ROOT not in path.parents and path != ROOT:
        fail(f"Ścieżka wychodzi poza projekt: {web_path}")
    return path


def validate_https(value: str, context: str) -> None:
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.netloc:
        fail(f"{context}: wymagany pełny adres HTTPS")


def walk_keys(value):
    if isinstance(value, dict):
        for key, child in value.items():
            yield key.lower()
            yield from walk_keys(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_keys(child)


def validate_procurement(record: dict, seen_ids: set[str], context: str) -> None:
    required = {
        "id",
        "hospital",
        "subject",
        "status",
        "dates",
        "value",
        "contractor",
        "documents",
        "source",
        "aiSummary",
    }
    missing = required - record.keys()
    if missing:
        fail(f"{context}: brak pól {', '.join(sorted(missing))}")
    if record["id"] in seen_ids:
        fail(f"{context}: duplikat identyfikatora {record['id']}")
    seen_ids.add(record["id"])
    if not record["id"].startswith(("bzp:", "ted:", "bip:")):
        fail(f"{context}: identyfikator musi wskazywać system źródłowy")
    if len(str(record["hospital"].get("name") or "").strip()) < 2:
        fail(f"{context}: brak nazwy szpitala")
    if record["hospital"].get("kind") != "clinical":
        fail(f"{context}: moduł przetargów publikuje wyłącznie szpitale kliniczne")
    if len(str(record["subject"] or "").strip()) < 3:
        fail(f"{context}: brak przedmiotu postępowania")
    validate_https(record["source"].get("url", ""), f"{context}.source.url")
    for number, document in enumerate(record["documents"]):
        validate_https(document.get("url", ""), f"{context}.documents[{number}].url")
    if FORBIDDEN_CONTENT_KEYS.intersection(walk_keys(record)):
        fail(f"{context}: rekord zawiera surową treść dokumentu zamiast danych przetworzonych")
    summary = record["aiSummary"]
    if summary.get("status") == "ready" and not summary.get("text"):
        fail(f"{context}: gotowe streszczenie AI nie ma treści")


def validate_sharded_dataset(dataset_name: str, descriptor: dict) -> tuple[int, int]:
    index_path = local_path(descriptor["indexPath"])
    index = read_json(index_path)
    if index.get("dataset") != dataset_name:
        fail(f"{index_path.relative_to(ROOT)}: niezgodna nazwa zbioru")
    partitions = index.get("partitions")
    if not isinstance(partitions, list):
        fail(f"{index_path.relative_to(ROOT)}: partitions musi być listą")

    seen_partition_ids: set[str] = set()
    seen_record_ids: set[str] = set()
    record_count = 0
    for partition in partitions:
        partition_id = str(partition.get("id") or "")
        if not partition_id or partition_id in seen_partition_ids:
            fail(f"{index_path.relative_to(ROOT)}: pusty lub powtórzony identyfikator partycji")
        seen_partition_ids.add(partition_id)
        shard_path = local_path(partition["path"])
        if shard_path.stat().st_size > MAX_SHARD_SIZE:
            fail(f"{shard_path.relative_to(ROOT)}: paczka przekracza 5 MB")
        shard = read_json(shard_path)
        if shard.get("dataset") != dataset_name:
            fail(f"{shard_path.relative_to(ROOT)}: niezgodna nazwa zbioru")
        records = shard.get("records")
        if not isinstance(records, list):
            fail(f"{shard_path.relative_to(ROOT)}: records musi być listą")
        if int(partition.get("recordCount", -1)) != len(records):
            fail(f"{index_path.relative_to(ROOT)}: błędna liczba rekordów partycji {partition_id}")
        for offset, record in enumerate(records):
            if dataset_name == "procurements":
                validate_procurement(
                    record,
                    seen_record_ids,
                    f"{shard_path.relative_to(ROOT)} records[{offset}]",
                )
        record_count += len(records)

    if int(index.get("recordCount", -1)) != record_count:
        fail(f"{index_path.relative_to(ROOT)}: recordCount nie zgadza się z paczkami")
    if int(descriptor.get("recordCount", -1)) != record_count:
        fail(f"manifest.json: recordCount zbioru {dataset_name} nie zgadza się z indeksem")
    return record_count, len(partitions)


def validate() -> tuple[int, int, int]:
    manifest = read_json(HUB / "manifest.json")
    sources = read_json(HUB / "sources.json")
    if manifest.get("schemaVersion") != "1.0.0":
        fail("manifest.json: nieobsługiwana wersja schematu")
    datasets = manifest.get("datasets")
    if not isinstance(datasets, dict) or not datasets:
        fail("manifest.json: brak katalogu zbiorów")

    source_ids = {source.get("id") for source in sources.get("sources", [])}
    if None in source_ids or len(source_ids) != len(sources.get("sources", [])):
        fail("sources.json: identyfikatory źródeł muszą być unikalne i niepuste")
    for source in sources.get("sources", []):
        validate_https(source.get("url", ""), f"sources.json:{source.get('id')}")

    records = 0
    partitions = 0
    for dataset_name, descriptor in datasets.items():
        unknown_sources = set(descriptor.get("sourceIds", [])) - source_ids
        if unknown_sources:
            fail(f"manifest.json:{dataset_name}: nieznane źródła {sorted(unknown_sources)}")
        schema = descriptor.get("schema")
        if schema:
            read_json(local_path(schema))
        adapter = descriptor.get("adapter")
        if adapter == "single-json":
            read_json(local_path(descriptor["path"]))
        elif adapter == "sharded-json":
            dataset_records, dataset_partitions = validate_sharded_dataset(dataset_name, descriptor)
            records += dataset_records
            partitions += dataset_partitions
        elif adapter == "legacy-js":
            for path in descriptor.get("paths", []):
                if not local_path(path).is_file():
                    fail(f"manifest.json:{dataset_name}: brak {path}")
        elif adapter not in {"local-only", "none"}:
            fail(f"manifest.json:{dataset_name}: nieznany adapter {adapter}")
    return len(datasets), records, partitions


def main() -> int:
    try:
        datasets, records, partitions = validate()
    except (KeyError, TypeError, ValueError) as error:
        print(f"Data Hub ERROR: {error}", file=sys.stderr)
        return 1
    print(f"Data Hub OK: {datasets} zbiorów, {records} rekordy, {partitions} paczki JSON.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
