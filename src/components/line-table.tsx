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
import { visToast } from "./toast";
import { effektivStatus, paaListen, PO_OPRETTET_DAGE, type OverlayFlag } from "@/lib/overlay";
import { markerPoOprettet, saetFlag, meldStateAendret, hurtigKlik, PO_NULSTIL } from "@/lib/handlinger";

type Flag = OverlayFlag & { dato?: string };
type PlanLite = { stk: number; af?: string; status: "planlagt" | "bestilt" };
export type Handling = "po_oprettet" | "udgaar" | "skjul" | "ikke_indkoeb" | "genindsaet" | "leverandoer";

const BRAND_ORDER: Brand[] = ["gladkokken", "casper", "herman", "tomi"];
const GRUPPER: { slug: string; label: string; status: LineStatus[] }[] = [
  { slug: "bestil", label: "Skal bestilles", status: ["bestil_nu", "bestil_14", "bestil_30", "book_po", "for_nyt"] },
  { slug: "nu", label: "Haster", status: ["bestil_nu"] },
  { slug: "book", label: "Kun booking af PO", status: ["book_po"] },
  { slug: "po", label: "PO oprettet", status: ["po_oprettet", "planlagt", "bestilt"] },
  { slug: "fjernet", label: "Skjult", status: ["skjult", "ikke_indkoeb"] },
];
const iGruppe = (l: LineLite, status: LineStatus[]) => status.includes(l.status) && (l.status !== "for_nyt" || paaListen(l.status, l.dage.bestilSenest));

export function LineStatusChip({ status, small }: { status: LineStatus; small?: boolean }) {
  const m = LINE_STATUS_META[status];
  return <span className={`chip ${small ? "!text-[.62rem] !px-2" : ""}`} style={{ background: m.farve, color: m.tekst }}>{m.label}</span>;
}

