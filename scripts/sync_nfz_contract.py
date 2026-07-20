#!/usr/bin/env python3
"""Pobiera publiczny profil zakresu z API Umowy NFZ.

Domyślne parametry odtwarzają profil używany w wersji demonstracyjnej:

    python3 scripts/sync_nfz_contract.py

Można wskazać innego świadczeniodawcę i zakres:

    python3 scripts/sync_nfz_contract.py \
      --year 2026 --branch 06 --provider-code 061/100014 \
      --product-code 03.4450.260.02 --agreement-code 061/100014/SZP/08/2026

Skrypt zapisuje wyłącznie publiczne dane potrzebne aplikacji: nazwę i kod
świadczeniodawcy oraz dane umowy. Nie zapisuje adresu, NIP ani REGON.
"""

import argparse
import json
import math
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API_ROOT = "https://api.nfz.gov.pl/app-umw-api"
API_VERSION = "1.2"
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "nfz-contract.js"
REQUEST_INTERVAL = 0.12


def api_get(path, **params):
    query = {
        **params,
        "format": "json",
        "api-version": API_VERSION,
    }
    url = f"{API_ROOT}/{path.lstrip('/')}?{urlencode(query)}"
    request = Request(url, headers={"User-Agent": "HospitalAPP/0.5"})
    time.sleep(REQUEST_INTERVAL)
    with urlopen(request, timeout=45) as response:
        return json.load(response)


def find_agreement(args):
    response = api_get(
        "agreements",
        year=args.year,
        branch=args.branch,
        providerCode=args.provider_code,
        productCode=args.product_code,
        limit=25,
    )
    agreements = response.get("data", {}).get("agreements", [])
    if args.agreement_code:
        agreements = [
            agreement
            for agreement in agreements
            if agreement.get("attributes", {}).get("code") == args.agreement_code
        ]
    if len(agreements) != 1:
        raise RuntimeError(
            f"Oczekiwano jednej umowy, znaleziono {len(agreements)}. "
            "Podaj dokładny --agreement-code."
        )
    return agreements[0]


def agreement_page(agreement_id, page):
    return api_get(f"agreements/{agreement_id}", page=page, limit=25)


def find_plan(agreement_id, product_code):
    first_response = agreement_page(agreement_id, 1)
    count = int(first_response.get("meta", {}).get("count", 0))
    last_page = max(1, math.ceil(count / 25))
    cached = {1: first_response}
    low, high = 1, last_page

    while low <= high:
        page = (low + high) // 2
        response = cached.get(page) or agreement_page(agreement_id, page)
        plans = response.get("data", {}).get("plans", [])
        if not plans:
            break

        match = next(
            (
                plan
                for plan in plans
                if plan.get("attributes", {}).get("product-code") == product_code
            ),
            None,
        )
        if match:
            return match

        first_code = plans[0].get("attributes", {}).get("product-code", "")
        last_code = plans[-1].get("attributes", {}).get("product-code", "")
        if product_code < first_code:
            high = page - 1
        elif product_code > last_code:
            low = page + 1
        else:
            break

    raise RuntimeError(f"Nie znaleziono zakresu {product_code} w planie umowy")


def product_group_code(name):
    match = re.match(r"^([A-Z][A-Z0-9]+)\s", str(name or "").strip())
    return match.group(1) if match else None


def build_scope(plan):
    plan_id = plan["id"]
    plan_response = api_get(f"plans/{plan_id}", limit=25)
    data = plan_response.get("data", {})
    months = data.get("months", [])
    if not months:
        raise RuntimeError("Plan umowy nie zawiera miesięcy")

    month_id = months[0]["id"]
    month_response = api_get(f"months/{month_id}", page=1, limit=25)
    packages = list(month_response.get("data", {}).get("packages", []))
    package_count = int(month_response.get("meta", {}).get("count", len(packages)))
    for page in range(2, math.ceil(package_count / 25) + 1):
        next_response = api_get(f"months/{month_id}", page=page, limit=25)
        packages.extend(next_response.get("data", {}).get("packages", []))
    attributes = plan.get("attributes", {})
    unit_products = []
    additional_products = []

    for package in packages:
        package_attributes = package.get("attributes", {})
        code = str(package_attributes.get("unit-product-code", ""))
        name = str(package_attributes.get("unit-product-name", ""))
        weight = package_attributes.get("weight")
        if code.startswith("5.51.01."):
            group_code = product_group_code(name)
            if group_code:
                unit_products.append(
                    {
                        "groupCode": group_code,
                        "productCode": code,
                        "productName": name,
                        "weight": weight,
                    }
                )
        elif code == "5.53.01.0001510":
            additional_products.append(
                {
                    "productCode": code,
                    "productName": name,
                    "points": weight,
                    "applicableGroupCodes": [],
                    "note": (
                        "Produkt dostępny w zakresie. Rozliczenie wymaga "
                        "spełnienia właściwych warunków NFZ."
                    ),
                }
            )

    maternal_group_codes = [
        product["groupCode"]
        for product in unit_products
        if "NOWORODEK" not in product["productName"].upper()
    ]
    for product in additional_products:
        product["applicableGroupCodes"] = maternal_group_codes

    return {
        "productCode": attributes.get("product-code"),
        "productName": attributes.get("product-name"),
        "averagePointPrice": attributes.get("avg-price"),
        "dateFrom": str(attributes.get("date-from", ""))[:10],
        "dateTo": str(attributes.get("date-to", ""))[:10],
        "unitProducts": unit_products,
        "additionalProducts": additional_products,
    }


def build_payload(args):
    agreement = find_agreement(args)
    agreement_attributes = agreement.get("attributes", {})
    plan = find_plan(agreement["id"], args.product_code)
    provider_name = args.provider_name or f"Świadczeniodawca {args.provider_code}"
    return {
        "meta": {
            "source": "API Umowy NFZ",
            "sourceUrl": "https://api.nfz.gov.pl/",
            "termsUrl": f"{API_ROOT}/terms",
            "apiVersion": API_VERSION,
            "syncedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "agreementUpdatedAt": agreement_attributes.get("updated-at"),
            "year": args.year,
            "branch": args.branch,
            "providerCode": args.provider_code,
            "providerName": provider_name,
            "providerDisplayName": args.provider_display_name or provider_name,
            "agreementCode": agreement_attributes.get("code"),
            "profileLabel": f"Profil umowy {args.year}",
        },
        "scopes": [build_scope(plan)],
    }


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, default=2026)
    parser.add_argument("--branch", default="06")
    parser.add_argument("--provider-code", default="061/100014")
    parser.add_argument("--provider-name")
    parser.add_argument("--provider-display-name")
    parser.add_argument("--product-code", default="03.4450.260.02")
    parser.add_argument("--agreement-code", default="061/100014/SZP/08/2026")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def main():
    args = parse_args()
    payload = build_payload(args)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        "window.NFZ_CONTRACT = "
        + json.dumps(payload, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    print(
        f"Zapisano {len(payload['scopes'])} zakres i "
        f"{len(payload['scopes'][0]['unitProducts'])} grup JGP do {args.output}"
    )


if __name__ == "__main__":
    main()
