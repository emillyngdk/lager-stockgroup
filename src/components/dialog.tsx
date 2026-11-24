"use client";
import { useEffect, useRef, useState } from "react";

/** Pæn in-app dialog i stedet for browserens confirm()/prompt(). Bruges imperativt: `const v = await ask({...})`. */
export type Field = { key: string; label: string; type?: "text" | "number" | "date"; value?: string; placeholder?: string; hint?: string; required?: boolean; options?: string[] };
export type AskOpts = { title: string; text?: string; fields?: Field[]; ok?: string; cancel?: string; danger?: boolean };
type Pending = AskOpts & { resolve: (v: Record<string, string> | null) => void };

let setPendingGlobal: ((p: Pending | null) => void) | null = null;
const queue: Pending[] = [];

export function ask(opts: AskOpts): Promise<Record<string, string> | null> {
  return new Promise((resolve) => {
    const p = { ...opts, resolve };
    if (setPendingGlobal) setPendingGlobal(p); else queue.push(p);
  });
}

/** Spørger om navn én gang og husker det i browseren. */
export async function hvemErDu(): Promise<string | null> {
  const gemt = typeof localStorage !== "undefined" ? localStorage.getItem("lager_navn") ?? "" : "";
  if (gemt) return gemt;
  const v = await ask({ title: "Hvem er du?", text: "Dit navn vises på det du gemmer, så kollegerne kan se hvem der har gjort hvad. Du bliver kun spurgt én gang.", fields: [{ key: "navn", label: "Navn", placeholder: "fx Martin", required: true }], ok: "Fortsæt" });
  const n = v?.navn?.trim();
  if (!n) return null;
  localStorage.setItem("lager_navn", n);
  return n;
}

export function DialogHost() {
  const [p, setP] = useState<Pending | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => { setPendingGlobal = setP; if (queue.length) setP(queue.shift()!); return () => { setPendingGlobal = null; }; }, []);
  useEffect(() => { if (p) { setVals(Object.fromEntries((p.fields ?? []).map((f) => [f.key, f.value ?? ""]))); setTimeout(() => first.current?.focus(), 30); } }, [p]);
  if (!p) return null;
  const close = (v: Record<string, string> | null) => { p.resolve(v); setP(queue.shift() ?? null); };
  const missing = (p.fields ?? []).some((f) => f.required && !vals[f.key]?.trim());
  const submit = () => { if (!missing) close(vals); };
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) close(null); }} onKeyDown={(e) => { if (e.key === "Escape") close(null); if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") submit(); }}>
      <div role="dialog" aria-modal className="card w-full max-w-md p-5 md:p-6 shadow-2xl">
        <h2 className="font-extrabold text-lg leading-tight">{p.title}</h2>
        {p.text && <p className="mt-2 text-sm font-medium text-[var(--muted)] whitespace-pre-line">{p.text}</p>}
        {(p.fields ?? []).length > 0 && <div className="mt-4 flex flex-col gap-3">
          {(p.fields ?? []).map((f, i) => <label key={f.key} className="block">
            <span className="block text-[.65rem] font-bold uppercase tracking-wider text-[var(--muted)] mb-1">{f.label}</span>
            <input ref={i === 0 ? first : undefined} type={f.type ?? "text"} value={vals[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} list={f.options ? `dl-${f.key}` : undefined} className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 font-semibold num" />
            {f.options && <datalist id={`dl-${f.key}`}>{f.options.map((o) => <option key={o} value={o} />)}</datalist>}
            {f.hint && <span className="block mt-1 text-xs font-medium text-[var(--muted)]">{f.hint}</span>}
          </label>)}
        </div>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => close(null)} className="rounded-full px-4 py-2 text-sm font-bold bg-[var(--bg)] hover:bg-[#eeeae2]">{p.cancel ?? "Annullér"}</button>
          <button type="button" onClick={submit} disabled={missing} className="rounded-full px-5 py-2 text-sm font-bold text-white disabled:opacity-40" style={{ background: p.danger ? "var(--kritisk)" : "var(--ink)" }}>{p.ok ?? "OK"}</button>
        </div>
      </div>
    </div>
  );
}
