import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { ForslagListe, type ForslagLinje } from "@/components/forslag-liste";
import { getForecast } from "@/lib/data";
import { paaListen } from "@/lib/overlay";

export const dynamic = "force-static";

export default function Forslag() {
  const f = getForecast();
  // Alle linjer der kan mangle en PO (grundstatus på listen og et forslag > 0). Siden lægger det der er trykket ovenpå live.
  const linjer: ForslagLinje[] = f.linjer
    .filter((l) => paaListen(l.grundStatus ?? l.status, l.dage.bestilSenest) && (l.genbestilling.foreslaaetStk > 0 || l.plan))
    .map((l) => ({
      ean: l.ean, titel: l.titel, leverandoer: l.leverandoer, grund: l.grundStatus ?? l.status, bsDage: l.dage.bestilSenest, bestilSenest: l.datoer.bestilSenest,
      stk: l.genbestilling.foreslaaetStk, colli: l.genbestilling.foreslaaetColli, raekkerTil: l.datoer.raekkerTil, begrundelse: l.statusAarsag,
      poNumre: l.poNumre ?? [], paaVejStk: l.paaVej.sikker + l.paaVej.usikker, dataLav: l.dataKvalitet === "lav",
      shops: l.shops.map((s) => ({ brand: s.brand, dageTilUdsolgt: s.dageTilUdsolgt, status: s.status })),
    }));
  return (
    <Shell active="forslag" title="Pr. leverandør" intro="Opret PO'en i BC for én leverandør ad gangen, og tryk “PO oprettet” – så forsvinder varerne fra listen. Ses PO'en ikke i BC inden 7 dage, kommer de tilbage.">
      <div className="mb-4 flex gap-2 flex-wrap"><a href="/api/forslag.csv" className="rounded-xl bg-white font-bold px-4 py-2.5 text-sm border-2 border-[var(--line)]">Download forslag (CSV)</a><a href="/api/plan.csv" className="rounded-xl bg-white font-bold px-4 py-2.5 text-sm border-2 border-[var(--line)]">Download planer (CSV)</a></div>
      <Suspense><ForslagListe linjer={linjer} dag0={f.dag0} /></Suspense>
    </Shell>
  );
}
