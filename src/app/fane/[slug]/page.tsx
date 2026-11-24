import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { SkuTable } from "@/components/sku-table";
import { EmptyState } from "@/components/ui";
import { getForecast, FANER, lite } from "@/lib/data";

export const dynamic = "force-static";
export function generateStaticParams() { return FANER.map((t) => ({ slug: t.slug })); }

export default async function Fane({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const fane = FANER.find((t) => t.slug === slug);
  if (!fane) notFound();
  const f = getForecast();
  const rows = f.rows.filter((r) => !fane.status || fane.status.includes(r.status)).sort(fane.sort).map(lite);
  return (
    <Shell active={slug} title={fane.label} intro={fane.beskrivelse}>
      {rows.length === 0 ? <EmptyState text={`Ingen varer i “${fane.label}” i dag`} /> : <Suspense><SkuTable rows={rows} visStatus={!fane.status || fane.status.length > 1 || slug === "alle"} /></Suspense>}
    </Shell>
  );
}
