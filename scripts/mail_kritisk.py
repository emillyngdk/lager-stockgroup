#!/usr/bin/env python3
"""Mail med indkøbslinjer i status "Bestil nu": data/mail_kritisk.html.
   --kun-nye : kun linjer der IKKE var "Bestil nu" i forrige kørsel (data/history/<forrige dato>.json). Exit 2 hvis der ingen er."""
import json, os, sys, glob, datetime as dt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
f = json.load(open(os.path.join(ROOT, "data", "forecast.json"), encoding="utf-8"))
SITE = "https://lager-stockgroup.vercel.app"
BR = {"gladkokken": ("Gladkokken", "GK", "#E5322D"), "casper": ("Sobczyk", "CS", "#141414"), "herman": ("Herman", "HdB", "#F5820D"), "tomi": ("Tomi Björck", "TB", "#1E9E5A")}
ol = f["opsummeringLinjer"]; dag0 = dt.date.fromisoformat(f["dag0"])
MD = ["januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november", "december"]
def tal(n, d=0): return (f"{n:,.{d}f}").replace(",", "X").replace(".", ",").replace("X", ".")
def dato(s): return "–" if not s else f"{dt.date.fromisoformat(s).day}. {MD[dt.date.fromisoformat(s).month-1][:3]}"

kun_nye = "--kun-nye" in sys.argv
nu = [l for l in f["linjer"] if l["status"] == "bestil_nu"]
if kun_nye:
    hist = sorted(p for p in glob.glob(os.path.join(ROOT, "data", "history", "*.json")) if not p.endswith(f"{f['dag0']}.json"))
    forrige = set()
    if hist:
        h = json.load(open(hist[-1], encoding="utf-8"))
        forrige = {x["ean"] for x in (h.get("linjer") if isinstance(h, dict) else []) if x["status"] == "bestil_nu"}
    nu = [l for l in nu if l["ean"] not in forrige]
    if not nu:
        print("Ingen nye Bestil nu-linjer siden sidst – ingen mail."); sys.exit(2)
nu.sort(key=lambda l: (-(l["genbestilling"]["foreslaaetStk"] > 0), l["dage"]["medPaaVej"] if l["dage"]["medPaaVej"] is not None else 9999, -l["velocity"]["base"]))

CSS = ".th{padding:8px 0 6px;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6b6b6b;border-bottom:1px solid #e8e4dc}.c{padding:10px 0 10px 12px;border-bottom:1px solid #f0ece4;font-size:14px;font-weight:600;white-space:nowrap}.v{padding:10px 0;border-bottom:1px solid #f0ece4;font-size:14px;font-weight:600;line-height:1.3}.d{padding:10px 0 10px 12px;border-bottom:1px solid #f0ece4;font-size:22px;font-weight:800;white-space:nowrap}.s{font-size:11px;font-weight:400;color:#6b6b6b}a.p{color:#141414;text-decoration:none}"
titel = "Nye varer at bestille" if kun_nye else "Bestil nu"
intro = f"{len(nu)} indkøbslinjer er kommet på Bestil nu siden sidste kørsel." if kun_nye else f"{len(nu)} indkøbslinjer har nået reorder point. Én linje pr. EAN; mængden dækker alle shops."
h = [f'''<!DOCTYPE html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>{titel}</title><style>{CSS}</style></head>
<body style="margin:0;padding:0;background:#f7f5f0;font-family:Poppins,'Helvetica Neue',Arial,sans-serif;color:#141414">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f7f5f0" style="background-color:#f7f5f0"><tr><td align="center" bgcolor="#f7f5f0" style="padding:24px 12px">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;border:1px solid #e8e4dc;border-radius:22px;overflow:hidden">
<tr><td bgcolor="#141414" style="background-color:#141414;border-radius:22px 22px 0 0;padding:32px 32px 28px">
  <img src="cid:att0" width="150" alt="Stock Group A/S" style="display:block;width:150px;height:auto;border:0">
  <p style="margin:22px 0 0;font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.5)">Indkøb · {dag0.day}. {MD[dag0.month-1]} {dag0.year}</p>
  <h1 style="margin:8px 0 0;font-size:34px;line-height:1;font-weight:800;letter-spacing:-.02em;color:#fff;text-transform:uppercase">{titel}</h1>
  <p style="margin:12px 0 0;font-size:14px;line-height:1.5;color:rgba(255,255,255,.75)">{intro}</p>
</td></tr>
<tr><td bgcolor="#ffffff" style="background-color:#ffffff;padding:0 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>''']
for lab, val, col in (("Bestil nu", ol["bestil_nu"], "#e5322d"), ("Inden 14 d", ol["bestil_14"], "#f5820d"), ("Inden 2 mdr.", ol["bestil_30"], "#b58900"), ("Book PO", ol["book_po"], "#b58900")):
    h.append(f'<td width="25%" style="padding:22px 0 18px;border-bottom:1px solid #e8e4dc"><p style="margin:0;font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#6b6b6b">{lab}</p><p style="margin:4px 0 0;font-size:34px;line-height:1;font-weight:800;color:{col}">{val}</p></td>')
