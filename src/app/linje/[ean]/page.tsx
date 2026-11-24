import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { StatusChip, TrendArrow, Dage } from "@/components/ui";
import { LineStatusChip, ShopDots } from "@/components/line-table";
import { LineDetail } from "@/components/line-detail";
import { getForecast, getLine, fmtDato, fmtTal } from "@/lib/data";
import { BRANDS } from "@/lib/forecast/types";

export const dynamicParams = false;
export function generateStaticParams() { return getForecast().linjer.map((l) => ({ ean: l.ean })); }

function Big({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return <div className="card p-4 md:p-5"><p className="text-[.65rem] font-bold uppercase tracking-widest text-[var(--muted)]">{label}</p><p className="display num text-3xl md:text-4xl mt-1 break-words" style={{ color }}>{value}</p>{sub && <p className="text-xs text-[var(--muted)] font-medium mt-1">{sub}</p>}</div>;
}

export default async function LinjeSide({ params }: { params: Promise<{ ean: string }> }) {
  const { ean } = await params;
  const l = getLine(ean);
  if (!l) notFound();
  const f = getForecast();
  const dag0 = l.projektion.dag0;
  const g = l.genbestilling;
  const nu = l.datoer.bestilSenest !== null && l.datoer.bestilSenest <= dag0;
  const pool = [
    { l: "På shop-lokationer", v: l.lager.ecomSum, c: "#141414" },
    { l: "Frit i Vejle (NONFOOD)", v: l.lager.vejleFrit, c: "#1e9e5a" },
    ...(l.lager.tredjepart ? [{ l: "Overskud på 3PL", v: l.lager.tredjepart, c: "#5b6cff" }] : []),
    { l: "På vej – bekræftet", v: l.paaVej.sikker, c: "#f5820d" },
    { l: "På vej – ubooket", v: l.paaVej.usikker, c: "#f2b705" },
  ];
  const total = Math.max(1, pool.reduce((a, p) => a + p.v, 0));
  return (
    <Shell active="indkoeb">
      <Link href="/" className="text-sm font-bold text-[var(--muted)] hover:text-[var(--ink)]">← Indkøb</Link>
      <header className="mt-3 mb-6">
        <div className="flex flex-wrap items-center gap-2"><LineStatusChip status={l.status} /><ShopDots shops={l.shops} withText />{l.hero && <span className="chip !bg-[#fff3e0] !text-[var(--bestil)]">Hero-produkt</span>}</div>
        <h1 className="display text-3xl md:text-5xl mt-2">{l.titel}</h1>
        {l.shopTitler.filter((t) => t !== l.titel).length > 0 && <p className="mt-1 text-sm font-semibold text-[var(--muted)]">I shoppene: {l.shopTitler.filter((t) => t !== l.titel).join(" · ")}</p>}
        <p className="mt-2 text-sm font-medium text-[var(--muted)] num">EAN {l.ean} · BC {l.bcSku ?? "–"} · {l.leverandoer ?? "leverandør ukendt"} · lead time {g.leadTime} dage ({g.leadTimeKilde}) · <span style={{ color: l.velocity.salgsdage < 90 ? "var(--bestil)" : undefined, fontWeight: l.velocity.salgsdage < 90 ? 700 : undefined }}>salgsdata {Math.min(365, l.velocity.salgsdage)} dage</span></p>
        <p className="mt-2 font-semibold">{l.statusAarsag}</p>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <Big label="Bestil senest" value={l.datoer.bestilSenest === null ? "–" : nu ? "NU" : fmtDato(l.datoer.bestilSenest)} sub={nu ? `reorder point ${fmtTal(g.reorderPoint)} stk er nået` : l.dage.bestilSenest !== null ? `om ${l.dage.bestilSenest} dage` : "ikke inden for horisonten"} color={nu ? "var(--kritisk)" : undefined} />
        <Big label="Foreslået mængde" value={g.foreslaaetStk > 0 ? fmtTal(g.foreslaaetStk) : "–"} sub={g.foreslaaetStk > 0 ? `${g.foreslaaetColli ? `${g.foreslaaetColli} colli à ${g.stkPrColli} · ` : ""}${g.daekningsdage} dages dækning efter lead time` : "intet behov ud over det bestilte"} />
        <Big label="Rækker til" value={g.foreslaaetStk > 0 && l.datoer.raekkerTil ? fmtDato(l.datoer.raekkerTil) : g.foreslaaetStk > 0 ? "2 år+" : "–"} sub={g.raekkerDage != null ? `${g.raekkerDage} dage efter modtagelse` : undefined} />
        <Big label="Tør samlet" value={l.dage.medPaaVej === null ? "180+" : `${l.dage.medPaaVej} d`} sub={l.datoer.medPaaVej ? `${fmtDato(l.datoer.medPaaVej)} med bekræftede leveringer` : "ikke inden for horisonten"} color={l.dage.medPaaVej !== null && l.dage.medPaaVej <= 14 ? "var(--kritisk)" : undefined} />
      </section>

      <LineDetail line={l} receivingDays={f.config.receivingDays} />

      <section className="card p-5 md:p-6 mt-6">
        <h2 className="font-extrabold text-lg mb-3">Pr. shop</h2>
        <div className="scroll-x"><table className="w-full text-sm">
          <thead><tr className="text-left text-[.65rem] uppercase tracking-wider text-[var(--muted)]"><th className="py-2 pr-3">Shop</th><th className="py-2 pr-3 text-right">Stk/dag</th><th className="py-2 pr-3 text-right">På lokation</th><th className="py-2 pr-3 text-right">Tør om</th><th className="py-2 pr-3 text-right">Andel af behov</th><th className="py-2 pr-3 text-right">Forslag til overflytning</th><th className="py-2">Status</th></tr></thead>
          <tbody>{l.shops.map((s) => {
            const f1 = l.fordeling.find((x) => x.brand === s.brand);
            return <tr key={s.key} className="border-t border-[var(--line)]">
              <td className="py-2.5 pr-3"><Link href={`/vare/${encodeURIComponent(s.key)}`} className="flex items-center gap-2 font-semibold"><i className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: BRANDS[s.brand].farve }} />{BRANDS[s.brand].navn}<span className="text-xs font-medium text-[var(--muted)] truncate max-w-[260px]">{s.titel}</span>{s.hero && <span className="text-[.6rem] font-bold tracking-wider text-[var(--bestil)]">HERO</span>}</Link></td>
              <td className="py-2.5 pr-3 text-right num font-semibold whitespace-nowrap">{fmtTal(s.velocity, 1)} <TrendArrow trend={s.trend} /></td>
              <td className="py-2.5 pr-3 text-right num">{fmtTal(s.ecom)}</td>
              <td className="py-2.5 pr-3 text-right"><Dage n={s.dageTilUdsolgt} /></td>
              <td className="py-2.5 pr-3 text-right num">{Math.round(s.andelAfBehov * 100)} %</td>
              <td className="py-2.5 pr-3 text-right num font-bold">{f1 ? fmtTal(f1.stk) : "–"}</td>
              <td className="py-2.5"><StatusChip status={s.status} small /></td>
            </tr>;
          })}</tbody>
        </table></div>
        <p className="text-xs text-[var(--muted)] mt-2">Shop-status er e-com's egen vurdering (udsolgt/kritisk på lokationen). Klik på shoppen for dens produktside og overflytning fra Vejle.</p>
      </section>

      <section className="grid lg:grid-cols-2 gap-4 mt-6">
        <div className="card p-5 md:p-6">
          <h2 className="font-extrabold text-lg mb-3">Lagerpuljer for hele EAN'et</h2>
          <div className="flex h-3 rounded-full overflow-hidden bg-[#eeeae2]">{pool.map((p) => p.v > 0 && <i key={p.l} style={{ width: `${(p.v / total) * 100}%`, background: p.c }} />)}</div>
          <ul className="mt-3 text-sm font-medium flex flex-col gap-1.5">
            {pool.map((p) => <li key={p.l} className="flex justify-between"><span className="flex items-center gap-2"><i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: p.c }} />{p.l}</span><b className="num">{fmtTal(p.v)}</b></li>)}
            <li className="flex justify-between pl-4 text-[var(--muted)]"><span>Heraf reserveret til Shop Group</span><span className="num">{fmtTal(l.lager.reserveretShopGroup)}</span></li>
            <li className="flex justify-between pl-4 text-[var(--muted)]"><span>Reserveret til B2B (fx Coop)</span><span className="num">{fmtTal(l.lager.reserveretB2b)}</span></li>
            <li className="flex justify-between pl-4 text-[var(--muted)]"><span>Bestilt af B2B, ikke sendt</span><span className="num">{fmtTal(l.lager.bestiltB2b)}</span></li>
            {Object.entries(l.lager.prLokation).map(([lok, v]) => <li key={lok} className="flex justify-between pl-4 text-[var(--muted)]"><span>BC-lager {lok}</span><span className="num">{fmtTal(v)}</span></li>)}
            <li className="flex justify-between border-t border-[var(--line)] pt-2 mt-1 font-bold"><span>Tilgængeligt nu (alle shops)</span><span className="num">{fmtTal(l.lager.tilgaengeligt)}</span></li>
          </ul>
        </div>
        <div className="card p-5 md:p-6">
          <h2 className="font-extrabold text-lg mb-3">Åbne indkøbsordrer</h2>
          {l.paaVej.events.length === 0 ? <p className="text-sm font-medium text-[var(--muted)]">Ingen åbne PO-linjer for EAN'et.</p> : (
            <table className="w-full text-sm"><thead><tr className="text-left text-[.65rem] uppercase tracking-wider text-[var(--muted)]"><th className="py-2 pr-3">PO</th><th className="py-2 pr-3">Salgbar fra</th><th className="py-2 pr-3 text-right">Stk</th><th className="py-2 pr-3">Lokation</th><th className="py-2">Status</th></tr></thead>
              <tbody>{l.paaVej.events.map((e, i) => <tr key={i} className="border-t border-[var(--line)]"><td className="py-2 pr-3 num font-bold">{e.po}</td><td className="py-2 pr-3 num">{fmtDato(e.dato)}</td><td className="py-2 pr-3 num text-right font-bold">{fmtTal(e.stk)}</td><td className="py-2 pr-3 text-xs">{e.lokation}</td><td className="py-2"><span className="chip !text-[.6rem]" style={{ background: e.sikker ? "#1e9e5a" : "#f2b705", color: e.sikker ? "#fff" : "#141414" }}>{e.status}</span></td></tr>)}</tbody></table>
          )}
          <h3 className="font-extrabold mt-5 mb-2">Salg</h3>
          <ul className="text-sm font-medium flex flex-col gap-1.5">
            <li className="flex justify-between"><span>Nu (alle shops)</span><b className="num">{fmtTal(l.velocity.base, 1)} stk/dag</b></li>
            <li className="flex justify-between"><span>Normalt niveau (afsæsonaliseret)</span><b className="num">{fmtTal(l.velocity.afsaeson, 1)} stk/dag</b></li>
            <li className="flex justify-between"><span>Trend</span><TrendArrow trend={l.velocity.trend} /></li>
            <li className="flex justify-between"><span>Salgsdata</span><b className="num" style={{ color: l.velocity.salgsdage < 90 ? "var(--bestil)" : undefined }}>{Math.min(365, l.velocity.salgsdage)} dage{l.velocity.salgsdage < 90 ? " · ny vare" : ""}</b></li>
            {l.velocity.solgt365 != null && <li className="flex justify-between"><span>Solgt i perioden ({Math.min(365, l.velocity.salgsdage)} dage)</span><b className="num">{fmtTal(l.velocity.solgt365)} stk{l.velocity.snitPrDag != null ? ` · ${fmtTal(l.velocity.snitPrDag, 1)} stk/dag i snit` : ""}</b></li>}
            <li className="flex justify-between"><span>Behov i lead time ({g.leadTime} d)</span><b className="num">{fmtTal(g.behovLeadTime)} stk</b></li>
            <li className="flex justify-between"><span>Behov i lead time + {g.daekningsdage} d dækning</span><b className="num">{fmtTal(g.behovDaekning)} stk</b></li>
            <li className="flex justify-between"><span>Sikkerhedslager (z {g.z}, σ {g.sigma})</span><b className="num">{fmtTal(g.sikkerhedslager)} stk</b></li>
            <li className="flex justify-between font-bold border-t border-[var(--line)] pt-2"><span>Reorder point</span><b className="num">{fmtTal(g.reorderPoint)} stk</b></li>
          </ul>
        </div>
      </section>

      <details className="card p-5 md:p-6 mt-6">
        <summary className="font-extrabold text-lg cursor-pointer">Sådan er det regnet</summary>
        <ol className="mt-3 text-sm font-medium list-decimal pl-5 flex flex-col gap-1.5">{l.forklaring.map((t, i) => <li key={i}>{t}</li>)}</ol>
        <p className="text-xs text-[var(--muted)] mt-3">Hele modellen: <Link href="/om" className="font-bold underline">Sådan regnes der</Link>.</p>
      </details>
    </Shell>
  );
}
