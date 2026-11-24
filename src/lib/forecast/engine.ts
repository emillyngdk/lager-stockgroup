import { buildPurchaseLines, LINE_STATUS_META, type PurchaseLine, type LineOverride, type LineStatus } from "./purchase";
import {
  AgeGroup, Brand, BRANDS, Config, DEFAULT_CONFIG, ForecastOutput, ForecastRow, InboundEvent, Override, PoLine,
  Snapshot, Status, UniversalRow, Variant,
} from "./types";

// ---------- små hjælpere ----------
const DAY = 86400000;
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => iso(new Date(new Date(d + "T00:00:00Z").getTime() + n * DAY));
const daysBetween = (a: string, b: string) => Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / DAY);
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const r1 = (x: number) => Math.round(x * 10) / 10;

export function isoWeek(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - firstThu.getTime()) / DAY - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
}

// ---------- sæsonindeks ----------
/** Ugeindeks (1..53) ud fra en dagsserie med units. Kræver mindst ~300 dage; ellers null. */
export function seasonIndex(series: Record<string, number>, cfg: Config): number[] | null {
  const days = Object.keys(series).sort();
  if (days.length < 300) return null;
  const perWeek: Record<number, { sum: number; n: number }> = {};
  for (const d of days) {
    const w = isoWeek(d);
    perWeek[w] ??= { sum: 0, n: 0 };
    perWeek[w].sum += series[d]; perWeek[w].n++;
  }
  const weekly: number[] = new Array(54).fill(NaN);
  for (let w = 1; w <= 53; w++) if (perWeek[w] && perWeek[w].n >= 5) weekly[w] = perWeek[w].sum / perWeek[w].n * 7;
  const vals = weekly.filter((x) => !isNaN(x));
  if (vals.length < 40) return null;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  // uge 53 arver uge 52
  if (isNaN(weekly[53])) weekly[53] = weekly[52];
  const raw = weekly.map((x) => (isNaN(x) ? 1 : x / mean));
  // glidende gennemsnit (cirkulært) og klem
  const k = Math.floor(cfg.seasonSmoothWeeks / 2);
  const out = new Array(54).fill(1);
  for (let w = 1; w <= 52; w++) {
    let s = 0, n = 0;
    for (let j = -k; j <= k; j++) { let ww = w + j; if (ww < 1) ww += 52; if (ww > 52) ww -= 52; s += raw[ww]; n++; }
    out[w] = clamp(s / n, cfg.seasonClamp[0], cfg.seasonClamp[1]);
  }
  out[53] = out[52];
  return out;
}

// ---------- alder ----------
export function ageGroup(days: number): AgeGroup {
  if (days < 14) return "nyhed";
  if (days < 56) return "ung";
  if (days < 365) return "etableret";
  return "moden";
}

// ---------- lead time / region ----------
const EU_HINTS = ["tenzi", "solania", "sorrento", "italia", "sp. z o.o", "gmbh", "b.v.", "a/s", "aps", "ab ", "oy"];
export function supplierRegion(lev: string | null, euFlag: boolean): "asia" | "eu" {
  if (euFlag) return "eu";
  const l = (lev || "").toLowerCase();
  return EU_HINTS.some((h) => l.includes(h)) ? "eu" : "asia";
}

