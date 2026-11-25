#!/usr/bin/env python3
"""Ugens indkøbsforslag som HTML-mail (mandag): data/mail.html (+ data/mail.txt). Kør efter run-forecast.ts.
   Samme linjer som "Skal bestilles" på sitet (Bestil nu / inden 14 dage / inden 2 mdr.), grupperet pr. leverandør.
   Logoet er inline-vedhæftningen cid:att0 (public/stock-group-white.png), som i mail_kritisk.py."""
import json, os, datetime as dt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
f = json.load(open(os.path.join(ROOT, "data", "forecast.json"), encoding="utf-8"))
SITE = "https://lager-stockgroup.vercel.app"
BR = {"gladkokken": ("GK", "#E5322D"), "casper": ("CS", "#141414"), "herman": ("HdB", "#F5820D"), "tomi": ("TB", "#1E9E5A")}
MD = ["januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november", "december"]
ol = f["opsummeringLinjer"]; dag0 = dt.date.fromisoformat(f["dag0"]); uge = dag0.isocalendar()[1]
L = {l["ean"]: l for l in f["linjer"]}
UKENDT = "Ukendt leverandør"

def tal(n, d=0): return (f"{n:,.{d}f}").replace(",", "X").replace(".", ",").replace("X", ".")
def dato(s):
    if not s: return "–"
    d = dt.date.fromisoformat(s)
    return f"{d.day}. {MD[d.month-1][:3]}" + (f" ’{str(d.year)[2:]}" if d.year != dag0.year else "")
def kortlev(n):
    import re
    k = re.sub(r"[\s,.]*(co\.?\s*,?\s*ltd\.?|company\s+limited|limited|ltd\.?|inc\.?|gmbh|a/s|aps|b\.?v\.?|oy|ab)\s*$", "", n, flags=re.I).rstrip(" ,.").strip() or n
    return k.title() if k == k.upper() else k

grupper = [g for g in (f.get("forslagEan") or []) if g["linjer"]]
grupper.sort(key=lambda g: (g["leverandoer"] == UKENDT, -len(g["linjer"])))  # navngivne leverandører først, "ukendt" sidst
alle = [x for g in grupper for x in g["linjer"]]
n_nu = sum(1 for x in alle if x["bestilSenest"] and x["bestilSenest"] <= f["dag0"])
stk = sum(x["foreslaaetStk"] for x in alle)
n_ukendt = sum(len(g["linjer"]) for g in grupper if g["leverandoer"] == UKENDT)

CSS = (".th{padding:8px 0 6px;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6b6b6b;border-bottom:1px solid #e8e4dc}"
       ".v{padding:9px 0;border-bottom:1px solid #f0ece4;font-size:14px;font-weight:600;line-height:1.3}"
       ".c{padding:9px 0 9px 12px;border-bottom:1px solid #f0ece4;font-size:14px;font-weight:600;white-space:nowrap}"
       ".s{font-size:11px;font-weight:500;color:#8a8a8a}.p{color:#141414;text-decoration:none}")
titel = "Ugens indkøbsforslag"
intro = (f"{len(alle)} varer skal bestilles inden for de næste 2 måneder – {n_nu} af dem nu. Én linje pr. EAN; mængden dækker alle shops."
         if alle else "Intet skal bestilles inden for de næste 2 måneder. Listen er i 0.")
