import fs from "node:fs";
import path from "node:path";
import { runForecast } from "../src/lib/forecast/engine";
import type { Snapshot, Override } from "../src/lib/forecast/types";

const root = path.resolve(__dirname, "..");
const snap: Snapshot = JSON.parse(fs.readFileSync(path.join(root, "data", "snapshot.json"), "utf8"));
const ovPath = path.join(root, "data", "overrides.json");
const overrides: Record<string, Override> = fs.existsSync(ovPath) ? JSON.parse(fs.readFileSync(ovPath, "utf8")) : {};
// Danske produktnavne for Herman (NL) og Tomi (FI)
const titlesPath = path.join(root, "data", "titles_da.json");
const titles: Record<string, string> = fs.existsSync(titlesPath) ? JSON.parse(fs.readFileSync(titlesPath, "utf8")) : {};
let manglerOversaettelse = 0;
for (const v of snap.variants) {
  if (v.brand !== "herman" && v.brand !== "tomi") continue;
  const da = titles[`${v.brand}:${v.product_id}`];
  v.title_original = v.title;
  if (da) v.title = da; else manglerOversaettelse++;
}
// Delt tilstand fra sitet (planer + overrides sat i UI). Hentes af den daglige opdatering til data/state.json.
// data/state.json = hentet i dag fra sitet; data/state.snapshot.json = sidst kendte kopi (committes), så udgåede varer aldrig dukker op igen hvis API'et svigter
const statePath = fs.existsSync(path.join(root, "data", "state.json")) ? path.join(root, "data", "state.json") : path.join(root, "data", "state.snapshot.json");
if (statePath.endsWith("state.json")) fs.copyFileSync(statePath, path.join(root, "data", "state.snapshot.json")); else console.log("OBS: data/state.json mangler – bruger sidst kendte state.snapshot.json");
type Plan = { stk: number; colli: number; bestilDato: string; leadTime: number; af?: string; note?: string; oprettet: string; status: "planlagt" | "bestilt"; po?: string; poKendt?: string[] };
const state: { plans: Record<string, Plan>; overrides: Record<string, Override> } = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : { plans: {}, overrides: {} };
for (const [ean, ov] of Object.entries(state.overrides ?? {})) overrides[ean] = { ...(overrides[ean] ?? {}), ...ov };
const today = process.argv[2];
const out = runForecast(snap, overrides, undefined, today);
// Planer: overlay på linjerne. Planlagt → Bestilt når en PO, der ikke var kendt da planen blev gemt, dukker op i BC.
let planlagt = 0, bestilt = 0;
for (const l of out.linjer) {
  const p = state.plans?.[l.ean]; if (!p) continue;
  const kendte = new Set(p.poKendt ?? []);
  const ny = l.paaVej.events.find((e) => !kendte.has(e.po) && e.dato >= p.bestilDato);
  const status: "planlagt" | "bestilt" = p.status === "bestilt" || ny ? "bestilt" : "planlagt";
  l.plan = { stk: p.stk, colli: p.colli, bestilDato: p.bestilDato, leadTime: p.leadTime, af: p.af, note: p.note, oprettet: p.oprettet, status, po: p.po ?? ny?.po };
  if (!["udgaar", "skjult", "ikke_indkoeb"].includes(l.status)) { l.status = status; l.statusAarsag = status === "bestilt" ? `Bestilt – PO ${l.plan.po ?? ""} fundet i BC efter planen (${p.stk} stk${p.af ? `, ${p.af}` : ""})` : `Planlagt ${p.stk} stk${p.af ? ` af ${p.af}` : ""} den ${p.oprettet.slice(0, 10)} – afventer PO i BC`; }
  if (status === "bestilt") bestilt++; else planlagt++;
}
out.opsummeringLinjer = Object.fromEntries(Object.keys(out.opsummeringLinjer).map((k) => [k, out.linjer.filter((l) => l.status === k).length])) as typeof out.opsummeringLinjer;
for (const g of out.forslagEan) for (const x of g.linjer) { const l = out.linjer.find((y) => y.ean === x.ean); if (l?.plan) { x.foreslaaetStk = l.plan.stk; x.foreslaaetColli = l.plan.colli; x.status = l.status; x.begrundelse = l.statusAarsag; } }
out.forslagEan = out.forslagEan.map((g) => ({ ...g, linjer: g.linjer.filter((x) => !["udgaar", "skjult", "ikke_indkoeb", "bestilt"].includes(x.status)) })).filter((g) => g.linjer.length);
if (planlagt + bestilt) console.log(`planer: ${planlagt} planlagt, ${bestilt} bestilt`);
fs.writeFileSync(path.join(root, "data", "forecast.json"), JSON.stringify(out));
// historik til præcisionsmåling
const histDir = path.join(root, "data", "history");
fs.mkdirSync(histDir, { recursive: true });
fs.writeFileSync(path.join(histDir, `${out.dag0}.json`), JSON.stringify({
  rows: out.rows.map((r) => ({ key: r.key, status: r.status, udsolgt: r.datoer.udsolgtMedPaaVej, tilg: r.lager.tilgaengeligt, base: r.velocity.base })),
  linjer: out.linjer.map((l) => ({ ean: l.ean, status: l.status, bestilSenest: l.datoer.bestilSenest, foreslaaet: l.genbestilling.foreslaaetStk, tilg: l.lager.tilgaengeligt, base: l.velocity.base })),
}));
console.log(`dag0 ${out.dag0} | rækker ${out.rows.length} | sæson: ${out.saeson.kilde}`);
console.log("status (shops):", out.opsummering);
console.log("indkøbslinjer:", out.linjer.length, out.opsummeringLinjer);
if (manglerOversaettelse) console.log(`OBS: ${manglerOversaettelse} Herman/Tomi-varianter mangler dansk navn i data/titles_da.json`);
console.log("uden kobling:", out.udenKobling.length, "| universelle:", out.universelle.length, "| forslag-leverandører:", out.forslag.length);