// ---------- hovedkørsel ----------
export function runForecast(snap: Snapshot, overrides: Record<string, Override> = {}, cfg: Config = DEFAULT_CONFIG, today?: string): ForecastOutput {
  const dag0 = today ?? iso(new Date());
  const H = cfg.horizonDays;

  // sæson: brug den længste serie (>=300 dage) som fælles indeks; hvert brand bruger egen, hvis den findes
  const seasonByBrand: Partial<Record<Brand, number[]>> = {};
  let fallback: { brand: Brand; idx: number[] } | null = null;
  for (const b of Object.keys(snap.dayseries) as Brand[]) {
    const idx = seasonIndex(snap.dayseries[b], cfg);
    if (idx) { seasonByBrand[b] = idx; if (!fallback || Object.keys(snap.dayseries[b]).length > Object.keys(snap.dayseries[fallback.brand]).length) fallback = { brand: b, idx }; }
  }
  const seasonFor = (b: Brand): { idx: number[]; kilde: string } =>
    seasonByBrand[b] ? { idx: seasonByBrand[b]!, kilde: `${BRANDS[b].navn}s egen historik` } : fallback ? { idx: fallback.idx, kilde: `lånt fra ${BRANDS[fallback.brand].navn}` } : { idx: new Array(54).fill(1), kilde: "ingen sæson (for lidt historik)" };

  // produktsalg pr. brand -> pr. product_id
  const salesOf = (b: Brand, pid: string) => {
    const s = snap.sales[b] || {};
    const d7 = s.d7?.rows[pid], d30 = s.d30?.rows[pid], d365 = s.d365?.rows[pid];
    return {
      s365: d365?.solgt ?? null, s7: d7?.solgt ?? 0, s8_14: d7?.solgt_foer ?? 0, s30: d30?.solgt ?? 0, s31_60: d30?.solgt_foer ?? 0,
      lager: d30?.lager ?? d7?.lager ?? null, dbPrStk: d30?.db_pr_stk ?? null, nyeKunder: d30?.nye_kunder ?? null, db: d30?.db ?? 0, titel: d30?.titel,
    };
  };

  // hero: top X% af DB pr. brand (d30)
  const heroSet = new Set<string>();
  for (const b of Object.keys(snap.sales) as Brand[]) {
    const rows = Object.entries(snap.sales[b].d30?.rows || {}).map(([pid, r]) => ({ pid, db: r.db || 0 })).filter((x) => x.db > 0).sort((a, c) => c.db - a.db);
    const total = rows.reduce((a, x) => a + x.db, 0);
    let acc = 0;
    for (const x of rows) { heroSet.add(`${b}:${x.pid}`); acc += x.db; if (acc >= total * (1 - cfg.heroShareOfDb) * 0 + total * 0 + total * cfg.heroShareOfDb * 0) { /* noop */ } if (acc >= total * 0.8) break; }
  }
  // (top-produkter der tilsammen udgør 80 % af DB = hero; det svarer typisk til ~20 % af varerne)

  // PO-linjer pr. EAN
  const poByEan: Record<string, PoLine[]> = {};
  for (const l of snap.po_lines) (poByEan[l.ean] ??= []).push(l);

  // varianter pr. EAN (til universelle + andele)
  const variantsByEan: Record<string, Variant[]> = {};
  for (const v of snap.variants) if (v.ean) (variantsByEan[v.ean] ??= []).push(v);

  // bundles med komponenter: læg bundlens salg oven i komponenterne
  const bundleExtra: Record<string, { s7: number; s8_14: number; s30: number; s31_60: number }> = {};
  for (const v of snap.variants) {
    if (!v.components) continue;
    const s = salesOf(v.brand, v.product_id);
    for (const c of v.components) {
      const k = `${v.brand}:${c}`;
      bundleExtra[k] ??= { s7: 0, s8_14: 0, s30: 0, s31_60: 0 };
      bundleExtra[k].s7 += s.s7; bundleExtra[k].s8_14 += s.s8_14; bundleExtra[k].s30 += s.s30; bundleExtra[k].s31_60 += s.s31_60;
    }
  }

  // --- første pass: velocity pr. variant (bruges til andele af fælles pulje) ---
  type Pre = { v: Variant; vel: ReturnType<typeof velocityFor> };
  const velocityFor = (v: Variant) => {
    const s = salesOf(v.brand, v.product_id);
    const sameProduct = snap.variants.filter((x) => x.brand === v.brand && x.product_id === v.product_id).length;
    const share = sameProduct > 1 ? 1 / sameProduct : 1; // produktsalg deles ligeligt på varianter
    const ex = v.ean ? bundleExtra[`${v.brand}:${v.ean}`] : undefined;
    const s7 = s.s7 * share + (ex?.s7 ?? 0), s8_14 = s.s8_14 * share + (ex?.s8_14 ?? 0), s30 = s.s30 * share + (ex?.s30 ?? 0), s31_60 = s.s31_60 * share + (ex?.s31_60 ?? 0);
    const pub = v.published_at || v.created_at || dag0;
    const ageDays = Math.max(0, daysBetween(pub, dag0));
    const grp = ageGroup(ageDays);
    const v7 = s7 / 7, v14 = (s7 + s8_14) / 14, v30 = s30 / 30, v60 = (s30 + s31_60) / 60;
    let base: number;
    if (grp === "nyhed") base = v7;
    else if (grp === "ung") base = 0.6 * v7 + 0.4 * v30;
    else base = cfg.weights.v7 * v7 + cfg.weights.v30 * v30 + cfg.weights.v60 * v60;
    const trend = v60 > 0 ? clamp(v14 / v60 - 1, -0.9, 3) : v14 > 0 ? 1 : 0;
    return { s, share, sameProduct, ageDays, grp, v7, v14, v30, v60, base, trend, pub };
  };
  const isGiftOrDemo = (v: Variant) => /100% off|🎁|\*demo\*/i.test(v.title) || /^d-/i.test(v.sku || "");
  const pres: Pre[] = snap.variants.filter((v) => !isGiftOrDemo(v)).map((v) => ({ v, vel: velocityFor(v) }));
  // gave-/demo-varianter med samme EAN i samme brand: læg deres salg oven i hovedvarianten
  for (const g of snap.variants.filter(isGiftOrDemo)) {
    if (!g.ean) continue;
    const main = pres.find((p) => p.v.brand === g.brand && p.v.ean === g.ean);
    if (!main) continue;
    const gs = velocityFor(g);
    main.vel.v7 += gs.v7; main.vel.v14 += gs.v14; main.vel.v30 += gs.v30; main.vel.v60 += gs.v60; main.vel.base += gs.base;
  }

  // andel af fælles Vejle-pulje pr. EAN (fordelt på brands der bruger NONFOOD)
  const shareOfPool: Record<string, number> = {};
  for (const [ean, vs] of Object.entries(variantsByEan)) {
    const users = pres.filter((p) => p.v.ean === ean && BRANDS[p.v.brand].bcLokation === "NONFOOD");
    const tot = users.reduce((a, p) => a + p.vel.base, 0);
    for (const p of users) shareOfPool[`${p.v.brand}:${p.v.variant_id}`] = tot > 0 ? p.vel.base / tot : 1 / users.length;
  }

  const rows: ForecastRow[] = [];
  const udenKobling: ForecastOutput["udenKobling"] = [];

  for (const { v, vel } of pres) {
    const key = `${v.brand}:${v.variant_id}`;
    const ov = overrides[key] || (v.ean ? overrides[v.ean] : undefined) || {};
    if (!v.ean) {
      const s = vel.s;
      if (!v.components && (s.s30 > 0 || (v.shopify_qty ?? 0) > 0) && !/gavekort|cadeaubon|lahjakortti|levering|reversio|\*demo\*/i.test(v.title))
        udenKobling.push({ brand: v.brand, variant_id: v.variant_id, titel: v.title, sku: v.sku, solgt30: s.s30, grund: v.sku ? "SKU er ikke et EAN" : "Ingen SKU/EAN i Shopify (pakke eller manuel vare)" });
      continue;
    }
    const bc = snap.bc_stock[v.ean];
    const bcLoc = BRANDS[v.brand].bcLokation;
    const loc = bc?.lokationer[bcLoc];
    const { idx: S, kilde: saesonKilde } = seasonFor(v.brand);
    const wNow = isoWeek(dag0);
    const saesonNu = S[wNow];
    const avgS = (n: number) => { let t = 0; for (let d = 0; d < n; d++) t += S[isoWeek(addDays(dag0, -d))]; return t / n; };
    const a7 = avgS(7), a14 = avgS(14), a30 = avgS(30), a60 = avgS(60);
    let afsaeson: number;
    if (vel.grp === "nyhed") afsaeson = vel.v7 / a7;
    else if (vel.grp === "ung") afsaeson = 0.6 * vel.v7 / a7 + 0.4 * vel.v30 / a30;
    else afsaeson = cfg.weights.v7 * vel.v7 / a7 + cfg.weights.v30 * vel.v30 / a30 + cfg.weights.v60 * vel.v60 / a60;
    vel.trend = vel.v60 > 0 ? clamp((vel.v14 / a14) / (vel.v60 / a60) - 1, -0.9, 3) : vel.v14 > 0 ? 1 : 0;

    // lagerpuljer
    const ecom = Math.max(0, v.shopify_qty ?? 0);
    const andel = bcLoc === "NONFOOD" ? (shareOfPool[key] ?? 1) : 1;
    const is3pl = bcLoc !== "NONFOOD";
    // Konservativ: Shop Groups egne reservationer er vores; resten af det disponible er i konkurrence med B2B-ordrer, der endnu ikke er reserveret.
    const poolKons = loc ? loc.reserveret_shop_group + Math.max(0, loc.disponibelt - loc.reserveret_shop_group - Math.max(0, loc.bestilt_andre_kunder - loc.reserveret_andre_kunder)) : 0;
    const poolOpt = loc ? Math.max(0, loc.disponibelt) : 0;
    const vejleFrit = loc ? (is3pl ? Math.max(0, poolKons - ecom) : poolKons * andel) : 0;
    const vejleOpt = loc ? (is3pl ? Math.max(0, poolOpt - ecom) : poolOpt * andel) : 0;
    const resSG = loc ? loc.reserveret_shop_group : 0;
    const resB2b = loc ? loc.reserveret_andre_kunder : 0;
    const bestB2b = loc ? loc.bestilt_andre_kunder : 0;

    // på vej (kun linjer til brandets BC-lokation; NONFOOD deles efter andel)
    const events: InboundEvent[] = [];
    for (const l of poByEan[v.ean] || []) {
      if (l.lokation !== bcLoc) continue;
      const sikker = l.status === "Bekræftet ETA";
      const d0 = l.forventet || l.planlagt_modtagelse;
      if (!d0) continue;
      let dato = addDays(d0, cfg.receivingDays + (bcLoc === "NONFOOD" ? cfg.transferDays : 0));
      if (dato < dag0) dato = addDays(dag0, cfg.receivingDays); // overskredet: regn med "snart", men usikkert
      events.push({ dato, stk: Math.round(l.antal * andel), sikker, po: l.po, status: l.status, lokation: l.lokation, leverandoer: l.leverandoer });
    }
    events.sort((a, b) => a.dato.localeCompare(b.dato));
    const paaVejSikker = events.filter((e) => e.sikker).reduce((a, e) => a + e.stk, 0);
    const paaVejUsikker = events.filter((e) => !e.sikker).reduce((a, e) => a + e.stk, 0);

    // projektion
    const kons: number[] = new Array(H + 1).fill(0);
    const opt: number[] = new Array(H + 1).fill(0);
    let sK = ecom + vejleFrit, sO = ecom + vejleOpt;
    kons[0] = sK; opt[0] = sO;
    let dageTilUdsolgt: number | null = null, dageMedPaaVej: number | null = null, dageOpt: number | null = null;
    let stockNoInbound = ecom + vejleFrit;
    for (let d = H + 1; d <= 400 && vel.base > 0; d++) { /* placeholder, erstattes nedenfor */ break; }
    for (let d = 1; d <= H; d++) {
      const dato = addDays(dag0, d);
      const w = isoWeek(dato);
      const demand = afsaeson * S[w];
      for (const e of events) if (e.dato === dato) { if (e.sikker) { sK += e.stk; sO += e.stk; } else sO += e.stk; }
      sK -= demand; sO -= demand; stockNoInbound -= demand;
      kons[d] = Math.max(0, sK); opt[d] = Math.max(0, sO);
      if (dageTilUdsolgt === null && stockNoInbound <= 0) dageTilUdsolgt = d;
      if (dageMedPaaVej === null && sK <= 0) dageMedPaaVej = d;
      if (dageOpt === null && sO <= 0) dageOpt = d;
    }
    if (dageTilUdsolgt === null && vel.base > 0) {
      for (let d = H + 1; d <= 400; d++) { stockNoInbound -= afsaeson * S[isoWeek(addDays(dag0, d))]; if (stockNoInbound <= 0) { dageTilUdsolgt = d; break; } }
    }
    const tilgaengeligt = ecom + vejleFrit;
    const tilgaengeligtOpt = ecom + vejleOpt;
    if (vel.base <= 0) { dageTilUdsolgt = tilgaengeligt > 0 ? null : 0; dageMedPaaVej = dageTilUdsolgt; dageOpt = dageTilUdsolgt; }
    if (tilgaengeligt <= 0) { dageTilUdsolgt = 0; if (dageMedPaaVej === 1) dageMedPaaVej = 0; if (dageOpt === 1) dageOpt = 0; }

    // genbestilling
    const poLev = (poByEan[v.ean] || [])[0];
    const region = supplierRegion(poLev?.leverandoer ?? null, poLev?.eu_leverandoer ?? false);
    const erHybrid = /hybrid/i.test(v.title) || /hybrid/i.test(v.title_original ?? "") || /hybrid/i.test(bc?.navn ?? "");
    const ltKey = region === "eu" ? "eu" : erHybrid ? "hybrid" : "asia";
    const leadTime = ov.lead_time ?? cfg.leadTimeDefault[ltKey];
    const leadTimeKilde = ov.lead_time ? "manuel" : region === "eu" ? "EU-leverandør, ca. 30 dage" : erHybrid ? "Hybrid, 6 mdr." : "øvrige varer, 5 mdr.";
    const hero = ov.service_level ? ov.service_level === "hero" : heroSet.has(`${v.brand}:${v.product_id}`);
    const z = hero ? cfg.zHero : cfg.zNormal;
    const sigma = vel.base * cfg.cvByAge[vel.grp];
    const sikkerhed = Math.ceil(z * sigma * Math.sqrt(leadTime) * (1 + cfg.extraSafetyByAge[vel.grp]));
    // forventet salg i lead time (med sæson)
    let demandLead = 0, demandCover = 0;
    const daekning = ov.coverage_days ?? cfg.coverageDays[region];
    for (let d = 1; d <= leadTime + daekning; d++) {
      const dem = afsaeson * S[isoWeek(addDays(dag0, d))];
      if (d <= leadTime) demandLead += dem;
      demandCover += dem;
    }
    const reorderPoint = Math.ceil(demandLead + sikkerhed);
    // bestil senest = første dag hvor projektionen med ALLE åbne PO'er (de er jo bestilt) <= reorder point
    let bestilSenestDag: number | null = null;
    for (let d = 0; d <= H; d++) if (opt[d] <= reorderPoint) { bestilSenestDag = d; break; }
    const foreslaaetStk = Math.max(0, Math.ceil(demandCover + sikkerhed - tilgaengeligt - paaVejSikker - paaVejUsikker));
    const cll = bc?.stk_pr_colli || poLev?.stk_pr_colli || null;
    const foreslaaetColli = cll ? Math.ceil(foreslaaetStk / cll) : 0;
    const foreslaaetStkRund = cll ? foreslaaetColli * cll : foreslaaetStk;

    // status
    let status: Status; let aarsag: string;
    const foersteSikker = events.find((e) => e.sikker)?.dato ?? null;
    const foersteUsikker = events.find((e) => !e.sikker) ?? null;
    const dK = dageMedPaaVej ?? Infinity;   // tør (kun bekræftede leveringer)
    const dO = dageOpt ?? Infinity;         // tør (alle åbne PO'er)
    const bs = bestilSenestDag ?? Infinity; // dage til ny ordre skal afsted
    if (ov.udgaar) { status = "overlager"; aarsag = "Markeret som udgår – genbestilles ikke"; }
    else if (vel.grp === "nyhed") { status = "for_nyt"; aarsag = `Kun ${vel.ageDays} dage i salg – for lidt data endnu`; }
    else if (tilgaengeligt <= 0) { status = "udsolgt"; aarsag = vel.base <= 0.05 ? "0 på lager og ingen salg i 60 dage – udgået?" : foersteSikker ? `0 tilgængeligt – næste bekræftede levering ${foersteSikker}` : foersteUsikker ? `0 tilgængeligt – kun ubooket PO ${foersteUsikker.po} (${foersteUsikker.dato})` : "0 tilgængeligt og intet på vej"; }
    else if (vel.base <= 0.05 && vel.ageDays > 90) { status = "overlager"; aarsag = "Ingen salg de sidste 60 dage"; }
    else if (dK <= cfg.status.bestilNuDays) { status = "kritisk"; aarsag = `Tør om ${dK} dage${foersteUsikker ? ` – kun ubooket PO ${foersteUsikker.po} (${foersteUsikker.dato}) kan redde det` : " og intet bekræftet på vej"}`; }
    else if (bs <= 0 && dO <= leadTime) { status = "kritisk"; aarsag = `Selv med alle åbne PO'er tør varen om ${dO} dage – ny ordre tager ${leadTime} dage`; }
    else if (bs <= cfg.status.bestilNuDays && foreslaaetStkRund === 0 && foersteUsikker && dO > dK) { status = "obs"; aarsag = `Tør ${dK === Infinity ? "ikke" : "om " + dK + " dage"} – ubooket PO ${foersteUsikker.po} dækker behovet, men kommer først ${foersteUsikker.dato}: book eller fremryk den`; }
    else if (bs <= cfg.status.bestilNuDays) { status = "bestil_nu"; aarsag = bs <= 0 ? "Reorder point er nået – ny PO skal afsted nu" : `Rammer reorder point om ${bs} dage`; }
    else if (dK <= cfg.status.obsDays && dO > dK) { status = "obs"; aarsag = `Tør om ${dK} dage hvis ubooket PO ${foersteUsikker?.po ?? ""} ikke kommer hjem i tide`; }
    else if ((dageTilUdsolgt ?? Infinity) > cfg.status.overlagerDays && paaVejSikker + paaVejUsikker === 0) { status = "overlager"; aarsag = `Over ${cfg.status.overlagerDays} dages dækning uden nye køb`; }
    else if (bs <= cfg.status.obsDays) { status = "obs"; aarsag = `Rammer reorder point om ${bs} dage`; }
    else if (vel.trend > cfg.status.trendObs && (dageTilUdsolgt ?? Infinity) < 120) { status = "obs"; aarsag = `Salget stiger ${Math.round(vel.trend * 100)} % – hold øje`; }
    else { status = "ok"; aarsag = `Dækket ${dO === Infinity ? "hele horisonten" : dO + " dage"} med det der er bestilt`; }

    const forklaring = [
      `Salg: ${r1(vel.v7)} stk/dag (7 d), ${r1(vel.v30)} (30 d), ${r1(vel.v60)} (60 d) → vægtet ${r1(vel.base)} stk/dag.`,
      `Sæson: uge ${wNow} ligger på ${(saesonNu * 100).toFixed(0)} % af årsgennemsnittet (${saesonKilde}); de sidste 30 dage lå på ${(a30 * 100).toFixed(0)} % → normalt niveau ${r1(afsaeson)} stk/dag.`,
      `Alder: ${vel.ageDays} dage i salg (${vel.grp}) → sikkerhedstillæg ${Math.round(cfg.extraSafetyByAge[vel.grp] * 100)} %.`,
      `Tilgængeligt: ${ecom} på ${BRANDS[v.brand].navn}s lokation + ${Math.round(vejleFrit)} frit i ${bcLoc}${andel < 1 ? ` (din andel ${Math.round(andel * 100)} %)` : ""} = ${Math.round(tilgaengeligt)} stk.`,
      `På vej: ${paaVejSikker} stk bekræftet (booket), ${paaVejUsikker} stk bestilt men ikke booket${foersteSikker ? `, første sikre ${foersteSikker}` : ""}.`,
      `Lead time ${leadTime} dage (${leadTimeKilde}), servicegrad ${hero ? "95 % (hero)" : "90 %"}, sikkerhedslager ${sikkerhed} stk, reorder point ${reorderPoint} stk.`,
      `Foreslået: dækning ${daekning} dage efter modtagelse → ${foreslaaetStkRund} stk${cll ? ` (${foreslaaetColli} colli à ${cll})` : ""}.`,
    ];
    if (vel.sameProduct > 1) forklaring.push(`Produktet har ${vel.sameProduct} varianter – salget er delt ligeligt (Jullytics rapporterer pr. produkt).`);

    rows.push({
      key, brand: v.brand, variant_id: v.variant_id, product_id: v.product_id, ean: v.ean, bc_sku: bc?.bc_sku ?? null,
      titel: v.title, titelOriginal: v.title_original && v.title_original !== v.title ? v.title_original : null, product_type: v.product_type, status, statusAarsag: aarsag,
      alder: { dage: vel.ageDays, gruppe: vel.grp, publiceret: v.published_at },
      velocity: { v7: r1(vel.v7), v14: r1(vel.v14), v30: r1(vel.v30), v60: r1(vel.v60), base: r1(vel.base), afsaeson: r1(afsaeson), trend: Math.round(vel.trend * 100) / 100, saesonNu: Math.round(saesonNu * 100) / 100, saesonKilde },
      lager: { ecom, vejleFrit: Math.round(vejleFrit), vejleOptimistisk: Math.round(vejleOpt), reserveretShopGroup: resSG, reserveretB2b: resB2b, bestiltB2b: bestB2b, tilgaengeligt: Math.round(tilgaengeligt), tilgaengeligtOptimistisk: Math.round(tilgaengeligtOpt), andel: Math.round(andel * 100) / 100, lokation: Object.keys(v.levels)[0] || "Shopify", shopifyQty: v.shopify_qty, bcLokation: loc ? bcLoc : null },
      paaVej: { sikker: paaVejSikker, usikker: paaVejUsikker, foersteEta: events[0]?.dato ?? null, events },
      dage: { tilUdsolgt: dageTilUdsolgt, tilUdsolgtMedPaaVej: dageMedPaaVej, tilUdsolgtOptimistisk: dageOpt },
      datoer: { udsolgt: dageTilUdsolgt === null ? null : addDays(dag0, dageTilUdsolgt), udsolgtMedPaaVej: dageMedPaaVej === null ? null : addDays(dag0, dageMedPaaVej), udsolgtOptimistisk: dageOpt === null ? null : addDays(dag0, dageOpt), bestilSenest: bestilSenestDag === null ? null : addDays(dag0, bestilSenestDag) },
      genbestilling: { leadTime, leadTimeKilde, sikkerhedslager: sikkerhed, reorderPoint, foreslaaetStk: foreslaaetStkRund, foreslaaetColli, stkPrColli: cll, daekningsdage: daekning, hero, z, sigma: r1(sigma), region },
      projektion: { dag0, konservativ: kons.map((x) => Math.round(x)), optimistisk: opt.map((x) => Math.round(x)) },
      oekonomi: { dbPrStk: vel.s.dbPrStk, unitCost: v.unit_cost, lagervaerdi: v.unit_cost != null ? Math.round(v.unit_cost * ecom) : null, nyeKunder: vel.s.nyeKunder, solgt365: vel.s.s365 },
      universel: (variantsByEan[v.ean] || []).filter((x) => x.brand !== v.brand).length > 0,
      brandsMedEan: [...new Set((variantsByEan[v.ean] || []).map((x) => x.brand))],
      leverandoer: poLev?.leverandoer ?? null, indkoeber: poLev?.indkoeber ?? null,
      forklaring,
    });
  }

  // universelle: samlet pr. EAN
  const universelle: UniversalRow[] = [];
  for (const [ean, vs] of Object.entries(variantsByEan)) {
    const brands = [...new Set(vs.map((x) => x.brand))];
    if (brands.length < 2) continue;
    const rs = rows.filter((r) => r.ean === ean);
    if (!rs.length) continue;
    const bc = snap.bc_stock[ean];
    const non = bc?.lokationer["NONFOOD"];
    const vejleFrit = non ? Math.max(0, non.disponibelt_efter_alle_andre_kunders_ordrer) : 0;
    const velocitySum = rs.reduce((a, r) => a + r.velocity.afsaeson, 0);
    const ecomSum = rs.reduce((a, r) => a + r.lager.ecom, 0);
    const sikker = (poByEan[ean] || []).filter((l) => l.status === "Bekræftet ETA").reduce((a, l) => a + l.antal, 0);
    const usikker = (poByEan[ean] || []).filter((l) => l.status !== "Bekræftet ETA").reduce((a, l) => a + l.antal, 0);
    const dage = velocitySum > 0 ? Math.floor((ecomSum + vejleFrit) / velocitySum) : null;
    const worst = rs.slice().sort((a, b) => (a.dage.tilUdsolgtMedPaaVej ?? 9999) - (b.dage.tilUdsolgtMedPaaVej ?? 9999))[0];
    const status = rs.map((r) => r.status).sort((a, b) => (STATUS_ORDER[a] - STATUS_ORDER[b]))[0];
    universelle.push({
      ean, titel: bc?.navn || rs[0].titel, brands, velocitySum: r1(velocitySum), vejleFrit, ecomSum, paaVejSikker: sikker, paaVejUsikker: usikker,
      dageTilUdsolgt: dage, bestilSenest: worst.datoer.bestilSenest, foreslaaetStk: rs.reduce((a, r) => a + r.genbestilling.foreslaaetStk, 0),
      foreslaaetColli: rs.reduce((a, r) => a + r.genbestilling.foreslaaetColli, 0), status,
      prBrand: rs.map((r) => ({ brand: r.brand, velocity: r.velocity.base, ecom: r.lager.ecom, dage: r.dage.tilUdsolgtMedPaaVej, status: r.status, key: r.key })),
    });
  }

  // opsummering
  const empty = (): Record<Status, number> => ({ udsolgt: 0, kritisk: 0, bestil_nu: 0, obs: 0, ok: 0, overlager: 0, for_nyt: 0, uden_kobling: 0 });
  const opsummering = { ...empty(), total: rows.length } as ForecastOutput["opsummering"];
  const prBrand = { gladkokken: empty(), casper: empty(), herman: empty(), tomi: empty() } as ForecastOutput["prBrand"];
  for (const r of rows) { opsummering[r.status]++; prBrand[r.brand][r.status]++; }
  opsummering.uden_kobling = udenKobling.length;

  // ugens forslag pr. leverandør
  const forslagMap: Record<string, ForecastOutput["forslag"][0]["linjer"]> = {};
  for (const r of rows) {
    if (!["kritisk", "bestil_nu", "obs", "udsolgt"].includes(r.status) || r.genbestilling.foreslaaetStk <= 0) continue;
    const lev = r.leverandoer || "Ukendt leverandør";
    (forslagMap[lev] ??= []).push({
      key: r.key, brand: r.brand, titel: r.titel, ean: r.ean!, bestilSenest: r.datoer.bestilSenest, foreslaaetStk: r.genbestilling.foreslaaetStk,
      foreslaaetColli: r.genbestilling.foreslaaetColli, status: r.status,
      begrundelse: `Sælger ${r.velocity.base} stk/dag, ${r.lager.tilgaengeligt} tilgængeligt, ${r.paaVej.sikker} bekræftet på vej → ${r.datoer.udsolgtMedPaaVej ? `tør ${r.datoer.udsolgtMedPaaVej}` : "ingen udsolgt-dato i horisonten"}; lead time ${r.genbestilling.leadTime} dage.`,
    });
  }
  const forslag = Object.entries(forslagMap).map(([leverandoer, linjer]) => ({ leverandoer, linjer: linjer.sort((a, b) => (a.bestilSenest || "9999").localeCompare(b.bestilSenest || "9999")) })).sort((a, b) => b.linjer.length - a.linjer.length);

  const seasonMeta = fallback ? { kilde: `${BRANDS[fallback.brand].navn} ${snap.sources.dayseries_range[fallback.brand]?.join(" – ")}`, ugeIndeks: fallback.idx.map((x) => Math.round(x * 100) / 100) } : { kilde: "ingen", ugeIndeks: new Array(54).fill(1) };

  rows.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (a.status === "udsolgt" ? b.velocity.base - a.velocity.base : (a.dage.tilUdsolgtMedPaaVej ?? 9999) - (b.dage.tilUdsolgtMedPaaVej ?? 9999)));

  // --- v2: indkøbslinjer pr. EAN ---
  const linjer = buildPurchaseLines(rows, snap, cfg, dag0, seasonFor, overrides as Record<string, LineOverride>, poByEan);
  const opsLinjer = Object.fromEntries(Object.keys(LINE_STATUS_META).map((k) => [k, 0])) as Record<LineStatus, number>;
  for (const l of linjer) opsLinjer[l.status]++;
  const forslagEanMap: Record<string, ForecastOutput["forslagEan"][0]["linjer"]> = {};
  for (const l of linjer) {
    if (!["bestil_nu", "bestil_14", "bestil_45"].includes(l.status) || l.genbestilling.foreslaaetStk <= 0) continue;
    (forslagEanMap[l.leverandoer || "Ukendt leverandør"] ??= []).push({ ean: l.ean, titel: l.titel, brands: l.brands, bestilSenest: l.datoer.bestilSenest, foreslaaetStk: l.genbestilling.foreslaaetStk, foreslaaetColli: l.genbestilling.foreslaaetColli, raekkerTil: l.datoer.raekkerTil, status: l.status, begrundelse: l.statusAarsag });
  }
  const forslagEan = Object.entries(forslagEanMap).map(([leverandoer, linjer]) => ({ leverandoer, linjer: linjer.sort((a, b) => (a.bestilSenest || "9999").localeCompare(b.bestilSenest || "9999")) })).sort((a, b) => b.linjer.length - a.linjer.length);

  return { kørt: new Date().toISOString(), dag0, config: cfg, kilder: snap.sources, saeson: seasonMeta, rows, universelle, udenKobling, opsummering, prBrand, forslag, linjer, opsummeringLinjer: opsLinjer, forslagEan };
}

const STATUS_ORDER: Record<Status, number> = { udsolgt: 0, kritisk: 1, bestil_nu: 2, obs: 3, ok: 4, overlager: 5, for_nyt: 6, uden_kobling: 7 };
