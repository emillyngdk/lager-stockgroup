#!/usr/bin/env python3
"""Saml alle rå tool-svar i data/raw til ét snapshot: data/snapshot.json

Kilder:
  shopify_*.json / compact_*.json   -> varianter (via parse_shopify.py -> data/variants.json)
  bc_lager_p*.json / compact_bc_lager_*.json -> BC-lager pr. SKU og lokation
  bc_po_p*.json / compact_bc_po_*.json       -> åbne PO-linjer
  sales_<brand>_<period>*.json                -> produktsalg (fuldt Jullytics-svar eller kompakt)
  dagsserie_<brand>_*.json                    -> dagsserie (units pr. dag) til sæsonindeks
"""
import json, glob, os, re, sys
from datetime import date, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
OUT = os.path.join(ROOT, "data", "snapshot.json")

def read_tool_json(path):
    with open(path, encoding="utf-8") as f:
        payload = json.load(f)
    if isinstance(payload, dict) and payload.get("compact"):
        return payload
    if isinstance(payload, dict) and "rows" in payload and "brand" in payload:
        return payload
    text = "".join(p.get("text", "") for p in payload if p.get("type") == "text") if isinstance(payload, list) else payload
    i = text.find("{")
    return json.loads(text[i:text.rfind("}") + 1])

def dk_date(s):
    """DD-MM-YYYY -> YYYY-MM-DD"""
    if not s:
        return None
    m = re.match(r"(\d{2})-(\d{2})-(\d{4})", s)
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else s

# ---------- BC-lager ----------
LOC_FIELDS = ["lager", "reserveret_andre_kunder", "reserveret_shop_group", "overflytning_reserveret",
              "disponibelt", "bestilt_andre_kunder", "bestilt_shop_group", "disponibelt_efter_alle_andre_kunders_ordrer"]

def load_bc_stock():
    out = {}
    laest = None
    for path in sorted(glob.glob(os.path.join(RAW, "bc_lager_*.json")) + glob.glob(os.path.join(RAW, "compact_bc_lager_*.json"))):
        d = read_tool_json(path)
        if d.get("compact"):
            for v in d["varer"]:
                ean = v["ean"] or v["sku"].lstrip("X")
                out[ean] = dict(bc_sku=v["sku"], ean=ean, navn=v["vare"], stk_pr_colli=v.get("cll"),
                                lokationer={k: dict(zip(LOC_FIELDS, vals)) for k, vals in v["lok"].items()})
        else:
            laest = d.get("laest") or laest
            for v in d["varer"]:
                ean = v.get("ean") or v["sku"].lstrip("X")
                out[ean] = dict(bc_sku=v["sku"], ean=ean, navn=v["vare"], stk_pr_colli=v.get("stk_pr_colli"),
                                lokationer={l["lokation"]: {k: l.get(k) for k in LOC_FIELDS} for l in v["lokationer"]})
    return out, laest

# ---------- Åbne PO-linjer ----------
def load_po():
    lines = []
    laest = None
    for path in sorted(glob.glob(os.path.join(RAW, "bc_po_*.json")) + glob.glob(os.path.join(RAW, "compact_bc_po_*.json"))):
        d = read_tool_json(path)
        if d.get("compact"):
            for po, linje, ean, vare, antal, cll, lok, plan in d["linjer"]:
                lines.append(dict(po=po, linje=linje, ean=ean, vare=vare, antal=antal, stk_pr_colli=cll, lokation=lok,
                                  leverandoer=d.get("lev"), indkoeber=d.get("ind"), planlagt_modtagelse=dk_date(plan),
                                  booket=False, speditoer=None, transport=None, eta_havn=None, levering_lager=None,
                                  forventet=dk_date(plan), forventet_kilde="planlagt modtagelse i BC",
                                  status="Planlagt (ikke booket)", eu_leverandoer=False))
        else:
            laest = (d.get("laest") or {}).get("bc") or laest
            for l in d["linjer"]:
                lines.append(dict(po=l["po"], linje=l["linje"], ean=l.get("ean") or l["sku"].lstrip("X"), vare=l["vare"],
                                  antal=l["antal"], stk_pr_colli=l.get("stk_pr_colli"), lokation=l.get("lokation"),
                                  leverandoer=l.get("leverandoer"), indkoeber=l.get("indkoeber"),
                                  planlagt_modtagelse=dk_date(l.get("planlagt_modtagelse")), booket=l.get("booket"),
                                  speditoer=l.get("speditoer"), transport=l.get("transport"), eta_havn=dk_date(l.get("eta_havn")),
                                  levering_lager=dk_date(l.get("levering_lager")), forventet=dk_date(l.get("forventet")),
                                  forventet_kilde=l.get("forventet_kilde"), status=l.get("status"),
                                  eu_leverandoer=bool(l.get("eu_leverandoer"))))
    # dedup (po, linje)
    seen, uniq = set(), []
    for l in lines:
        k = (l["po"], l["linje"])
        if k in seen:
            continue
        seen.add(k); uniq.append(l)
    return uniq, laest

