import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { LineTable } from "@/components/line-table";
import { EmptyState } from "@/components/ui";
import { getForecast, FANER, liteLine } from "@/lib/data";

export const dynamic = "force-static";
export function generateStaticParams() { return FANER.map((t) => ({ slug: t.slug })); }

/** Shops-fanerne: én linje pr. EAN (aldrig samme vare fire gange). Fanen filtrerer på shoppenes e-com-status; hver shop vises som en brik på linjen. */
export default async function Fane({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const fane = FANER.find((t) => t.slug === slug);
  if (!fane) notFound();
  const f = getForecast();
  const lines = f.linjer.map(liteLine);
  const antal = fane.status ? lines.filter((l) => l.shops.some((s) => fane.status!.includes(s.status))).length : lines.length;
  return (
    <Shell active={slug} title={fane.label} intro={`${fane.beskrivelse} · ${antal} EAN${fane.status ? " – brikkerne viser hvilke shops det gælder og hvornår de tør" : ""}`}>
      {antal === 0 ? <EmptyState text={`Ingen varer i “${fane.label}” i dag`} /> : <Suspense><LineTable lines={lines} shopStatus={fane.status ?? []} /></Suspense>}
    </Shell>
  );
}
