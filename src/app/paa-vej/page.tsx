import Link from "next/link";
import { Shell } from "@/components/shell";
import { BrandChip } from "@/components/ui";
import { getForecast, fmtDato, fmtTal } from "@/lib/data";
import { isoWeek } from "@/lib/forecast/engine";

export const dynamic = "force-static";

export default function PaaVej() {
  const f = getForecast();
  type Ev = { dato: string; stk: number; sikker: boolean; po: string; status: string; leverandoer: string | null; key: string; titel: string; brand: typeof f.rows[0]["brand"]; velocity: number };
  const evs: Ev[] = [];
  for (const r of f.rows) for (const e of r.paaVej.events) evs.push({ ...e, key: r.key, titel: r.titel, brand: r.brand, velocity: r.velocity.base });
  evs.sort((a, b) => a.dato.localeCompare(b.dato));
  const weeks = new Map<string, Ev[]>();
  for (const e of evs) { const y = e.dato.slice(0, 4); const k = `${y}-W${String(isoWeek(e.dato)).padStart(2, "0")}`; (weeks.get(k) ?? weeks.set(k, []).get(k)!).push(e); }
  const sikker = evs.filter((e) => e.sikker).reduce((a, e) => a + e.stk, 0), usikker = evs.filter((e) => !e.sikker).reduce((a, e) => a + e.stk, 0);
  return (
    <Shell active="paa-vej" title="På vej" intro={`${fmtTal(sikker)} stk bekræftet og ${fmtTal(usikker)} stk bestilt men ikke booket – grupperet efter den uge varen er salgbar (levering + modtagelse).`}>
      <div className="flex flex-col gap-4">
        {[...weeks.entries()].map(([w, list]) => (
          <section key={w} className="card p-4 md:p-5">
            <h2 className="font-extrabold text-lg flex items-baseline gap-3">Uge {w.slice(6)} <span className="text-xs font-semibold text-[var(--muted)]">{w.slice(0, 4)} · {fmtTal(list.reduce((a, e) => a + e.stk, 0))} stk · {list.length} linjer</span></h2>
            <div className="scroll-x mt-2"><table className="w-full text-sm">
              <tbody>{list.map((e, i) => (
                <tr key={i} className="border-t border-[var(--line)]">
                  <td className="py-2 pr-3 max-w-[340px]"><Link href={`/vare/${encodeURIComponent(e.key)}`} className="block"><span className="block font-semibold truncate">{e.titel}</span><BrandChip brand={e.brand} /></Link></td>
                  <td className="py-2 pr-3 num whitespace-nowrap">{fmtDato(e.dato)}</td>
                  <td className="py-2 pr-3 num font-bold text-right">{fmtTal(e.stk)}</td>
                  <td className="py-2 pr-3"><span className="chip !text-[.6rem]" style={{ background: e.sikker ? "#1e9e5a" : e.status.includes("overskredet") ? "#e5322d" : "#f2b705", color: e.sikker || e.status.includes("overskredet") ? "#fff" : "#141414" }}>{e.status}</span></td>
                  <td className="py-2 pr-3 num text-[var(--muted)] whitespace-nowrap">PO {e.po}</td>
                  <td className="py-2 text-[var(--muted)] truncate max-w-[200px] hidden md:table-cell">{e.leverandoer ?? "–"}</td>
                </tr>))}</tbody>
            </table></div>
          </section>
        ))}
      </div>
    </Shell>
  );
}