h.append('</tr></table></td></tr>')
h.append('<tr><td bgcolor="#ffffff" style="background-color:#ffffff;padding:20px 32px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">')
h.append('<tr><td class="th">Vare</td><td align="right" class="th" style="padding-left:12px">Bestil</td><td align="right" class="th" style="padding-left:12px">Rækker til</td><td align="right" class="th" style="padding-left:12px">Tør</td><td align="right" class="th" style="padding-left:12px">Stk/dag</td></tr>')
MAX = int(os.environ.get("MAXROWS", "30"))
for l in nu[:MAX]:
    g = l["genbestilling"]; d = l["dage"]["medPaaVej"]
    shops = " ".join(f'<span style="color:{BR[b][2]}">●</span>{BR[b][1]}' for b in l["brands"])
    plan = f'<br><span class="s" style="color:#5b6cff">planlagt {tal(l["plan"]["stk"])} stk{(" af " + l["plan"]["af"]) if l["plan"].get("af") else ""}</span>' if l.get("plan") else ""
    pa = f'<br><span class="s">+{tal(l["paaVej"]["usikker"])} ubooket</span>' if l["paaVej"]["usikker"] else (f'<br><span class="s" style="color:#1e9e5a">+{tal(l["paaVej"]["sikker"])} booket</span>' if l["paaVej"]["sikker"] else "")
    hero = ' <span style="font-size:9px;font-weight:700;letter-spacing:.1em;color:#f5820d">HERO</span>' if l["hero"] else ""
    h.append(f'<tr><td class="v"><a class="p" href="{SITE}/linje/{l["ean"]}">{l["titel"]}</a>{hero}<br><span class="s">{shops} · EAN {l["ean"]} · {l["leverandoer"] or "leverandør ukendt"}</span>{plan}</td>'
             f'<td align="right" class="d">{tal(g["foreslaaetStk"]) if g["foreslaaetStk"] else "–"}<br><span class="s">{(str(g["foreslaaetColli"]) + " colli") if g["foreslaaetColli"] else ""}</span></td>'
             f'<td align="right" class="c">{dato(l["datoer"]["raekkerTil"]) if g["foreslaaetStk"] and l["datoer"]["raekkerTil"] else ("2 år+" if g["foreslaaetStk"] else "–")}</td>'
             f'<td align="right" class="c" style="color:{"#e5322d" if d is not None and d <= 14 else "#f5820d" if d is not None and d <= 45 else "#141414"}">{"180+" if d is None else str(d) + " d"}{pa}</td>'
             f'<td align="right" class="c">{tal(l["velocity"]["base"], 1)}<br><span class="s">{tal(l["velocity"]["solgt365"] or 0)} / {min(365, l["velocity"]["salgsdage"])} d{" · ny" if l["velocity"]["salgsdage"] < 90 else ""}</span></td></tr>')
if len(nu) > MAX: h.append(f'<tr><td colspan="5" style="padding:10px 0 0;font-size:12px;color:#6b6b6b">+ {len(nu) - MAX} flere – <a href="{SITE}/?g=nu" style="color:#141414;font-weight:700">se alle på sitet →</a></td></tr>')
h.append('</table></td></tr>')
h.append(f'''<tr><td bgcolor="#ffffff" style="background-color:#ffffff;padding:32px;border-radius:0 0 22px 22px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#141414;border-radius:12px"><a href="{SITE}/?g=nu" style="display:inline-block;padding:14px 22px;font-size:14px;font-weight:700;color:#fff;text-decoration:none">Åbn indkøbslisten →</a></td>
  <td style="padding-left:10px"><a href="{SITE}/forslag" style="display:inline-block;padding:14px 18px;font-size:14px;font-weight:700;color:#141414;text-decoration:none;border:2px solid #e8e4dc;border-radius:12px">Pr. leverandør</a></td></tr></table>
  <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#6b6b6b"><b>Sådan læses det:</b> “Bestil” er den mængde en ny PO bør lyde på for at dække alle shops: lead time (Hybrid 6 mdr., øvrige 5 mdr., EU ca. 30 dage) plus 90–120 dages salg og sikkerhedslager, fratrukket alt der er på lager og bestilt. “Rækker til” er datoen den mængde holder til. “Tør” er dage til udsolgt med bookede leveringer. Klik på varen for at justere mængden og gemme en plan.</p>
</td></tr>
<tr><td style="padding:18px 8px;font-size:11px;color:#8a8a8a;text-align:center">Lager · Stock Group A/S · Shop Group · opdateres hver morgen · <a href="{SITE}" style="color:#8a8a8a">{SITE.replace("https://", "")}</a></td></tr>
</table></td></tr></table></body></html>''')
out = os.path.join(ROOT, "data", "mail_kritisk.html")
open(out, "w", encoding="utf-8").write("\n".join(h))
print(f"{len(nu)} linjer → {out} ({os.path.getsize(out)//1024} KB) · emne: {titel} – {dag0.day}. {MD[dag0.month-1]}")
