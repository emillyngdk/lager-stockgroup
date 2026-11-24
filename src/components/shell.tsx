import Link from "next/link";
import Image from "next/image";
import { getForecast } from "@/lib/data";

import { LINE_STATUS_META } from "@/lib/forecast/purchase";


function NavItem({ href, label, count, color, active }: { href: string; label: string; count?: number; color?: string; active: boolean }) {
  return (
    <Link href={href} className={`nav-item flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap ${active ? "bg-white text-[var(--ink)]" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>
      <span className="flex items-center gap-2.5">{color && <i className="inline-block w-2 h-2 rounded-full ring-2 ring-white/10" style={{ background: color }} />}{label}</span>
      {count !== undefined && <span className={`num text-[.7rem] font-bold rounded-full px-2 py-0.5 ${active ? "bg-[var(--ink)] text-white" : "bg-white/10 text-white/80"}`}>{count}</span>}
    </Link>
  );
}

export function Shell({ children, active, title, intro, aside }: { children: React.ReactNode; active: string; title?: string; intro?: string; aside?: React.ReactNode }) {
  const f = getForecast();
  const koert = new Date(f.kørt);
  const ageH = (Date.now() - koert.getTime()) / 36e5;
  const stale = ageH > 30;
  const opdateret = koert.toLocaleString("da-DK", { timeZone: "Europe/Copenhagen", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const fjernet = f.linjer.filter((l) => ["udgaar", "skjult", "ikke_indkoeb"].includes(l.status)).length;
  const ol = f.opsummeringLinjer;
  const nav = (
    <>
      <NavItem href="/" label="Skal bestilles" count={ol.bestil_nu + ol.bestil_14 + ol.bestil_30 + ol.book_po} color={LINE_STATUS_META.bestil_nu.farve} active={active === "indkoeb"} />
      <NavItem href="/forslag" label="Pr. leverandør" count={f.forslagEan.reduce((a, g) => a + g.linjer.length, 0)} active={active === "forslag"} />
      <NavItem href="/paa-vej" label="På vej" active={active === "paa-vej"} />
      <div className="h-px bg-white/10 my-3 hidden md:block" />
      <p className="hidden md:block px-3 pb-1 text-[.6rem] font-bold uppercase tracking-[.18em] text-white/35">Sortiment</p>
      <NavItem href="/fane/alle" label="Alle varer" count={f.linjer.length} active={active === "alle"} />
      <NavItem href="/shops" label="Overblik pr. shop" active={active === "shops"} />
      <div className="h-px bg-white/10 my-3 hidden md:block" />
      <NavItem href="/uden-kobling" label="Uden kobling" count={f.udenKobling.length} active={active === "uden-kobling"} />
      <NavItem href="/fjernet" label="Fjernede varer" count={fjernet} active={active === "fjernet"} />
      <NavItem href="/om" label="Sådan regnes der" active={active === "om"} />
    </>
  );
  return (
    <div className="min-h-screen md:grid md:grid-cols-[264px_1fr]">
      <aside className="bg-[var(--ink)] text-white md:sticky md:top-0 md:h-screen md:overflow-y-auto flex flex-col">
        <div className="px-5 pt-5 md:pt-7 pb-3 md:pb-6">
          <Link href="/" className="block">
            <Image src="/stock-group-white.png" alt="Stock Group A/S" width={790} height={294} priority unoptimized className="w-[150px] md:w-[190px] h-auto" />
          </Link>
          <p className="hidden md:block mt-4 text-[.65rem] font-bold uppercase tracking-[.2em] text-white/45">Lager & forecast · Shop Group</p>
        </div>
        <nav className="flex md:flex-col gap-1 overflow-x-auto px-5 pb-4 md:pb-0 md:flex-1">{nav}</nav>
        <div className="hidden md:block px-5 py-5 mt-4 border-t border-white/10">
          <p className="flex items-center gap-2 text-xs font-semibold text-white/80"><i className={`inline-block w-2 h-2 rounded-full ${stale ? "bg-[var(--kritisk)]" : "bg-[var(--ok)]"}`} />Opdateret {opdateret}</p>
          <p className="mt-1.5 text-[.65rem] leading-relaxed text-white/40">BC {f.kilder.bc_laest ?? "–"}<br />Shopify &amp; Jullytics {f.kilder.shopify_hentet}</p>
        </div>
      </aside>
      <div className="min-w-0">
        {stale && (
          <div className="bg-[var(--kritisk)] text-white text-sm font-bold text-center py-2 px-4">
            Tallene er {Math.round(ageH)} timer gamle – den daglige opdatering er ikke kørt. Sidst kørt {koert.toLocaleString("da-DK", { timeZone: "Europe/Copenhagen" })}.
          </div>
        )}
        <main className="max-w-[1400px] px-4 md:px-8 py-6 md:py-10">
          {title && (
            <header className="mb-6 md:mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="display text-4xl md:text-6xl">{title}</h1>
                {intro && <p className="mt-3 text-sm md:text-base text-[var(--muted)] font-medium max-w-2xl leading-relaxed">{intro}</p>}
              </div>
              {aside}
            </header>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
