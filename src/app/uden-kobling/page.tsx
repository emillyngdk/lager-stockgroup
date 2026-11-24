import { Shell } from "@/components/shell";
import { BrandChip } from "@/components/ui";
import { getForecast, fmtTal } from "@/lib/data";

export const dynamic = "force-static";

export default function UdenKobling() {
  const f = getForecast();
  const list = f.udenKobling.slice().sort((a, b) => b.solgt30 - a.solgt30);
  const pakker = list.filter((x) => !x.sku), andre = list.filter((x) => x.sku);
  const Tabel = ({ rows }: { rows: typeof list }) => (
    <div className="card scroll-x"><table className="w-full text-sm">
      <thead><tr className="text-left text-[.65rem] uppercase tracking-wider text-[var(--muted)]"><th className="px-4 py-3">Vare</th><th className="px-3 py-3">SKU i Shopify</th><th className="px-3 py-3 text-right">Solgt 30 dage</th><th className="px-4 py-3">Hvorfor</th></tr></thead>
      <tbody>{rows.map((x) => <tr key={`${x.brand}:${x.variant_id}`} className="border-t border-[var(--line)]"><td className="px-4 py-2.5"><span className="block font-semibold">{x.titel}</span><BrandChip brand={x.brand} /></td><td className="px-3 py-2.5 num text-[var(--muted)]">{x.sku ?? "–"}</td><td className="px-3 py-2.5 num font-bold text-right">{fmtTal(x.solgt30)}</td><td className="px-4 py-2.5 text-xs text-[var(--muted)]">{x.grund}</td></tr>)}</tbody>
    </table></div>
  );
  return (
    <Shell active="uden-kobling" title="Uden kobling" intro="Shopify-varianter uden et EAN der findes i BC. Pakker og bundles sælger komponenter, som forecasten ikke kan se – ret SKU'en i Shopify til “EAN+EAN”, så tæller salget med på komponenterne.">
      <h2 className="font-extrabold text-lg mb-2">Varer med SKU der ikke er et EAN <span className="num text-sm text-[var(--muted)]">({andre.length})</span></h2>
      <div className="mb-6"><Tabel rows={andre} /></div>
      <h2 className="font-extrabold text-lg mb-2">Pakker og bundles uden SKU <span className="num text-sm text-[var(--muted)]">({pakker.length})</span></h2>
      <Tabel rows={pakker} />
    </Shell>
  );
}
