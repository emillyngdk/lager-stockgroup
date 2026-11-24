import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { StatusChip, BrandChip, TrendArrow } from "@/components/ui";
import { ProjectionChart } from "@/components/projection-chart";
import { getForecast, getRow, fmtDato, fmtTal } from "@/lib/data";
import { BRANDS } from "@/lib/forecast/types";

export const dynamic = "force-static";
export const dynamicParams = false;
export function generateStaticParams() { return getForecast().rows.map((r) => ({ key: r.key })); }

function Big({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return <div className="card p-4 md:p-5"><p className="text-[.65rem] font-bold uppercase tracking-widest text-[var(--muted)]">{label}</p><p className="display num text-3xl md:text-4xl mt-1" style={{ color }}>{value}</p>{sub && <p className="text-xs font-medium text-[var(--muted)] mt-1">{sub}</p>}</div>;
}

export default async function Vare({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const r = getRow(decodeURIComponent(key));
  if (!r) notFound();
  const f = getForecast();
  const dK = r.dage.tilUdsolgtMedPaaVej;
  const colorDays = dK === null ? "var(--ok)" : dK <= 14 ? "var(--kritisk)" : dK <= 45 ? "var(--bestil)" : "var(--ok)";
  const pools = [
    { l: `${BRANDS[r.brand].navn}s e-com-lokation`, v: r.lager.ecom, c: "#141414" },
    { l: `Frit i ${r.lager.bcLokation ?? "Vejle"}${r.lager.andel < 1 ? ` (din andel ${Math.round(r.lager.andel * 100)} %)` : ""}`, v: r.lager.vejleFrit, c: "#1e9e5a" },
    { l: "Heraf reserveret til Shop Group", v: r.lager.reserveretShopGroup, c: "#5b6cff", info: true },
    { l: "Reserveret til B2B (fx Coop)", v: r.lager.reserveretB2b, c: "#8a8a8a", info: true },
    { l: "Bestilt af B2B, ikke sendt", v: r.lager.bestiltB2b, c: "#c9c4b8", info: true },
    { l: "På vej – bekræftet", v: r.paaVej.sikker, c: "#f5820d" },
    { l: "På vej – bestilt, ikke booket", v: r.paaVej.usikker, c: "#f2b705" },
  ];
  const sibling = f.rows.filter((x) => x.ean === r.ean && x.key !== r.key);
  const bestilNu = r.datoer.bestilSenest && r.datoer.bestilSenest <= r.projektion.dag0;
  return (
    <Shell active="">
      <div className="mb-5">
        <Link href={`/fane/${r.status.replace("_", "-")}`} className="text-xs font-bold text-[var(--muted)]">← Tilbage</Link>
        <div className="flex flex-wrap items-center gap-3 mt-2"><StatusChip status={r.status} /><BrandChip brand={r.brand} />{r.universel && <span className="text-[.65rem] font-bold uppercase tracking-wide text-[var(--overlager)]">Universel</span>}{r.genbestilling.hero && <span className="text-[.65rem] font-bold uppercase tracking-wide text-[var(--bestil)]">Hero-produkt</span>}</div>
        <h1 className="display text-3xl md:text-5xl mt-2">{r.titel}</h1>
        <p className="mt-2 text-sm font-medium text-[var(--muted)] num">EAN {r.ean} · BC {r.bc_sku ?? "–"} · {r.product_type || "–"} · {r.alder.dage} dage i salg ({r.alder.gruppe}) · {r.leverandoer ?? "leverandør ukendt"}</p>
        <p className="mt-2 text-base font-semibold">{r.statusAarsag}.</p>
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <Big label="Dage til udsolgt" value={dK === null ? "180+" : fmtTal(dK)} sub={`uden leveringer: ${r.dage.tilUdsolgt === null ? "400+" : fmtTal(r.dage.tilUdsolgt)} dage`} color={colorDays} />
        <Big label="Udsolgt-dato" value={fmtDato(r.datoer.udsolgtMedPaaVej)} sub={`optimistisk: ${fmtDato(r.datoer.udsolgtOptimistisk)}`} />
        <Big label="Bestil senest" value={bestilNu ? "Nu" : fmtDato(r.datoer.bestilSenest)} sub={`lead time ${r.genbestilling.leadTime} dage`} color={bestilNu ? "var(--kritisk)" : undefined} />
        <Big label="Foreslået mængde" value={r.genbestilling.foreslaaetStk > 0 ? fmtTal(r.genbestilling.foreslaaetStk) : "–"} sub={r.genbestilling.foreslaaetStk > 0 ? `${r.genbestilling.foreslaaetColli} colli à ${r.genbestilling.stkPrColli ?? "?"} · ${r.genbestilling.daekningsdage} dages dækning` : "intet behov ud over det bestilte"} />
      </section>

      <section className="card p-5 md:p-6 mb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 className="font-extrabold text-lg">Lagerkurve 180 dage</h2>
          <p className="text-xs font-semibold text-[var(--muted)]"><span className="inline-block w-3 h-0.5 bg-[#141414] align-middle mr-1" />Med bekræftede leveringer <span className="inline-block w-3 h-0.5 bg-[#5b6cff] align-middle ml-3 mr-1" />Med alle åbne PO'er <span className="inline-block w-3 h-0.5 bg-[#e5322d] align-middle ml-3 mr-1" />Reorder point</p>
        </div>
        <ProjectionChart row={r} />
      </section>

      <section className="grid md:grid-cols-2 gap-4 md:gap-5 mb-6">
        <div className="card p-5 md:p-6">
          <h2 className="font-extrabold text-lg mb-3">Lagerpuljer</h2>
          <div className="flex h-4 rounded-full overflow-hidden bg-[#eeeae2] mb-4">
            {pools.filter((p) => !p.info && p.v > 0).map((p) => <i key={p.l} style={{ width: `${(p.v / Math.max(1, pools.filter((q) => !q.info).reduce((a, q) => a + q.v, 0))) * 100}%`, background: p.c }} title={p.l} />)}
          </div>
          <ul className="flex flex-col gap-2 text-sm">
            {pools.map((p) => <li key={p.l} className={`flex items-center justify-between gap-3 ${p.info ? "text-[var(--muted)] pl-4" : "font-semibold"}`}><span className="flex items-center gap-2 min-w-0"><i className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: p.c }} /><span className="truncate">{p.l}</span></span><span className="num">{fmtTal(p.v)}</span></li>)}
          </ul>
          <p className="mt-4 pt-3 border-t border-[var(--line)] flex justify-between font-extrabold"><span>Tilgængeligt til e-com nu</span><span className="num">{fmtTal(r.lager.tilgaengeligt)}</span></p>
        </div>
        <div className="card p-5 md:p-6">
          <h2 className="font-extrabold text-lg mb-3">Salgshastighed</h2>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[["7 dage", r.velocity.v7], ["14 dage", r.velocity.v14], ["30 dage", r.velocity.v30], ["60 dage", r.velocity.v60]].map(([l, v]) => <div key={l as string} className="rounded-xl bg-[var(--bg)] p-3"><p className="display num text-2xl">{fmtTal(v as number, 1)}</p><p className="text-[.6rem] font-bold uppercase text-[var(--muted)]">{l}</p></div>)}
          </div>
          <ul className="mt-4 text-sm flex flex-col gap-1.5 font-medium">
            <li className="flex justify-between"><span>Vægtet nu</span><b className="num">{fmtTal(r.velocity.base, 1)} stk/dag</b></li>
            <li className="flex justify-between"><span>Normalt niveau (afsæsonaliseret)</span><b className="num">{fmtTal(r.velocity.afsaeson, 1)} stk/dag</b></li>
            <li className="flex justify-between"><span>Sæson denne uge</span><b className="num">{Math.round(r.velocity.saesonNu * 100)} %</b></li>
            <li className="flex justify-between"><span>Trend (14 vs 60 dage, sæsonjusteret)</span><TrendArrow trend={r.velocity.trend} /></li>
            {r.oekonomi.nyeKunder != null && <li className="flex justify-between"><span>Købt af nye kunder</span><b className="num">{Math.round(r.oekonomi.nyeKunder * 100)} %</b></li>}
            {r.oekonomi.dbPrStk != null && <li className="flex justify-between"><span>DB pr. stk (DKK)</span><b className="num">{fmtTal(r.oekonomi.dbPrStk)}</b></li>}
          </ul>
        </div>
      </section>

      <section className="card p-5 md:p-6 mb-6">
        <details open>
          <summary className="font-extrabold text-lg cursor-pointer">Sådan er det regnet</summary>
          <ol className="mt-3 flex flex-col gap-2 text-sm font-medium list-decimal pl-5">{r.forklaring.map((t, i) => <li key={i}>{t}</li>)}</ol>
          <p className="mt-3 text-xs text-[var(--muted)]">Sæsonindeks: {r.velocity.saesonKilde}. Sikkerhedslager: z {r.genbestilling.z} × σ {r.genbestilling.sigma} × √{r.genbestilling.leadTime}.</p>
        </details>
      </section>

      {r.paaVej.events.length > 0 && (
        <section className="card p-5 md:p-6 mb-6">
          <h2 className="font-extrabold text-lg mb-3">Åbne indkøbsordrer</h2>
          <div className="scroll-x"><table className="w-full text-sm">
            <thead><tr className="text-left text-[.65rem] uppercase tracking-wider text-[var(--muted)]"><th className="py-2 pr-3">PO</th><th className="py-2 pr-3">Salgbar fra</th><th className="py-2 pr-3 text-right">Stk{r.lager.andel < 1 ? " (din andel)" : ""}</th><th className="py-2 pr-3">Status</th><th className="py-2">Leverandør</th></tr></thead>
            <tbody>{r.paaVej.events.map((e, i) => <tr key={i} className="border-t border-[var(--line)]"><td className="py-2 pr-3 num font-bold">{e.po}</td><td className="py-2 pr-3 num">{fmtDato(e.dato)}</td><td className="py-2 pr-3 num text-right font-semibold">{fmtTal(e.stk)}</td><td className="py-2 pr-3"><span className="chip !text-[.6rem]" style={{ background: e.sikker ? "#1e9e5a" : "#f2b705", color: e.sikker ? "#fff" : "#141414" }}>{e.status}</span></td><td className="py-2 text-[var(--muted)]">{e.leverandoer ?? "–"}</td></tr>)}</tbody>
          </table></div>
        </section>
      )}

      {sibling.length > 0 && (
        <section className="card p-5 md:p-6">
          <h2 className="font-extrabold text-lg mb-1">Samme vare i andre shops</h2>
          <p className="text-xs text-[var(--muted)] mb-3">Deler den fælles pulje i Vejle. Fordeling efter salgshastighed.</p>
          <ul className="divide-y divide-[var(--line)]">{sibling.map((s) => <li key={s.key}><Link href={`/vare/${encodeURIComponent(s.key)}`} className="py-2 flex items-center justify-between gap-3"><span className="flex items-center gap-3 min-w-0"><BrandChip brand={s.brand} /><span className="text-sm font-semibold truncate">{s.titel}</span></span><span className="flex items-center gap-3 shrink-0"><span className="num text-sm">{fmtTal(s.velocity.base, 1)} stk/dag</span><StatusChip status={s.status} small /></span></Link></li>)}</ul>
        </section>
      )}
    </Shell>
  );
}
