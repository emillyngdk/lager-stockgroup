import Link from "next/link";
import { getForecast, FANER } from "@/lib/data";
import type { Status } from "@/lib/forecast/types";
import { STATUS_META } from "@/lib/forecast/types";

const EXTRA = [
  { slug: "paa-vej", label: "På vej" },
  { slug: "universelle", label: "Universelle" },
  { slug: "forslag", label: "Ugens forslag" },
  { slug: "uden-kobling", label: "Uden kobling" },
  { slug: "om", label: "Sådan regnes der" },
];

function NavItem({ href, label, count, color, active }: { href: string; label: string; count?: number; color?: string; active: boolean }) {
  return (
    <Link href={href} className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap ${active ? "bg-[var(--ink)] text-white" : "hover:bg-white"}`}>
      <span className="flex items-center gap-2">{color && <i className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />}{label}</span>
      {count !== undefined && <span className={`num text-xs font-bold rounded-full px-2 py-0.5 ${active ? "bg-white/20" : "bg-[#eeeae2]"}`}>{count}</span>}
    </Link>
  );
}

export function Shell({ children, active, title, intro }: { children: React.ReactNode; active: string; title?: string; intro?: string }) {
  const f = getForecast();
  const koert = new Date(f.kørt);
  const ageH = (Date.now() - koert.getTime()) / 36e5;
  const stale = ageH > 30;
  const nav = (
    <>
      <NavItem href="/" label="Forside" active={active === "forside"} />
      {FANER.map((t) => {
        const count = t.status ? t.status.reduce((a, s) => a + f.opsummering[s as Status], 0) : f.rows.length;
        return <NavItem key={t.slug} href={`/fane/${t.slug}`} label={t.label} count={count} color={t.status ? STATUS_META[t.status[0]].farve : undefined} active={active === t.slug} />;
      })}
      <div className="h-px bg-[var(--line)] my-2 hidden md:block" />
      {EXTRA.map((t) => <NavItem key={t.slug} href={`/${t.slug}`} label={t.label} count={t.slug === "uden-kobling" ? f.udenKobling.length : t.slug === "universelle" ? f.universelle.length : t.slug === "forslag" ? f.forslag.reduce((a, l) => a + l.linjer.length, 0) : undefined} active={active === t.slug} />)}
    </>
  );
  return (
    <div className="min-h-screen">
      {stale && (
        <div className="bg-[var(--kritisk)] text-white text-sm font-bold text-center py-2 px-4">
          Tallene er {Math.round(ageH)} timer gamle – den daglige opdatering er ikke kørt. Sidst kørt {koert.toLocaleString("da-DK", { timeZone: "Europe/Copenhagen" })}.
        </div>
      )}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-4 md:py-6 md:grid md:grid-cols-[220px_1fr] md:gap-8">
        <aside className="md:sticky md:top-6 md:self-start">
          <Link href="/" className="block mb-4 md:mb-6">
            <p className="text-[.65rem] font-bold uppercase tracking-widest text-[var(--muted)]">Stock Group · Shop Group</p>
            <p className="display text-3xl">Lager</p>
          </Link>
          <nav className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0">{nav}</nav>
          <p className="hidden md:block mt-6 text-[.68rem] leading-relaxed text-[var(--muted)]">
            Opdateret {koert.toLocaleString("da-DK", { timeZone: "Europe/Copenhagen", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}<br />
            BC {f.kilder.bc_laest ?? "–"} · Shopify {f.kilder.shopify_hentet}
          </p>
        </aside>
        <main className="min-w-0">
          {title && (
            <header className="mb-5 md:mb-7">
              <h1 className="display text-3xl md:text-5xl">{title}</h1>
              {intro && <p className="mt-2 text-sm md:text-base text-[var(--muted)] font-medium max-w-2xl">{intro}</p>}
            </header>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
