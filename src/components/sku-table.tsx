"use client";
import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { RowLite } from "@/lib/types-lite";
import { fmtDato, fmtTal } from "@/lib/format";
import { BRANDS, type Brand } from "@/lib/forecast/types";
import { StatusChip, BrandChip, TrendArrow, CoverageBar, Dage } from "./ui";

export function SkuTable({ rows, visStatus = true }: { rows: RowLite[]; visStatus?: boolean }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") || "");
  const [brand, setBrand] = useState<string>(sp.get("brand") || "");
  const [lev, setLev] = useState<string>(sp.get("lev") || "");
  const [hero, setHero] = useState(sp.get("hero") === "1");

  useEffect(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q); if (brand) p.set("brand", brand); if (lev) p.set("lev", lev); if (hero) p.set("hero", "1");
    router.replace(`?${p.toString()}`, { scroll: false });
  }, [q, brand, lev, hero, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "/" && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); (document.getElementById("sku-search") as HTMLInputElement)?.focus(); } };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);

  const levs = useMemo(() => [...new Set(rows.map((r) => r.leverandoer).filter(Boolean))].sort() as string[], [rows]);
  const filtered = useMemo(() => rows.filter((r) =>
    (!brand || r.brand === brand) && (!lev || r.leverandoer === lev) && (!hero || r.genbestilling.hero) &&
    (!q || `${r.titel} ${r.ean} ${r.bc_sku}`.toLowerCase().includes(q.toLowerCase()))), [rows, q, brand, lev, hero]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 items-center">
        <input id="sku-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søg vare eller EAN  ( / )" className="rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-medium outline-none focus:border-[var(--ink)] min-w-[220px] flex-1 md:flex-none" />
        <select value={brand} onChange={(e) => setBrand(e.target.value)} className="rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm font-semibold">
          <option value="">Alle brands</option>
          {(Object.keys(BRANDS) as Brand[]).map((b) => <option key={b} value={b}>{BRANDS[b].navn}</option>)}
        </select>
        <select value={lev} onChange={(e) => setLev(e.target.value)} className="rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm font-semibold max-w-[220px]">
          <option value="">Alle leverandører</option>
          {levs.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm font-semibold rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 cursor-pointer"><input type="checkbox" checked={hero} onChange={(e) => setHero(e.target.checked)} /> Kun hero-produkter</label>
        <span className="num text-xs font-bold text-[var(--muted)] ml-auto">{filtered.length} varer</span>
      </div>

      {/* desktop */}
      <div className="card scroll-x hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[.68rem] uppercase tracking-wider text-[var(--muted)]">
              <th className="px-4 py-3 font-bold">Vare</th>
              {visStatus && <th className="px-3 py-3 font-bold">Status</th>}
              <th className="px-3 py-3 font-bold text-right">Dage til udsolgt</th>
              <th className="px-3 py-3 font-bold">Udsolgt</th>
              <th className="px-3 py-3 font-bold">Bestil senest</th>
              <th className="px-3 py-3 font-bold text-right">Stk/dag<span className="block text-[.55rem] font-semibold text-[var(--muted)] normal-case tracking-normal">solgt 365 d</span></th>
              <th className="px-3 py-3 font-bold text-right">Tilgængeligt</th>
              <th className="px-3 py-3 font-bold text-right">På vej</th>
              <th className="px-4 py-3 font-bold text-right">Foreslået</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.key} className="row-link border-t border-[var(--line)]">
                <td className="px-4 py-2.5 max-w-[320px]">
                  <Link href={`/vare/${encodeURIComponent(r.key)}`} className="block">
                    <span className="block font-semibold leading-snug truncate">{r.titel}</span>
                    <span className="flex items-center gap-3 mt-0.5"><BrandChip brand={r.brand} />{r.universel && <span className="text-[.62rem] font-bold uppercase tracking-wide text-[var(--overlager)]">Universel</span>}{r.genbestilling.hero && <span className="text-[.62rem] font-bold uppercase tracking-wide text-[var(--bestil)]">Hero</span>}</span>
                  </Link>
                </td>
                {visStatus && <td className="px-3 py-2.5"><StatusChip status={r.status} small /></td>}
                <td className="px-3 py-2.5 text-right"><div className="flex flex-col items-end gap-1"><Dage n={r.dage.tilUdsolgtMedPaaVej} /><CoverageBar days={r.dage.tilUdsolgtMedPaaVej} /></div></td>
                <td className="px-3 py-2.5 num font-medium whitespace-nowrap">{fmtDato(r.datoer.udsolgtMedPaaVej)}</td>
                <td className="px-3 py-2.5 num font-bold whitespace-nowrap">{r.datoer.bestilSenest && r.datoer.bestilSenest <= r.projektionDag0 ? <span className="text-[var(--kritisk)]">Nu</span> : fmtDato(r.datoer.bestilSenest)}</td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap"><span className="num font-semibold">{fmtTal(r.velocity.base, 1)}</span> <TrendArrow trend={r.velocity.trend} />{r.oekonomi.solgt365 != null && <span className="block num text-[.65rem] font-medium text-[var(--muted)]">{fmtTal(r.oekonomi.solgt365)} / 365 d</span>}</td>
                <td className="px-3 py-2.5 text-right num font-semibold">{fmtTal(r.lager.tilgaengeligt)}</td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap"><span className="num font-semibold">{fmtTal(r.paaVej.sikker)}</span>{r.paaVej.usikker > 0 && <span className="num text-xs text-[var(--muted)]"> +{fmtTal(r.paaVej.usikker)}</span>}{r.paaVej.foersteEta && <span className="block text-[.65rem] text-[var(--muted)]">{fmtDato(r.paaVej.foersteEta)}</span>}</td>
                <td className="px-4 py-2.5 text-right num font-bold">{r.genbestilling.foreslaaetStk > 0 ? <>{fmtTal(r.genbestilling.foreslaaetStk)}{r.genbestilling.foreslaaetColli > 0 && <span className="block text-[.65rem] font-medium text-[var(--muted)]">{r.genbestilling.foreslaaetColli} colli</span>}</> : <span className="text-[var(--muted)]">–</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="p-8 text-center font-semibold text-[var(--muted)]">Ingen varer matcher filtrene.</p>}
      </div>

      {/* mobil */}
      <div className="md:hidden flex flex-col gap-2">
        {filtered.map((r) => (
          <Link key={r.key} href={`/vare/${encodeURIComponent(r.key)}`} className="card p-4 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-snug truncate">{r.titel}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap"><BrandChip brand={r.brand} />{visStatus && <StatusChip status={r.status} small />}</div>
              <p className="text-xs text-[var(--muted)] mt-1.5 num">{fmtTal(r.velocity.base, 1)} stk/dag{r.oekonomi.solgt365 != null ? ` · ${fmtTal(r.oekonomi.solgt365)} solgt/365 d` : ""} · {fmtTal(r.lager.tilgaengeligt)} tilg. · bestil {r.datoer.bestilSenest && r.datoer.bestilSenest <= r.projektionDag0 ? "nu" : fmtDato(r.datoer.bestilSenest)}</p>
            </div>
            <div className="text-right shrink-0"><Dage n={r.dage.tilUdsolgtMedPaaVej} /><p className="text-[.6rem] uppercase font-bold text-[var(--muted)]">dage</p></div>
          </Link>
        ))}
        {filtered.length === 0 && <p className="card p-8 text-center font-semibold text-[var(--muted)]">Ingen varer matcher.</p>}
      </div>
    </div>
  );
}
