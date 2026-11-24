#!/usr/bin/env python3
"""Normaliser Shopify-produktdata fra Jullytics shopify_hent-svar (persisted eller compact).

Output: data/variants.json  -> liste af varianter pr. shop
        data/eans.txt       -> unikke EAN/SKU'er til BC-opslag
"""
import json, glob, re, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
OUT = os.path.join(ROOT, "data")

BRAND_LOC = {"gladkokken": "NO-ECOM", "casper": "SOB-ECOM", "herman": "NL-ECOM", "tomi": "FI-ECOM"}

def load_persisted(path):
    """Tool-result-fil: liste af {type:text,text:'...'} hvor text = 'Shopify: ...\n{json}'."""
    with open(path, encoding="utf-8") as f:
        payload = json.load(f)
    if isinstance(payload, list):
        text = "".join(p.get("text", "") for p in payload if p.get("type") == "text")
    else:
        text = payload if isinstance(payload, str) else json.dumps(payload)
    i = text.find("{")
    data = json.loads(text[i:])
    shops = []
    for b in data["butikker"]:
        if b.get("status") != "ok":
            continue
        nodes = b["data"]["products"]["nodes"]
        shops.append((b["brand"], nodes, False))
    return shops

def load_compact(path):
    with open(path, encoding="utf-8") as f:
        d = json.load(f)
    return [(d["brand"], d["nodes"], True)]

def gid(s):
    return s.rsplit("/", 1)[-1] if isinstance(s, str) else s

def norm_variant(brand, p, v, compact):
    if compact:
        loc = v.get("loc") or {}
        return dict(
            brand=brand, product_id=gid(p["id"]), title=p["title"],
            created_at=(p.get("createdAt") or "")[:10] or None,
            published_at=(p.get("publishedAt") or "")[:10] or None,
            product_type=p.get("productType") or "",
            variant_id=gid(v["id"]), sku=v.get("sku"), barcode=v.get("barcode"),
            shopify_qty=v.get("qty"), unit_cost=v.get("cost"), levels=loc,
        )
    inv = v.get("inventoryItem") or {}
    cost = (inv.get("unitCost") or {}).get("amount")
    levels = {}
    for lvl in ((inv.get("inventoryLevels") or {}).get("nodes") or []):
        name = (lvl.get("location") or {}).get("name") or "?"
        q = None
        for qq in lvl.get("quantities") or []:
            q = qq.get("quantity")
        levels[name] = q
    return dict(
        brand=brand, product_id=gid(p["id"]), title=p["title"],
        created_at=(p.get("createdAt") or "")[:10] or None,
        published_at=(p.get("publishedAt") or "")[:10] or None,
        product_type=p.get("productType") or "",
        variant_id=gid(v["id"]), sku=v.get("sku"), barcode=v.get("barcode"),
        shopify_qty=v.get("inventoryQuantity"),
        unit_cost=float(cost) if cost not in (None, "") else None,
        levels=levels,
    )

def main():
    variants = []
    seen = set()
    compact_paths = [p for p in sorted(glob.glob(os.path.join(RAW, "compact_*.json"))) if "compact_bc_" not in os.path.basename(p)]
    for path in sorted(glob.glob(os.path.join(RAW, "shopify_*.json"))) + compact_paths:
        loader = load_compact if os.path.basename(path).startswith("compact_") else load_persisted
        for brand, nodes, compact in loader(path):
            for p in nodes:
                vs = p["variants"] if compact else p["variants"]["nodes"]
                for v in vs:
                    nv = norm_variant(brand, p, v, compact)
                    key = (brand, nv["variant_id"])
                    if key in seen:
                        continue
                    seen.add(key)
                    variants.append(nv)
    # EAN-nøgle: barcode, ellers sku hvis det ligner et EAN (8-14 cifre)
    def ean_of(v):
        for cand in (v["barcode"], v["sku"]):
            if cand and re.fullmatch(r"\d{8,14}", cand):
                return cand
        return None
    eans = set()
    for v in variants:
        v["ean"] = ean_of(v)
        # bundles med "ean+ean" i sku -> komponenter
        v["components"] = None
        if not v["ean"] and v["sku"] and "+" in v["sku"]:
            parts = [s for s in v["sku"].split("+") if re.fullmatch(r"\d{8,14}", s)]
            if parts:
                v["components"] = parts
                eans.update(parts)
        if v["ean"]:
            eans.add(v["ean"])
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "variants.json"), "w", encoding="utf-8") as f:
        json.dump(variants, f, ensure_ascii=False, indent=0)
    with open(os.path.join(OUT, "eans.txt"), "w") as f:
        f.write("\n".join(sorted(eans)))
    by_brand = {}
    for v in variants:
        by_brand.setdefault(v["brand"], [0, 0])
        by_brand[v["brand"]][0] += 1
        if v["ean"]:
            by_brand[v["brand"]][1] += 1
    print("varianter pr. brand (total, med EAN):", by_brand)
    print("unikke EAN'er:", len(eans))

if __name__ == "__main__":
    main()
