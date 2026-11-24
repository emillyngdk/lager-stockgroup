import { Suspense } from "react";
import Link from "next/link";
import { Shell } from "@/components/shell";
import { BigNumber } from "@/components/ui";
import { LineTable } from "@/components/line-table";
import { getForecast, liteLine, fmtTal } from "@/lib/data";
import { LINE_STATUS_META } from "@/lib/forecast/purchase";

export const dynamic = "force-static";

export default function Indkoeb() {
  const f = getForecast();
  const o = f.opsummeringLinjer;
  const lines = f.linjer.map(liteLine);
  const stkNu = f.linjer.filter((l) => l.status === "bestil_nu").reduce((a, l) => a + l.genbestilling.foreslaaetStk, 0);
  const d = new Date(f.dag0 + "T12:00:00").toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" });
  return (
    <Shell active="indkoeb">
      <header className="mb-6 md:mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl md:text-6xl">Hvad skal bestilles?</h1>
          <p className="mt-3 text-sm md:text-base font-medium text-[var(--muted)]">{d.charAt(0).toUpperCase() + d.slice(1)} · {fmtTal(f.linjer.length)} indkøbslinjer på tværs af fire shops · én linje pr. EAN</p>
        </div>
        <Link href="/forslag" className="card !bg-[var(--ink)] text-white px-5 py-4 flex items-center gap-4">
          <span className="display num text-4xl">{fmtTal(stkNu)}</span>
          <span className="text-sm font-semibold leading-tight text-white/85">stk at bestille<br />nu · pr. leverandør →</span>
        </Link>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <BigNumber label="Bestil nu" value={o.bestil_nu} sub="Reorder point er nået" href="/?g=nu" color={LINE_STATUS_META.bestil_nu.farve} />
        <BigNumber label="Inden 14 dage" value={o.bestil_14} sub="PO skal afsted snart" href="/?g=14" color={LINE_STATUS_META.bestil_14.farve} />
        <BigNumber label="Inden 45 dage" value={o.bestil_45 + o.book_po} sub={`${o.book_po} kræver kun booking af PO`} href="/?g=45" color="#b58900" />
        <BigNumber label="Dækket" value={o.daekket + o.planlagt + o.bestilt} sub="Intet at gøre de næste 45 dage" href="/?g=daekket" color={LINE_STATUS_META.daekket.farve} />
      </section>

      <Suspense fallback={<div className="card p-8 text-center font-semibold text-[var(--muted)]">Indlæser…</div>}>
        <LineTable lines={lines} />
      </Suspense>
    </Shell>
  );
}
