"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { LineLite } from "@/lib/types-lite";
import { BRANDS, type Brand } from "@/lib/forecast/types";
import { LINE_STATUS_META, type LineStatus } from "@/lib/forecast/purchase";
import { fmtDato, fmtTal } from "@/lib/format";
import { TrendArrow } from "./ui";

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
  { slug: "fjernet", label: "Fjernet", status: ["udgaar", "skjult", "ikke_indkoeb"] },
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

export function LineTable({ lines, gruppe = "alle" }: { lines: LineLite[]; gruppe?: string }) {
  const router = useRouter(); const pathname = usePathname(); const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [brand, setBrand] = useState(sp.get("brand") ?? "");
  const [lev, setLev] = useState(sp.get("lev") ?? "");
  const [hero, setHero] = useState(sp.get("hero") === "1");
  const [g, setG] = useState(sp.get("g") ?? gruppe);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q); if (brand) p.set("brand", brand); if (lev) p.set("lev", lev); if (hero) p.set("hero", "1"); if (g !== "alle") p.set("g", g);
    router.replace(`${pathname}${p.toString() ? `?${p}` : ""}`, { scroll: false });
  }, [q, brand, lev, hero, g, pathname, router]);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "/" && document.activeElement?.tagName !== "INPUT") { e.preventDefault(); inputRef.current?.focus(); } }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, []);
  const leverandoerer = useMemo(() => [...new Set(lines.map((l) => l.leverandoer).filter(Boolean) as string[])].sort(), [lines]);
  const grp = GRUPPER.find((x) => x.slug === g) ?? GRUPPER[0];
  const counts = useMemo(() => Object.fromEntries(GRUPPER.map((x) => [x.slug, lines.filter((l) => x.status.includes(l.status)).length])), [lines]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return lines.filter((l) => grp.status.includes(l.status))
      .filter((l) => !brand || l.brands.includes(brand as Brand))
      .filter((l) => !lev || l.leverandoer === lev)
      .filter((l) => !hero || l.hero)
      .filter((l) => !needle || l.titel.toLowerCase().includes(needle) || l.ean.includes(needle) || l.shopTitler.some((t) => t.toLowerCase().includes(needle)) || (l.bcSku ?? "").toLowerCase().includes(needle));
  }, [lines, grp, brand, lev, hero, q]);

  return (
    <div>
      <div className="flex gap-1.5 flex-wrap mb-4">
        {GRUPPER.map((x) => <button key={x.slug} onClick={() => setG(x.slug)} className={`rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap transition ${g === x.slug ? "bg-[var(--ink)] text-white" : "bg-white hover:bg-[#eeeae2]"}`}>{x.label} <span className={`num ml-1 ${g === x.slug ? "text-white/70" : "text-[var(--muted)]"}`}>{counts[x.slug]}</span></button>)}
      </div>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søg vare, EAN eller BC-nr.  ( / )" className="card !rounded-xl px-4 py-2.5 text-sm font-medium w-full md:w-80 outline-none focus:ring-2 ring-[var(--ink)]" />
        <select value={brand} onChange={(e) => setBrand(e.target.value)} className="card !rounded-xl px-3 py-2.5 text-sm font-semibold"><option value="">Alle shops</option>{BRAND_ORDER.map((b) => <option key={b} value={b}>{BRANDS[b].navn}</option>)}</select>
        <select value={lev} onChange={(e) => setLev(e.target.value)} className="card !rounded-xl px-3 py-2.5 text-sm font-semibold max-w-[220px]"><option value="">Alle leverandører</option>{leverandoerer.map((l) => <option key={l} value={l}>{l}</option>)}</select>
        <label className="card !rounded-xl px-3 py-2.5 text-sm font-semibold flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={hero} onChange={(e) => setHero(e.target.checked)} /> Kun hero</label>
        <span className="text-xs font-semibold text-[var(--muted)] ml-auto num">{rows.length} linjer</span>
      </div>

      {/* desktop */}
      <div className="card hidden md:block overflow-hidden">
        <div className="scroll-x">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[.65rem] uppercase tracking-wider text-[var(--muted)]">
              <th className="px-4 py-3 font-bold">Vare</th>
              <th className="px-3 py-3 font-bold">Bestil senest</th>
              <th className="px-3 py-3 font-bold text-right">Bestil</th>
              <th className="px-3 py-3 font-bold hidden xl:table-cell">Rækker til</th>
              <th className="px-3 py-3 font-bold">Tør</th>
              <th className="px-3 py-3 font-bold text-right">Stk/dag</th>
              <th className="px-3 py-3 font-bold text-right hidden xl:table-cell">Tilg.</th>
              <th className="px-3 py-3 font-bold text-right">På vej</th>
              <th className="px-3 py-3 font-bold hidden 2xl:table-cell">Status</th>
            </tr></thead>
            <tbody>
              {rows.map((l) => {
                const worst = l.shops.slice().sort((a, b) => (a.dageTilUdsolgt ?? 9999) - (b.dageTilUdsolgt ?? 9999))[0];
                return (
                  <tr key={l.ean} className="row-link border-t border-[var(--line)] align-top cursor-pointer" onClick={() => router.push(`/linje/${l.ean}`)}>
                    <td className="px-4 py-3 max-w-[300px]">
                      <Link href={`/linje/${l.ean}`} className="block font-bold truncate text-[.95rem]">{l.titel}</Link>
                      <span className="flex items-center gap-2 mt-0.5"><ShopDots shops={l.shops} withText /><span className="num text-[.65rem] text-[var(--muted)]">{l.ean}</span>{l.hero && <span className="text-[.6rem] font-bold tracking-wider text-[var(--bestil)]">HERO</span>}</span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap"><BestilSenest dato={l.datoer.bestilSenest} dag0={l.dag0} dage={l.dage.bestilSenest} big /></td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      {l.genbestilling.foreslaaetStk > 0 ? <><span className="num font-extrabold text-2xl leading-none">{fmtTal(l.genbestilling.foreslaaetStk)}</span><span className="block text-[.65rem] font-semibold text-[var(--muted)]">{l.genbestilling.foreslaaetColli ? `${l.genbestilling.foreslaaetColli} colli` : "stk"}{l.genbestilling.moq ? " · MOQ" : ""}</span></> : <span className="text-[var(--muted)] font-semibold">–</span>}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap num font-semibold hidden xl:table-cell">{l.genbestilling.foreslaaetStk > 0 ? (l.datoer.raekkerTil ? fmtDato(l.datoer.raekkerTil) : "180+ dage") : <span className="text-[var(--muted)]">–</span>}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {worst && worst.dageTilUdsolgt !== null ? <><span className="num font-bold" style={{ color: worst.dageTilUdsolgt <= 14 ? "var(--kritisk)" : worst.dageTilUdsolgt <= 45 ? "var(--bestil)" : "var(--ink)" }}>{BRANDS[worst.brand].kort} om {worst.dageTilUdsolgt} d</span><span className="block text-[.65rem] text-[var(--muted)] num">samlet {l.datoer.medPaaVej ? fmtDato(l.datoer.medPaaVej) : "180+"}</span></> : <span className="num font-bold text-[var(--ok)]">180+</span>}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap"><span className="num font-semibold">{fmtTal(l.velocity.base, 1)}</span> <TrendArrow trend={l.velocity.trend} />{l.velocity.solgt365 != null && <span className="block num text-[.65rem] text-[var(--muted)]">{fmtTal(l.velocity.solgt365)} / 365 d</span>}</td>
                    <td className="px-3 py-3 text-right num font-semibold whitespace-nowrap hidden xl:table-cell">{fmtTal(l.lager.tilgaengeligt)}{l.lager.vejleFrit > 0 && <span className="block text-[.65rem] text-[var(--muted)]">{fmtTal(l.lager.vejleFrit)} i Vejle</span>}</td>
                    <td className="px-3 py-3 text-right num whitespace-nowrap text-xs">{l.paaVej.sikker > 0 && <span className="block font-bold text-[var(--ok)]">+{fmtTal(l.paaVej.sikker)}</span>}{l.paaVej.usikker > 0 && <span className="block text-[#b58900] font-bold" title="Ubooket">+{fmtTal(l.paaVej.usikker)}<span className="text-[.6rem] font-semibold"> ub.</span></span>}{l.paaVej.sikker + l.paaVej.usikker === 0 && <span className="text-[var(--muted)]">0</span>}</td>
                    <td className="px-3 py-3 hidden 2xl:table-cell"><LineStatusChip status={l.status} small /></td>
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
              <BestilSenest dato={l.datoer.bestilSenest} dag0={l.dag0} dage={l.dage.bestilSenest} big />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-[var(--muted)]">
              <span className="num">{fmtTal(l.velocity.base, 1)} stk/dag · {fmtTal(l.lager.tilgaengeligt)} tilg.</span>
              {l.genbestilling.foreslaaetStk > 0 ? <span className="num font-extrabold text-base text-[var(--ink)]">{fmtTal(l.genbestilling.foreslaaetStk)} stk</span> : <LineStatusChip status={l.status} small />}
            </div>
          </Link></li>
        ))}
      </ul>
    </div>
  );
}
