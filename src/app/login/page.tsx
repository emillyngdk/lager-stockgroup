export default async function LoginPage({ searchParams }: { searchParams: Promise<{ fejl?: string; next?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form method="post" action="/api/login" className="card w-full max-w-sm p-8 flex flex-col gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Stock Group · Shop Group</p>
          <h1 className="display text-4xl mt-2">Lager</h1>
          <p className="text-sm text-[var(--muted)] mt-2">Forecast og suppleringsradar for kokkebrands.</p>
        </div>
        <input type="hidden" name="next" value={sp.next || "/"} />
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Adgangskode
          <input name="password" type="password" autoComplete="current-password" required
            className="rounded-xl border border-[var(--line)] px-4 py-3 text-base font-medium outline-none focus:border-[var(--ink)]" />
        </label>
        {sp.fejl && <p className="text-sm font-semibold text-[var(--kritisk)]">Forkert adgangskode – prøv igen.</p>}
        <button className="rounded-xl bg-[var(--ink)] text-white font-bold py-3 text-base hover:opacity-90">Log ind</button>
      </form>
    </main>
  );
}