h = [f'''<!DOCTYPE html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>{titel} – uge {uge}</title><style>{CSS}</style></head>
<body style="margin:0;padding:0;background:#f7f5f0;font-family:Poppins,'Helvetica Neue',Arial,sans-serif;color:#141414">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f7f5f0" style="background-color:#f7f5f0"><tr><td align="center" bgcolor="#f7f5f0" style="padding:24px 12px">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;border:1px solid #e8e4dc;border-radius:22px;overflow:hidden">
<tr><td bgcolor="#141414" style="background-color:#141414;border-radius:22px 22px 0 0;padding:32px 32px 28px">
  <img src="cid:att0" width="150" alt="Stock Group A/S" style="display:block;width:150px;height:auto;border:0">
  <p style="margin:22px 0 0;font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.5)">Uge {uge} · {dag0.day}. {MD[dag0.month-1]} {dag0.year}</p>
  <h1 style="margin:8px 0 0;font-size:34px;line-height:1;font-weight:800;letter-spacing:-.02em;color:#fff;text-transform:uppercase">{titel}</h1>
  <p style="margin:12px 0 0;font-size:14px;line-height:1.5;color:rgba(255,255,255,.75)">{intro}</p>
</td></tr>
<tr><td bgcolor="#ffffff" style="background-color:#ffffff;padding:0 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>''']
for lab, val, col in (("Skal bestilles", tal(len(alle)), "#141414"), ("Heraf nu", tal(n_nu), "#e5322d"), ("Stk i alt", tal(stk), "#141414"), ("Leverandører", tal(len([g for g in grupper if g["leverandoer"] != UKENDT])), "#141414")):
    h.append(f'<td width="25%" style="padding:22px 0 18px;border-bottom:1px solid #e8e4dc"><p style="margin:0;font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#6b6b6b">{lab}</p><p style="margin:4px 0 0;font-size:28px;line-height:1;font-weight:800;color:{col}">{val}</p></td>')
h.append('</tr></table></td></tr>')
h.append(f'''<tr><td bgcolor="#ffffff" style="background-color:#ffffff;padding:22px 32px 4px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#141414;border-radius:12px"><a href="{SITE}/" style="display:inline-block;padding:13px 20px;font-size:14px;font-weight:700;color:#fff;text-decoration:none">Åbn Skal bestilles →</a></td>
  <td style="padding-left:10px"><a href="{SITE}/api/skal-bestilles.xlsx" style="display:inline-block;padding:13px 18px;font-size:14px;font-weight:700;color:#141414;text-decoration:none;border:2px solid #e8e4dc;border-radius:12px">Hent som Excel</a></td></tr></table>
</td></tr>''')
t = [f"{titel} – uge {uge} ({f['dag0']})", f"{len(alle)} varer skal bestilles inden for 2 måneder, {n_nu} nu · {tal(stk)} stk", f"{SITE}/", ""]

