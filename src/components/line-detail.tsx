"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PurchaseLine } from "@/lib/forecast/purchase";
import { Calculator } from "./calculator";
import { fmtDato, fmtTal } from "@/lib/format";

export type Plan = { stk: number; colli: number; bestilDato: string; leadTime: number; note?: string; af?: string; oprettet: string; status: "planlagt" | "bestilt"; po?: string };
export type Flag = { udgaar?: boolean; skjul_til?: string | null; ikke_indkoeb?: boolean; note?: string; af?: string; dato?: string; lead_time?: number; coverage_days?: number; moq?: number; eu?: boolean; kategori?: "hybrid" | "standard" };

export function useNavn(): [string, (n: string) => void] {
  const [navn, setNavn] = useState("");
  useEffect(() => { setNavn(localStorage.getItem("lager_navn") ?? ""); }, []);
  return [navn, (n: string) => { localStorage.setItem("lager_navn", n); setNavn(n); }];
}

export function askNavn(current: string): string | null {
  const n = window.prompt("Hvem er du? (vises på planen)", current || "");
  if (n === null) return null;
  const t = n.trim();
  if (!t) return null;
  localStorage.setItem("lager_navn", t);
  return t;
}

export function LineDetail({ line, receivingDays }: { line: PurchaseLine; receivingDays: number }) {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [flag, setFlag] = useState<Flag | null>(line.override as Flag | null);
  const [navn, setNavn] = useNavn();
  const [menu, setMenu] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/state?ean=${line.ean}`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) { setPlan(d.plan ?? null); if (d.override) setFlag(d.override); } }).catch(() => {});
  }, [line.ean]);

  const who = () => navn || askNavn(navn);
  const save = async (p: { stk: number; colli: number; bestilDato: string; leadTime: number; note: string }) => {
    const af = who(); if (!af) return; setNavn(af);
    const r = await fetch(`/api/plan/${line.ean}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...p, af }) });
    if (r.ok) { setPlan(await r.json()); setMsg("Plan gemt"); setTimeout(() => setMsg(null), 2500); } else setMsg("Kunne ikke gemme – prøv igen");
  };
  const slet = async () => {
    if (!window.confirm("Fjern planen?")) return;
    const r = await fetch(`/api/plan/${line.ean}`, { method: "DELETE" });
    if (r.ok) setPlan(null);
  };
  const setFlagRemote = async (patch: Flag, tekst: string) => {
    const af = who(); if (!af) return; setNavn(af);
    const note = window.prompt(`${tekst}\n\nNote (valgfri):`, "");
    if (note === null) return;
    const r = await fetch(`/api/override/${line.ean}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...patch, note: note || undefined, af }) });
    if (r.ok) { setFlag(await r.json()); setMenu(false); setMsg("Gemt – slår igennem på listen ved næste opdatering i morgen tidlig"); router.refresh(); } else setMsg("Kunne ikke gemme");
  };
  const fjernet = flag?.udgaar || flag?.ikke_indkoeb || (flag?.skjul_til && flag.skjul_til >= line.projektion.dag0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {plan && <span className="chip" style={{ background: plan.status === "bestilt" ? "#1e9e5a" : "#5b6cff", color: "#fff" }}>{plan.status === "bestilt" ? `Bestilt · PO ${plan.po ?? ""}` : "Planlagt"} · {fmtTal(plan.stk)} stk{plan.af ? ` · ${plan.af}` : ""} · {fmtDato(plan.oprettet.slice(0, 10))}</span>}
        {plan && <button onClick={slet} className="text-xs font-bold text-[var(--muted)] underline">fjern plan</button>}
        {fjernet && <span className="chip" style={{ background: "#8a8a8a", color: "#fff" }}>{flag?.udgaar ? "Udgår" : flag?.ikke_indkoeb ? "Ikke relevant for indkøb" : `Skjult til ${fmtDato(flag!.skjul_til!)}`}{flag?.af ? ` · ${flag.af}` : ""}</span>}
        {msg && <span className="text-xs font-bold text-[var(--ok)]">{msg}</span>}
        <div className="relative ml-auto">
          <button onClick={() => setMenu((m) => !m)} className="card !rounded-xl px-3 py-2 text-sm font-bold" aria-label="Handlinger">⋯</button>
          {menu && (
            <div className="absolute right-0 mt-2 card p-2 w-72 z-20 flex flex-col text-sm">
              {!fjernet ? (<>
                <button onClick={() => setFlagRemote({ udgaar: true }, `Udgår – ${line.titel}?\nVaren fjernes fra forslag, mails og nøgletal. Fortryd under Fjernede varer.`)} className="text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] font-semibold">Markér som udgår<span className="block text-xs font-medium text-[var(--muted)]">Ingen forslag, ingen mail. Restlager vises stadig.</span></button>
                <button onClick={() => { const d = window.prompt("Skjul indtil dato (ÅÅÅÅ-MM-DD):", new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)); if (d) setFlagRemote({ skjul_til: d }, `Skjul ${line.titel} til ${d}?`); }} className="text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] font-semibold">Skjul indtil dato<span className="block text-xs font-medium text-[var(--muted)]">Fx fordi en PO er på vej men ikke i BC endnu.</span></button>
                <button onClick={() => setFlagRemote({ ikke_indkoeb: true }, `Ikke relevant for indkøb – ${line.titel}?\nFjernes fra indkøbslisten, bliver i Shops-visningen.`)} className="text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] font-semibold">Ikke relevant for indkøb<span className="block text-xs font-medium text-[var(--muted)]">Holdes af shoppen selv (dropship, gavekort).</span></button>
              </>) : (
                <button onClick={() => setFlagRemote({ udgaar: false, ikke_indkoeb: false, skjul_til: null }, `Genindsæt ${line.titel} på indkøbslisten?`)} className="text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] font-semibold">Genindsæt på listen</button>
              )}
              <div className="h-px bg-[var(--line)] my-1" />
              <button onClick={() => { const v = window.prompt("Lead time i dage for dette EAN (tom = tilbage til reglen):", String(flag?.lead_time ?? line.genbestilling.leadTime)); if (v === null) return; setFlagRemote({ lead_time: v.trim() ? Number(v) : undefined }, "Gem lead time?"); }} className="text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] font-semibold">Ret lead time<span className="block text-xs font-medium text-[var(--muted)]">Nu {line.genbestilling.leadTime} dage ({line.genbestilling.leadTimeKilde})</span></button>
              <button onClick={() => { const v = window.prompt("MOQ (mindste ordre) i stk, tom = ingen:", String(flag?.moq ?? "")); if (v === null) return; setFlagRemote({ moq: v.trim() ? Number(v) : undefined }, "Gem MOQ?"); }} className="text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] font-semibold">Sæt MOQ</button>
              <button onClick={() => setFlagRemote({ eu: !(flag?.eu ?? line.genbestilling.eu) }, `${line.genbestilling.eu ? "Fjern" : "Sæt"} EU-leverandør (30 dages lead time)?`)} className="text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] font-semibold">{line.genbestilling.eu ? "Ikke EU-leverandør" : "EU-leverandør (30 dage)"}</button>
            </div>
          )}
        </div>
      </div>
      <Calculator line={line} receivingDays={receivingDays} plan={plan ? { stk: plan.stk, bestilDato: plan.bestilDato, leadTime: plan.leadTime, note: plan.note, af: plan.af } : null} onSave={save} />
    </div>
  );
}
