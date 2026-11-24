/**
 * Indkøbslinjer: én linje pr. EAN på tværs af alle shops.
 * Bygger oven på ForecastRow (pr. shop) og regner behov, puljer, på vej, lead time,
 * reorder point, bestil senest, foreslået mængde, "rækker til" og fordeling pr. shop.
 *
 * Alt her er rent (ingen fs), så raekkerTil() kan køres i browseren på samme data.
 */
import { BRANDS, type Brand, type Config, type ForecastRow, type Override, type PoLine, type Snapshot, type AgeGroup } from "./types";
import { addDays, isoWeek } from "./engine";

export type LineStatus =
  | "bestil_nu" | "bestil_14" | "bestil_30" | "book_po" | "planlagt" | "bestilt" | "daekket" | "overlager" | "for_nyt"
  | "udgaar" | "skjult" | "ikke_indkoeb";

export const LINE_STATUS_META: Record<LineStatus, { label: string; farve: string; tekst: string; orden: number; kort: string }> = {
  bestil_nu: { label: "Bestil", farve: "#E5322D", tekst: "#FFFFFF", orden: 0, kort: "Nu" },
  bestil_14: { label: "Bestil", farve: "#F5820D", tekst: "#FFFFFF", orden: 1, kort: "14 d" },
  bestil_30: { label: "Bestil", farve: "#F2B705", tekst: "#141414", orden: 2, kort: "30 d" },
  book_po: { label: "Book PO", farve: "#F2B705", tekst: "#141414", orden: 3, kort: "Book" },
  planlagt: { label: "Planlagt", farve: "#5B6CFF", tekst: "#FFFFFF", orden: 4, kort: "Plan" },
  bestilt: { label: "Bestilt", farve: "#1E9E5A", tekst: "#FFFFFF", orden: 5, kort: "Bestilt" },
  daekket: { label: "Dækket", farve: "#1E9E5A", tekst: "#FFFFFF", orden: 6, kort: "OK" },
  overlager: { label: "Overlager", farve: "#9B6BFF", tekst: "#FFFFFF", orden: 7, kort: "Over" },
  for_nyt: { label: "For nyt", farve: "#9B6BFF", tekst: "#FFFFFF", orden: 8, kort: "Nyt" },
  udgaar: { label: "Udgår", farve: "#8A8A8A", tekst: "#FFFFFF", orden: 9, kort: "Udgår" },
  skjult: { label: "Skjult", farve: "#8A8A8A", tekst: "#FFFFFF", orden: 10, kort: "Skjult" },
  ikke_indkoeb: { label: "Ikke indkøb", farve: "#8A8A8A", tekst: "#FFFFFF", orden: 11, kort: "–" },
};

export interface LineOverride extends Override {
  moq?: number; kategori?: "hybrid" | "standard"; eu?: boolean; leverandoer?: string;
  skjul_til?: string | null; ikke_indkoeb?: boolean; af?: string; dato?: string;
}

export interface LineShop {
  brand: Brand; key: string; titel: string; velocity: number; afsaeson: number; trend: number; ecom: number;
  dageTilUdsolgt: number | null; udsolgt: string | null; status: ForecastRow["status"]; hero: boolean; alder: AgeGroup; salgsdage: number; solgt365: number | null;
  andelAfBehov: number; // andel af samlet behov i dækningsperioden
}

export interface LineEvent { dato: string; stk: number; sikker: boolean; po: string; status: string; lokation: string; leverandoer: string | null }

