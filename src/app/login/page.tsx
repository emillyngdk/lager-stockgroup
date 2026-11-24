import Image from "next/image";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ fejl?: string; next?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="min-h-screen bg-[var(--ink)] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Image src="/stock-group-white.png" alt="Stock Group A/S" width={790} height={294} priority unoptimized className="w-[220px] h-auto mx-auto mb-8" />
        <form method="post" action="/api/login" className="card p-8 flex flex-col gap-5">
          <div>
            <p className="text-[.65rem] font-bold uppercase tracking-[.2em] text-[var(--muted)]">Shop Group · Stock Group</p>
            <h1 className="display text-4xl mt-2">Lager</h1>
            <p className="text-sm text-[var(--muted)] mt-2 font-medium">Forecast og suppleringsradar for kokkebrands.</p>
          </div>
          <input type="hidden" name="next" value={sp.next || "/"} />
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Adgangskode
            <input name="password" type="password" autoComplete="current-password" required autoFocus
              className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-base font-medium outline-none focus:border-[var(--ink)] focus:bg-white" />
          </label>
          {sp.fejl && <p className="text-sm font-semibold text-[var(--kritisk)]">Forkert adgangskode – prøv igen.</p>}
          <button className="rounded-xl bg-[var(--ink)] text-white font-bold py-3 text-base hover:opacity-90">Log ind</button>
        </form>
      </div>
    </main>
  );
}
