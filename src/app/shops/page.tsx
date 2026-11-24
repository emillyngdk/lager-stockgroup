import Link from "next/link";
import { Shell } from "@/components/shell";
import { BigNumber, StatusChip, Dage } from "@/components/ui";
import { getForecast, fmtDato, fmtTal } from "@/lib/data";
import { BRANDS, STATUS_META, type Brand, type Status } from "@/lib/forecast/types";

export const dynamic = "force-static";

export default function Forside() {
  const f = getForecast();
  const o = f.opsummering;
  const brands = Object.keys(BRANDS) as Brand[];
  const forslagLinjer = f.forslag.reduce((a, l) => a + l.linjer.length, 0);
  const top = (b: Brand) => f.rows.filter((r) => r.brand === b && ["udsolgt", "kritisk", "bestil_nu"].includes(r.status) && r.velocity.base > 0.5)
    .sort((x, y) => (x.dage.tilUdsolgtMedPaaVej ?? 9999) - (y.dage.tilUdsolgtMedPaaVej ?? 9999)).slice(0, 3);
  const univ = f.universelle.filter((u) => ["udsolgt", "kritisk", "bestil_nu"].includes(u.status)).slice(0, 3);

  return (
    <Shell active="shops">
      <header className="mb-6 md:mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl md:text-6xl">Shops – dagens overblik</h1>
          <p className="mt-3 text-sm md:text-base font-medium text-[var(--muted)]">{(() => { const d = new Date(f.dag0 + "T12:00:00").toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" }); return d.charAt(0).toUpperCase() + d.slice(1); })()} · {fmtTal(f.rows.length)} varer forecastet på tværs af fire shops</p>
        </div>
        <Link href="/forslag" className="card !bg-[var(--ink)] text-white px-5 py-4 flex items-center gap-4">
          <span className="display num text-4xl">{forslagLinjer}</span>
          <span className="text-sm font-semibold leading-tight text-white/85">linjer i<br />ugens forslag →</span>
        </Link>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        <BigNumber label="Udsolgt" value={o.udsolgt} sub="0 tilgængeligt lige nu" href="/fane/udsolgt" color={STATUS_META.udsolgt.farve} />
        <BigNumber label="Kritisk" value={o.kritisk} sub="Tør før næste levering" href="/fane/kritisk" color={STATUS_META.kritisk.farve} />
        <BigNumber label="Bestil nu" value={o.bestil_nu} sub="PO afsted inden 14 dage" href="/fane/bestil-nu" color={STATUS_META.bestil_nu.farve} />
        <BigNumber label="OBS" value={o.obs} sub="Hold øje de næste 45 dage" href="/fane/obs" color="#b58900" />
      </section>

      <section className="grid md:grid-cols-2 xl:grid-cols-5 gap-3 md:gap-4 mb-8">
        {brands.map((b) => {
          const s = f.prBrand[b];
          const t = top(b);
          return (
            <div key={b} className="card p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-extrabold text-lg flex items-center gap-2"><i className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: BRANDS[b].farve }} />{BRANDS[b].navn}</h2>
                <span className="text-[.65rem] font-bold uppercase tracking-wider text-[var(--muted)]">{BRANDS[b].land}</span>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(["udsolgt", "kritisk", "bestil_nu", "obs", "ok"] as Status[]).map((st) => (
                  <Link key={st} href={`/fane/${st.replace("_", "-")}?brand=${b}`} className="chip !text-[.6rem]" style={{ background: s[st] ? STATUS_META[st].farve : "#eeeae2", color: s[st] ? STATUS_META[st].tekst : "#8a8a8a" }}>{STATUS_META[st].label} {s[st]}</Link>
                ))}
              </div>
              <ul className="flex flex-col divide-y divide-[var(--line)]">
                {t.length === 0 && <li className="py-2 text-sm font-semibold text-[var(--ok)]">Intet brænder lige nu 🎉</li>}
                {t.map((r) => (
                  <li key={r.key}><Link href={`/vare/${encodeURIComponent(r.key)}`} className="py-2 flex items-center justify-between gap-3">
                    <span className="min-w-0"><span className="block text-sm font-semibold truncate">{r.titel}</span><span className="text-[.65rem] text-[var(--muted)] num">{fmtTal(r.velocity.base, 1)} stk/dag · {fmtTal(r.lager.tilgaengeligt)} tilg.</span></span>
                    <span className="text-right shrink-0"><Dage n={r.dage.tilUdsolgtMedPaaVej} /><span className="block text-[.55rem] font-bold uppercase text-[var(--muted)]">dage</span></span>
                  </Link></li>
                ))}
              </ul>
            </div>
          );
        })}
        <div className="card p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between"><h2 className="font-extrabold text-lg">Universelle</h2><Link href="/universelle" className="text-xs font-bold text-[var(--overlager)]">Alle {f.universelle.length} →</Link></div>
          <p className="text-xs text-[var(--muted)] font-medium">Samme EAN i flere shops – trækker på den fælles pulje i Vejle.</p>
          <ul className="flex flex-col divide-y divide-[var(--line)]">
            {univ.length === 0 && <li className="py-2 text-sm font-semibold text-[var(--ok)]">Alle universelle er dækket</li>}
            {univ.map((u) => (
              <li key={u.ean} className="py-2 flex items-center justify-between gap-3">
                <span className="min-w-0"><span className="block text-sm font-semibold truncate">{u.titel}</span><span className="text-[.65rem] text-[var(--muted)] num">{u.brands.map((b) => BRANDS[b].kort).join(" + ")} · {fmtTal(u.velocitySum, 1)} stk/dag</span></span>
                <StatusChip status={u.status} small />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-3 md:gap-4">
        <div className="card p-5">
          <p className="text-[.7rem] font-bold uppercase tracking-widest text-[var(--muted)]">Datakilder</p>
          <ul className="mt-2 text-sm font-medium flex flex-col gap-1">
            <li>BC lager og PO'er: <span className="num font-bold">{f.kilder.bc_laest ?? "–"}</span></li>
            <li>Shopify-lager: <span className="num font-bold">{fmtDato(f.kilder.shopify_hentet)}</span></li>
            <li>Salg: Jullytics 7/30/60 dage</li>
            <li>Sæson: {f.saeson.kilde}</li>
          </ul>
        </div>
        <div className="card p-5">
          <p className="text-[.7rem] font-bold uppercase tracking-widest text-[var(--muted)]">Resten af sortimentet</p>
          <ul className="mt-2 text-sm font-medium flex flex-col gap-1">
            <li><Link href="/fane/ok" className="flex justify-between"><span>OK</span><b className="num">{o.ok}</b></Link></li>
            <li><Link href="/fane/overlager" className="flex justify-between"><span>Overlager</span><b className="num">{o.overlager}</b></Link></li>
            <li><Link href="/fane/nyheder" className="flex justify-between"><span>Nyheder (under 14 dage)</span><b className="num">{o.for_nyt}</b></Link></li>
            <li><Link href="/uden-kobling" className="flex justify-between"><span>Uden kobling til BC</span><b className="num">{f.udenKobling.length}</b></Link></li>
          </ul>
        </div>
        <div className="card p-5">
          <p className="text-[.7rem] font-bold uppercase tracking-widest text-[var(--muted)]">Sådan læser du tallene</p>
          <p className="mt-2 text-sm font-medium leading-relaxed">“Dage til udsolgt” regner med det der er på lager plus bekræftede leveringer. “Bestil senest” er dagen hvor en ny PO skal afsted, givet lead time og det der allerede er bestilt – også det der ikke er booket endnu. <Link href="/om" className="font-bold underline">Hele regnestykket →</Link></p>
        </div>
      </section>
    </Shell>
  );
}
