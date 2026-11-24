"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { LineLite } from "@/lib/types-lite";
import { BRANDS, type Brand } from "@/lib/forecast/types";
import { LINE_STATUS_META, type LineStatus } from "@/lib/forecast/purchase";
import { fmtDato, fmtTal } from "@/lib/format";
import { TrendArrow } from "./ui";
import { ask, hvemErDu } from "./dialog";

type Flag = { udgaar?: boolean; skjul_til?: string | null; ikke_indkoeb?: boolean; af?: string; dato?: string; note?: string };
type PlanLite = { stk: number; af?: string; status: "planlagt" | "bestilt" };
export type Handling = "udgaar" | "skjul" | "ikke_indkoeb" | "genindsaet";

const BRAND_ORDER: Brand[] = ["gladkokken", "casper", "herman", "tomi"];
const GRUPPER: { slug: string; label: string; status: LineStatus[] }[] = [
  { slug: "alle", label: "Alle", status: ["bestil_nu", "bestil_14", "bestil_45", "book_po", "planlagt", "bestilt", "daekket", "overlager", "for_nyt"] },
  { slug: "nu", label: "Bestil nu", status: ["bestil_nu"] },
  { slug: "14", label: "Inden 14 dage", status: ["bestil_14"] },
  { slug: "45", label: "Inden 45 dage", status: ["bestil_45"] },
  { slug: "book", label: "Book PO", status: ["book_po"] },
  { slug: "plan", label: "Planlagt / bestilt", status: ["planlagt", "bestilt"] },
  { slug: "daekket", label: "Dækket", status: ["daekket"] },
  { slug: "over", label: "Overlager", status: ["overlager"] },
  { slug: "nyt", label: "Nyheder", status: ["for_nyt"] },
  { slug: "fjernet", label: "Skjult", status: ["skjult", "ikke_indkoeb"] },
];

export function LineStatusChip({ status, small }: { status: LineStatus; small?: boolean }) {
  const m = LINE_STATUS_META[status];
  return <span className={`chip ${small ? "!text-[.62rem] !px-2" : ""}`} style={{ background: m.farve, color: m.tekst }}>{m.label}</span>;
}

export function ShopDots({ shops, withText }: { shops: { brand: Brand; velocity?: number; ecom?: number; dageTilUdsolgt?: number | null }[]; withText?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      {BRAND_ORDER.filter((b) => shops.some((s) => s.brand === b)).map((b) => {
        const s = shops.find((x) => x.brand === b)!;
        return <span key={b} className="inline-flex items-center gap-1 text-[.65rem] font-bold uppercase tracking-wide text-[var(--muted)]" title={`${BRANDS[b].navn}${s.velocity != null ? ` · ${fmtTal(s.velocity, 1)} stk/dag` : ""}`}>
          <i className="inline-block w-2 h-2 rounded-full" style={{ background: BRANDS[b].farve }} />{withText && BRANDS[b].kort}
        </span>;
      })}
    </span>
  );
}

export function BestilSenest({ dato, dag0, dage, big }: { dato: string | null; dag0: string; dage: number | null; big?: boolean }) {
  const nu = dato !== null && dato <= dag0;
  const color = nu ? "var(--kritisk)" : dage !== null && dage <= 14 ? "var(--bestil)" : dage !== null && dage <= 45 ? "#b58900" : "var(--ink)";
  return (
    <span className="block">
      <span className={`num font-extrabold ${big ? "text-2xl" : "text-lg"} leading-none`} style={{ color }}>{dato === null ? "–" : nu ? "NU" : fmtDato(dato)}</span>
      {dato !== null && !nu && dage !== null && <span className="block text-[.65rem] font-semibold text-[var(--muted)]">om {dage} dage</span>}
      {nu && dage !== null && dage < 0 && <span className="block text-[.65rem] font-semibold text-[var(--kritisk)]">{-dage} dage over</span>}
    </span>
  );
}


