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
  const nyeMedDato = f.linjer.filter((l) => l.status === "for_nyt" && l.dage.bestilSenest != null && l.dage.bestilSenest <= 30).length;
  const bestil = o.bestil_nu + o.bestil_14 + o.bestil_30 + o.book_po + nyeMedDato;
  const stk = f.linjer.filter((l) => ["bestil_nu", "bestil_14", "bestil_30", "book_po"].includes(l.status)).reduce((a, l) => a + l.genbestilling.foreslaaetStk, 0);
  const d = new Date(f.dag0 + "T12:00:00").toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" });
  return (
    <Shell active="indkoeb">
      <header className="mb-6 md:mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl md:text-6xl">Skal bestilles</h1>
          <p className="mt-3 text-sm md:text-base font-medium text-[var(--muted)]">{d.charAt(0).toUpperCase() + d.slice(1)} · alt der skal afsted inden 30 dage, én linje pr. EAN · varer der er dækket vises ikke her</p>
        </div>
        <Link href="/forslag" className="card !bg-[var(--ink)] text-white px-5 py-4 flex items-center gap-4">
          <span className="display num text-4xl">{fmtTal(stk)}</span>
          <span className="text-sm font-semibold leading-tight text-white/85">stk i alt<br />se pr. leverandør →</span>
        </Link>
      </header>

      <section className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
        <BigNumber label="Skal bestilles" value={bestil} sub={`${o.bestil_nu} haster – bestil senest i dag`} href="/" color={LINE_STATUS_META.bestil_nu.farve} />
        <BigNumber label="Kun booking af PO" value={o.book_po} sub="Bestilt, men ikke booket – book eller fremryk" href="/?g=book" color="#b58900" />
        <BigNumber label="Planlagt / bestilt" value={o.planlagt + o.bestilt} sub="Planer gemt på sitet" href="/?g=plan" color={LINE_STATUS_META.planlagt.farve} />
      </section>

      <Suspense fallback={<div className="card p-8 text-center font-semibold text-[var(--muted)]">Indlæser…</div>}>
        <LineTable lines={lines} />
      </Suspense>
    </Shell>
  );
}