for g in grupper:
    lev = g["leverandoer"]; navn = "Leverandør ikke sat" if lev == UKENDT else kortlev(lev)
    gstk = sum(x["foreslaaetStk"] for x in g["linjer"])
    note = f'<br><span class="s">Ingen åben PO at læse leverandøren fra – sæt den på varen på sitet (+ Sæt leverandør).</span>' if lev == UKENDT else ""
    h.append(f'<tr><td bgcolor="#ffffff" style="background-color:#ffffff;padding:22px 32px 0"><p style="margin:0;font-size:17px;font-weight:800">{navn} <span style="font-size:12px;font-weight:600;color:#6b6b6b">{len(g["linjer"])} varer · {tal(gstk)} stk</span>{note}</p>'
             '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:6px;table-layout:fixed">'
             '<tr><td class="th">Vare</td><td align="right" width="92" class="th" style="padding-left:12px;width:92px;white-space:nowrap">Bestil senest</td><td align="right" width="132" class="th" style="padding-left:12px;width:132px">Stk</td><td align="right" width="84" class="th" style="padding-left:12px;width:84px;white-space:nowrap">Rækker til</td></tr>')
    t.append(f"== {navn} ({len(g['linjer'])} varer, {tal(gstk)} stk) ==")
    for x in g["linjer"]:
        l = L.get(x["ean"], {}); gb = l.get("genbestilling", {})
        nu = bool(x["bestilSenest"] and x["bestilSenest"] <= f["dag0"])
        bs = "Nu" if nu else dato(x["bestilSenest"])
        shops = " ".join(f'<span style="color:{BR[b][1]}">●</span>{BR[b][0]}' for b in x["brands"])
        moq = gb.get("behovFoerMoq") is not None and gb.get("moq") and gb["behovFoerMoq"] < gb["moq"]
        under = " · ".join(s for s in ((str(x["foreslaaetColli"]) + " colli") if x["foreslaaetColli"] else "", f"MOQ (behov {tal(gb['behovFoerMoq'])})" if moq else "") if s)
        extra = (' <span style="font-size:9px;font-weight:700;letter-spacing:.1em;color:#f5820d">HERO</span>' if l.get("hero") else "") + \
                (' <span style="font-size:9px;font-weight:700;letter-spacing:.1em;color:#e5322d">TJEK TALLET</span>' if l.get("dataKvalitet") == "lav" else "")
        plan = f'<br><span class="s" style="color:#5b6cff">planlagt{(" af " + l["plan"]["af"]) if l.get("plan") and l["plan"].get("af") else ""}</span>' if l.get("plan") else ""
        h.append(f'<tr><td class="v"><a class="p" href="{SITE}/linje/{x["ean"]}">{x["titel"]}</a>{extra}<br><span class="s">{shops} · {x["ean"]}</span>{plan}</td>'
                 f'<td align="right" class="c" style="color:{"#e5322d" if nu else "#141414"}">{bs}</td>'
                 f'<td align="right" class="c"><span style="font-size:16px;font-weight:800">{tal(x["foreslaaetStk"])}</span>{("<br><span class=s>" + under + "</span>") if under else ""}</td>'
                 f'<td align="right" class="c">{dato(x["raekkerTil"]) if x.get("raekkerTil") else "2 år+"}</td></tr>')
        t.append(f"- {x['titel']} ({'+'.join(BR[b][0] for b in x['brands'])}, EAN {x['ean']}): bestil senest {bs}, {tal(x['foreslaaetStk'])} stk{(' / ' + str(x['foreslaaetColli']) + ' colli') if x['foreslaaetColli'] else ''}{' (MOQ)' if moq else ''}")
    h.append('</table></td></tr>'); t.append("")

c = f["config"]
h.append(f'''<tr><td bgcolor="#ffffff" style="background-color:#ffffff;padding:28px 32px 32px;border-radius:0 0 22px 22px">
  <p style="margin:0;font-size:12px;line-height:1.6;color:#6b6b6b"><b>Sådan læses det:</b> Listen er den samme som “Skal bestilles” på sitet – alt der skal bestilles inden for de næste 2 måneder. “Stk” dækker alle shops: salget i lead time (Hybrid 6 mdr., øvrige 5 mdr., EU ca. 30 dage) plus {c["coverageDays"]["asia"]} dages salg ({c["coverageDaysYoung"]["asia"]} for nye varer) og sikkerhedslager, fratrukket lager og alt der er bestilt, rundet op til mindst {tal(c.get("moqStandard") or 0)} stk (MOQ) og hele colli. “Rækker til” er datoen, mængden holder til. Når en PO er lagt, så tryk <b>✓ PO oprettet</b> på sitet, så forsvinder linjen. Hele regnestykket: <a href="{SITE}/om" style="color:#141414">{SITE.replace("https://", "")}/om</a></p>
</td></tr>
<tr><td style="padding:18px 8px;font-size:11px;color:#8a8a8a;text-align:center">Lager · Stock Group A/S · Shop Group · sendes hver mandag · <a href="{SITE}" style="color:#8a8a8a">{SITE.replace("https://", "")}</a></td></tr>
</table></td></tr></table></body></html>''')
out = os.path.join(ROOT, "data", "mail.html")
open(out, "w", encoding="utf-8").write("\n".join(h))
open(os.path.join(ROOT, "data", "mail.txt"), "w", encoding="utf-8").write("\n".join(t))
print(f"Emne: {titel} – uge {uge} | {len(alle)} linjer ({n_nu} nu, {n_ukendt} uden leverandør) | {os.path.getsize(out)//1024} KB → data/mail.html og data/mail.txt")
