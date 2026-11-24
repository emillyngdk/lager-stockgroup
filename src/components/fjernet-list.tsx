"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { LineLite } from "@/lib/types-lite";
import { ShopDots } from "./line-table";
import { ask, hvemErDu } from "./dialog";
import { fmtDato, fmtTal } from "@/lib/format";

type Flag = { udgaar?: boolean; skjul_til?: string | null; ikke_indkoeb?: boolean; af?: string; dato?: string; note?: string };

export function FjernetList({ lines, dag0 }: { lines: LineLite[]; dag0: string }) {
  const [overrides, setOverrides] = useState<Record<string, Flag> | null>(null);
  const [besked, setBesked] = useState<string | null>(null);
  useEffect(() => { fetch("/api/state").then((r) => (r.ok ? r.json() : null)).then((d) => setOverrides(d?.overrides ?? {})).catch(() => setOverrides({})); }, []);
  const list = useMemo(() => {
    const ov = overrides ?? {};
    return lines.map((l) => ({ l, o: overrides ? ov[l.ean] : l.override as Flag | null }))
      .filter(({ o }) => o && (o.udgaar || o.ikke_indkoeb || (o.skjul_til && o.skjul_til >= dag0)))
      .map(({ l, o }) => ({ l, o: o!, type: o!.udgaar ? "Udgår" : o!.ikke_indkoeb ? "Ikke indkøb" : `Skjult til ${fmtDato(o!.skjul_til!)}` }))
      .sort((a, b) => a.type.localeCompare(b.type) || b.l.lager.tilgaengeligt - a.l.lager.tilgaengeligt);
  }, [lines, overrides, dag0]);
  const genindsaet = async (ean: string, titel: string) => {
    const navn = await hvemErDu(); if (!navn) return;
    if (!(await ask({ title: "Genindsæt på listen?", text: `${titel} kommer tilbage på indkøbslisten med det samme.`, ok: "Genindsæt" }))) return;
    const r = await fetch(`/api/override/${ean}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ udgaar: false, ikke_indkoeb: false, skjul_til: null, af: navn }) });
    if (r.ok) { const saved = await r.json(); setOverrides((o) => ({ ...(o ?? {}), [ean]: saved })); setBesked(`${titel} er tilbage på listen`); setTimeout(() => setBesked(null), 3000); }
  };
  if (overrides === null) return <div className="card p-8 text-center font-semibold text-[var(--muted)]">Henter…</div>;
  if (list.length === 0) return <div className="card p-10 text-center font-bold text-[var(--muted)]">Ingen varer er fjernet.</div>;
  return (
    <div>
      {besked && <p className="mb-3 text-sm font-bold text-[var(--ok)]">{besked}</p>}
      <div className="card scroll-x"><table className="w-full text-sm">
        <thead><tr className="text-left text-[.65rem] uppercase tracking-wider text-[var(--muted)]"><th className="px-4 py-3">Vare</th><th className="px-3 py-3">Flag</th><th className="px-3 py-3">Af · dato</th><th className="px-3 py-3 text-right">Restlager</th><th className="px-3 py-3 text-right">Dage til tomt</th><th className="px-3 py-3">Note</th><th className="px-4 py-3"></th></tr></thead>
        <tbody>{list.map(({ l, o, type }) => <tr key={l.ean} className="border-t border-[var(--line)]">
          <td className="px-4 py-2.5"><Link href={`/linje/${l.ean}`} className="font-bold">{l.titel}</Link><span className="flex items-center gap-2"><ShopDots shops={l.shops} withText /><span className="num text-[.65rem] text-[var(--muted)]">{l.ean}</span></span></td>
          <td className="px-3 py-2.5"><span className="chip !text-[.6rem]" style={{ background: o.udgaar ? "#141414" : "#8a8a8a", color: "#fff" }}>{type}</span></td>
          <td className="px-3 py-2.5 text-xs text-[var(--muted)]">{o.af ?? "–"}{o.dato ? ` · ${fmtDato(o.dato)}` : ""}</td>
          <td className="px-3 py-2.5 text-right num font-bold">{fmtTal(l.lager.tilgaengeligt)}</td>
          <td className="px-3 py-2.5 text-right num">{l.dage.tilUdsolgt === null ? "2 år+" : l.dage.tilUdsolgt}</td>
          <td className="px-3 py-2.5 text-xs text-[var(--muted)] max-w-[240px] truncate">{o.note ?? ""}</td>
          <td className="px-4 py-2.5 text-right"><button onClick={() => genindsaet(l.ean, l.titel)} className="text-xs font-bold underline whitespace-nowrap">Genindsæt</button></td>
        </tr>)}</tbody>
      </table></div>
    </div>
  );
}
