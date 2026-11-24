import { addDays } from "@/lib/forecast/engine";
import { fmtDato } from "@/lib/format";

export interface LineChartProps {
  dag0: string; konservativ: number[]; optimistisk: number[]; reorderPoint: number;
  events: { dato: string; stk: number; sikker: boolean }[]; bestilSenest: string | null;
  plan?: { kurve: number[]; stk: number; dato: string } | null;
}

/** Lagerkurve som ren SVG: konservativ (sort), optimistisk (stiplet blå), valgt plan (blå fyldt), reorder point (stiplet rød), leveringer som hak. */
export function LineChart({ dag0, konservativ: k, optimistisk: o, reorderPoint: rop, events, bestilSenest, plan }: LineChartProps) {
  const W = 760, H = 230, padL = 48, padR = 12, padT = 16, padB = 28;
  const n = k.length;
  const max = Math.max(1, ...k, ...o, ...(plan?.kurve ?? []), rop);
  const x = (i: number) => padL + (i / (n - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const path = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const months: { i: number; label: string }[] = [];
  const MDR = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  const step = n > 250 ? 2 : 1; // ved lange kurver: hver anden måned, så labels ikke står oven i hinanden
  let m = 0;
  for (let i = 0; i < n; i++) {
    const d = addDays(dag0, i);
    if (i === 0) { months.push({ i, label: fmtDato(d) }); continue; }
    if (d.endsWith("-01") && i > 12) { m++; if (m % step === 0) months.push({ i, label: `${MDR[Number(d.slice(5, 7)) - 1]}${d.slice(5, 7) === "01" ? ` ${d.slice(0, 4)}` : ""}` }); }
  }
  const toI = (d: string) => Math.round((Date.parse(d) - Date.parse(dag0)) / 864e5);
  const ev = events.map((e) => ({ ...e, i: toI(e.dato) })).filter((e) => e.i >= 0 && e.i < n);
  const bsI = bestilSenest ? toI(bestilSenest) : null;
  const planI = plan ? toI(plan.dato) : null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Lagerkurve">
      {[0, 0.5, 1].map((t) => <g key={t}><line x1={padL} x2={W - padR} y1={y(max * t)} y2={y(max * t)} stroke="#eeeae2" /><text x={padL - 6} y={y(max * t) + 4} fontSize="10" textAnchor="end" fill="#8a8a8a">{Math.round(max * t).toLocaleString("da-DK")}</text></g>)}
      {months.map((m) => <text key={m.i} x={x(m.i)} y={H - 8} fontSize="10" textAnchor={m.i === 0 ? "start" : "middle"} fill="#8a8a8a">{m.label}</text>)}
      <path d={`${path(o)} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill="#5b6cff" opacity=".05" />
      <path d={`${path(k)} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill="#141414" opacity=".06" />
      {plan && <path d={`${path(plan.kurve)} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill="#5b6cff" opacity=".12" />}
      <path d={path(o)} fill="none" stroke="#5b6cff" strokeWidth="2" strokeDasharray="4 4" />
      {plan && <path d={path(plan.kurve)} fill="none" stroke="#5b6cff" strokeWidth="2.5" />}
      <path d={path(k)} fill="none" stroke="#141414" strokeWidth="2.5" />
      {rop > 0 && rop <= max && <g><line x1={padL} x2={W - padR} y1={y(rop)} y2={y(rop)} stroke="#e5322d" strokeWidth="1.5" strokeDasharray="6 4" /><text x={W - padR} y={y(rop) - 4} fontSize="10" textAnchor="end" fill="#e5322d" fontWeight="700">Reorder point {rop.toLocaleString("da-DK")}</text></g>}
      {ev.map((e, j) => <g key={j}><line x1={x(e.i)} x2={x(e.i)} y1={padT} y2={H - padB} stroke={e.sikker ? "#1e9e5a" : "#f2b705"} strokeWidth="1.5" strokeDasharray={e.sikker ? undefined : "3 3"} /><text x={x(e.i) + 3} y={padT + 10} fontSize="9" fill={e.sikker ? "#1e9e5a" : "#b58900"} fontWeight="700">+{e.stk.toLocaleString("da-DK")}</text></g>)}
      {planI !== null && planI >= 0 && planI < n && <g><line x1={x(planI)} x2={x(planI)} y1={padT} y2={H - padB} stroke="#5b6cff" strokeWidth="2" /><text x={x(planI) + 3} y={H - padB - 6} fontSize="10" fill="#5b6cff" fontWeight="800">+{plan!.stk.toLocaleString("da-DK")} ny PO</text></g>}
      {bsI !== null && bsI >= 0 && bsI < n && <circle cx={x(bsI)} cy={y(Math.min(rop, max))} r="5" fill="#e5322d" />}
    </svg>
  );
}
