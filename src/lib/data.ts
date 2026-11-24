import fs from "node:fs";
import path from "node:path";
import type { ForecastOutput, ForecastRow, Status } from "./forecast/types";

let cache: ForecastOutput | null = null;

export function getForecast(): ForecastOutput {
  if (cache) return cache;
  const p = path.join(process.cwd(), "data", "forecast.json");
  cache = JSON.parse(fs.readFileSync(p, "utf8")) as ForecastOutput;
  return cache;
}

export function getRow(key: string): ForecastRow | undefined {
  return getForecast().rows.find((r) => r.key === key);
}

/** Letvægtsudgave af en række til tabeller (ingen projektion/forklaring). */
import type { RowLite } from "./types-lite";
export type { RowLite };
export function lite(r: ForecastRow): RowLite {
  const { projektion, forklaring: _f, paaVej, ...rest } = r;
  void _f;
  const { events: _e, ...pv } = paaVej; void _e;
  return { ...rest, paaVej: pv, projektionDag0: projektion.dag0 };
}

export const FANER: { slug: string; status?: Status[]; label: string; beskrivelse: string; sort: (a: ForecastRow, b: ForecastRow) => number }[] = [
  { slug: "udsolgt", status: ["udsolgt"], label: "Udsolgt", beskrivelse: "0 tilgængeligt til e-com lige nu", sort: (a, b) => b.velocity.base - a.velocity.base },
  { slug: "kritisk", status: ["kritisk"], label: "Kritisk", beskrivelse: "Tør før næste bekræftede levering", sort: (a, b) => (a.dage.tilUdsolgtMedPaaVej ?? 9999) - (b.dage.tilUdsolgtMedPaaVej ?? 9999) },
  { slug: "bestil-nu", status: ["bestil_nu"], label: "Bestil nu", beskrivelse: "Ny PO skal afsted inden 14 dage", sort: (a, b) => (a.datoer.bestilSenest ?? "9999").localeCompare(b.datoer.bestilSenest ?? "9999") },
  { slug: "obs", status: ["obs"], label: "OBS", beskrivelse: "Bestil inden 45 dage, eller afhængig af ubooket PO", sort: (a, b) => (a.datoer.bestilSenest ?? "9999").localeCompare(b.datoer.bestilSenest ?? "9999") },
  { slug: "ok", status: ["ok"], label: "OK", beskrivelse: "Dækket med det der er på lager og bestilt", sort: (a, b) => (a.dage.tilUdsolgt ?? 9999) - (b.dage.tilUdsolgt ?? 9999) },
  { slug: "nyheder", status: ["for_nyt"], label: "Nyheder", beskrivelse: "Under 14 dage i salg – foreløbig velocity", sort: (a, b) => a.alder.dage - b.alder.dage },
  { slug: "overlager", status: ["overlager"], label: "Overlager", beskrivelse: "Over 365 dages dækning eller ingen salg", sort: (a, b) => (b.oekonomi.lagervaerdi ?? 0) - (a.oekonomi.lagervaerdi ?? 0) },
  { slug: "alle", label: "Alle varer", beskrivelse: "Hele sortimentet med EAN", sort: (a, b) => 0 * (a.velocity.base - b.velocity.base) },
];

export { fmtDato, fmtTal } from "./format";

// ---------- v2: indkøbslinjer ----------
import type { PurchaseLine } from "./forecast/purchase";
import type { LineLite } from "./types-lite";
export type { LineLite };
export function getLines(): PurchaseLine[] { return getForecast().linjer; }
export function getLine(ean: string): PurchaseLine | undefined { return getForecast().linjer.find((l) => l.ean === ean); }
export function liteLine(l: PurchaseLine): LineLite {
  const { demandPrDag: _d, projektion, forklaring: _f, paaVej, shops, ...rest } = l; void _d; void _f;
  const { events: _e, ...pv } = paaVej; void _e;
  return { ...rest, paaVej: pv, dag0: projektion.dag0, shops: shops.map(({ brand, key, velocity, ecom, dageTilUdsolgt, status, hero }) => ({ brand, key, velocity, ecom, dageTilUdsolgt, status, hero })) };
}