function Tabel({ rows, dag0, brand, valgt, toggle, onHandling, fjernet }: { rows: LineLite[]; dag0: string; brand?: Brand; valgt: Set<string>; toggle: (ean: string) => void; onHandling: (eans: string[], h: Handling) => void; fjernet?: boolean }) {
  const router = useRouter();
  const [menuPos, setMenuPos] = useState<{ ean: string; right: number; top?: number; bottom?: number } | null>(null);
  const menu = menuPos?.ean ?? null;
  const setMenu = (ean: string | null) => { if (!ean) setMenuPos(null); };
  const openMenu = (ean: string, el: HTMLElement) => {
    if (menuPos?.ean === ean) { setMenuPos(null); return; }
    const r = el.getBoundingClientRect(); const up = r.bottom + 200 > window.innerHeight;
    setMenuPos({ ean, right: window.innerWidth - r.right, top: up ? undefined : r.bottom + 4, bottom: up ? window.innerHeight - r.top + 4 : undefined });
  };
  useEffect(() => { if (!menuPos) return; const h = () => setMenuPos(null); window.addEventListener("scroll", h, true); window.addEventListener("resize", h); return () => { window.removeEventListener("scroll", h, true); window.removeEventListener("resize", h); }; }, [menuPos]);
  return (
    <div>

      <div className="card hidden md:block overflow-hidden">
        <div className="scroll-x">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[.65rem] uppercase tracking-wider text-[var(--muted)]">
              <th className="pl-3 pr-1 py-3 w-8"><input type="checkbox" aria-label="Vælg alle" checked={rows.length > 0 && rows.every((l) => valgt.has(l.ean))} onChange={() => rows.forEach((l) => { if (rows.every((x) => valgt.has(x.ean))) toggle(l.ean); else if (!valgt.has(l.ean)) toggle(l.ean); })} /></th>
              <th className="px-3 py-3 font-bold">Vare</th>
              <th className="px-3 py-3 font-bold">Bestil senest</th>
              <th className="px-3 py-3 font-bold text-right">Bestil</th>
              <th className="px-3 py-3 font-bold hidden xl:table-cell">Rækker til</th>
              <th className="px-3 py-3 font-bold">Tør</th>
              <th className="px-3 py-3 font-bold text-right">Stk/dag</th>
              <th className="px-3 py-3 font-bold text-right hidden xl:table-cell">Tilg.</th>
              <th className="px-3 py-3 font-bold text-right">På vej</th>
              <th className="px-3 py-3 font-bold hidden 2xl:table-cell">Status</th>
              <th className="px-2 py-3 w-10"></th>
            </tr></thead>
            <tbody>
              {rows.map((l) => {
                const worst = l.shops.slice().sort((a, b) => (a.dageTilUdsolgt ?? 9999) - (b.dageTilUdsolgt ?? 9999))[0];
                return (
                  <tr key={l.ean} className={`row-link border-t border-[var(--line)] align-top cursor-pointer ${valgt.has(l.ean) ? "!bg-[#eef0ff]" : ""}`} onClick={() => router.push(`/linje/${l.ean}`)}>
                    <td className="pl-3 pr-1 py-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={valgt.has(l.ean)} onChange={() => toggle(l.ean)} aria-label="Vælg" /></td>
                    <td className="px-3 py-3 max-w-[300px]">
                      <Link href={`/linje/${l.ean}`} className="block font-bold truncate text-[.95rem]">{l.titel}</Link>
                      <span className="flex items-center gap-2 mt-0.5">{brand && l.brands.length > 1 ? <span className="text-[.65rem] font-bold text-[var(--overlager)]">Også i {l.brands.filter((x) => x !== brand).map((x) => BRANDS[x].kort).join(" + ")}</span> : <ShopDots shops={l.shops} withText />}<span className="num text-[.65rem] text-[var(--muted)]">{l.ean}</span>{l.hero && <span className="text-[.6rem] font-bold tracking-wider text-[var(--bestil)]">HERO</span>}{l.dataKvalitet === "lav" && <span className="text-[.6rem] font-bold tracking-wider text-white bg-[var(--kritisk)] rounded px-1.5 py-0.5" title={l.advarsler[0]}>KUN {Math.min(365, l.velocity.salgsdage)} D DATA</span>}</span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{l.status === "for_nyt" ? <span className="font-extrabold text-[var(--bestil)]" title="For lidt salgsdata til en automatisk dato">Vurdér<span className="block text-[.65rem] font-semibold text-[var(--muted)]">{Math.min(365, l.velocity.salgsdage)} d data</span></span> : <BestilSenest dato={l.datoer.bestilSenest} dag0={dag0} dage={l.dage.bestilSenest} big />}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      {l.genbestilling.foreslaaetStk > 0 ? <><span className="num font-extrabold text-2xl leading-none">{fmtTal(l.genbestilling.foreslaaetStk)}</span><span className="block text-[.65rem] font-semibold text-[var(--muted)]">{l.genbestilling.foreslaaetColli ? `${l.genbestilling.foreslaaetColli} colli` : "stk"}{l.genbestilling.moq ? " · MOQ" : ""}</span></> : <span className="text-[var(--muted)] font-semibold">–</span>}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap num font-semibold hidden xl:table-cell">{l.genbestilling.foreslaaetStk > 0 ? (l.datoer.raekkerTil ? fmtDato(l.datoer.raekkerTil) : "180+ dage") : <span className="text-[var(--muted)]">–</span>}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {worst && worst.dageTilUdsolgt !== null ? <><span className="num font-bold" style={{ color: worst.dageTilUdsolgt <= 14 ? "var(--kritisk)" : worst.dageTilUdsolgt <= 45 ? "var(--bestil)" : "var(--ink)" }}>{BRANDS[worst.brand].kort} om {worst.dageTilUdsolgt} d</span><span className="block text-[.65rem] text-[var(--muted)] num">samlet {l.datoer.medPaaVej ? fmtDato(l.datoer.medPaaVej) : "180+"}</span></> : <span className="num font-bold text-[var(--ok)]">180+</span>}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap"><span className="num font-semibold">{fmtTal(l.velocity.base, 1)}</span> <TrendArrow trend={l.velocity.trend} />{l.velocity.solgt365 != null && <span className={`block num text-[.65rem] ${l.velocity.salgsdage < 90 ? "text-[var(--bestil)] font-bold" : "text-[var(--muted)]"}`} title={`Solgt ${fmtTal(l.velocity.solgt365)} stk på ${Math.min(365, l.velocity.salgsdage)} dages salgsdata`}>{fmtTal(l.velocity.solgt365)} / {Math.min(365, l.velocity.salgsdage)} d{l.velocity.salgsdage < 90 ? " · ny" : ""}</span>}</td>
                    <td className="px-3 py-3 text-right num font-semibold whitespace-nowrap hidden xl:table-cell">{fmtTal(l.lager.tilgaengeligt)}{l.lager.vejleFrit > 0 && <span className="block text-[.65rem] text-[var(--muted)]">{fmtTal(l.lager.vejleFrit)} i Vejle</span>}</td>
                    <td className="px-3 py-3 text-right num whitespace-nowrap text-xs">{l.paaVej.sikker > 0 && <span className="block font-bold text-[var(--ok)]">+{fmtTal(l.paaVej.sikker)}</span>}{l.paaVej.usikker > 0 && <span className="block text-[#b58900] font-bold" title="Ubooket">+{fmtTal(l.paaVej.usikker)}<span className="text-[.6rem] font-semibold"> ub.</span></span>}{l.paaVej.sikker + l.paaVej.usikker === 0 && <span className="text-[var(--muted)]">0</span>}</td>
                    <td className="px-3 py-3 hidden 2xl:table-cell"><LineStatusChip status={l.status} small /></td>
                    <td className="px-2 py-3 relative" onClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => openMenu(l.ean, e.currentTarget)} className="rounded-lg px-2 py-1 text-sm font-bold text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)]" aria-label="Handlinger">⋯</button>
                      {menu === l.ean && menuPos && (
                        <div className="fixed card p-1.5 w-56 z-40 flex flex-col text-sm shadow-xl" style={{ right: menuPos.right, top: menuPos.top, bottom: menuPos.bottom }} onMouseLeave={() => setMenu(null)}>
                          {fjernet ? <button onClick={() => { onHandling([l.ean], "genindsaet"); setMenu(null); }} className="text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] font-semibold">Genindsæt på listen</button> : (<>
                            <button onClick={() => { onHandling([l.ean], "udgaar"); setMenu(null); }} className="text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] font-semibold">Markér som udgår</button>
                            <button onClick={() => { onHandling([l.ean], "skjul"); setMenu(null); }} className="text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] font-semibold">Skjul i 30 dage</button>
                            <button onClick={() => { onHandling([l.ean], "ikke_indkoeb"); setMenu(null); }} className="text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] font-semibold">Ikke relevant for indkøb</button>
                          </>)}
                          <Link href={`/linje/${l.ean}`} className="text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] font-semibold text-[var(--muted)]">Åbn linjen →</Link>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="p-8 text-center font-semibold text-[var(--muted)]">Ingen linjer matcher.</p>}
      </div>

      {/* mobil */}
      <ul className="md:hidden flex flex-col gap-2">
        {rows.map((l) => (
          <li key={l.ean}><Link href={`/linje/${l.ean}`} className="card block p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="font-bold truncate">{l.titel}</p><ShopDots shops={l.shops} withText /></div>
              <BestilSenest dato={l.datoer.bestilSenest} dag0={dag0} dage={l.dage.bestilSenest} big />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-[var(--muted)]">
              <span className="num">{fmtTal(l.velocity.base, 1)} stk/dag · {fmtTal(l.lager.tilgaengeligt)} tilg.</span>
              {l.genbestilling.foreslaaetStk > 0 ? <span className="num font-extrabold text-base text-[var(--ink)]">{fmtTal(l.genbestilling.foreslaaetStk)} stk</span> : <LineStatusChip status={l.status} small />}
            </div>
          </Link>
          <div className="flex justify-end -mt-1 pr-2 pb-1"><button onClick={() => onHandling([l.ean], fjernet ? "genindsaet" : "udgaar")} className="text-[.65rem] font-bold text-[var(--muted)] underline">{fjernet ? "Genindsæt" : "Markér udgår"}</button></div></li>
        ))}
      </ul>
    </div>
  );
}

export function LineTable({ lines, gruppe = "alle" }: { lines: LineLite[]; gruppe?: string }) {
  const router = useRouter(); const pathname = usePathname(); const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [brand, setBrand] = useState(sp.get("brand") ?? "");
  const [lev, setLev] = useState(sp.get("lev") ?? "");
  const [hero, setHero] = useState(sp.get("hero") === "1");
  const [g, setG] = useState(sp.get("g") ?? gruppe);
  const [visAlle, setVisAlle] = useState<Record<string, boolean>>({});
  const [overrides, setOverrides] = useState<Record<string, Flag>>({});
  const [plans, setPlans] = useState<Record<string, PlanLite>>({});
  const [valgt, setValgt] = useState<Set<string>>(new Set());
  const [besked, setBesked] = useState<string | null>(null);
  useEffect(() => { fetch("/api/state").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) { setOverrides(d.overrides ?? {}); setPlans(d.plans ?? {}); } }).catch(() => {}); }, []);
  const dag0 = lines[0]?.dag0 ?? "";
  // Effektiv status: flag og planer sat på sitet slår igennem med det samme, før den daglige opdatering
  const effLines = useMemo(() => lines.map((l) => {
    const o = overrides[l.ean]; const p = plans[l.ean];
    let status: LineStatus = l.status;
    if (o?.udgaar) status = "udgaar"; else if (o?.ikke_indkoeb) status = "ikke_indkoeb"; else if (o?.skjul_til && o.skjul_til >= dag0) status = "skjult";
    else if (p) status = p.status; else if (["udgaar", "ikke_indkoeb", "skjult", "planlagt", "bestilt"].includes(l.status) && o === undefined && !p && Object.keys(overrides).length + Object.keys(plans).length > 0) status = l.status;
    return status === l.status ? l : { ...l, status };
  }).filter((l) => l.status !== "udgaar"), [lines, overrides, plans, dag0]); // udgåede varer vises aldrig i indkøbsoversigten – kun under /fjernet
  const antalUdgaaet = useMemo(() => lines.filter((l) => l.status === "udgaar" || overrides[l.ean]?.udgaar).length, [lines, overrides]);
  const toggle = (ean: string) => setValgt((v) => { const n = new Set(v); if (n.has(ean)) n.delete(ean); else n.add(ean); return n; });
  const onHandling = async (eans: string[], h: Handling) => {
    const navn = await hvemErDu(); if (!navn) return;
    const tekst = { udgaar: "Markér som udgår", skjul: "Skjul i 30 dage", ikke_indkoeb: "Ikke relevant for indkøb", genindsaet: "Genindsæt på listen" }[h];
    const titler = eans.map((e) => lines.find((l) => l.ean === e)?.titel ?? e);
    const hvem = eans.length === 1 ? titler[0] : `${eans.length} varer: ${titler.slice(0, 4).join(", ")}${eans.length > 4 ? " …" : ""}`;
    const forklaring = { udgaar: "Forsvinder fra indkøbslisten, forslag og mails – også i fremtidige kørsler. Fortryd under Fjernede varer.", skjul: "Forsvinder fra listen i 30 dage og kommer selv tilbage.", ikke_indkoeb: "Fjernes fra indkøbslisten, bliver i Shops-visningen.", genindsaet: "Kommer tilbage på indkøbslisten med det samme." }[h];
    if (!(await ask({ title: `${tekst}?`, text: `${hvem}\n\n${forklaring}`, ok: tekst, danger: h === "udgaar" }))) return;
    const body = h === "udgaar" ? { udgaar: true } : h === "skjul" ? { skjul_til: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10) } : h === "ikke_indkoeb" ? { ikke_indkoeb: true } : { udgaar: false, ikke_indkoeb: false, skjul_til: null };
    let ok = 0;
    for (const ean of eans) {
      const r = await fetch(`/api/override/${ean}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, af: navn }) });
      if (r.ok) { const saved = await r.json(); setOverrides((o) => ({ ...o, [ean]: saved })); ok++; }
    }
    setValgt(new Set()); setBesked(`${ok} ${ok === 1 ? "vare" : "varer"} opdateret`); setTimeout(() => setBesked(null), 3000);
  };
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q); if (brand) p.set("brand", brand); if (lev) p.set("lev", lev); if (hero) p.set("hero", "1"); if (g !== "alle") p.set("g", g);
    router.replace(`${pathname}${p.toString() ? `?${p}` : ""}`, { scroll: false });
  }, [q, brand, lev, hero, g, pathname, router]);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "/" && document.activeElement?.tagName !== "INPUT") { e.preventDefault(); inputRef.current?.focus(); } }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, []);
  const leverandoerer = useMemo(() => [...new Set(lines.map((l) => l.leverandoer).filter(Boolean) as string[])].sort(), [lines]);
  const grp = GRUPPER.find((x) => x.slug === g) ?? GRUPPER[0];
  const counts = useMemo(() => Object.fromEntries(GRUPPER.map((x) => [x.slug, effLines.filter((l) => x.status.includes(l.status)).length])), [effLines]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return effLines.filter((l) => grp.status.includes(l.status))
      .filter((l) => !brand || l.brands.includes(brand as Brand))
      .filter((l) => !lev || l.leverandoer === lev)
      .filter((l) => !hero || l.hero)
      .filter((l) => !needle || l.titel.toLowerCase().includes(needle) || l.ean.includes(needle) || l.shopTitler.some((t) => t.toLowerCase().includes(needle)) || (l.bcSku ?? "").toLowerCase().includes(needle));
  }, [effLines, grp, brand, lev, hero, q]);
  const erFjernet = g === "fjernet";
  const tabelProps = { dag0, valgt, toggle, onHandling, fjernet: erFjernet };

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-4">
        {([["", "Alle shops"], ...BRAND_ORDER.map((b) => [b, BRANDS[b].navn])] as [string, string][]).map(([b, label]) => {
          const n = effLines.filter((l) => (!b || l.brands.includes(b as Brand)) && ["bestil_nu", "bestil_14", "bestil_45", "book_po"].includes(l.status)).length;
          const on = brand === b;
          return <button key={b} onClick={() => setBrand(b)} className={`card !rounded-2xl px-4 md:px-5 py-3 text-left transition ${on ? "!bg-[var(--ink)] text-white" : "hover:-translate-y-0.5"}`}>
            <span className="flex items-center gap-2 font-extrabold text-base">{b && <i className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: BRANDS[b as Brand].farve }} />}{label}</span>
            <span className={`block text-[.65rem] font-semibold mt-0.5 ${on ? "text-white/70" : "text-[var(--muted)]"}`}><b className="num">{n}</b> at handle på</span>
          </button>;
        })}
      </div>
      <div className="flex gap-1.5 flex-wrap mb-4">
        {GRUPPER.map((x) => <button key={x.slug} onClick={() => setG(x.slug)} className={`rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap transition ${g === x.slug ? "bg-[var(--ink)] text-white" : "bg-white hover:bg-[#eeeae2]"}`}>{x.label} <span className={`num ml-1 ${g === x.slug ? "text-white/70" : "text-[var(--muted)]"}`}>{counts[x.slug]}</span></button>)}
      </div>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søg vare, EAN eller BC-nr.  ( / )" className="card !rounded-xl px-4 py-2.5 text-sm font-medium w-full md:w-80 outline-none focus:ring-2 ring-[var(--ink)]" />
        <select value={lev} onChange={(e) => setLev(e.target.value)} className="card !rounded-xl px-3 py-2.5 text-sm font-semibold max-w-[220px]"><option value="">Alle leverandører</option>{leverandoerer.map((l) => <option key={l} value={l}>{l}</option>)}</select>
        <label className="card !rounded-xl px-3 py-2.5 text-sm font-semibold flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={hero} onChange={(e) => setHero(e.target.checked)} /> Kun hero</label>
        <span className="text-xs font-semibold text-[var(--muted)] ml-auto num">{rows.length} linjer{antalUdgaaet > 0 && <> · <Link href="/fjernet" className="underline">{antalUdgaaet} udgået</Link></>}</span>
      </div>

      {(valgt.size > 0 || besked) && (
        <div className="sticky top-2 z-30 mb-3 card !bg-[var(--ink)] text-white px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
          {valgt.size > 0 ? <><b className="num">{valgt.size} valgt</b>
            {erFjernet ? <button onClick={() => onHandling([...valgt], "genindsaet")} className="rounded-lg bg-white text-[var(--ink)] font-bold px-3 py-1.5">Genindsæt</button> : (<>
              <button onClick={() => onHandling([...valgt], "udgaar")} className="rounded-lg bg-white text-[var(--ink)] font-bold px-3 py-1.5">Markér som udgår</button>
              <button onClick={() => onHandling([...valgt], "skjul")} className="rounded-lg bg-white/15 font-bold px-3 py-1.5">Skjul i 30 dage</button>
              <button onClick={() => onHandling([...valgt], "ikke_indkoeb")} className="rounded-lg bg-white/15 font-bold px-3 py-1.5">Ikke relevant for indkøb</button>
            </>)}
            <button onClick={() => setValgt(new Set())} className="ml-auto text-white/70 font-semibold">Fravælg</button></> : <span className="font-bold text-[#7ee2a8]">{besked}</span>}
        </div>
      )}
      {brand ? <Tabel rows={rows} brand={brand as Brand} {...tabelProps} /> : (
        <div className="flex flex-col gap-8">
          {BRAND_ORDER.map((b) => {
            const br = rows.filter((l) => l.brands.includes(b));
            if (!br.length) return null;
            const nu = br.filter((l) => l.status === "bestil_nu").length;
            return (
              <section key={b}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-extrabold text-xl flex items-center gap-2"><i className="inline-block w-3 h-3 rounded-full" style={{ background: BRANDS[b].farve }} />{BRANDS[b].navn}<span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] ml-1">{BRANDS[b].land}</span></h2>
                  <div className="flex items-center gap-3 text-xs font-semibold text-[var(--muted)]">{nu > 0 && <span className="chip !text-[.6rem]" style={{ background: LINE_STATUS_META.bestil_nu.farve, color: "#fff" }}>Bestil nu {nu}</span>}<span className="num">{br.length} linjer</span><button onClick={() => setBrand(b)} className="font-bold text-[var(--ink)] underline">Kun {BRANDS[b].kort} →</button></div>
                </div>
                <Tabel rows={br.slice(0, visAlle[b] ? undefined : 8)} brand={b} {...tabelProps} />
                {br.length > 8 && !visAlle[b] && <button onClick={() => setVisAlle((v) => ({ ...v, [b]: true }))} className="mt-2 text-sm font-bold text-[var(--muted)] hover:text-[var(--ink)]">Vis alle {br.length} linjer for {BRANDS[b].navn} ↓</button>}
              </section>
            );
          })}
          {rows.length === 0 && <p className="card p-8 text-center font-semibold text-[var(--muted)]">Ingen linjer matcher.</p>}
        </div>
      )}
    </div>
  );
}
