#!/usr/bin/env python3
"""Skriv ugens indkøbsforslag som HTML-mail: data/mail.html (+ data/mail.txt). Kør efter run-forecast.ts."""
import json, os, datetime as dt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
f = json.load(open(os.path.join(ROOT, "data", "forecast.json"), encoding="utf-8"))
BR = {"gladkokken": "Gladkokken", "casper": "Sobczyk", "herman": "Herman", "tomi": "Tomi Björck"}
o = f["opsummering"]; dag0 = f["dag0"]; uge = dt.date.fromisoformat(dag0).isocalendar()[1]
site = "https://lager-stockgroup.vercel.app"
def tal(n): return f"{int(round(n)):,}".replace(",", ".")
def dato(s): return "Nu" if (s and s <= dag0) else (dt.date.fromisoformat(s).strftime("%-d. %b") if s else "–")
total = sum(len(g["linjer"]) for g in f["forslag"])

h = [f'<div style="font-family:Poppins,Arial,sans-serif;color:#141414;max-width:720px">',
     f'<h1 style="font-size:26px;margin:0 0 4px">Ugens indkøbsforslag – uge {uge}</h1>',
     f'<p style="color:#6b6b6b;margin:0 0 16px">Forecast pr. {dt.date.fromisoformat(dag0).strftime("%-d. %B %Y")} · {total} linjer hos {len(f["forslag"])} leverandører · <a href="{site}/forslag">åbn på sitet</a></p>',
     f'<p style="margin:0 0 20px"><b style="color:#141414">Udsolgt {o["udsolgt"]}</b> · <b style="color:#e5322d">Kritisk {o["kritisk"]}</b> · <b style="color:#f5820d">Bestil nu {o["bestil_nu"]}</b> · <b style="color:#b58900">OBS {o["obs"]}</b> · OK {o["ok"]}</p>']
t = [f"Ugens indkøbsforslag – uge {uge} ({dag0})", f"Udsolgt {o['udsolgt']} · Kritisk {o['kritisk']} · Bestil nu {o['bestil_nu']} · OBS {o['obs']}", f"{site}/forslag", ""]
for g in f["forslag"]:
    h.append(f'<h2 style="font-size:17px;margin:22px 0 6px">{g["leverandoer"]} <span style="color:#6b6b6b;font-weight:normal;font-size:13px">{len(g["linjer"])} linjer · {tal(sum(l["foreslaaetStk"] for l in g["linjer"]))} stk</span></h2>')
    h.append('<table style="border-collapse:collapse;width:100%;font-size:13px"><tr style="text-align:left;color:#6b6b6b"><th style="padding:4px 6px">Vare</th><th style="padding:4px 6px">Brand</th><th style="padding:4px 6px">EAN</th><th style="padding:4px 6px">Bestil senest</th><th style="padding:4px 6px;text-align:right">Stk</th><th style="padding:4px 6px;text-align:right">Colli</th></tr>')
    t.append(f"== {g['leverandoer']} ==")
    for l in g["linjer"]:
        bs = dato(l["bestilSenest"]); red = ' style="color:#e5322d;font-weight:bold"' if bs == "Nu" else ""
        h.append(f'<tr style="border-top:1px solid #e8e4dc"><td style="padding:5px 6px"><a href="{site}/vare/{l["key"].replace(":", "%3A")}" style="color:#141414">{l["titel"]}</a></td><td style="padding:5px 6px">{BR[l["brand"]]}</td><td style="padding:5px 6px;color:#6b6b6b">{l["ean"]}</td><td style="padding:5px 6px"{red}>{bs}</td><td style="padding:5px 6px;text-align:right;font-weight:bold">{tal(l["foreslaaetStk"])}</td><td style="padding:5px 6px;text-align:right">{l["foreslaaetColli"] or "–"}</td></tr>')
        t.append(f"- {l['titel']} ({BR[l['brand']]}, EAN {l['ean']}): bestil senest {bs}, {tal(l['foreslaaetStk'])} stk / {l['foreslaaetColli'] or '–'} colli")
    h.append("</table>"); t.append("")
h.append(f'<p style="color:#6b6b6b;font-size:12px;margin-top:24px">Mængder dækker lead time + 90/120 dages salg med sikkerhedslager, fratrukket alt der allerede er bestilt, rundet op til hele colli. Hele regnestykket: <a href="{site}/om">{site}/om</a></p></div>')
open(os.path.join(ROOT, "data", "mail.html"), "w", encoding="utf-8").write("\n".join(h))
open(os.path.join(ROOT, "data", "mail.txt"), "w", encoding="utf-8").write("\n".join(t))
print(f"Emne: Ugens indkøbsforslag – uge {uge} | {total} linjer | skrevet data/mail.html og data/mail.txt")