export interface PurchaseLine {
  ean: string; bcSku: string | null; titel: string; shopTitler: string[]; brands: Brand[]; shops: LineShop[];
  status: LineStatus; statusAarsag: string; hero: boolean;
  leverandoer: string | null; indkoeber: string | null;
  velocity: { base: number; afsaeson: number; trend: number; solgt365: number | null; salgsdage: number; snitPrDag: number | null };
  /** Hvor meget kan man stole på forslaget? lav = under 30 dages salgsdata, middel = under 90, ok = 90+ */
  dataKvalitet: "lav" | "middel" | "ok";
  advarsler: string[];
  lager: {
    ecomSum: number; vejleFrit: number; vejleOptimistisk: number; tredjepart: number; tredjepartOptimistisk: number; reserveretShopGroup: number; reserveretB2b: number; bestiltB2b: number;
    tilgaengeligt: number; tilgaengeligtOptimistisk: number; prLokation: Record<string, number>;
  };
  paaVej: { sikker: number; usikker: number; foersteSikker: string | null; foersteUsikker: string | null; events: LineEvent[] };
  dage: { tilUdsolgt: number | null; medPaaVej: number | null; optimistisk: number | null; bestilSenest: number | null };
  datoer: { udsolgt: string | null; medPaaVej: string | null; optimistisk: string | null; bestilSenest: string | null; raekkerTil: string | null };
  genbestilling: {
    leadTime: number; leadTimeKilde: string; kategori: "hybrid" | "standard"; eu: boolean; daekningsdage: number; sikkerhedslager: number; reorderPoint: number;
    behovLeadTime: number; behovDaekning: number; foreslaaetStk: number; foreslaaetColli: number; foreslaaetUdenUbooket: number; stkPrColli: number | null; moq: number | null; z: number; sigma: number;
    raekkerDage: number | null; // dage efter modtagelse den foreslåede mængde rækker
  };
  fordeling: { brand: Brand; stk: number }[];
  oekonomi: { unitCost: number | null; lagervaerdi: number | null };
  demandPrDag: number[]; // dag 0..400, samlet behov pr. dag
  projektion: { dag0: string; konservativ: number[]; optimistisk: number[] };
  override: LineOverride | null;
  plan: { stk: number; colli: number; bestilDato: string; leadTime: number; af?: string; note?: string; oprettet: string; status: "planlagt" | "bestilt"; po?: string } | null;
  forklaring: string[];
}

const r1 = (x: number) => Math.round(x * 10) / 10;
const HORIZON = 730;
/** Kurven på linjesiden: 400 dage, så en ordre med 6 mdr. lead time kan ses lande og række */
export const CHART_DAYS = 400;

export function supplierIsEu(lev: string | null, flag: boolean, ov?: LineOverride): boolean {
  if (ov?.eu !== undefined) return ov.eu;
  if (flag) return true;
  if (!lev) return false;
  return /solania|italia|italy|\bsrl\b|\bgmbh\b|\bb\.v\.?\b|\bbv\b|\boy\b|\bab\b|\bas\b|\baps\b|\ba\/s\b|denmark|danmark|sweden|norway|finland|germany|netherlands|polska|poland|portugal|spain|españa|france|belgi/i.test(lev);
}

/** Første dag (fra dag0) hvor lageret rammer 0, givet startlager, events og en ekstra ordre Q, der er salgbar på dagen `qDato`. */
export function raekkerTil(line: { demandPrDag: number[]; paaVej: { events: LineEvent[] }; lager: { tilgaengeligt: number }; projektion: { dag0: string } }, q: number, qDato: string | null, optimistisk = true): { dag: number | null; dato: string | null; dageEfterModtagelse: number | null } {
  const dag0 = line.projektion.dag0;
  let s = line.lager.tilgaengeligt;
  const qDag = qDato ? Math.max(0, Math.round((Date.parse(qDato) - Date.parse(dag0)) / 864e5)) : null;
  const byDay: Record<number, number> = {};
  for (const e of line.paaVej.events) {
    if (!optimistisk && !e.sikker) continue;
    const d = Math.max(0, Math.round((Date.parse(e.dato) - Date.parse(dag0)) / 864e5));
    byDay[d] = (byDay[d] ?? 0) + e.stk;
  }
  let hit: number | null = null;
  for (let d = 1; d <= HORIZON; d++) {
    if (byDay[d]) s += byDay[d];
    if (qDag !== null && d === qDag) s += q;
    s -= line.demandPrDag[d] ?? line.demandPrDag[line.demandPrDag.length - 1] ?? 0;
    if (s <= 0) {
      // før den nye ordre lander er et udsolgt tabt salg, ikke "rækker til": lageret kan ikke gå under 0
      if (qDag === null || d > qDag) { hit = d; break; }
      s = 0;
    }
  }
  if (hit === null) return { dag: null, dato: null, dageEfterModtagelse: null };
  return { dag: hit, dato: addDays(dag0, hit), dageEfterModtagelse: qDag !== null ? Math.max(0, hit - qDag) : null };
}

