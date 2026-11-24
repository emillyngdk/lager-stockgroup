import Link from "next/link";
import { BRANDS, STATUS_META, type Brand, type Status } from "@/lib/forecast/types";
import { fmtTal } from "@/lib/format";

export function StatusChip({ status, small }: { status: Status; small?: boolean }) {
  const m = STATUS_META[status];
  return <span className={`chip ${small ? "!text-[.62rem] !px-2" : ""}`} style={{ background: m.farve, color: m.tekst }}>{m.label}</span>;
}

export function BrandChip({ brand }: { brand: Brand }) {
  const b = BRANDS[brand];
  return <span className="inline-flex items-center gap-1.5 text-[.68rem] font-bold uppercase tracking-wide text-[var(--muted)]"><i className="inline-block w-2 h-2 rounded-full" style={{ background: b.farve }} />{b.navn}</span>;
}

export function TrendArrow({ trend }: { trend: number }) {
  const pct = Math.round(trend * 100);
  const up = pct > 10, down = pct < -10;
  return <span className={`num text-xs font-bold ${up ? "text-[var(--ok)]" : down ? "text-[var(--kritisk)]" : "text-[var(--muted)]"}`}>{up ? "↑" : down ? "↓" : "→"} {pct > 0 ? "+" : ""}{pct}%</span>;
}

export function CoverageBar({ days }: { days: number | null }) {
  const d = days ?? 400;
  const pct = Math.min(100, (Math.min(d, 90) / 90) * 100);
  const color = d <= 14 ? "var(--kritisk)" : d <= 45 ? "var(--bestil)" : d <= 90 ? "var(--obs)" : "var(--ok)";
  return <span className="bar block w-full min-w-[56px]"><i style={{ width: `${pct}%`, background: color }} /></span>;
}

export function BigNumber({ label, value, sub, href, color }: { label: string; value: string | number; sub?: string; href?: string; color?: string }) {
  const inner = (
    <div className="card p-5 md:p-6 h-full flex flex-col justify-between gap-2 min-h-[132px]">
      <p className="text-[.7rem] font-bold uppercase tracking-widest text-[var(--muted)]">{label}</p>
      <p className="display num text-5xl md:text-6xl" style={{ color }}>{value}</p>
      {sub && <p className="text-xs font-medium text-[var(--muted)]">{sub}</p>}
    </div>
  );
  return href ? <Link href={href} className="block hover:-translate-y-0.5 transition-transform">{inner}</Link> : inner;
}

export function Dage({ n }: { n: number | null }) {
  if (n === null) return <span className="num font-extrabold text-lg text-[var(--ok)]">365+</span>;
  const color = n <= 14 ? "var(--kritisk)" : n <= 45 ? "var(--bestil)" : n <= 90 ? "#b58900" : "var(--ok)";
  return <span className="num font-extrabold text-lg" style={{ color }}>{fmtTal(n)}</span>;
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="card p-10 text-center">
      <p className="text-3xl mb-2">🎉</p>
      <p className="font-bold">{text}</p>
    </div>
  );
}
