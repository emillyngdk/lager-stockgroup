import { Suspense } from "react";
import Link from "next/link";
import { Shell } from "@/components/shell";
import { LineTable } from "@/components/line-table";
import { getForecast, liteLine } from "@/lib/data";

export const dynamic = "force-static";

export default function Indkoeb() {
  const f = getForecast();
  const lines = f.linjer.map(liteLine);
  const d = new Date(f.dag0 + "T12:00:00").toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" });
  return (
    <Shell active="indkoeb">
      <header className="mb-6 md:mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl md:text-6xl">Skal bestilles</h1>
          <p className="mt-3 text-sm md:text-base font-medium text-[var(--muted)]">{d.charAt(0).toUpperCase() + d.slice(1)} · hver linje er en opgave – tryk <b className="text-[var(--ink)]">✓ PO oprettet</b> når den er bestilt. Målet er 0.</p>
        </div>
        <Link href="/forslag" className="card !bg-[var(--ink)] text-white px-5 py-4 text-sm font-bold">Arbejd pr. leverandør →</Link>
      </header>
      <Suspense fallback={<div className="card p-8 text-center font-semibold text-[var(--muted)]">Indlæser…</div>}>
        <LineTable lines={lines} kort />
      </Suspense>
    </Shell>
  );
}
