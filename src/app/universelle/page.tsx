import Link from "next/link";
import { Shell } from "@/components/shell";
import { StatusChip, Dage } from "@/components/ui";
import { getForecast, fmtDato, fmtTal } from "@/lib/data";
import { BRANDS, STATUS_META } from "@/lib/forecast/types";

export const dynamic = "force-static";

export default function Universelle() {
  const f = getForecast();
  const list = f.universelle.slice().sort((a, b) => STATUS_META[a.status].orden - STATUS_META[b.status].orden || (a.dageTilUdsolgt ?? 9999) - (b.dageTilUdsolgt ?? 9999));
  return (
    <Shell active="universelle" title="Universelle" intro="Samme EAN i flere shops. Den samlede linje afgør hvornår der skal bestilles hos leverandøren; linjerne pr. brand afgør overflytning.">
      <div className="flex flex-col gap-3">
        {list.map((u) => (
          <section key={u.ean} className="card p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-extrabold text-lg truncate">{u.titel}</h2>
                <p className="text-xs text-[var(--muted)] num">EAN {u.ean} · {u.brands.map((b) => BRANDS[b].navn).join(" + ")}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right"><Dage n={u.dageTilUdsolgt} /><p className="text-[.55rem] font-bold uppercase text-[var(--muted)]">dage samlet</p></div>
                <StatusChip status={u.status} />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3 text-sm">
              {[["Samlet stk/dag", fmtTal(u.velocitySum, 1)], ["Frit i Vejle", fmtTal(u.vejleFrit)], ["På e-com-lokationer", fmtTal(u.ecomSum)], ["På vej (bekræftet / ubooket)", `${fmtTal(u.paaVejSikker)} / ${fmtTal(u.paaVejUsikker)}`], ["Bestil senest", u.bestilSenest && u.bestilSenest <= f.dag0 ? "Nu" : fmtDato(u.bestilSenest)]].map(([l, v]) => <div key={l} className="rounded-xl bg-[var(--bg)] p-3"><p className="text-[.6rem] font-bold uppercase text-[var(--muted)]">{l}</p><p className="num font-extrabold">{v}</p></div>)}
            </div>
            <ul className="mt-3 divide-y divide-[var(--line)]">
              {u.prBrand.map((p) => <li key={p.key}><Link href={`/vare/${encodeURIComponent(p.key)}`} className="py-2 flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 font-semibold"><i className="inline-block w-2 h-2 rounded-full" style={{ background: BRANDS[p.brand].farve }} />{BRANDS[p.brand].navn}</span><span className="flex items-center gap-4"><span className="num">{fmtTal(p.velocity, 1)} stk/dag</span><span className="num">{fmtTal(p.ecom)} på lokation</span><span className="num font-bold w-16 text-right">{p.dage === null ? "180+" : p.dage} d</span><StatusChip status={p.status} small /></span></Link></li>)}
            </ul>
          </section>
        ))}
      </div>
    </Shell>
  );
}