/** Fordel en mængde Q på shops efter deres andel af behovet, fratrukket det de selv har på lokation. */
export function fordel(line: { shops: LineShop[]; demandPrDag: number[]; genbestilling: { leadTime: number; daekningsdage: number } }, q: number): { brand: Brand; stk: number }[] {
  const horizon = line.genbestilling.leadTime + line.genbestilling.daekningsdage;
  const total = line.demandPrDag.slice(1, horizon + 1).reduce((a, x) => a + x, 0);
  const need = line.shops.map((s) => ({ brand: s.brand, need: Math.max(0, s.andelAfBehov * total - s.ecom) }));
  const sum = need.reduce((a, x) => a + x.need, 0);
  if (sum <= 0) return line.shops.map((s) => ({ brand: s.brand, stk: Math.round(q * s.andelAfBehov) }));
  const out = need.map((x) => ({ brand: x.brand, stk: Math.round((x.need / sum) * q) }));
  const diff = q - out.reduce((a, x) => a + x.stk, 0);
  if (out.length) out[0].stk += diff;
  return out;
}

export function buildPurchaseLines(
  rows: ForecastRow[], snap: Snapshot, cfg: Config, dag0: string,
  seasonFor: (b: Brand) => { idx: number[]; kilde: string },
  overrides: Record<string, LineOverride>,
  poByEan: Record<string, PoLine[]>,
): PurchaseLine[] {
  const byEan: Record<string, ForecastRow[]> = {};
  for (const r of rows) if (r.ean) (byEan[r.ean] ??= []).push(r);
  const lines: PurchaseLine[] = [];
  const BRAND_ORDER: Brand[] = ["gladkokken", "casper", "herman", "tomi"];

  for (const [ean, rs0] of Object.entries(byEan)) {
    const rs = rs0.slice().sort((a, b) => BRAND_ORDER.indexOf(a.brand) - BRAND_ORDER.indexOf(b.brand));
    const bc = snap.bc_stock[ean];
    const ov = overrides[ean] ?? null;
    const titel = (bc?.navn || rs[0].titel).replace(/\s*\/\s*cll\s*:?\s*\d+\s*$/i, "").replace(/^(TB|GK|CS|HdB|HDB|SOB|GLAD)\s*[-–]\s*/i, "").trim() || rs[0].titel;
    const forklaring: string[] = [];

    // --- behov pr. dag (sum af shops, hver med sit sæsonindeks) ---
    const demandPrDag = new Array(HORIZON + 1).fill(0);
    const seasons = rs.map((r) => seasonFor(r.brand).idx);
    for (let d = 0; d <= HORIZON; d++) {
      const w = isoWeek(addDays(dag0, d));
      let t = 0;
      rs.forEach((r, i) => { t += r.velocity.afsaeson * seasons[i][w]; });
      demandPrDag[d] = t;
    }
    const base = rs.reduce((a, r) => a + r.velocity.base, 0);
    const afsaeson = rs.reduce((a, r) => a + r.velocity.afsaeson, 0);
    const trend = afsaeson > 0 ? rs.reduce((a, r) => a + r.velocity.trend * r.velocity.afsaeson, 0) / afsaeson : 0;

    // --- puljer (hele EAN'et, én gang) ---
    const ecomSum = rs.reduce((a, r) => a + r.lager.ecom, 0);
    const prLokation: Record<string, number> = {};
    let vejleFrit = 0, vejleOpt = 0, tredjepart = 0, tredjepartOpt = 0, resSG = 0, resB2b = 0, bestB2b = 0;
    if (bc) {
      for (const [lok, l] of Object.entries(bc.lokationer)) {
        prLokation[lok] = l.lager;
        const kons = l.reserveret_shop_group + Math.max(0, l.disponibelt - l.reserveret_shop_group - Math.max(0, l.bestilt_andre_kunder - l.reserveret_andre_kunder));
        const opt = Math.max(0, l.disponibelt);
        resSG += l.reserveret_shop_group; resB2b += l.reserveret_andre_kunder; bestB2b += l.bestilt_andre_kunder;
        if (lok === "NONFOOD") { vejleFrit += kons; vejleOpt += opt; }
        else {
          // 3PL-lokation (NL-NONFOOD / FI-NONFOOD): BC-tallet dækker typisk det samme som Shopify; tæl kun overskud
          const brand = (Object.keys(BRANDS) as Brand[]).find((b) => BRANDS[b].bcLokation === lok);
          const shopEcom = brand ? rs.find((r) => r.brand === brand)?.lager.ecom ?? 0 : 0;
          tredjepart += Math.max(0, kons - shopEcom); tredjepartOpt += Math.max(0, opt - shopEcom);
        }
      }
    }
    const tilgaengeligt = ecomSum + vejleFrit + tredjepart;
    const tilgaengeligtOpt = ecomSum + vejleOpt + tredjepartOpt;

    // --- på vej: alle PO-linjer for EAN'et ---
    const events: LineEvent[] = [];
    for (const l of poByEan[ean] || []) {
      const d0 = l.forventet || l.planlagt_modtagelse;
      if (!d0) continue;
      let dato = addDays(d0, cfg.receivingDays);
      if (dato < dag0) dato = addDays(dag0, cfg.receivingDays);
      events.push({ dato, stk: l.antal, sikker: l.status === "Bekræftet ETA", po: l.po, status: l.status, lokation: l.lokation, leverandoer: l.leverandoer });
    }
    events.sort((a, b) => a.dato.localeCompare(b.dato));
    const paaVejSikker = events.filter((e) => e.sikker).reduce((a, e) => a + e.stk, 0);
    const paaVejUsikker = events.filter((e) => !e.sikker).reduce((a, e) => a + e.stk, 0);

    // --- projektion ---
    const kons = new Array(HORIZON + 1).fill(0), opt = new Array(HORIZON + 1).fill(0);
    let sK = tilgaengeligt, sO = tilgaengeligtOpt, sN = tilgaengeligt;
    kons[0] = sK; opt[0] = sO;
    let dTil: number | null = null, dKons: number | null = null, dOpt: number | null = null;
    for (let d = 1; d <= HORIZON; d++) {
      const dato = addDays(dag0, d);
      for (const e of events) if (e.dato === dato) { if (e.sikker) { sK += e.stk; sO += e.stk; } else sO += e.stk; }
      sK -= demandPrDag[d]; sO -= demandPrDag[d]; sN -= demandPrDag[d];
      kons[d] = Math.max(0, sK); opt[d] = Math.max(0, sO);
      if (dTil === null && sN <= 0) dTil = d;
      if (dKons === null && sK <= 0) dKons = d;
      if (dOpt === null && sO <= 0) dOpt = d;
    }
    if (afsaeson <= 0.001) { dTil = tilgaengeligt > 0 ? null : 0; dKons = dTil; dOpt = dTil; }
    if (tilgaengeligt <= 0) { dTil = 0; if (dKons === 1) dKons = 0; if (dOpt === 1) dOpt = 0; }

    // --- lead time ---
    const poLev = (poByEan[ean] || [])[0];
    const leverandoer = ov?.leverandoer || poLev?.leverandoer || rs.find((r) => r.leverandoer)?.leverandoer || null;
    const eu = supplierIsEu(leverandoer, poLev?.eu_leverandoer ?? false, ov ?? undefined);
    const erHybrid = ov?.kategori ? ov.kategori === "hybrid" : /hybrid/i.test(titel) || rs.some((r) => /hybrid/i.test(r.titel) || /hybrid/i.test(r.titelOriginal ?? ""));
    const kategori: "hybrid" | "standard" = erHybrid ? "hybrid" : "standard";
    const leadTime = ov?.lead_time ?? (eu ? cfg.leadTimeDefault.eu : erHybrid ? cfg.leadTimeDefault.hybrid : cfg.leadTimeDefault.asia);
    const leadTimeKilde = ov?.lead_time ? `manuelt sat (${ov.af ?? "sitet"})` : eu ? `EU-leverandør${leverandoer ? `: ${leverandoer}` : ""} → ca. 30 dage` : erHybrid ? "Hybrid → 6 mdr." : "øvrige varer → 5 mdr.";
    const daekning = ov?.coverage_days ?? (eu ? cfg.coverageDays.eu : cfg.coverageDays.asia);

    // --- sikkerhedslager og reorder point ---
    const hero = rs.some((r) => r.genbestilling.hero);
    const z = ov?.service_level ? (ov.service_level === "hero" ? cfg.zHero : cfg.zNormal) : hero ? cfg.zHero : cfg.zNormal;
    const sigma = rs.reduce((a, r) => a + r.velocity.afsaeson * cfg.cvByAge[r.alder.gruppe], 0);
    const extra = afsaeson > 0 ? rs.reduce((a, r) => a + cfg.extraSafetyByAge[r.alder.gruppe] * r.velocity.afsaeson, 0) / afsaeson : 0;
    const sikkerhed = Math.ceil(z * sigma * Math.sqrt(leadTime) * (1 + extra));
    let behovLead = 0, behovDaekning = 0;
    for (let d = 1; d <= leadTime + daekning; d++) { if (d <= leadTime) behovLead += demandPrDag[d]; behovDaekning += demandPrDag[d]; }
    const reorderPoint = Math.ceil(behovLead + sikkerhed);
    // Bestil senest: den dag lageret (inkl. alt på vej) rammer sikkerhedslageret, minus lead time + modtagelse.
    // (Ikke "første dag under reorder point" – det slog falsk ud når en PO landede om få dage og dækkede længe.)
    // Kun et hul en ny PO faktisk kan fylde tæller: det første hul på eller efter dagen en ny PO tidligst kan lande.
    // Et hul før det (fx udsolgt indtil en bekræftet PO lander om 10 dage) kan ingen ny ordre gøre noget ved – det er fremrykning/overflytning, ikke indkøb.
    const tidligstNy = leadTime + cfg.receivingDays;
    let bsDag: number | null = null, sikkerhedsDag: number | null = null;
    for (let d = tidligstNy; d <= HORIZON; d++) if (opt[d] <= sikkerhed) { sikkerhedsDag = d; break; }
    if (sikkerhedsDag !== null) bsDag = Math.max(0, sikkerhedsDag - tidligstNy);
    let hulFoer: number | null = null; // første dag før tidligstNy hvor lageret er under sikkerhed (info, ikke en indkøbshandling)
    for (let d = 0; d < tidligstNy; d++) if (opt[d] <= sikkerhed) { hulFoer = d; break; }
    const cll = bc?.stk_pr_colli || poLev?.stk_pr_colli || null;
    const moq = ov?.moq ?? null;
    let foreslaaetStk = Math.max(0, Math.ceil(behovDaekning + sikkerhed - tilgaengeligt - paaVejSikker - paaVejUsikker));
    if (foreslaaetStk > 0 && moq && foreslaaetStk < moq) foreslaaetStk = moq;
    const foreslaaetColli = cll ? Math.ceil(foreslaaetStk / cll) : 0;
    const foreslaaetStkRund = cll ? foreslaaetColli * cll : foreslaaetStk;
    // alternativ: hvis de ubookede PO'er ikke kommer (bruges som startværdi i beregneren når forslaget er 0)
    let udenUbooket = Math.max(0, Math.ceil(behovDaekning + sikkerhed - tilgaengeligt - paaVejSikker));
    if (udenUbooket > 0 && moq && udenUbooket < moq) udenUbooket = moq;
    const udenUbooketRund = cll ? Math.ceil(udenUbooket / cll) * cll : udenUbooket;

    // --- shops ---
    const horizonDemand = rs.map((r, i) => { let t = 0; for (let d = 1; d <= leadTime + daekning; d++) t += r.velocity.afsaeson * seasons[i][isoWeek(addDays(dag0, d))]; return t; });
    const hdSum = horizonDemand.reduce((a, x) => a + x, 0);
    const shops: LineShop[] = rs.map((r, i) => ({
      brand: r.brand, key: r.key, titel: r.titel, velocity: r.velocity.base, afsaeson: r.velocity.afsaeson, trend: r.velocity.trend, ecom: r.lager.ecom,
      dageTilUdsolgt: r.dage.tilUdsolgtMedPaaVej, udsolgt: r.datoer.udsolgtMedPaaVej, status: r.status, hero: r.genbestilling.hero, alder: r.alder.gruppe,
      salgsdage: r.alder.salgsdage, solgt365: r.oekonomi.solgt365, andelAfBehov: hdSum > 0 ? horizonDemand[i] / hdSum : 1 / rs.length,
    }));

    const lineStub = { demandPrDag, paaVej: { events }, lager: { tilgaengeligt }, projektion: { dag0 }, shops, genbestilling: { leadTime, daekningsdage: daekning } };
    const bestilDato = bsDag !== null ? addDays(dag0, bsDag) : null;
    const modtagelse = addDays(bestilDato && bestilDato > dag0 ? bestilDato : dag0, leadTime + cfg.receivingDays);
    const rt = foreslaaetStkRund > 0 ? raekkerTil(lineStub, foreslaaetStkRund, modtagelse) : raekkerTil(lineStub, 0, null);

    // --- status ---
    const bs = bsDag ?? Infinity, dK = dKons ?? Infinity, dO = dOpt ?? Infinity;
    const foersteSikker = events.find((e) => e.sikker)?.dato ?? null;
    const foersteUsikker = events.find((e) => !e.sikker) ?? null;
    let status: LineStatus; let aarsag: string;
    const skjult = ov?.skjul_til && ov.skjul_til >= dag0;
    if (ov?.udgaar) { status = "udgaar"; aarsag = `Markeret som udgår${ov.af ? ` af ${ov.af}` : ""}${ov.note ? ` – ${ov.note}` : ""}`; }
    else if (ov?.ikke_indkoeb) { status = "ikke_indkoeb"; aarsag = `Holdes af shoppen selv${ov.note ? ` – ${ov.note}` : ""}`; }
    else if (skjult) { status = "skjult"; aarsag = `Skjult til ${ov!.skjul_til}${ov?.note ? ` – ${ov.note}` : ""}`; }
    else if (rs.every((r) => r.alder.gruppe === "nyhed")) { status = "for_nyt"; aarsag = "Under 14 dage i salg i alle shops – for lidt data"; }
    else if (base <= 0.05 && rs.every((r) => r.alder.dage > 90)) { status = "overlager"; aarsag = tilgaengeligt > 0 ? "Ingen salg de sidste 60 dage" : "Ingen salg og intet på lager – udgået?"; }
    else if (foreslaaetStkRund === 0 && udenUbooketRund > 0 && foersteUsikker) { status = "book_po"; aarsag = `Tør ${dK === Infinity ? "ikke" : "om " + dK + " dage"} – ubooket PO ${foersteUsikker.po} dækker behovet men kommer først ${foersteUsikker.dato}: book eller fremryk den`; }
    else if (foreslaaetStkRund === 0 && udenUbooketRund === 0) { status = base <= 0.05 ? "overlager" : "daekket"; aarsag = base <= 0.05 ? "Ingen efterspørgsel at regne på – intet at bestille" : "Intet behov ud over det der er på lager og bestilt"; }
    else if (bs <= 0) { status = "bestil_nu"; aarsag = tilgaengeligt <= 0 ? `0 tilgængeligt i alle shops${foersteSikker ? ` – næste bekræftede levering ${foersteSikker}` : foersteUsikker ? ` – kun ubooket PO ${foersteUsikker.po} (${foersteUsikker.dato})` : " og intet på vej"}` : `Lageret inkl. det der er på vej rammer sikkerhedslageret om ${sikkerhedsDag} dage – en ny PO tager ${leadTime + cfg.receivingDays} dage, så den skal afsted nu`; }
    else if (bs <= cfg.status.bestilNuDays) { status = "bestil_14"; aarsag = `Skal bestilles om ${bs} dage for at nå hjem før lageret rammer sikkerhedslageret (om ${sikkerhedsDag} dage)`; }
    else if (bs <= cfg.status.obsDays) { status = "bestil_30"; aarsag = `Skal bestilles om ${bs} dage – lageret rammer sikkerhedslageret om ${sikkerhedsDag} dage`; }
    else if ((dTil ?? Infinity) > cfg.status.overlagerDays && paaVejSikker + paaVejUsikker === 0) { status = "overlager"; aarsag = `Over ${cfg.status.overlagerDays} dages dækning uden nye køb`; }
    else { status = "daekket"; aarsag = (hulFoer !== null ? `Tør om ${hulFoer} dage indtil næste levering${foersteSikker ? ` ${foersteSikker}` : ""} – kan ikke nås med en ny PO (${tidligstNy} dage); derefter ` : "") + (bs === Infinity ? "dækket hele horisonten med det der er bestilt" : `næste bestilling om ${bs} dage`); }

    const salgsdage = Math.max(...rs.map((r) => r.alder.salgsdage));
    const solgt365Sum = rs.some((r) => r.oekonomi.solgt365 != null) ? rs.reduce((a, r) => a + (r.oekonomi.solgt365 ?? 0), 0) : null;
    const dataKvalitet: PurchaseLine["dataKvalitet"] = salgsdage < 30 ? "lav" : salgsdage < 90 ? "middel" : "ok";
    const advarsler: string[] = [];
    if (dataKvalitet === "lav") advarsler.push(`Kun ${salgsdage} dages salgsdata – forslaget bygger på en meget kort periode og kan være langt fra det rigtige. Tjek tallet med egen vurdering før du bestiller.`);
    else if (dataKvalitet === "middel") advarsler.push(`${salgsdage} dages salgsdata – varen er ny, og sæsonmønstret er endnu ikke kendt.`);
    if (rs.some((r) => r.forklaring.some((f) => f.startsWith("Normalt niveau dæmpet")))) advarsler.push("De seneste ugers salg er kampagnedrevet (Black Week) – normalt niveau er dæmpet til 3× årsgennemsnittet.");
    if (!leverandoer) advarsler.push("Ingen leverandør kendt (ingen åben PO). Sæt leverandøren under ⋯ → Sæt leverandør, så kommer varen med på leverandørens liste.");
    const unitCost = rs.find((r) => r.oekonomi.unitCost != null && r.brand === "casper")?.oekonomi.unitCost ?? rs.find((r) => r.oekonomi.unitCost != null)?.oekonomi.unitCost ?? null;

    forklaring.push(`Behov: ${rs.map((r) => `${BRANDS[r.brand].navn} ${r1(r.velocity.base)}`).join(" + ")} = ${r1(base)} stk/dag nu; normalt niveau ${r1(afsaeson)} stk/dag.`);
    forklaring.push(`Salgsdata: ${salgsdage} dage${salgsdage < 365 ? " – varen er ny, så 365-dages tallet dækker kun den periode" : ""}${solgt365Sum != null ? `; solgt ${solgt365Sum} stk = ${r1(solgt365Sum / Math.max(1, Math.min(365, salgsdage)))} stk/dag i snit over hele perioden (vægtet velocity bruger de seneste 7/30/60 dage)` : ""}.`);
    forklaring.push(`Tilgængeligt: ${ecomSum} på shop-lokationer + ${Math.round(vejleFrit)} frit i Vejle${tredjepart ? ` + ${Math.round(tredjepart)} på 3PL` : ""} = ${Math.round(tilgaengeligt)} stk. B2B binder ${resB2b} reserveret og ${bestB2b} bestilt.`);
    forklaring.push(`På vej: ${paaVejSikker} stk bekræftet, ${paaVejUsikker} stk ubooket${foersteSikker ? `, første sikre ${foersteSikker}` : ""}.`);
    forklaring.push(`Lead time ${leadTime} dage (${leadTimeKilde}). Behov i lead time ${Math.round(behovLead)} stk + sikkerhedslager ${sikkerhed} stk (z ${z}, σ ${r1(sigma)}) = reorder point ${reorderPoint} stk.`);
    forklaring.push(`Foreslået: behov i lead time + ${daekning} dages dækning (${Math.round(behovDaekning)} stk) + sikkerhed − tilgængeligt − på vej = ${foreslaaetStkRund} stk${cll ? ` (${foreslaaetColli} colli à ${cll})` : ""}${moq ? `, MOQ ${moq}` : ""}.`);
    if (rt.dato) forklaring.push(`Den foreslåede mængde rækker til ${rt.dato}${rt.dageEfterModtagelse != null ? ` (${rt.dageEfterModtagelse} dage efter modtagelse)` : ""}.`);

    lines.push({
      ean, bcSku: bc?.bc_sku ?? null, titel, shopTitler: [...new Set(rs.map((r) => r.titelOriginal ?? r.titel))], brands: rs.map((r) => r.brand), shops,
      status, statusAarsag: aarsag, hero, leverandoer, indkoeber: poLev?.indkoeber ?? null,
      velocity: { base: r1(base), afsaeson: r1(afsaeson), trend: Math.round(trend * 100) / 100, solgt365: solgt365Sum, salgsdage, snitPrDag: solgt365Sum != null && salgsdage > 0 ? r1(solgt365Sum / Math.min(365, salgsdage)) : null },
      dataKvalitet, advarsler,
      lager: { ecomSum, vejleFrit: Math.round(vejleFrit), vejleOptimistisk: Math.round(vejleOpt), tredjepart: Math.round(tredjepart), tredjepartOptimistisk: Math.round(tredjepartOpt), reserveretShopGroup: resSG, reserveretB2b: resB2b, bestiltB2b: bestB2b, tilgaengeligt: Math.round(tilgaengeligt), tilgaengeligtOptimistisk: Math.round(tilgaengeligtOpt), prLokation },
      paaVej: { sikker: paaVejSikker, usikker: paaVejUsikker, foersteSikker, foersteUsikker: foersteUsikker?.dato ?? null, events },
      dage: { tilUdsolgt: dTil, medPaaVej: dKons, optimistisk: dOpt, bestilSenest: bsDag },
      datoer: { udsolgt: dTil !== null ? addDays(dag0, dTil) : null, medPaaVej: dKons !== null ? addDays(dag0, dKons) : null, optimistisk: dOpt !== null ? addDays(dag0, dOpt) : null, bestilSenest: bestilDato, raekkerTil: rt.dato },
      genbestilling: { leadTime, leadTimeKilde, kategori, eu, daekningsdage: daekning, sikkerhedslager: sikkerhed, reorderPoint, behovLeadTime: Math.round(behovLead), behovDaekning: Math.round(behovDaekning), foreslaaetStk: foreslaaetStkRund, foreslaaetColli, foreslaaetUdenUbooket: udenUbooketRund, stkPrColli: cll, moq, z, sigma: r1(sigma), raekkerDage: rt.dageEfterModtagelse },
      fordeling: foreslaaetStkRund > 0 ? fordel(lineStub, foreslaaetStkRund) : [],
      oekonomi: { unitCost, lagervaerdi: unitCost != null ? Math.round(unitCost * tilgaengeligt) : null },
      demandPrDag: demandPrDag.map((x) => Math.round(x * 10) / 10),
      projektion: { dag0, konservativ: kons.slice(0, CHART_DAYS + 1).map(Math.round), optimistisk: opt.slice(0, CHART_DAYS + 1).map(Math.round) },
      override: ov, plan: null, forklaring,
    });
  }
  lines.sort((a, b) => LINE_STATUS_META[a.status].orden - LINE_STATUS_META[b.status].orden || (a.dage.bestilSenest ?? 9999) - (b.dage.bestilSenest ?? 9999) || b.velocity.base - a.velocity.base);
  return lines;
}