const SHOP_STATUS_FARVE: Record<string, string> = { udsolgt: "var(--ink)", kritisk: "var(--kritisk)", bestil_nu: "var(--bestil)", obs: "#b58900", ok: "var(--ok)", overlager: "var(--overlager)", for_nyt: "#9B6BFF" };
export function ShopDots({ shops, withText, withDays }: { shops: { brand: Brand; velocity?: number; ecom?: number; dageTilUdsolgt?: number | null; status?: string }[]; withText?: boolean; withDays?: boolean }) {
  return (
    <span className={`inline-flex items-center flex-wrap ${withDays ? "gap-2" : "gap-1.5"}`}>
      {BRAND_ORDER.filter((b) => shops.some((s) => s.brand === b)).map((b) => {
        const ss = shops.filter((x) => x.brand === b); const s = ss.slice().sort((a, c) => (a.dageTilUdsolgt ?? 9999) - (c.dageTilUdsolgt ?? 9999))[0];
        const farve = withDays && s.status ? SHOP_STATUS_FARVE[s.status] ?? "var(--muted)" : "var(--muted)";
        const dage = s.dageTilUdsolgt == null ? "365+" : `${s.dageTilUdsolgt} d`;
        return <span key={b} className={`inline-flex items-center gap-1 text-[.65rem] font-bold uppercase tracking-wide ${withDays ? "rounded-md px-1.5 py-0.5 bg-[var(--bg)]" : ""}`} style={{ color: farve }} title={`${BRANDS[b].navn}${s.velocity != null ? ` · ${fmtTal(s.velocity, 1)} stk/dag` : ""}${s.ecom != null ? ` · ${fmtTal(s.ecom)} på lokation` : ""}${withDays ? ` · tør om ${dage}` : ""}`}>
          <i className="inline-block w-2 h-2 rounded-full" style={{ background: BRANDS[b].farve }} />{(withText || withDays) && BRANDS[b].kort}{withDays && <span className="num normal-case tracking-normal font-semibold">{dage}</span>}
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


function PoBadge({ l }: { l: LineLite }) {
  const po = l.poOprettet;
  if (!po || !paaListen(l.status, l.dage.bestilSenest)) return null;
  if (po.tilstand === "udloebet") return <span className="text-[.6rem] font-bold tracking-wider text-white bg-[var(--kritisk)] rounded px-1.5 py-0.5" title={`Markeret ${fmtDato(po.dato)}${po.af ? ` af ${po.af}` : ""} – intet nyt i BC efter ${PO_OPRETTET_DAGE} dage`}>{l.status === "book_po" ? "STADIG IKKE BOOKET" : "PO IKKE FUNDET I BC"}</span>;
  if (po.tilstand === "fundet") return <span className="text-[.6rem] font-bold tracking-wider text-[#7a5a00] bg-[#fff3c4] rounded px-1.5 py-0.5" title="Der er kommet en ny PO i BC, men den dækker ikke hele behovet">PO {po.nyPo ?? ""} FUNDET · MANGLER STADIG</span>;
  return null;
}

function Tabel({ rows, dag0, brand, valgt, toggle, onHandling, fjernet, fortrydTekst }: { rows: LineLite[]; dag0: string; brand?: Brand; valgt: Set<string>; toggle: (ean: string) => void; onHandling: (eans: string[], h: Handling, hurtig?: boolean) => void; fjernet?: boolean; fortrydTekst?: string }) {
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
              <th className="px-2 py-3 text-right font-bold">{fjernet ? "Status" : "Opgave"}</th>
            </tr></thead>
            <tbody>
              {rows.map((l) => {
                const worst = l.shops.slice().sort((a, b) => (a.dageTilUdsolgt ?? 9999) - (b.dageTilUdsolgt ?? 9999))[0];
                return (
                  <tr key={l.ean} className={`row-link border-t border-[var(--line)] align-top cursor-pointer ${valgt.has(l.ean) ? "!bg-[#eef0ff]" : ""}`} onClick={() => router.push(`/linje/${l.ean}`)}>
                    <td className="pl-3 pr-1 py-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={valgt.has(l.ean)} onChange={() => toggle(l.ean)} aria-label="Vælg" /></td>
                    <td className="px-3 py-3 max-w-[300px]">
                      <Link href={`/linje/${l.ean}`} className="block font-bold truncate text-[.95rem]">{l.titel}</Link>
                      <span className="flex items-center gap-2 mt-0.5"><ShopDots shops={l.shops} withDays /><span className="num text-[.65rem] text-[var(--muted)]">{l.ean}</span>{l.hero && <span className="text-[.6rem] font-bold tracking-wider text-[var(--bestil)]">HERO</span>}{l.dataKvalitet === "lav" && <span className="text-[.6rem] font-bold tracking-wider text-white bg-[var(--kritisk)] rounded px-1.5 py-0.5" title={l.advarsler[0]}>KUN {Math.min(365, l.velocity.salgsdage)} D DATA</span>}<PoBadge l={l} /></span>
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
                    <td className="px-2 py-3 relative whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                      {!fjernet && paaListen(l.status, l.dage.bestilSenest)
                        ? <button onClick={() => hurtigKlik(() => onHandling([l.ean], "po_oprettet", true))} className="po-btn rounded-full border-2 border-[var(--line)] px-3 py-1 text-xs font-bold text-[var(--ink)] hover:border-[var(--ok)] hover:bg-[var(--ok)] hover:text-white transition" title={l.status === "book_po" ? `PO'en er booket hos speditøren. Står den stadig som ikke booket i BC om ${PO_OPRETTET_DAGE} dage, kommer varen tilbage.` : `Fjerner varen fra listen i ${PO_OPRETTET_DAGE} dage. Dukker der ikke en ny PO op i BC, kommer den tilbage.`}>{l.status === "book_po" ? "✓ Booket" : "✓ PO oprettet"}</button>
                        : <span className="inline-block align-middle"><LineStatusChip status={l.status} small />{l.status === "po_oprettet" && l.poOprettet && <span className="block text-[.6rem] font-semibold text-[var(--muted)] mt-0.5">tjekkes til {fmtDato(l.poOprettet.frist)}</span>}</span>}
                      <button onClick={(e) => openMenu(l.ean, e.currentTarget)} className="rounded-lg px-2 py-1 text-sm font-bold text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)]" aria-label="Handlinger">⋯</button>
                      {menu === l.ean && menuPos && (
                        <div className="fixed card p-1.5 w-56 z-40 flex flex-col text-sm shadow-xl" style={{ right: menuPos.right, top: menuPos.top, bottom: menuPos.bottom }} onMouseLeave={() => setMenu(null)}>
                          {fjernet ? <button onClick={() => { onHandling([l.ean], "genindsaet"); setMenu(null); }} className="text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] font-semibold">{fortrydTekst ?? "Genindsæt på listen"}</button> : (<>
                            <button onClick={() => { onHandling([l.ean], "po_oprettet"); setMenu(null); }} className="text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] font-bold">✓ PO oprettet …<span className="block text-xs font-medium text-[var(--muted)]">Med PO-nummer (valgfrit)</span></button>
                            <div className="h-px bg-[var(--line)] my-1" />
                            <button onClick={() => { onHandling([l.ean], "udgaar"); setMenu(null); }} className="text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] font-semibold">Markér som udgår</button>
                            <button onClick={() => { onHandling([l.ean], "skjul"); setMenu(null); }} className="text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] font-semibold">Skjul i 30 dage</button>
                            <button onClick={() => { onHandling([l.ean], "ikke_indkoeb"); setMenu(null); }} className="text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] font-semibold">Ikke relevant for indkøb</button>
                            <button onClick={() => { onHandling([l.ean], "leverandoer"); setMenu(null); }} className="text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] font-semibold">Sæt leverandør<span className="block text-xs font-medium text-[var(--muted)]">{l.leverandoer ?? "Ukendt"}</span></button>
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
      </div>

      {/* mobil */}
      <ul className="md:hidden flex flex-col gap-2">
        {rows.map((l) => (
          <li key={l.ean}><Link href={`/linje/${l.ean}`} className="card block p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="font-bold truncate">{l.titel}</p><span className="flex flex-wrap gap-1.5 items-center"><ShopDots shops={l.shops} withDays /><PoBadge l={l} /></span></div>
              <BestilSenest dato={l.datoer.bestilSenest} dag0={dag0} dage={l.dage.bestilSenest} big />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-[var(--muted)]">
              <span className="num">{fmtTal(l.velocity.base, 1)} stk/dag · {fmtTal(l.lager.tilgaengeligt)} tilg.</span>
              {l.genbestilling.foreslaaetStk > 0 ? <span className="num font-extrabold text-base text-[var(--ink)]">{fmtTal(l.genbestilling.foreslaaetStk)} stk</span> : <LineStatusChip status={l.status} small />}
            </div>
          </Link>
          <div className="flex justify-end gap-3 -mt-1 pr-2 pb-1">{fjernet
            ? <button onClick={() => onHandling([l.ean], "genindsaet")} className="text-xs font-bold text-[var(--muted)] underline">{fortrydTekst ?? "Genindsæt"}</button>
            : <><button onClick={() => onHandling([l.ean], "udgaar")} className="text-[.65rem] font-bold text-[var(--muted)] underline">Udgår</button><button onClick={() => hurtigKlik(() => onHandling([l.ean], "po_oprettet", true))} className="rounded-full bg-[var(--ink)] text-white px-3 py-1 text-xs font-bold">✓ PO oprettet</button></>}</div></li>
        ))}
      </ul>
    </div>
  );
}

/** shopStatus: vis kun linjer hvor mindst én shop har en af disse e-com-statusser (Shops-fanerne). Linjen er stadig ét EAN. */
export function LineTable({ lines, gruppe = "bestil", shopStatus, kort }: { lines: LineLite[]; gruppe?: string; shopStatus?: string[] | null; kort?: boolean }) {
  const router = useRouter(); const pathname = usePathname(); const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [brand, setBrand] = useState(sp.get("brand") ?? "");
  const [lev, setLev] = useState(sp.get("lev") ?? "");
  const [hero, setHero] = useState(sp.get("hero") === "1");
  const [g, setG] = useState(sp.get("g") ?? gruppe);
  const [visAlle, setVisAlle] = useState<Record<string, boolean>>({});
  const [overrides, setOverrides] = useState<Record<string, Flag>>({});
  const [plans, setPlans] = useState<Record<string, PlanLite>>({});
  const [stateHentet, setStateHentet] = useState(false);
  const [valgt, setValgt] = useState<Set<string>>(new Set());
  useEffect(() => { fetch("/api/state").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) { setOverrides(d.overrides ?? {}); setPlans(d.plans ?? {}); setStateHentet(true); } }).catch(() => {}); }, []);
  useEffect(() => { if (stateHentet) meldStateAendret(overrides, plans); }, [overrides, plans, stateHentet]);
  const dag0 = lines[0]?.dag0 ?? "";
  // Effektiv status = grundstatus fra beregningen + det der er trykket på sitet (samme regel som den daglige kørsel). Slår igennem med det samme.
  const effLines = useMemo(() => lines.map((l) => {
    if (!stateHentet) return l; // indtil tilstanden er hentet: brug statussen fra morgenens kørsel
    const o = overrides[l.ean]; const p = plans[l.ean];
    const { status, po } = effektivStatus(l.grundStatus ?? l.status, l.dage.bestilSenest, o, p ? { status: p.status } : null, l.poNumre ?? [], l.paaVej.sikker + l.paaVej.usikker, dag0);
    const lev = o?.leverandoer || l.leverandoer;
    return status === l.status && lev === l.leverandoer && po?.tilstand === l.poOprettet?.tilstand ? l : { ...l, status, leverandoer: lev, poOprettet: po };
  }).filter((l) => l.status !== "udgaar"), [lines, overrides, plans, dag0, stateHentet]); // udgåede varer vises aldrig i indkøbsoversigten – kun under /fjernet
  const antalUdgaaet = useMemo(() => lines.filter((l) => l.status === "udgaar" || overrides[l.ean]?.udgaar).length, [lines, overrides]);
  const toggle = (ean: string) => setValgt((v) => { const n = new Set(v); if (n.has(ean)) n.delete(ean); else n.add(ean); return n; });
  const gem = (saved: Record<string, Flag>) => setOverrides((o) => ({ ...o, ...saved }));
  const navnPaa = (eans: string[]) => { const t = eans.map((e) => lines.find((l) => l.ean === e)?.titel ?? e); return eans.length === 1 ? t[0] : `${eans.length} varer`; };
  const onHandling = async (eans: string[], h: Handling, hurtig = false) => {
    const navn = await hvemErDu(); if (!navn) return;
    const hvem = navnPaa(eans);
    const liste = eans.length > 1 ? `${eans.length} varer: ${eans.slice(0, 4).map((e) => lines.find((l) => l.ean === e)?.titel ?? e).join(", ")}${eans.length > 4 ? " …" : ""}` : hvem;
    if (h === "po_oprettet") {
      let poNr: string | undefined;
      if (!hurtig) {
        const svar = await ask({ title: "PO oprettet?", text: `${liste}\n\nForsvinder fra listen i ${PO_OPRETTET_DAGE} dage. Dukker der ikke en ny PO op i BC på varen inden da, kommer den tilbage på listen.`, ok: "✓ PO oprettet", fields: [{ key: "po", label: "PO-nummer (valgfrit)", placeholder: "fx 108512" }] });
        if (!svar) return; poNr = svar.po;
      }
      const kand = eans.map((e) => lines.find((l) => l.ean === e)!).filter(Boolean).map((l) => ({ ean: l.ean, poNumre: l.poNumre ?? [], paaVejStk: l.paaVej.sikker + l.paaVej.usikker }));
      const saved = await markerPoOprettet(kand, navn, poNr); gem(saved); setValgt(new Set());
      const ok = Object.keys(saved);
      visToast({ tekst: ok.length === eans.length ? `${hvem} – PO oprettet` : `${ok.length} af ${eans.length} gemt – prøv igen for resten`, fortryd: async () => gem(await saetFlag(ok, { ...PO_NULSTIL }, navn)) });
      return;
    }
    const tekst = { udgaar: "Markér som udgår", skjul: "Skjul i 30 dage", ikke_indkoeb: "Ikke relevant for indkøb", genindsaet: g === "po" ? "Tilbage på listen" : "Genindsæt på listen", leverandoer: "Sæt leverandør" }[h];
    const forklaring = { udgaar: "Forsvinder fra indkøbslisten, forslag og mails – også i fremtidige kørsler. Fortryd under Fjernede varer.", skjul: "Forsvinder fra listen i 30 dage og kommer selv tilbage.", ikke_indkoeb: "Fjernes fra indkøbslisten, bliver i Shops-visningen.", genindsaet: g === "po" ? "Markeringen “PO oprettet” fjernes, og varen kommer tilbage på listen med det samme." : "Kommer tilbage på indkøbslisten med det samme.", leverandoer: "Varerne samles under leverandøren på Pr. leverandør-siden og i mails." }[h];
    const svar = await ask({ title: `${tekst}?`, text: `${liste}\n\n${forklaring}`, ok: tekst, danger: h === "udgaar", fields: h === "leverandoer" ? [{ key: "lev", label: "Leverandør", placeholder: "Begynd at skrive …", options: leverandoerer, required: true }] : undefined });
    if (!svar) return;
    const body = h === "udgaar" ? { udgaar: true } : h === "skjul" ? { skjul_til: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10) } : h === "ikke_indkoeb" ? { ikke_indkoeb: true } : h === "leverandoer" ? { leverandoer: svar.lev.trim() } : { udgaar: false, ikke_indkoeb: false, skjul_til: null, ...PO_NULSTIL };
    const fortrydBody = h === "udgaar" ? { udgaar: false } : h === "skjul" ? { skjul_til: null } : h === "ikke_indkoeb" ? { ikke_indkoeb: false } : null;
    const saved = await saetFlag(eans, body, navn); gem(saved); setValgt(new Set());
    const ok = Object.keys(saved);
    visToast({ tekst: `${hvem} – ${tekst.toLowerCase()}`, fortryd: fortrydBody ? async () => gem(await saetFlag(ok, fortrydBody, navn)) : undefined });
  };
  // Klik på forsidens kort (/?g=nu) eller et link med ?brand= skal virke selv om tabellen allerede er på siden
  const spKey = sp.toString();
  const lastWritten = useRef<string | null>(null);
  useEffect(() => {
    if (lastWritten.current !== null && spKey === lastWritten.current) return; // vores egen URL-opdatering – ikke en navigation
    const ng = sp.get("g") ?? gruppe; if (ng !== g) setG(ng);
    const nb = sp.get("brand") ?? ""; if (nb !== brand) setBrand(nb);
    const nq = sp.get("q") ?? ""; if (nq !== q) setQ(nq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spKey]);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q); if (brand) p.set("brand", brand); if (lev) p.set("lev", lev); if (hero) p.set("hero", "1"); if (g !== gruppe) p.set("g", g);
    lastWritten.current = p.toString();
    router.replace(`${pathname}${p.toString() ? `?${p}` : ""}`, { scroll: false });
  }, [q, brand, lev, hero, g, pathname, router]);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "/" && document.activeElement?.tagName !== "INPUT") { e.preventDefault(); inputRef.current?.focus(); } }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, []);
  const leverandoerer = useMemo(() => [...new Set(lines.map((l) => l.leverandoer).filter(Boolean) as string[])].sort(), [lines]);
  const grp = GRUPPER.find((x) => x.slug === g) ?? GRUPPER[0];
  const counts = useMemo(() => Object.fromEntries(GRUPPER.map((x) => [x.slug, effLines.filter((l) => iGruppe(l, x.status)).length])), [effLines]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return effLines.filter((l) => shopStatus ? (!shopStatus.length || l.shops.some((s) => shopStatus.includes(s.status) && (!brand || s.brand === brand))) : iGruppe(l, grp.status))
      .filter((l) => !brand || l.brands.includes(brand as Brand))
      .filter((l) => !lev || l.leverandoer === lev)
      .filter((l) => !hero || l.hero)
      .filter((l) => !needle || l.titel.toLowerCase().includes(needle) || l.ean.includes(needle) || l.shopTitler.some((t) => t.toLowerCase().includes(needle)) || (l.bcSku ?? "").toLowerCase().includes(needle));
  }, [effLines, grp, brand, lev, hero, q, shopStatus]);
  const erFjernet = !shopStatus && (g === "fjernet" || g === "po");
  const tabelProps = { dag0, valgt, toggle, onHandling, fjernet: erFjernet, fortrydTekst: g === "po" ? "Fortryd – tilbage på listen" : undefined };
  const filtreret = !!(q || lev || hero);
  // Nøgletal til kortene øverst (live – falder i takt med at opgaverne sorteres væk)
  const paaListe = useMemo(() => effLines.filter((l) => paaListen(l.status, l.dage.bestilSenest)), [effLines]);
  const haster = paaListe.filter((l) => l.status === "bestil_nu").length;
  const stkIalt = paaListe.reduce((a, l) => a + l.genbestilling.foreslaaetStk, 0);
  const antalPo = effLines.filter((l) => ["po_oprettet", "planlagt", "bestilt"].includes(l.status)).length;
  const antalRetur = paaListe.filter((l) => l.poOprettet?.tilstand === "udloebet").length;
  const vaelg = (slug: string) => { setG(slug); setBrand(""); };

  return (
    <div>
      {kort && !shopStatus && (
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
          <button onClick={() => vaelg("bestil")} className={`card accent text-left p-5 md:p-6 pl-6 md:pl-7 flex flex-col justify-between gap-2 min-h-[132px] transition ${g === "bestil" ? "ring-2 ring-[var(--ink)]" : "hover:-translate-y-0.5"}`} style={{ ["--accent" as string]: paaListe.length ? "var(--kritisk)" : "var(--ok)" }}>
            <span className="text-[.7rem] font-bold uppercase tracking-widest text-[var(--muted)]">Opgaver tilbage</span>
            <span className="display num text-5xl md:text-6xl" style={{ color: paaListe.length ? "var(--kritisk)" : "var(--ok)" }}>{paaListe.length}</span>
            <span className="text-xs font-medium text-[var(--muted)]">{paaListe.length ? <>{haster} haster · {fmtTal(stkIalt)} stk{antalRetur ? <> · <b className="text-[var(--kritisk)]">{antalRetur} kom retur</b></> : null}</> : "Alt er håndteret ✓"}</span>
          </button>
          <button onClick={() => vaelg("book")} className={`card accent text-left p-5 md:p-6 pl-6 md:pl-7 flex flex-col justify-between gap-2 min-h-[132px] transition ${g === "book" ? "ring-2 ring-[var(--ink)]" : "hover:-translate-y-0.5"}`} style={{ ["--accent" as string]: "#b58900" }}>
            <span className="text-[.7rem] font-bold uppercase tracking-widest text-[var(--muted)]">Heraf kun booking af PO</span>
            <span className="display num text-5xl md:text-6xl" style={{ color: "#b58900" }}>{counts.book}</span>
            <span className="text-xs font-medium text-[var(--muted)]">PO findes, men er ikke booket – book eller fremryk</span>
          </button>
          <button onClick={() => vaelg("po")} className={`card accent text-left p-5 md:p-6 pl-6 md:pl-7 flex flex-col justify-between gap-2 min-h-[132px] transition ${g === "po" ? "ring-2 ring-[var(--ink)]" : "hover:-translate-y-0.5"}`} style={{ ["--accent" as string]: LINE_STATUS_META.po_oprettet.farve }}>
            <span className="text-[.7rem] font-bold uppercase tracking-widest text-[var(--muted)]">PO oprettet</span>
            <span className="display num text-5xl md:text-6xl" style={{ color: LINE_STATUS_META.po_oprettet.farve }}>{antalPo}</span>
            <span className="text-xs font-medium text-[var(--muted)]">Venter på at PO&apos;en dukker op i BC (op til {PO_OPRETTET_DAGE} dage)</span>
          </button>
        </section>
      )}
      <div className="flex gap-2 flex-wrap mb-4">
        {([["", "Alle shops"], ...BRAND_ORDER.map((b) => [b, BRANDS[b].navn])] as [string, string][]).map(([b, label]) => {
          const n = shopStatus
            ? effLines.filter((l) => (!b || l.brands.includes(b as Brand)) && (!shopStatus.length || l.shops.some((s) => shopStatus.includes(s.status) && (!b || s.brand === b)))).length
            : effLines.filter((l) => (!b || l.brands.includes(b as Brand)) && paaListen(l.status, l.dage.bestilSenest)).length;
          const on = brand === b;
          return <button key={b} onClick={() => setBrand(b)} className={`card !rounded-2xl px-4 md:px-5 py-3 text-left transition ${on ? "!bg-[var(--ink)] text-white" : "hover:-translate-y-0.5"}`}>
            <span className="flex items-center gap-2 font-extrabold text-base">{b && <i className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: BRANDS[b as Brand].farve }} />}{label}</span>
            <span className={`block text-[.65rem] font-semibold mt-0.5 ${on ? "text-white/70" : "text-[var(--muted)]"}`}><b className="num">{n}</b> {shopStatus ? "varer" : "at handle på"}</span>
          </button>;
        })}
      </div>
      {!shopStatus && <div className="flex gap-1.5 flex-wrap mb-4">
        {GRUPPER.map((x) => <button key={x.slug} onClick={() => setG(x.slug)} className={`rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap transition ${g === x.slug ? "bg-[var(--ink)] text-white" : "bg-white hover:bg-[#eeeae2]"}`}>{x.label} <span className={`num ml-1 ${g === x.slug ? "text-white/70" : "text-[var(--muted)]"}`}>{counts[x.slug]}</span></button>)}
      </div>}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søg vare, EAN eller BC-nr.  ( / )" className="card !rounded-xl px-4 py-2.5 text-sm font-medium w-full md:w-80 outline-none focus:ring-2 ring-[var(--ink)]" />
        <select value={lev} onChange={(e) => setLev(e.target.value)} className="card !rounded-xl px-3 py-2.5 text-sm font-semibold max-w-[220px]"><option value="">Alle leverandører</option>{leverandoerer.map((l) => <option key={l} value={l}>{l}</option>)}</select>
        <label className="card !rounded-xl px-3 py-2.5 text-sm font-semibold flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={hero} onChange={(e) => setHero(e.target.checked)} /> Kun hero</label>
        <span className="text-xs font-semibold text-[var(--muted)] ml-auto num">{rows.length} linjer{antalUdgaaet > 0 && <> · <Link href="/fjernet" className="underline">{antalUdgaaet} udgået</Link></>}</span>
      </div>

      {valgt.size > 0 && (
        <div className="sticky top-2 z-30 mb-3 card !bg-[var(--ink)] text-white px-4 py-3 flex flex-wrap items-center gap-2 md:gap-3 text-sm">
          <b className="num mr-1">{valgt.size} valgt</b>
          {erFjernet ? <button onClick={() => onHandling([...valgt], "genindsaet")} className="rounded-lg bg-white text-[var(--ink)] font-bold px-3 py-1.5">{g === "po" ? "Fortryd – tilbage på listen" : "Genindsæt"}</button> : (<>
            <button onClick={() => onHandling([...valgt], "po_oprettet")} className="rounded-lg bg-[var(--ok)] text-white font-extrabold px-4 py-1.5">✓ PO oprettet</button>
            <span className="w-px h-5 bg-white/20 mx-1 hidden md:block" />
            <button onClick={() => onHandling([...valgt], "udgaar")} className="rounded-lg bg-white/15 font-bold px-3 py-1.5">Markér som udgår</button>
            <button onClick={() => onHandling([...valgt], "skjul")} className="rounded-lg bg-white/15 font-bold px-3 py-1.5">Skjul i 30 dage</button>
            <button onClick={() => onHandling([...valgt], "ikke_indkoeb")} className="rounded-lg bg-white/15 font-bold px-3 py-1.5">Ikke relevant for indkøb</button>
            <button onClick={() => onHandling([...valgt], "leverandoer")} className="rounded-lg bg-white/15 font-bold px-3 py-1.5">Sæt leverandør</button>
          </>)}
          <button onClick={() => setValgt(new Set())} className="ml-auto text-white/70 font-semibold">Fravælg</button>
        </div>
      )}
      {rows.length === 0 ? (
        !shopStatus && g === "bestil" && !filtreret
          ? <div className="card p-10 md:p-14 text-center">
              <p className="display text-5xl md:text-6xl text-[var(--ok)]">0</p>
              <p className="mt-3 text-xl font-extrabold">{brand ? `Intet at bestille for ${BRANDS[brand as Brand].navn}` : "Listen er tom – alt er håndteret"}</p>
              <p className="mt-2 text-sm font-medium text-[var(--muted)]">Nye opgaver dukker op her, når lageret kræver det. Varer markeret “PO oprettet” kommer tilbage, hvis PO&apos;en ikke ses i BC inden {PO_OPRETTET_DAGE} dage.</p>
              {antalPo > 0 && <button onClick={() => vaelg("po")} className="mt-5 rounded-full bg-[var(--bg)] px-4 py-2 text-sm font-bold hover:bg-[#eeeae2]">Se de {antalPo} med PO oprettet →</button>}
            </div>
          : <p className="card p-8 text-center font-semibold text-[var(--muted)]">{g === "po" ? "Ingen varer venter på en PO i BC." : "Ingen linjer matcher."}</p>
      ) : brand ? <Tabel rows={rows} brand={brand as Brand} {...tabelProps} /> : (
        <div className="flex flex-col gap-8">
          {(() => {
            // Universelle varer (samme EAN i flere shops) vises ÉN gang i deres egen sektion – aldrig under hver shop
            const univ = rows.filter((l) => new Set(l.brands).size > 1);
            if (!univ.length) return null;
            const nu = univ.filter((l) => l.status === "bestil_nu").length;
            return (
              <section key="univ">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-extrabold text-xl flex items-center gap-2"><span className="inline-flex -space-x-1">{BRAND_ORDER.map((b) => <i key={b} className="inline-block w-3 h-3 rounded-full ring-2 ring-[var(--bg)]" style={{ background: BRANDS[b].farve }} />)}</span>Universelle<span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] ml-1">samme EAN i flere shops</span></h2>
                  <div className="flex items-center gap-3 text-xs font-semibold text-[var(--muted)]">{nu > 0 && <span className="chip !text-[.6rem]" style={{ background: LINE_STATUS_META.bestil_nu.farve, color: "#fff" }}>Haster {nu}</span>}<span className="num">{univ.length} linjer</span></div>
                </div>
                <Tabel rows={univ.slice(0, visAlle.univ ? undefined : 8)} {...tabelProps} />
                {univ.length > 8 && !visAlle.univ && <button onClick={() => setVisAlle((v) => ({ ...v, univ: true }))} className="mt-2 text-sm font-bold text-[var(--muted)] hover:text-[var(--ink)]">Vis alle {univ.length} universelle ↓</button>}
              </section>
            );
          })()}
          {BRAND_ORDER.map((b) => {
            const br = rows.filter((l) => l.brands.includes(b) && new Set(l.brands).size === 1);
            if (!br.length) return null;
            const nu = br.filter((l) => l.status === "bestil_nu").length;
            return (
              <section key={b}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-extrabold text-xl flex items-center gap-2"><i className="inline-block w-3 h-3 rounded-full" style={{ background: BRANDS[b].farve }} />{BRANDS[b].navn}<span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] ml-1">{BRANDS[b].land}</span></h2>
                  <div className="flex items-center gap-3 text-xs font-semibold text-[var(--muted)]">{nu > 0 && <span className="chip !text-[.6rem]" style={{ background: LINE_STATUS_META.bestil_nu.farve, color: "#fff" }}>Haster {nu}</span>}<span className="num">{br.length} linjer</span><button onClick={() => setBrand(b)} className="font-bold text-[var(--ink)] underline">Alle {BRANDS[b].kort} inkl. universelle →</button></div>
                </div>
                <Tabel rows={br.slice(0, visAlle[b] ? undefined : 8)} brand={b} {...tabelProps} />
                {br.length > 8 && !visAlle[b] && <button onClick={() => setVisAlle((v) => ({ ...v, [b]: true }))} className="mt-2 text-sm font-bold text-[var(--muted)] hover:text-[var(--ink)]">Vis alle {br.length} linjer for {BRANDS[b].navn} ↓</button>}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
