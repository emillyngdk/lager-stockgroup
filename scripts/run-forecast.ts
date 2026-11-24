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
const today = process.argv[2];
const out = runForecast(snap, overrides, undefined, today);
fs.writeFileSync(path.join(root, "data", "forecast.json"), JSON.stringify(out));
// historik til præcisionsmåling
const histDir = path.join(root, "data", "history");
fs.mkdirSync(histDir, { recursive: true });
fs.writeFileSync(path.join(histDir, `${out.dag0}.json`), JSON.stringify(out.rows.map((r) => ({ key: r.key, status: r.status, udsolgt: r.datoer.udsolgtMedPaaVej, tilg: r.lager.tilgaengeligt, base: r.velocity.base }))));
console.log(`dag0 ${out.dag0} | rækker ${out.rows.length} | sæson: ${out.saeson.kilde}`);
console.log("status:", out.opsummering);
if (manglerOversaettelse) console.log(`OBS: ${manglerOversaettelse} Herman/Tomi-varianter mangler dansk navn i data/titles_da.json`);
console.log("uden kobling:", out.udenKobling.length, "| universelle:", out.universelle.length, "| forslag-leverandører:", out.forslag.length);
