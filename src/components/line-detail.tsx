"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PurchaseLine } from "@/lib/forecast/purchase";
import { Calculator } from "./calculator";
import { fmtDato, fmtTal } from "@/lib/format";
import { ask, hvemErDu } from "./dialog";

export type Plan = { stk: number; colli: number; bestilDato: string; leadTime: number; note?: string; af?: string; oprettet: string; status: "planlagt" | "bestilt"; po?: string };
export type Flag = { udgaar?: boolean; skjul_til?: string | null; ikke_indkoeb?: boolean; note?: string; af?: string; dato?: string; lead_time?: number; coverage_days?: number; moq?: number; eu?: boolean; kategori?: "hybrid" | "standard" };

export function useNavn(): [string, (n: string) => void] {
  const [navn, setNavn] = useState("");
  useEffect(() => { setNavn(localStorage.getItem("lager_navn") ?? ""); }, []);
  return [navn, (n: string) => { localStorage.setItem("lager_navn", n); setNavn(n); }];
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

  const who = async () => navn || (await hvemErDu());
  const save = async (p: { stk: number; colli: number; bestilDato: string; leadTime: number; note: string }) => {
    const af = await who(); if (!af) return; setNavn(af);
    const r = await fetch(`/api/plan/${line.ean}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...p, af }) });
    if (r.ok) { setPlan(await r.json()); setMsg("Plan gemt"); setTimeout(() => setMsg(null), 2500); } else setMsg("Kunne ikke gemme – prøv igen");
  };
  const slet = async () => {
    if (!(await ask({ title: "Fjern planen?", text: "Planen slettes for alle. Forslaget fra beregneren bliver stående.", ok: "Fjern plan", danger: true }))) return;
    const r = await fetch(`/api/plan/${line.ean}`, { method: "DELETE" });
    if (r.ok) setPlan(null);
  };
  const setFlagRemote = async (patch: Flag, titel: string, tekst?: string, danger = false) => {
    setMenu(false);
    const af = await who(); if (!af) return; setNavn(af);
    const v = await ask({ title: titel, text: tekst, fields: [{ key: "note", label: "Note (valgfri)", placeholder: "fx aftalt med Martin" }], ok: "Gem", danger });
    if (!v) return;
    const note = v.note.trim();
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
                <button onClick={() => setFlagRemote({ udgaar: true }, "Markér som udgår?", `${line.titel} fjernes fra indkøbslisten, forslag og mails – også i fremtidige kørsler. Fortryd under Fjernede varer.`, true)} className="text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] font-semibold">Markér som udgår<span className="block text-xs font-medium text-[var(--muted)]">Ingen forslag, ingen mail. Restlager vises stadig.</span></button>
                <button onClick={async () => { setMenu(false); const v = await ask({ title: "Skjul indtil dato", text: "Varen forsvinder fra listen indtil datoen og kommer selv tilbage bagefter.", fields: [{ key: "dato", label: "Skjul til", type: "date", value: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), required: true }], ok: "Videre" }); if (v?.dato) setFlagRemote({ skjul_til: v.dato }, `Skjul til ${fmtDato(v.dato)}?`, line.titel); }} className="text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] font-semibold">Skjul indtil dato<span className="block text-xs font-medium text-[var(--muted)]">Fx fordi en PO er på vej men ikke i BC endnu.</span></button>
                <button onClick={() => setFlagRemote({ ikke_indkoeb: true }, "Ikke relevant for indkøb?", `${line.titel} fjernes fra indkøbslisten, men bliver i Shops-visningen.`)} className="text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] font-semibold">Ikke relevant for indkøb<span className="block text-xs font-medium text-[var(--muted)]">Holdes af shoppen selv (dropship, gavekort).</span></button>
              </>) : (
                <button onClick={() => setFlagRemote({ udgaar: false, ikke_indkoeb: false, skjul_til: null }, "Genindsæt på listen?", line.titel)} className="text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] font-semibold">Genindsæt på listen</button>
              )}
              <div className="h-px bg-[var(--line)] my-1" />
              <button onClick={async () => { setMenu(false); const v = await ask({ title: "Ret lead time", text: "Gælder kun dette EAN. Tom = tilbage til standardreglen.", fields: [{ key: "lt", label: "Lead time i dage", type: "number", value: String(flag?.lead_time ?? line.genbestilling.leadTime) }], ok: "Videre" }); if (!v) return; setFlagRemote({ lead_time: v.lt.trim() ? Number(v.lt) : undefined }, "Gem lead time?", v.lt.trim() ? `${v.lt} dage for ${line.titel}` : `Tilbage til reglen for ${line.titel}`); }} className="text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] font-semibold">Ret lead time<span className="block text-xs font-medium text-[var(--muted)]">Nu {line.genbestilling.leadTime} dage ({line.genbestilling.leadTimeKilde})</span></button>
              <button onClick={async () => { setMenu(false); const v = await ask({ title: "Sæt MOQ", text: "Leverandørens mindste ordre i stk. Forslaget rundes op til MOQ. Tom = ingen MOQ.", fields: [{ key: "moq", label: "MOQ (stk)", type: "number", value: String(flag?.moq ?? "") }], ok: "Videre" }); if (!v) return; setFlagRemote({ moq: v.moq.trim() ? Number(v.moq) : undefined }, "Gem MOQ?", v.moq.trim() ? `${v.moq} stk for ${line.titel}` : `Ingen MOQ for ${line.titel}`); }} className="text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] font-semibold">Sæt MOQ</button>
              <button onClick={() => setFlagRemote({ eu: !(flag?.eu ?? line.genbestilling.eu) }, line.genbestilling.eu ? "Ikke længere EU-leverandør?" : "EU-leverandør?", line.genbestilling.eu ? "Lead time går tilbage til standardreglen." : "Lead time sættes til 30 dage for dette EAN.")} className="text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] font-semibold">{line.genbestilling.eu ? "Ikke EU-leverandør" : "EU-leverandør (30 dage)"}</button>
            </div>
          )}
        </div>
      </div>
      <Calculator line={line} receivingDays={receivingDays} plan={plan ? { stk: plan.stk, bestilDato: plan.bestilDato, leadTime: plan.leadTime, note: plan.note, af: plan.af } : null} onSave={save} />
    </div>
  );
}
