#!/usr/bin/env python3
"""Skriv ugens indkøbsforslag som HTML-mail: data/mail.html (+ data/mail.txt). Kør efter run-forecast.ts."""
import json, os, datetime as dt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
f = json.load(open(os.path.join(ROOT, "data", "forecast.json"), encoding="utf-8"))
BR = {"gladkokken": "GK", "casper": "CS", "herman": "HdB", "tomi": "TB"}
o = f["opsummering"]; ol = f["opsummeringLinjer"]; dag0 = f["dag0"]; uge = dt.date.fromisoformat(dag0).isocalendar()[1]
site = "https://lager-stockgroup.vercel.app"
def tal(n): return f"{int(round(n)):,}".replace(",", ".")
def dato(s): return "Nu" if (s and s <= dag0) else (dt.date.fromisoformat(s).strftime("%-d. %b") if s else "–")
forslag = f.get("forslagEan") or []
total = sum(len(g["linjer"]) for g in forslag)
planer = {l["ean"]: l["plan"] for l in f["linjer"] if l.get("plan")}

h = [f'<div style="font-family:Poppins,Arial,sans-serif;color:#141414;max-width:720px">',
     f'<h1 style="font-size:26px;margin:0 0 4px">Ugens indkøbsforslag – uge {uge}</h1>',
     f'<p style="color:#6b6b6b;margin:0 0 16px">Forecast pr. {dt.date.fromisoformat(dag0).strftime("%-d. %B %Y")} · {total} indkøbslinjer (én pr. EAN, dækker alle shops) hos {len(forslag)} leverandører · <a href="{site}/forslag">åbn på sitet</a></p>',
     f'<p style="margin:0 0 20px"><b style="color:#e5322d">Bestil nu {ol["bestil_nu"]}</b> · <b style="color:#f5820d">Inden 14 dage {ol["bestil_14"]}</b> · <b style="color:#b58900">Inden 2 mdr. {ol["bestil_30"]}</b> · Book PO {ol["book_po"]} · Planlagt {ol["planlagt"]}</p>']
t = [f"Ugens indkøbsforslag – uge {uge} ({dag0})", f"Bestil nu {ol['bestil_nu']} · Inden 14 dage {ol['bestil_14']} · Inden 2 mdr. {ol['bestil_30']} · Book PO {ol['book_po']}", f"{site}/forslag", ""]
for g in forslag:
    h.append(f'<h2 style="font-size:17px;margin:22px 0 6px">{g["leverandoer"]} <span style="color:#6b6b6b;font-weight:normal;font-size:13px">{len(g["linjer"])} linjer · {tal(sum(l["foreslaaetStk"] for l in g["linjer"]))} stk</span></h2>')
    h.append('<table style="border-collapse:collapse;width:100%;font-size:13px"><tr style="text-align:left;color:#6b6b6b"><th style="padding:4px 6px">Vare</th><th style="padding:4px 6px">Shops</th><th style="padding:4px 6px">EAN</th><th style="padding:4px 6px">Bestil senest</th><th style="padding:4px 6px;text-align:right">Stk</th><th style="padding:4px 6px;text-align:right">Colli</th><th style="padding:4px 6px">Rækker til</th></tr>')
    t.append(f"== {g['leverandoer']} ==")
    for l in g["linjer"]:
        bs = dato(l["bestilSenest"]); red = ' style="color:#e5322d;font-weight:bold"' if bs == "Nu" else ""
        pl = planer.get(l["ean"]); plan = f' <span style="color:#5b6cff;font-size:11px">planlagt{(" af " + pl["af"]) if pl and pl.get("af") else ""}</span>' if pl else ""
        h.append(f'<tr style="border-top:1px solid #e8e4dc"><td style="padding:5px 6px"><a href="{site}/linje/{l["ean"]}" style="color:#141414">{l["titel"]}</a>{plan}</td><td style="padding:5px 6px;color:#6b6b6b">{"+".join(BR[b] for b in l["brands"])}</td><td style="padding:5px 6px;color:#6b6b6b">{l["ean"]}</td><td style="padding:5px 6px"{red}>{bs}</td><td style="padding:5px 6px;text-align:right;font-weight:bold">{tal(l["foreslaaetStk"])}</td><td style="padding:5px 6px;text-align:right">{l["foreslaaetColli"] or "–"}</td><td style="padding:5px 6px;color:#6b6b6b">{dato(l["raekkerTil"]) if l.get("raekkerTil") else "2 år+"}</td></tr>')
        t.append(f"- {l['titel']} ({'+'.join(BR[b] for b in l['brands'])}, EAN {l['ean']}): bestil senest {bs}, {tal(l['foreslaaetStk'])} stk / {l['foreslaaetColli'] or '–'} colli{' (planlagt)' if pl else ''}")
    h.append("</table>"); t.append("")
h.append(f'<p style="color:#6b6b6b;font-size:12px;margin-top:24px">Mængder dækker alle shops: lead time (Hybrid 6 mdr., øvrige 5 mdr., EU 30 dage) + 90/120 dages salg med sikkerhedslager, fratrukket alt der allerede er bestilt, rundet op til hele colli. Hele regnestykket: <a href="{site}/om">{site}/om</a></p></div>')
open(os.path.join(ROOT, "data", "mail.html"), "w", encoding="utf-8").write("\n".join(h))
open(os.path.join(ROOT, "data", "mail.txt"), "w", encoding="utf-8").write("\n".join(t))
print(f"Emne: Ugens indkøbsforslag – uge {uge} | {total} linjer | skrevet data/mail.html og data/mail.txt")
