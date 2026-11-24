"""Kalibrering af forecastet mod virkeligheden.
1) Bygger køkken-sæsonprofilen (data/kalibrering/koekken_indeks.json) fra to referencevarer med fuld dagshistorik.
2) Backtester niveau-estimatet: stå på en dato, forudsig de næste 180/300 dage, sammenlign med det der faktisk blev solgt.
Kør: python3 scripts/kalibrering.py [--backtest]"""
import json, datetime as dt, statistics as st, math, os, sys
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
REF = json.load(open(os.path.join(R, "data/kalibrering/koekken_reference.json")))["serier"]
D = dt.date.fromisoformat
ONE = dt.timedelta(days=1)

class Serie:
    def __init__(s, o):
        s.navn = o["titel"]; s.d = o["dage"]; ks = sorted(s.d); s.d0, s.dN = D(ks[0]), D(ks[-1])
    def val(s, d): return s.d.get(d.isoformat(), 0)
    def sum(s, a, b): return sum(s.val(a + ONE * i) for i in range((b - a).days + 1))
    def mean(s, a, b): return s.sum(a, b) / ((b - a).days + 1)

def uge(d): return min(d.isocalendar()[1], 52)

def raa_indeks(s):
    """uge-snit / snit af de seneste 52 hele uger (uge 48 sidste år … uge 47 i år)"""
    slut = s.dN - ONE * ((s.dN.weekday() + 1) % 7)  # seneste søndag
    start = slut - ONE * (52 * 7 - 1)
    if start < s.d0: return None
    lvl = s.mean(start, slut); out = {}
    for i in range(52):
        a = start + ONE * (7 * i); out[uge(a)] = s.mean(a, a + ONE * 6) / lvl
    return out

def glat(raw):
    idx = [1.0] * 54
    for w in range(1, 53):
        p, n = (52 if w == 1 else w - 1), (1 if w == 52 else w + 1)
        idx[w] = 0.25 * raw[p] + 0.5 * raw[w] + 0.25 * raw[n]
    idx[53] = idx[52]; m = sum(idx[1:53]) / 52
    return [round(x / m, 3) for x in idx]

def byg_indeks(serier):
    raws = [r for r in (raa_indeks(s) for s in serier) if r]
    return glat({w: math.exp(sum(math.log(max(r[w], 0.05)) for r in raws) / len(raws)) for w in range(1, 53)})

# ---------- niveau-estimatorer (samme logik som src/lib/forecast/engine.ts) ----------
def vinduer(s, T):
    """delvinduer talt bagud fra T: (dage, stk/dag, snit-indeks-funktion)"""
    alder = (T - s.d0).days + 1; N = min(365, alder); ud = []
    for a, b in ((1, 7), (8, 14), (15, 30), (31, 60), (61, N)):
        if b > N: b = N
        if a > b: continue
        ud.append((a, b, s.mean(T - ONE * (b - 1), T - ONE * (a - 1))))
    return ud, N

def snit_idx(ix, T, a, b): return sum(ix[uge(T - ONE * (i - 1))] for i in range(a, b + 1)) / (b - a + 1)

def est_gammel(s, T, ix):
    v = lambda n: s.mean(T - ONE * (n - 1), T); a = lambda n: snit_idx(ix, T, 1, n)
    return 0.5 * v(7) / a(7) + 0.3 * v(30) / a(30) + 0.2 * v(60) / a(60)

MODEN_DAGE = 180; TOP = 1.5
def lancering(N): return 0.7 if N < 30 else 0.8 if N < 60 else 1.0  # de første uger efter lancering er pustet op
def est_ny(s, T, ix):
    vs, N = vinduer(s, T)
    straf = lambda a: 1.0 if a <= TOP else (TOP / a) ** 2  # kampagne-/peak-uger tæller næsten ikke
    if N >= MODEN_DAGE:
        aar = s.mean(T - ONE * (N - 1), T) / snit_idx(ix, T, 1, N)
        num = den = 0.0
        for a, b, r in vs:
            if a > 60: continue
            ai = snit_idx(ix, T, a, b); w = (b - a + 1) * straf(ai); num += w * r / ai; den += w
        return 0.5 * aar + 0.5 * (num / den if den else aar)
    num = den = 0.0
    for a, b, r in vs:  # ung vare: sæsonen kendes ikke – et lavt indeks må ikke puste niveauet op
        ai = snit_idx(ix, T, a, b); w = (b - a + 1) * straf(ai) * (0.5 if a > 60 else 1.0)
        num += w * r / max(ai, 1.0); den += w
    return lancering(N) * num / den if den else 0.0

def fc(lvl, ix, T, n): return sum(lvl * ix[uge(T + ONE * i)] for i in range(1, n + 1))

