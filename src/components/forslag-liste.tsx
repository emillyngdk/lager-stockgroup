"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Brand } from "@/lib/forecast/types";
import type { LineStatus } from "@/lib/forecast/purchase";
import { fmtDato, fmtTal } from "@/lib/format";
import { effektivStatus, paaListen, PO_OPRETTET_DAGE, type OverlayFlag } from "@/lib/overlay";
import { markerPoOprettet, saetFlag, meldStateAendret, hurtigKlik, PO_NULSTIL } from "@/lib/handlinger";
import { ShopDots } from "./line-table";
import { ask, hvemErDu } from "./dialog";
import { visToast } from "./toast";

export type ForslagLinje = {
  ean: string; titel: string; leverandoer: string | null; grund: LineStatus; bsDage: number | null; bestilSenest: string | null;
  stk: number; colli: number; raekkerTil: string | null; begrundelse: string; poNumre: string[]; paaVejStk: number;
  shops: { brand: Brand; dageTilUdsolgt: number | null; status: string }[]; dataLav: boolean;
};
type St = { overrides: Record<string, OverlayFlag>; plans: Record<string, { status: "planlagt" | "bestilt"; stk: number }> };

/** Pr. leverandør: arbejd leverandør for leverandør. Opret PO'en i BC, tryk "PO oprettet for alle" – så forsvinder hele gruppen. */
export function ForslagListe({ linjer, dag0 }: { linjer: ForslagLinje[]; dag0: string }) {
  const [st, setSt] = useState<St | null>(null);
  useEffect(() => { fetch("/api/state").then((r) => (r.ok ? r.json() : null)).then((d) => setSt({ overrides: d?.overrides ?? {}, plans: d?.plans ?? {} })).catch(() => setSt({ overrides: {}, plans: {} })); }, []);
  useEffect(() => { if (st) meldStateAendret(st.overrides, st.plans); }, [st]);
  const gem = (saved: Record<string, OverlayFlag>) => setSt((s) => s && ({ ...s, overrides: { ...s.overrides, ...saved } }));

  const grupper = useMemo(() => {
    const m: Record<string, (ForslagLinje & { status: LineStatus; planStk: number | null })[]> = {};
    for (const l of linjer) {
      const o = st?.overrides[l.ean]; const p = st?.plans[l.ean];
      const { status } = st ? effektivStatus(l.grund, l.bsDage, o, p ? { status: p.status } : null, l.poNumre, l.paaVejStk, dag0) : { status: l.grund };
      const planlagt = status === "planlagt";
      if (!planlagt && !(paaListen(status, l.bsDage) && status !== "book_po")) continue;
      const lev = o?.leverandoer || l.leverandoer || "Ukendt leverandør";
      (m[lev] ??= []).push({ ...l, status, planStk: planlagt ? p?.stk ?? null : null });
    }
    return Object.entries(m).map(([lev, ls]) => ({ lev, ls: ls.sort((a, b) => (a.bestilSenest || "9999").localeCompare(b.bestilSenest || "9999")) }))
      .sort((a, b) => (a.lev === "Ukendt leverandør" ? 1 : 0) - (b.lev === "Ukendt leverandør" ? 1 : 0) || b.ls.length - a.ls.length);
  }, [linjer, st, dag0]);

  const markér = async (ls: ForslagLinje[], lev: string, hurtig: boolean) => {
    const navn = await hvemErDu(); if (!navn) return;
    let poNr: string | undefined;
    if (!hurtig) {
      const svar = await ask({ title: `PO oprettet hos ${lev}?`, text: `${ls.length} ${ls.length === 1 ? "vare" : "varer"} · ${fmtTal(ls.reduce((a, l) => a + l.stk, 0))} stk\n\nForsvinder fra listen i ${PO_OPRETTET_DAGE} dage. Varer der ikke ses på en ny PO i BC inden da, kommer tilbage.`, ok: "✓ PO oprettet", fields: [{ key: "po", label: "PO-nummer (valgfrit)", placeholder: "fx 108512" }] });
      if (!svar) return; poNr = svar.po;
    }
    const saved = await markerPoOprettet(ls.map((l) => ({ ean: l.ean, poNumre: l.poNumre, paaVejStk: l.paaVejStk })), navn, poNr); gem(saved);
    const ok = Object.keys(saved);
    visToast({ tekst: ls.length === 1 ? `${ls[0].titel} – PO oprettet` : `${ok.length} varer hos ${lev} – PO oprettet`, fortryd: async () => gem(await saetFlag(ok, { ...PO_NULSTIL }, navn)) });
  };

  const antal = grupper.reduce((a, g) => a + g.ls.length, 0);
  if (st && antal === 0) return (
    <div className="card p-10 md:p-14 text-center">
      <p className="display text-5xl md:text-6xl text-[var(--ok)]">0</p>
      <p className="mt-3 text-xl font-extrabold">Ingen PO&apos;er mangler at blive oprettet</p>
      <p className="mt-2 text-sm font-medium text-[var(--muted)]">Alt på listen er bestilt eller dækket.</p>
    </div>
  );
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-semibold text-[var(--muted)]"><b className="num text-[var(--ink)]">{antal}</b> varer hos <b className="num text-[var(--ink)]">{grupper.length}</b> leverandører mangler en PO.</p>
      {grupper.map((g) => {
        const aktive = g.ls.filter((l) => l.status !== "planlagt");
        const stk = g.ls.reduce((a, l) => a + (l.planStk ?? l.stk), 0);
        return (
          <section key={g.lev} className="card p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-extrabold text-lg flex items-baseline gap-3">{g.lev} <span className="text-xs font-semibold text-[var(--muted)]">{g.ls.length} varer · {fmtTal(stk)} stk</span></h2>
              {aktive.length > 0 && <button onClick={() => markér(aktive, g.lev, false)} className="rounded-full bg-[var(--ok)] text-white font-extrabold px-4 py-2 text-sm hover:brightness-110">✓ PO oprettet for {aktive.length === 1 ? "varen" : `alle ${aktive.length}`}</button>}
            </div>
            <div className="scroll-x mt-2"><table className="w-full text-sm">
              <thead><tr className="text-left text-[.65rem] uppercase tracking-wider text-[var(--muted)]"><th className="py-2 pr-3">Vare</th><th className="py-2 pr-3">Bestil senest</th><th className="py-2 pr-3 text-right">Stk</th><th className="py-2 pr-3 text-right">Colli</th><th className="py-2 pr-3">Rækker til</th><th className="py-2 pr-3 hidden lg:table-cell">Begrundelse</th><th className="py-2"></th></tr></thead>
              <tbody>{g.ls.map((l) => (
                <tr key={l.ean} className="border-t border-[var(--line)] align-top">
                  <td className="py-2.5 pr-3 max-w-[320px]"><Link href={`/linje/${l.ean}`} className="block"><span className="block font-semibold truncate">{l.titel}</span><span className="flex flex-wrap gap-1.5 items-center mt-0.5"><ShopDots shops={l.shops} withDays /><span className="num text-[.65rem] text-[var(--muted)]">{l.ean}</span>{l.dataLav && <span className="text-[.6rem] font-bold text-white bg-[var(--kritisk)] rounded px-1.5 py-0.5">FÅ DATA</span>}</span></Link></td>
                  <td className="py-2.5 pr-3 num font-bold whitespace-nowrap">{l.status === "for_nyt" ? <span className="text-[var(--bestil)]">Vurdér</span> : l.bestilSenest && l.bestilSenest <= dag0 ? <span className="text-[var(--kritisk)]">NU</span> : <span style={{ color: (l.bsDage ?? 99) <= 14 ? "var(--bestil)" : "#b58900" }}>{fmtDato(l.bestilSenest)}</span>}</td>
                  <td className="py-2.5 pr-3 num font-extrabold text-right text-base">{fmtTal(l.planStk ?? l.stk)}{l.planStk != null && <span className="block text-[.6rem] font-bold text-[#5b6cff]">PLAN</span>}</td>
                  <td className="py-2.5 pr-3 num text-right">{l.colli || "–"}</td>
                  <td className="py-2.5 pr-3 num whitespace-nowrap">{l.raekkerTil ? fmtDato(l.raekkerTil) : "2 år+"}</td>
                  <td className="py-2.5 pr-3 text-xs text-[var(--muted)] hidden lg:table-cell max-w-[360px]">{l.begrundelse}</td>
                  <td className="py-2.5 text-right whitespace-nowrap">{l.status !== "planlagt" && <button onClick={() => hurtigKlik(() => markér([l], g.lev, true))} className="rounded-full border-2 border-[var(--line)] px-3 py-1 text-xs font-bold hover:border-[var(--ok)] hover:bg-[var(--ok)] hover:text-white transition">✓ PO</button>}</td>
                </tr>
              ))}</tbody>
            </table></div>
          </section>
        );
      })}
    </div>
  );
}
