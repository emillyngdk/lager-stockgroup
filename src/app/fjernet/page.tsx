import Link from "next/link";
import { Shell } from "@/components/shell";
import { LineStatusChip, ShopDots } from "@/components/line-table";
import { getForecast, fmtDato, fmtTal } from "@/lib/data";

export const dynamic = "force-static";

export default function Fjernet() {
  const f = getForecast();
  const list = f.linjer.filter((l) => ["udgaar", "skjult", "ikke_indkoeb"].includes(l.status));
  return (
    <Shell active="fjernet" title="Fjernede varer" intro="Varer der er markeret udgår, skjult til en dato eller holdes af shoppen selv. De tæller ikke i forslag, mails eller nøgletal. Genindsæt dem fra linjesidens ⋯-menu.">
      {list.length === 0 ? <div className="card p-10 text-center font-bold text-[var(--muted)]">Ingen varer er fjernet.</div> : (
        <div className="card scroll-x"><table className="w-full text-sm">
          <thead><tr className="text-left text-[.65rem] uppercase tracking-wider text-[var(--muted)]"><th className="px-4 py-3">Vare</th><th className="px-3 py-3">Flag</th><th className="px-3 py-3">Af · dato</th><th className="px-3 py-3 text-right">Restlager</th><th className="px-3 py-3 text-right">Dage til tomt</th><th className="px-4 py-3">Note</th></tr></thead>
          <tbody>{list.map((l) => <tr key={l.ean} className="border-t border-[var(--line)]">
            <td className="px-4 py-2.5"><Link href={`/linje/${l.ean}`} className="font-bold">{l.titel}</Link><span className="flex items-center gap-2"><ShopDots shops={l.shops} withText /><span className="num text-[.65rem] text-[var(--muted)]">{l.ean}</span></span></td>
            <td className="px-3 py-2.5"><LineStatusChip status={l.status} small />{l.override?.skjul_til && <span className="block text-xs text-[var(--muted)] num">til {fmtDato(l.override.skjul_til)}</span>}</td>
            <td className="px-3 py-2.5 text-xs text-[var(--muted)]">{l.override?.af ?? "–"}{l.override?.dato ? ` · ${fmtDato(l.override.dato)}` : ""}</td>
            <td className="px-3 py-2.5 text-right num font-bold">{fmtTal(l.lager.tilgaengeligt)}</td>
            <td className="px-3 py-2.5 text-right num">{l.dage.tilUdsolgt === null ? "2 år+" : l.dage.tilUdsolgt}</td>
            <td className="px-4 py-2.5 text-xs text-[var(--muted)]">{l.override?.note ?? ""}</td>
          </tr>)}</tbody>
        </table></div>
      )}
    </Shell>
  );
}
