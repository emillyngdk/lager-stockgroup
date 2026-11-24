"use client";
import { useEffect, useMemo, useState } from "react";
import type { PurchaseLine } from "@/lib/forecast/purchase";
import { raekkerTil, fordel } from "@/lib/forecast/purchase";
import { addDays } from "@/lib/forecast/engine";
import { BRANDS } from "@/lib/forecast/types";
import { fmtDato, fmtTal } from "@/lib/format";
import { LineChart } from "./line-chart";

type Props = { line: PurchaseLine; receivingDays: number; plan?: { stk: number; bestilDato: string; leadTime: number; note?: string; af?: string } | null; onSave?: (p: { stk: number; colli: number; bestilDato: string; leadTime: number; note: string }) => Promise<void> | void };

export function Calculator({ line, receivingDays, plan, onSave }: Props) {
  const g = line.genbestilling;
  const dag0 = line.projektion.dag0;
  const basis = g.foreslaaetStk > 0 ? g.foreslaaetStk : g.foreslaaetUdenUbooket; // forslag, eller "hvis de ubookede ikke kommer"
  const basisTekst = g.foreslaaetStk > 0 ? "Forslag" : "Hvis ubookede PO'er ikke kommer";
  const start = plan?.stk ?? basis;
  const [stk, setStk] = useState<number>(start);
  const [bestilDato, setBestilDato] = useState<string>(plan?.bestilDato ?? (line.datoer.bestilSenest && line.datoer.bestilSenest > dag0 ? line.datoer.bestilSenest : dag0));
  const [leadTime, setLeadTime] = useState<number>(plan?.leadTime ?? g.leadTime);
  const [pris, setPris] = useState<number | "">(line.oekonomi.unitCost ?? "");
  const [note, setNote] = useState(plan?.note ?? "");
  const [saving, setSaving] = useState(false);
  // planen hentes asynkront – når den lander, skal felterne vise planen og ikke forslaget
  const planKey = plan ? `${plan.stk}|${plan.bestilDato}|${plan.leadTime}|${plan.note ?? ""}` : "";
  useEffect(() => { if (plan) { setStk(plan.stk); setBestilDato(plan.bestilDato); setLeadTime(plan.leadTime); setNote(plan.note ?? ""); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planKey]);
  const cll = g.stkPrColli ?? 0;
  const colli = cll ? Math.ceil(stk / cll) : 0;
  const stkRund = cll ? colli * cll : stk;
  const modtagelse = addDays(bestilDato < dag0 ? dag0 : bestilDato, leadTime + receivingDays);

  const calc = useMemo(() => {
    const rt = raekkerTil(line, stkRund, modtagelse, true);
    const ref = raekkerTil(line, basis, addDays(line.datoer.bestilSenest && line.datoer.bestilSenest > dag0 ? line.datoer.bestilSenest : dag0, g.leadTime + receivingDays), true);
    const uden = raekkerTil(line, 0, null, true);
    const kurve: number[] = [];
    let s = line.lager.tilgaengeligtOptimistisk;
    const byDay: Record<number, number> = {};
    for (const e of line.paaVej.events) { const d = Math.max(0, Math.round((Date.parse(e.dato) - Date.parse(dag0)) / 864e5)); byDay[d] = (byDay[d] ?? 0) + e.stk; }
    const qDag = Math.round((Date.parse(modtagelse) - Date.parse(dag0)) / 864e5);
    const n = line.projektion.optimistisk.length;
    for (let d = 0; d < n; d++) { if (d > 0) { if (byDay[d]) s += byDay[d]; if (d === qDag) s += stkRund; s -= line.demandPrDag[d]; } kurve.push(Math.max(0, Math.round(s))); }
    const forLang = rt.dageEfterModtagelse != null && rt.dageEfterModtagelse > 365;
    const forSen = uden.dag != null && uden.dag < qDag; // tør før den nye PO lander
    const dageDaekning = rt.dag == null ? null : rt.dag;
    return { rt, ref, uden, kurve, qDag, forLang, forSen, dageDaekning, fordeling: stkRund > 0 ? fordel(line, stkRund) : [] };
  }, [line, stkRund, modtagelse, basis, g.leadTime, dag0, receivingDays]);

  const pct = basis > 0 ? Math.round((stkRund / basis - 1) * 100) : null;
  const diffDage = calc.rt.dag != null && calc.ref.dag != null ? calc.rt.dag - calc.ref.dag : null;
  const vaerdi = pris !== "" ? Math.round(stkRund * Number(pris)) : null;
  const bump = (f: number) => { const v = Math.max(0, Math.round(basis * f)); setStk(cll ? Math.ceil(v / cll) * cll : v); };

  return (
    <section className="card p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h2 className="font-extrabold text-lg">Bestillingsberegner</h2>
        <p className="text-xs text-[var(--muted)] font-medium">{basisTekst}: <b className="num">{fmtTal(basis)} stk</b>{cll && basis ? ` · ${Math.ceil(basis / cll)} colli à ${cll}` : ""} · lead time {g.leadTime} dage ({g.leadTimeKilde})</p>
      </div>
      {line.dataKvalitet === "lav" && <p className="mb-4 rounded-lg bg-[#fff1f0] border border-[var(--kritisk)] px-3 py-2 text-xs font-bold text-[var(--kritisk)]">Forslaget bygger kun på {Math.min(365, line.velocity.salgsdage)} dages salg – brug knapperne herunder til at skrue ned, hvis det virker for højt.</p>}
      <div className="grid md:grid-cols-[1fr_1.2fr] gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex gap-1.5 flex-wrap">
            {[["−50 %", 0.5], ["−25 %", 0.75], ["+25 %", 1.25], ["+50 %", 1.5], ["+100 %", 2]].map(([l, f]) => <button key={l as string} onClick={() => bump(f as number)} className="rounded-full px-3 py-1.5 text-xs font-bold bg-[var(--bg)] hover:bg-[#eeeae2]">{l as string}</button>)}
            <button onClick={() => setStk(basis)} className="rounded-full px-3 py-1.5 text-xs font-bold bg-[var(--bg)] hover:bg-[#eeeae2]">Nulstil</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">Stk<input type="number" min={0} value={stk} onChange={(e) => setStk(Math.max(0, Number(e.target.value) || 0))} onBlur={() => { if (cll && stk % cll) setStk(Math.ceil(stk / cll) * cll); }} className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-3 num text-2xl font-extrabold text-[var(--ink)] outline-none focus:border-[var(--ink)]" /></label>
            <label className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">Colli{cll ? ` (à ${cll})` : ""}<input type="number" min={0} disabled={!cll} value={colli} onChange={(e) => setStk(Math.max(0, Number(e.target.value) || 0) * cll)} className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-3 num text-2xl font-extrabold text-[var(--ink)] outline-none focus:border-[var(--ink)] disabled:opacity-40" /></label>
            <label className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">Bestildato<input type="date" value={bestilDato} onChange={(e) => setBestilDato(e.target.value || dag0)} className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 num text-sm font-semibold text-[var(--ink)] outline-none focus:border-[var(--ink)]" /></label>
            <label className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">Lead time (dage)<input type="number" min={1} value={leadTime} onChange={(e) => setLeadTime(Math.max(1, Number(e.target.value) || 1))} className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 num text-sm font-semibold text-[var(--ink)] outline-none focus:border-[var(--ink)]" /></label>
            <label className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">Kostpris pr. stk<input type="number" min={0} step="0.01" value={pris} onChange={(e) => setPris(e.target.value === "" ? "" : Number(e.target.value))} placeholder="–" className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 num text-sm font-semibold text-[var(--ink)] outline-none focus:border-[var(--ink)]" /></label>
            <label className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide">Note<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="fx aftalt med leverandør" className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm font-medium text-[var(--ink)] outline-none focus:border-[var(--ink)]" /></label>
          </div>
          {onSave && (
            <div className="flex items-center gap-3 mt-1">
              <button disabled={saving || stkRund <= 0} onClick={async () => { setSaving(true); try { await onSave({ stk: stkRund, colli, bestilDato, leadTime, note }); } finally { setSaving(false); } }} className="rounded-xl bg-[var(--ink)] text-white font-bold px-5 py-3 text-sm disabled:opacity-40">{saving ? "Gemmer…" : plan ? "Opdatér plan" : "Gem som plan"}</button>
              {plan && <span className="text-xs text-[var(--muted)] font-medium">Planlagt {fmtTal(plan.stk)} stk{plan.af ? ` af ${plan.af}` : ""}</span>}
            </div>
          )}
        </div>
        <div className="rounded-2xl bg-[var(--bg)] p-4 md:p-5 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-[.6rem] font-bold uppercase tracking-widest text-[var(--muted)]">Rækker til</p><p className="display num text-3xl mt-1" style={{ color: calc.forSen ? "var(--kritisk)" : calc.forLang ? "#b58900" : "var(--ink)" }}>{calc.rt.dato ? fmtDato(calc.rt.dato) : "2 år+"}</p><p className="text-xs text-[var(--muted)] font-medium mt-1">{calc.rt.dageEfterModtagelse != null ? `${calc.rt.dageEfterModtagelse} dage efter modtagelse ${fmtDato(modtagelse)}` : `modtages ${fmtDato(modtagelse)}`}</p></div>
            <div><p className="text-[.6rem] font-bold uppercase tracking-widest text-[var(--muted)]">I forhold til forslaget</p><p className="display num text-3xl mt-1">{pct === null ? "–" : `${pct > 0 ? "+" : ""}${pct} %`}</p><p className="text-xs text-[var(--muted)] font-medium mt-1 num">{pct === null ? "intet forslag" : `${stkRund - basis > 0 ? "+" : ""}${fmtTal(stkRund - basis)} stk${diffDage != null ? ` · ${diffDage > 0 ? "+" : ""}${diffDage} dage` : ""}`}</p></div>
          </div>
          <ul className="text-sm font-medium flex flex-col gap-1.5 border-t border-[var(--line)] pt-3">
            <li className="flex justify-between"><span>Mængde (rundet til colli)</span><b className="num">{fmtTal(stkRund)} stk{cll ? ` · ${colli} colli` : ""}</b></li>
            {vaerdi != null && <li className="flex justify-between"><span>Lagerværdi</span><b className="num">{fmtTal(vaerdi)} kr.</b></li>}
            <li className="flex justify-between"><span>Uden ny ordre tør lageret</span><b className="num">{calc.uden.dato ? fmtDato(calc.uden.dato) : "ikke inden 2 år"}</b></li>
            {calc.fordeling.length > 0 && <li className="flex justify-between gap-3"><span>Fordeling</span><span className="num text-right">{calc.fordeling.map((f) => `${BRANDS[f.brand].kort} ${fmtTal(f.stk)}`).join(" · ")}</span></li>}
          </ul>
          {calc.forSen && <p className="text-xs font-bold text-[var(--kritisk)]">Lageret tør {fmtDato(calc.uden.dato!)} – før den nye PO lander {fmtDato(modtagelse)}. Fremryk bookede PO'er eller flyt fra Vejle.</p>}
          {calc.forLang && !calc.forSen && <p className="text-xs font-bold text-[#b58900]">Mængden rækker over et år efter modtagelse – overvej en mindre ordre.</p>}
        </div>
      </div>
      <div className="mt-5">
        <div className="flex items-center justify-between mb-2"><h3 className="font-extrabold">Lagerkurve · {Math.round((line.projektion.optimistisk.length - 1) / 30)} måneder frem</h3><div className="flex gap-4 text-[.65rem] font-semibold text-[var(--muted)]"><span><i className="inline-block w-4 h-0.5 bg-[var(--ink)] align-middle mr-1" />Bekræftede leveringer</span><span><i className="inline-block w-4 border-t-2 border-dashed border-[#5b6cff] align-middle mr-1" />Alle åbne PO'er</span><span><i className="inline-block w-4 h-0.5 bg-[#5b6cff] align-middle mr-1" />Med denne ordre</span><span className="text-[var(--kritisk)]">— Reorder point</span></div></div>
        <LineChart dag0={dag0} konservativ={line.projektion.konservativ} optimistisk={line.projektion.optimistisk} reorderPoint={g.reorderPoint} events={line.paaVej.events} bestilSenest={line.datoer.bestilSenest} plan={stkRund > 0 ? { kurve: calc.kurve, stk: stkRund, dato: modtagelse } : null} />
      </div>
    </section>
  );
}