def backtest(serier, ix_for, label):
    print(f"\n=== {label} ===")
    alle = []
    for s in serier:
        ix = ix_for(s); rows = []
        T = s.d0 + ONE * 21; T += ONE * ((7 - T.weekday()) % 7)
        while T + ONE * 300 <= s.dN:
            a3, a1 = s.sum(T + ONE, T + ONE * 300), s.sum(T + ONE, T + ONE * 180)
            g, n = est_gammel(s, T, ix), est_ny(s, T, ix)
            rows.append((T, (T - s.d0).days + 1, fc(g, ix, T, 300) / a3, fc(n, ix, T, 300) / a3, fc(g, ix, T, 180) / a1, fc(n, ix, T, 180) / a1))
            T += ONE * 7
        print(f"{s.navn}: {len(rows)} origins")
        for r in rows:
            if r[0].isoformat() in ("2025-10-20", "2025-11-03", "2025-11-17", "2025-11-24", "2025-12-01", "2025-12-15", "2026-01-12", "2025-06-02", "2025-08-04"):
                print(f"   {r[0]} (alder {r[1]:>3} d)  300d: gammel {r[2]:.2f}  ny {r[3]:.2f}   180d: gammel {r[4]:.2f}  ny {r[5]:.2f}")
        alle += rows
    mae = lambda xs: sum(abs(math.log(x)) for x in xs) / len(xs)
    for navn, f in ((f"unge (<{MODEN_DAGE} d data)", lambda r: r[1] < MODEN_DAGE), (f"modne (≥{MODEN_DAGE} d)", lambda r: r[1] >= MODEN_DAGE), ("alle", lambda r: True)):
        rs = [r for r in alle if f(r)]
        if not rs: continue
        print(f"  {navn:20} n={len(rs):>3} | 300d gammel: median {st.median(r[2] for r in rs):.2f} fejl {mae([r[2] for r in rs]):.0%} [{min(r[2] for r in rs):.2f}–{max(r[2] for r in rs):.2f}]  ny: median {st.median(r[3] for r in rs):.2f} fejl {mae([r[3] for r in rs]):.0%} [{min(r[3] for r in rs):.2f}–{max(r[3] for r in rs):.2f}]"
              f" | 180d gammel: {st.median(r[4] for r in rs):.2f}/{mae([r[4] for r in rs]):.0%}  ny: {st.median(r[5] for r in rs):.2f}/{mae([r[5] for r in rs]):.0%}")

if __name__ == "__main__":
    S = [Serie(o) for o in REF]
    idx = byg_indeks(S)
    json.dump({"kilde": "Køkken-profil: " + " + ".join(s.navn for s in S) + " – uge-snit / snit af seneste 52 uger, geometrisk snit af varerne, glattet 25/50/25",
               "opdateret": S[0].dN.isoformat(), "ugeIndeks": idx}, open(os.path.join(R, "data/kalibrering/koekken_indeks.json"), "w"))
    print("køkken-indeks uge 1-52:", [round(x, 2) for x in idx[1:53]])
    # Sommer-profilen pr. shop: faktisk ugesalg af slush/sirup/is de seneste 52 hele uger (ingen Black Week-pukkel lånt fra panderne)
    sp = os.path.join(R, "data/kalibrering/sommer_reference.json")
    if os.path.exists(sp):
        ref = json.load(open(sp)); brands = {}
        for b, uger in ref["uger"].items():
            ks = sorted(uger)[-52:]; raw = {}
            m = sum(max(0, uger[k]) for k in ks) / 52
            for k in ks: raw[uge(D(k))] = max(0, uger[k]) / m
            if len(raw) < 52: continue
            g = glat(raw); g = [max(x, 0.01) for x in g]; mm = sum(g[1:53]) / 52
            brands[b] = [round(x / mm, 3) for x in g]
            print(f"sommer-indeks {b} uge 1-52:", [round(x, 2) for x in brands[b][1:53]])
        json.dump({"kilde": "Sommer-profil pr. shop: faktisk ugesalg af slush, sirup og is de seneste 52 uger (Shopify), glattet 25/50/25",
                   "opdateret": max(max(u) for u in ref["uger"].values()), "brands": brands}, open(os.path.join(R, "data/kalibrering/sommer_indeks.json"), "w"))
    if "--backtest" in sys.argv:
        backtest(S, lambda s: idx, "Fælles køkken-indeks (i stikprøven)")
        backtest(S, lambda s: byg_indeks([x for x in S if x is not s]), "Indeks bygget KUN på den anden vare (uden for stikprøven)")
        snap = json.load(open(os.path.join(R, "data/snapshot.json")))
        pw = {}
        for k, v in snap["dayseries"]["casper"].items():
            if "2025-02-01" <= k <= "2026-03-06": pw.setdefault(uge(D(k)), []).append(v)
        mu = sum(sum(pw[w]) / len(pw[w]) for w in range(1, 53)) / 52
        gl = glat({w: sum(pw[w]) / len(pw[w]) / mu for w in range(1, 53)})
        backtest(S, lambda s: gl, "Det gamle indeks (Sobczyk brand-total inkl. slush)")
