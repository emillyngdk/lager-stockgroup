#!/usr/bin/env python3
"""Mail med de kritiske varer lige nu: data/mail_kritisk.html. Kør efter run-forecast.ts."""
import json, os, datetime as dt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
f = json.load(open(os.path.join(ROOT, "data", "forecast.json"), encoding="utf-8"))
SITE = "https://lager-stockgroup.vercel.app"
BR = {"gladkokken": ("Gladkokken", "Norge", "#E5322D"), "casper": ("Sobczyk", "Danmark", "#141414"), "herman": ("Herman", "Holland", "#F5820D"), "tomi": ("Tomi Björck", "Finland", "#1E9E5A")}
o = f["opsummering"]; dag0 = dt.date.fromisoformat(f["dag0"])
MD = ["januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november", "december"]
def tal(n, d=0): return (f"{n:,.{d}f}").replace(",", "X").replace(".", ",").replace("X", ".")
def dato(s): return "–" if not s else f"{dt.date.fromisoformat(s).day}. {MD[dt.date.fromisoformat(s).month-1][:3]}"
def dage_farve(n): return "#e5322d" if n is None or n <= 14 else "#f5820d" if n <= 45 else "#b58900"

krit = [r for r in f["rows"] if r["status"] == "kritisk"]
krit.sort(key=lambda r: (r["dage"]["tilUdsolgtMedPaaVej"] if r["dage"]["tilUdsolgtMedPaaVej"] is not None else 999, -r["velocity"]["base"]))
CSS = ".th{padding:8px 0 6px;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6b6b6b;border-bottom:1px solid #e8e4dc}.c{padding:10px 0 10px 12px;border-bottom:1px solid #f0ece4;font-size:14px;font-weight:600;white-space:nowrap}.v{padding:10px 0;border-bottom:1px solid #f0ece4;font-size:14px;font-weight:600;line-height:1.3}.d{padding:10px 0;border-bottom:1px solid #f0ece4;font-size:22px;font-weight:800;white-space:nowrap}.s{font-size:11px;font-weight:400;color:#6b6b6b}a.p{color:#141414;text-decoration:none}"
FONT = "font-family:Poppins,'Helvetica Neue',Arial,sans-serif"
h = [f'''<!DOCTYPE html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet"><title>Kritiske varer</title><style>{CSS}</style></head>
<body style="margin:0;padding:0;background:#f7f5f0;{FONT};color:#141414">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f7f5f0" style="background:#f7f5f0;background-color:#f7f5f0"><tr><td align="center" bgcolor="#f7f5f0" style="padding:24px 12px;background-color:#f7f5f0">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;border:1px solid #e8e4dc;border-radius:22px;overflow:hidden">
<tr><td bgcolor="#141414" style="background:#141414;background-color:#141414;border-radius:22px 22px 0 0;padding:32px 32px 28px">
  <img src="cid:att0" width="150" alt="Stock Group A/S" style="display:block;width:150px;height:auto;border:0">
  <p style="margin:22px 0 0;font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.5)">Lager &amp; forecast · {dag0.day}. {MD[dag0.month-1]} {dag0.year}</p>
  <h1 style="margin:8px 0 0;font-size:34px;line-height:1;font-weight:800;letter-spacing:-.02em;color:#fff;text-transform:uppercase">Kritiske varer</h1>
  <p style="margin:12px 0 0;font-size:14px;line-height:1.5;color:rgba(255,255,255,.75)">{len(krit)} varer tørrer ud før næste bekræftede levering, eller kan ikke nå at blive genbestilt i tide. Sorteret efter hvor få dage der er tilbage.</p>
</td></tr>
<tr><td bgcolor="#ffffff" style="background:#fff;background-color:#ffffff;padding:0 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>''']
for lab, val, col in (("Udsolgt", o["udsolgt"], "#141414"), ("Kritisk", o["kritisk"], "#e5322d"), ("Bestil nu", o["bestil_nu"], "#f5820d"), ("OBS", o["obs"], "#b58900")):
    h.append(f'<td width="25%" style="padding:22px 0 18px;border-bottom:1px solid #e8e4dc"><p style="margin:0;font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#6b6b6b">{lab}</p><p style="margin:4px 0 0;font-size:34px;line-height:1;font-weight:800;color:{col}">{val}</p></td>')
h.append('</tr></table></td></tr>')

