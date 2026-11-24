#!/usr/bin/env python3
"""Sanity-tjek af rådata før forecast: er alle sider hentet, og ligner tallene gårsdagens?
Kør efter parse_shopify.py + normalize.py. Exit 1 hvis noget mangler."""
import json, os, sys, glob
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
snap = json.load(open(os.path.join(ROOT, "data", "snapshot.json"), encoding="utf-8"))
problems, warnings = [], []

# 1) BC-lager: antal på side 1 vs. indlæst
def tool_meta(pattern):
    metas = []
    for p in sorted(glob.glob(os.path.join(ROOT, "data", "raw", pattern))):
        if os.path.basename(p).startswith("compact_"): continue
        payload = json.load(open(p, encoding="utf-8"))
        text = "".join(x.get("text", "") for x in payload if x.get("type") == "text") if isinstance(payload, list) else payload
        d = json.loads(text[text.find("{"):text.rfind("}") + 1])
        metas.append(d)
    return metas
bc = tool_meta("bc_lager_p*.json")
if bc and bc[0].get("antal", 0) > len(snap["bc_stock"]):
    problems.append(f"BC-lager: {bc[0]['antal']} varer ifølge side 1, men kun {len(snap['bc_stock'])} indlæst – mangler der en side?")
po = tool_meta("bc_po_p*.json")
if po and po[0].get("antal", 0) > len(snap["po_lines"]):
    problems.append(f"PO-linjer: {po[0]['antal']} ifølge side 1, men kun {len(snap['po_lines'])} indlæst – mangler der en side?")

# 2) Varianter pr. brand
per = {}
for v in snap["variants"]: per[v["brand"]] = per.get(v["brand"], 0) + 1
for b in ("gladkokken", "casper", "herman", "tomi"):
    if per.get(b, 0) < 20: problems.append(f"Shopify {b}: kun {per.get(b, 0)} varianter – hentningen er nok ufuldstændig")

# 3) Salg: begge perioder pr. brand, og perioden slutter i går
yday = date.today().toordinal() - 1
for b in ("gladkokken", "casper", "herman", "tomi"):
    s = snap["sales"].get(b, {})
    for p in ("d7", "d30"):
        if p not in s: problems.append(f"Salg {b} {p} mangler"); continue
        if date.fromisoformat(s[p]["to"]).toordinal() < yday - 1: warnings.append(f"Salg {b} {p} slutter {s[p]['to']} – ikke frisk")
        if len(s[p]["rows"]) < 10: warnings.append(f"Salg {b} {p}: kun {len(s[p]['rows'])} produkter")

# 4) Sammenlign med forrige forecast
hist = sorted(glob.glob(os.path.join(ROOT, "data", "history", "*.json")))
if hist:
    prev = json.load(open(hist[-1], encoding="utf-8"))
    n_prev = len(prev)
    if n_prev and len([v for v in snap["variants"] if v.get("ean")]) < 0.8 * n_prev:
        warnings.append(f"Varianter med EAN faldet markant ift. {os.path.basename(hist[-1])} ({n_prev} rækker sidst)")

for w in warnings: print("ADVARSEL:", w)
for p in problems: print("FEJL:", p)
print(f"OK: {len(snap['variants'])} varianter, {len(snap['bc_stock'])} BC-SKU'er, {len(snap['po_lines'])} PO-linjer, salg for {sorted(snap['sales'])}")
sys.exit(1 if problems else 0)