# ---------- Produktsalg ----------
def load_sales():
    """-> {brand: {period: {from,to,days, rows:{product_id: {solgt, solgt_foer, lager}}}}}"""
    out = {}
    for path in sorted(glob.glob(os.path.join(RAW, "sales_*.json"))):
        name = os.path.basename(path)[6:-5]  # <brand>_<period>[_full]
        parts = name.split("_")
        brand, period = parts[0], parts[1]
        d = read_tool_json(path)
        rows = {}
        if "rows" in d and isinstance(d["rows"], list) and d["rows"] and isinstance(d["rows"][0], list):
            frm, to, days = d["from"], d["to"], d["days"]
            for row in d["rows"]:
                pid, solgt, foer, lager = row[:4]
                extra = {}
                if len(row) > 4: extra["db"] = row[4]
                if len(row) > 5: extra["titel"] = row[5]
                rows[str(pid)] = dict(solgt=solgt, solgt_foer=foer, lager=lager, **extra)
        else:
            frm, to = d["periode"]["from"], d["periode"]["to"]
            days = (date.fromisoformat(to) - date.fromisoformat(frm)).days + 1
            for r in d["rows"]:
                pid = str(r["produktId"])
                if pid.startswith("title:"):
                    continue
                rows[pid] = dict(solgt=r["solgt"], solgt_foer=r.get("solgtFoer") or 0, lager=r.get("lager"),
                                 titel=r.get("titel"), db_pr_stk=r.get("dbPrStkFuld"), nye_kunder=r.get("nyeKunder"),
                                 db=r.get("db"))
        out.setdefault(brand, {})[period] = dict(**{"from": frm, "to": to}, days=days, rows=rows)
    return out

# ---------- Dagsserie ----------
def load_dayseries():
    out = {}
    for path in sorted(glob.glob(os.path.join(RAW, "dagsserie_*.json"))):
        brand = os.path.basename(path).split("_")[1]
        d = read_tool_json(path)
        ser = out.setdefault(brand, {})
        for day in d["dage"]:
            ser[day["day"]] = day["units"]
    return out

def main():
    variants = json.load(open(os.path.join(ROOT, "data", "variants.json"), encoding="utf-8"))
    stock, stock_laest = load_bc_stock()
    po, po_laest = load_po()
    sales = load_sales()
    days = load_dayseries()
    snap = dict(
        generated_at=datetime.now().isoformat(timespec="seconds"),
        sources=dict(bc_laest=stock_laest, po_laest=po_laest, shopify_hentet=date.today().isoformat(),
                     sales_periods={b: {p: [v["from"], v["to"]] for p, v in d.items()} for b, d in sales.items()},
                     dayseries_range={b: [min(s), max(s)] for b, s in days.items()}),
        variants=variants, bc_stock=stock, po_lines=po, sales=sales, dayseries=days,
    )
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(snap, f, ensure_ascii=False)
    print(f"varianter {len(variants)} | BC-SKU'er {len(stock)} | PO-linjer {len(po)} | salg: " +
          ", ".join(f"{b}:{'/'.join(d.keys())}" for b, d in sales.items()) +
          f" | dagsserier: {', '.join(f'{b} {len(s)}d' for b, s in days.items())}")
    print("skrevet", OUT, os.path.getsize(OUT) // 1024, "KB")

if __name__ == "__main__":
    main()
