import { addDays } from "@/lib/forecast/engine";
import type { ForecastRow } from "@/lib/forecast/types";
import { fmtDato } from "@/lib/data";

/** 180-dages lagerkurve som ren SVG: konservativ (sort), optimistisk (stiplet blå), reorder point (stiplet rød), leveringer som hak. */
export function ProjectionChart({ row }: { row: ForecastRow }) {
  const W = 760, H = 220, padL = 44, padR = 12, padT = 14, padB = 28;
  const k = row.projektion.konservativ, o = row.projektion.optimistisk;
  const n = k.length;
  const max = Math.max(1, ...k, ...o, row.genbestilling.reorderPoint);
  const x = (i: number) => padL + (i / (n - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const path = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const months: { i: number; label: string }[] = [];
  for (let i = 0; i < n; i++) { const d = addDays(row.projektion.dag0, i); if ((d.endsWith("-01") && i > 8) || i === 0) months.push({ i, label: fmtDato(d) }); }
  const ev = row.paaVej.events.map((e) => ({ ...e, i: Math.round((new Date(e.dato).getTime() - new Date(row.projektion.dag0).getTime()) / 86400000) })).filter((e) => e.i >= 0 && e.i < n);
  const rop = row.genbestilling.reorderPoint;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Lagerkurve 180 dage">
      {[0, 0.5, 1].map((t) => <g key={t}><line x1={padL} x2={W - padR} y1={y(max * t)} y2={y(max * t)} stroke="#eeeae2" /><text x={padL - 6} y={y(max * t) + 4} fontSize="10" textAnchor="end" fill="#8a8a8a" className="num">{Math.round(max * t).toLocaleString("da-DK")}</text></g>)}
      {months.map((m) => <text key={m.i} x={x(m.i)} y={H - 8} fontSize="10" textAnchor={m.i === 0 ? "start" : "middle"} fill="#8a8a8a">{m.label}</text>)}
      <path d={`${path(o)} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill="#5b6cff" opacity=".06" />
      <path d={`${path(k)} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill="#141414" opacity=".06" />
      <path d={path(o)} fill="none" stroke="#5b6cff" strokeWidth="2" strokeDasharray="4 4" />
      <path d={path(k)} fill="none" stroke="#141414" strokeWidth="2.5" />
      {rop > 0 && rop <= max && <g><line x1={padL} x2={W - padR} y1={y(rop)} y2={y(rop)} stroke="#e5322d" strokeWidth="1.5" strokeDasharray="6 4" /><text x={W - padR} y={y(rop) - 4} fontSize="10" textAnchor="end" fill="#e5322d" fontWeight="700">Reorder point {rop.toLocaleString("da-DK")}</text></g>}
      {ev.map((e, j) => <g key={j}><line x1={x(e.i)} x2={x(e.i)} y1={padT} y2={H - padB} stroke={e.sikker ? "#1e9e5a" : "#f2b705"} strokeWidth="1.5" strokeDasharray={e.sikker ? undefined : "3 3"} /><text x={x(e.i) + 3} y={padT + 10} fontSize="9" fill={e.sikker ? "#1e9e5a" : "#b58900"} fontWeight="700">+{e.stk.toLocaleString("da-DK")}</text></g>)}
      {row.datoer.bestilSenest && (() => { const i = Math.round((new Date(row.datoer.bestilSenest).getTime() - new Date(row.projektion.dag0).getTime()) / 86400000); return i >= 0 && i < n ? <circle cx={x(i)} cy={y(rop)} r="5" fill="#e5322d" /> : null; })()}
    </svg>
  );
}
