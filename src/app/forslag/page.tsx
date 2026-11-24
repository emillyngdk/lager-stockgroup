import Link from "next/link";
import { Shell } from "@/components/shell";
import { LineStatusChip, ShopDots } from "@/components/line-table";
import { getForecast, fmtDato, fmtTal } from "@/lib/data";

export const dynamic = "force-static";

export default function Forslag() {
  const f = getForecast();
  const total = f.forslagEan.reduce((a, l) => a + l.linjer.length, 0);
  const stk = f.forslagEan.reduce((a, g) => a + g.linjer.reduce((b, l) => b + l.foreslaaetStk, 0), 0);
  return (
    <Shell active="forslag" title="Leverandører" intro={`${total} indkøbslinjer og ${fmtTal(stk)} stk fordelt på ${f.forslagEan.length} leverandører. Én linje pr. EAN; mængden dækker alle shops. Planlagte mængder vises i stedet for forslaget.`}>
      <div className="mb-4 flex gap-2 flex-wrap"><a href="/api/forslag.csv" className="rounded-xl bg-[var(--ink)] text-white font-bold px-4 py-2.5 text-sm">Download forslag (CSV)</a><a href="/api/plan.csv" className="rounded-xl bg-white font-bold px-4 py-2.5 text-sm border-2 border-[var(--line)]">Download planer (CSV)</a></div>
      <div className="flex flex-col gap-4">
        {f.forslagEan.map((g) => (
          <section key={g.leverandoer} className="card p-4 md:p-5">
            <h2 className="font-extrabold text-lg flex items-baseline gap-3">{g.leverandoer} <span className="text-xs font-semibold text-[var(--muted)]">{g.linjer.length} linjer · {fmtTal(g.linjer.reduce((a, l) => a + l.foreslaaetStk, 0))} stk</span></h2>
            <div className="scroll-x mt-2"><table className="w-full text-sm">
              <thead><tr className="text-left text-[.65rem] uppercase tracking-wider text-[var(--muted)]"><th className="py-2 pr-3">Vare</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Bestil senest</th><th className="py-2 pr-3 text-right">Stk</th><th className="py-2 pr-3 text-right">Colli</th><th className="py-2 pr-3">Rækker til</th><th className="py-2 hidden lg:table-cell">Begrundelse</th></tr></thead>
              <tbody>{g.linjer.map((l) => {
                const line = f.linjer.find((x) => x.ean === l.ean)!;
                return <tr key={l.ean} className="border-t border-[var(--line)]">
                  <td className="py-2 pr-3 max-w-[300px]"><Link href={`/linje/${l.ean}`} className="block"><span className="block font-semibold truncate">{l.titel}</span><span className="flex gap-2 items-center"><ShopDots shops={line.shops} withText /><span className="num text-[.65rem] text-[var(--muted)]">{l.ean}</span></span></Link></td>
                  <td className="py-2 pr-3"><LineStatusChip status={l.status} small /></td>
                  <td className="py-2 pr-3 num font-bold whitespace-nowrap">{l.bestilSenest && l.bestilSenest <= f.dag0 ? <span className="text-[var(--kritisk)]">NU</span> : fmtDato(l.bestilSenest)}</td>
                  <td className="py-2 pr-3 num font-extrabold text-right text-base">{fmtTal(l.foreslaaetStk)}</td>
                  <td className="py-2 pr-3 num text-right">{l.foreslaaetColli || "–"}</td>
                  <td className="py-2 pr-3 num whitespace-nowrap">{l.raekkerTil ? fmtDato(l.raekkerTil) : "2 år+"}</td>
                  <td className="py-2 text-xs text-[var(--muted)] hidden lg:table-cell">{l.begrundelse}</td>
                </tr>;
              })}</tbody>
            </table></div>
          </section>
        ))}
      </div>
    </Shell>
  );
}