for b, (navn, land, farve) in BR.items():
    alle = [r for r in krit if r["brand"] == b]
    if not alle: continue
    MAXROWS = int(os.environ.get("MAXROWS", "12")); rows = alle[:MAXROWS]; rest = len(alle) - len(rows)
    h.append(f'''<tr><td bgcolor="#ffffff" style="background:#fff;background-color:#ffffff;padding:28px 32px 6px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="width:10px;height:10px;border-radius:5px;background:{farve}"></td>
      <td style="padding-left:10px;font-size:19px;font-weight:800;letter-spacing:-.01em">{navn}</td>
      <td style="padding-left:10px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6b6b6b">{land} · {len(alle)} varer</td></tr></table></td></tr>''')
    h.append('<tr><td bgcolor="#ffffff" style="background:#fff;background-color:#ffffff;padding:0 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">')
    h.append('<tr><td class="th">Vare</td><td align="right" class="th">Dage</td><td align="right" class="th" style="padding-left:12px">Stk/dag</td><td align="right" class="th" style="padding-left:12px">Tilg.</td><td align="right" class="th" style="padding-left:12px">Foreslået</td></tr>')
    for r in rows:
        d = r["dage"]["tilUdsolgtMedPaaVej"]; pv = r["paaVej"]
        pa = f'<br><span class="s">+{tal(pv["usikker"])} ubooket {dato(pv["foersteEta"])}</span>' if pv["usikker"] and not pv["sikker"] else (f'<br><span class="s" style="color:#1e9e5a">+{tal(pv["sikker"])} booket {dato(pv["foersteEta"])}</span>' if pv["sikker"] else "")
        hero = ' <span style="font-size:9px;font-weight:700;letter-spacing:.1em;color:#f5820d">HERO</span>' if r["genbestilling"]["hero"] else ""
        fs = r["genbestilling"]["foreslaaetStk"]; cl = r["genbestilling"]["foreslaaetColli"]
        h.append(f'''<tr><td class="v"><a class="p" href="{SITE}/vare/{r["key"].replace(":", "%3A")}">{r["titel"]}</a>{hero}<br><span class="s">EAN {r["ean"]} · {tal(r["oekonomi"]["solgt365"] or 0)} solgt/365 d</span></td><td align="right" class="d" style="color:{dage_farve(d)}">{"180+" if d is None else d}</td><td align="right" class="c">{tal(r["velocity"]["base"], 1)}</td><td align="right" class="c">{tal(r["lager"]["tilgaengeligt"])}{pa}</td><td align="right" class="c" style="font-weight:800">{tal(fs) if fs else "–"}{f'<br><span class="s">{cl} colli</span>' if cl else ""}</td></tr>''')
    if rest: h.append(f'<tr><td colspan="5" style="padding:10px 0 0;font-size:12px;color:#6b6b6b">+ {rest} flere kritiske hos {navn} – <a href="{SITE}/fane/kritisk?brand={b}" style="color:#141414;font-weight:700">se alle på sitet →</a></td></tr>')
    h.append('</table></td></tr>')

h.append(f'''<tr><td bgcolor="#ffffff" style="background:#fff;background-color:#ffffff;padding:32px;border-radius:0 0 22px 22px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#141414;border-radius:12px"><a href="{SITE}/fane/kritisk" style="display:inline-block;padding:14px 22px;font-size:14px;font-weight:700;color:#fff;text-decoration:none">Åbn alle kritiske på sitet →</a></td>
  <td style="padding-left:10px"><a href="{SITE}/forslag" style="display:inline-block;padding:14px 18px;font-size:14px;font-weight:700;color:#141414;text-decoration:none;border:2px solid #e8e4dc;border-radius:12px">Ugens forslag</a></td></tr></table>
  <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#6b6b6b"><b>Sådan læses det:</b> “Dage” er dage til udsolgt med det der er på lager plus bekræftede (bookede) leveringer. “Foreslået” er den mængde en ny PO bør lyde på: lead time (Hybrid 6 mdr., øvrige 5 mdr., EU ca. 30 dage) plus 90–120 dages salg og sikkerhedslager, fratrukket alt der allerede er bestilt, rundet op til hele colli. Sæsonjusteret ud fra sidste års uge-for-uge-salg.</p>
</td></tr>
<tr><td style="padding:18px 8px;font-size:11px;color:#8a8a8a;text-align:center">Lager · Stock Group A/S · Shop Group · opdateres hver morgen · <a href="{SITE}" style="color:#8a8a8a">{SITE.replace("https://", "")}</a></td></tr>
</table></td></tr></table></body></html>''')
out = os.path.join(ROOT, "data", "mail_kritisk.html")
open(out, "w", encoding="utf-8").write("\n".join(h))
print(f"{len(krit)} kritiske varer → {out} ({os.path.getsize(out)//1024} KB)")
