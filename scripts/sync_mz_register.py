#!/usr/bin/env python3
"""Update legislation from the official MZ legislative-work register."""
import csv, hashlib, io, json, re, subprocess
from datetime import datetime, timezone
from html import unescape
from pathlib import Path

URL="https://www.gov.pl/web/zdrowie/wykaz-prac-legislacyjnych"
ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/"data"/"mz-legislation.json"

def fetch():
    result=subprocess.run(["curl","--location","--fail","--silent","--show-error","--retry","3","--max-time","90",URL],check=True,capture_output=True)
    return result.stdout.decode("utf-8",errors="replace")

def main():
    existing=json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else {"meta":{},"items":[]}
    old={item.get("id"):item for item in existing.get("items",[])}
    match=re.search(r'<pre[^>]+id="registerData"[^>]*>(.*?)</pre>',fetch(),re.I|re.S)
    if not match: raise RuntimeError("Brak registerData w wykazie MZ")
    payload=json.loads(unescape(match.group(1)))
    rows=list(csv.DictReader(io.StringIO(payload["data"]),delimiter=";"))
    active=[r for r in rows if (r.get("Nr w Wykazie") or "").strip() and (r.get("Tytuł rozporządzenia") or "").strip() and not (r.get("Przyczyny rezygnacji z prac nad projektem") or "").strip()]
    active.sort(key=lambda r:int(re.sub(r"\D","",r.get("Lp.") or "0") or 0),reverse=True)
    now=datetime.now(timezone.utc).isoformat(timespec="seconds"); items=[]
    for row in active[:80]:
        number=(row.get("Nr w Wykazie") or "").strip(); item_id="mz-register-"+re.sub(r"[^a-z0-9]+","-",number.lower()).strip("-")
        previous=old.get(item_id,{})
        title=" ".join((row.get("Tytuł rozporządzenia") or "").split())
        summary=" ".join((row.get("Istota rozwiązań, które planuje się zawrzeć w projekcie:") or "").split())
        period=" ".join((row.get("Planowany termin wydania / Publikacja w Dz. U") or "").split())
        fingerprint=hashlib.sha256((number+title+summary+period).encode()).hexdigest()
        fresh=not previous; changed=bool(previous and previous.get("sourceFingerprint")!=fingerprint)
        items.append({"id":item_id,"type":"Projekt rozporządzenia Ministra Zdrowia","title":f"{number} · {title}","publicationDate":None,"updatedAt":now if fresh or changed else previous.get("updatedAt"),"date":now[:10],"dateLabel":"Stan wykazu MZ","shortStatus":"Nowy w wykazie" if fresh else "Zaktualizowany" if changed else "W wykazie MZ","summary":summary or None,"summaryStatus":"ready" if summary else "pending","summaryProvider":"Ministerstwo Zdrowia" if summary else None,"firstSeenAt":previous.get("firstSeenAt") or now,"lastSeenAt":now,"isNew":fresh,"sourceFingerprint":fingerprint,"url":URL,"source":"Wykaz prac legislacyjnych Ministra Zdrowia","plannedPeriod":period or None})
    history=[x for x in existing.get("items",[]) if str(x.get("id","")).startswith("rcl-")]
    all_items=items+history
    meta={**existing.get("meta",{}),"title":"Legislacja Ministerstwa Zdrowia","checkedAt":now,"sourceStatus":"official-mz-register","sourceUrl":URL,"sourceLabel":"Wykaz prac legislacyjnych Ministra Zdrowia","projectCount":len(all_items),"visibleAtSourceCount":len(items),"newSincePreviousCheck":sum(x["isNew"] for x in items),"updatedSincePreviousCheck":sum(x["shortStatus"]=="Zaktualizowany" for x in items),"failedProjectCount":0,"summaryMode":"official-register","note":"Aktualizowane z oficjalnego wykazu MZ; historyczne projekty RCL pozostają w rejestrze."}
    OUTPUT.write_text(json.dumps({"meta":meta,"items":all_items},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"Zapisano {len(all_items)} pozycji; źródło: {payload.get('description','wykaz MZ')}")

if __name__=="__main__": main()
