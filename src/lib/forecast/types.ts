export type Brand = "gladkokken" | "casper" | "herman" | "tomi";

export const BRANDS: Record<Brand, { navn: string; kort: string; land: string; valuta: string; bcLokation: string; farve: string }> = {
  gladkokken: { navn: "Gladkokken", kort: "GK", land: "Norge", valuta: "NOK", bcLokation: "NONFOOD", farve: "#E5322D" },
  casper: { navn: "Sobczyk", kort: "CS", land: "Danmark", valuta: "DKK", bcLokation: "NONFOOD", farve: "#141414" },
  herman: { navn: "Herman", kort: "HdB", land: "Holland", valuta: "EUR", bcLokation: "NL-NONFOOD", farve: "#F5820D" },
  tomi: { navn: "Tomi Björck", kort: "TB", land: "Finland", valuta: "EUR", bcLokation: "FI-NONFOOD", farve: "#1E9E5A" },
};

export type Status =
  | "udsolgt" | "kritisk" | "bestil_nu" | "obs" | "ok" | "overlager" | "for_nyt" | "uden_kobling";

export const STATUS_META: Record<Status, { label: string; farve: string; tekst: string; orden: number }> = {
  udsolgt: { label: "Udsolgt", farve: "#141414", tekst: "#FFFFFF", orden: 0 },
  kritisk: { label: "Kritisk", farve: "#E5322D", tekst: "#FFFFFF", orden: 1 },
  bestil_nu: { label: "Bestil nu", farve: "#F5820D", tekst: "#FFFFFF", orden: 2 },
  obs: { label: "OBS", farve: "#F2B705", tekst: "#141414", orden: 3 },
  ok: { label: "OK", farve: "#1E9E5A", tekst: "#FFFFFF", orden: 4 },
  overlager: { label: "Overlager", farve: "#5B6CFF", tekst: "#FFFFFF", orden: 5 },
  for_nyt: { label: "For nyt", farve: "#9B6BFF", tekst: "#FFFFFF", orden: 6 },
  uden_kobling: { label: "Uden kobling", farve: "#8A8A8A", tekst: "#FFFFFF", orden: 7 },
};

export type AgeGroup = "nyhed" | "ung" | "etableret" | "moden";

export interface Config {
  weights: { v7: number; v30: number; v60: number };
  seasonClamp: [number, number];
  seasonSmoothWeeks: number;
  horizonDays: number;
  transferDays: number;       // Vejle -> shoplokation
  receivingDays: number;      // levering til lager -> salgbar
  leadTimeDefault: { hybrid: number; asia: number; eu: number };
  coverageDays: { asia: number; eu: number };
  zHero: number;
  zNormal: number;
  heroShareOfDb: number;      // top X% af DB = hero
  cvByAge: Record<AgeGroup, number>;
  extraSafetyByAge: Record<AgeGroup, number>;
  status: { bestilNuDays: number; obsDays: number; overlagerDays: number; trendObs: number };
}

export const DEFAULT_CONFIG: Config = {
  weights: { v7: 0.5, v30: 0.3, v60: 0.2 },
  seasonClamp: [0.3, 8.0],
  seasonSmoothWeeks: 3,
  horizonDays: 180,
  transferDays: 0,
  receivingDays: 3,
  leadTimeDefault: { hybrid: 180, asia: 150, eu: 30 },
  coverageDays: { asia: 120, eu: 90 },
  zHero: 1.65,
  zNormal: 1.28,
  heroShareOfDb: 0.2,
  cvByAge: { nyhed: 0.8, ung: 0.6, etableret: 0.45, moden: 0.35 },
  extraSafetyByAge: { nyhed: 0.5, ung: 0.3, etableret: 0.15, moden: 0 },
  status: { bestilNuDays: 14, obsDays: 45, overlagerDays: 365, trendObs: 0.3 },
};

export interface Variant {
  brand: Brand; product_id: string; title: string; title_original?: string; created_at: string | null; published_at: string | null;
  product_type: string; variant_id: string; sku: string | null; barcode: string | null; shopify_qty: number | null;
  unit_cost: number | null; levels: Record<string, number | null>; ean: string | null; components: string[] | null;
}

export interface BcLoc {
  lager: number; reserveret_andre_kunder: number; reserveret_shop_group: number; overflytning_reserveret: number;
  disponibelt: number; bestilt_andre_kunder: number; bestilt_shop_group: number; disponibelt_efter_alle_andre_kunders_ordrer: number;
}
export interface BcStock { bc_sku: string; ean: string; navn: string; stk_pr_colli: number | null; lokationer: Record<string, BcLoc> }

export interface PoLine {
  po: string; linje: number; ean: string; vare: string; antal: number; stk_pr_colli: number | null; lokation: string;
  leverandoer: string | null; indkoeber: string | null; planlagt_modtagelse: string | null; booket: boolean;
  speditoer: string | null; transport: string | null; eta_havn: string | null; levering_lager: string | null;
  forventet: string | null; forventet_kilde: string | null; status: string; eu_leverandoer: boolean;
}

export interface SalesRow { solgt: number; solgt_foer: number; lager: number | null; titel?: string; db_pr_stk?: number | null; nye_kunder?: number | null; db?: number | null }
export interface SalesPeriod { from: string; to: string; days: number; rows: Record<string, SalesRow> }

export interface Snapshot {
  generated_at: string;
  sources: { bc_laest: string | null; po_laest: string | null; shopify_hentet: string; sales_periods: Record<string, Record<string, [string, string]>>; dayseries_range: Record<string, [string, string]> };
  variants: Variant[];
  bc_stock: Record<string, BcStock>;
  po_lines: PoLine[];
  sales: Record<string, Record<string, SalesPeriod>>;
  dayseries: Record<string, Record<string, number>>;
}

export interface Override { lead_time?: number; coverage_days?: number; service_level?: "hero" | "normal"; udgaar?: boolean; note?: string; kampagne_uge?: number }

export interface InboundEvent { dato: string; stk: number; sikker: boolean; po: string; status: string; lokation: string; leverandoer: string | null }

export interface ForecastRow {
  key: string; brand: Brand; variant_id: string; product_id: string; ean: string | null; bc_sku: string | null;
  titel: string; titelOriginal?: string | null; product_type: string; status: Status; statusAarsag: string;
  alder: { dage: number; gruppe: AgeGroup; publiceret: string | null; oprettet: string | null; salgsdage: number };
  velocity: { v7: number; v14: number; v30: number; v60: number; base: number; afsaeson: number; trend: number; saesonNu: number; saesonKilde: string };
  lager: { ecom: number; vejleFrit: number; vejleOptimistisk: number; reserveretShopGroup: number; reserveretB2b: number; bestiltB2b: number; tilgaengeligt: number; tilgaengeligtOptimistisk: number; andel: number; lokation: string; shopifyQty: number | null; bcLokation: string | null };
  paaVej: { sikker: number; usikker: number; foersteEta: string | null; events: InboundEvent[] };
  dage: { tilUdsolgt: number | null; tilUdsolgtMedPaaVej: number | null; tilUdsolgtOptimistisk: number | null };
  datoer: { udsolgt: string | null; udsolgtMedPaaVej: string | null; udsolgtOptimistisk: string | null; bestilSenest: string | null };
  genbestilling: { leadTime: number; leadTimeKilde: string; sikkerhedslager: number; reorderPoint: number; foreslaaetStk: number; foreslaaetColli: number; stkPrColli: number | null; daekningsdage: number; hero: boolean; z: number; sigma: number; region: "asia" | "eu" };
  projektion: { dag0: string; konservativ: number[]; optimistisk: number[] };
  oekonomi: { dbPrStk: number | null; unitCost: number | null; lagervaerdi: number | null; nyeKunder: number | null; solgt365: number | null };
  universel: boolean; brandsMedEan: Brand[]; leverandoer: string | null; indkoeber: string | null;
  forklaring: string[];
}

export interface UniversalRow {
  ean: string; titel: string; brands: Brand[]; velocitySum: number; vejleFrit: number; ecomSum: number; paaVejSikker: number; paaVejUsikker: number;
  dageTilUdsolgt: number | null; bestilSenest: string | null; foreslaaetStk: number; foreslaaetColli: number; status: Status; prBrand: { brand: Brand; velocity: number; ecom: number; dage: number | null; status: Status; key: string }[];
}

export interface ForecastOutput {
  kørt: string; dag0: string; config: Config; kilder: Snapshot["sources"];
  saeson: { kilde: string; ugeIndeks: number[] };
  rows: ForecastRow[]; universelle: UniversalRow[];
  udenKobling: { brand: Brand; variant_id: string; titel: string; sku: string | null; solgt30: number; grund: string }[];
  opsummering: Record<Status, number> & { total: number };
  prBrand: Record<Brand, Record<Status, number>>;
  forslag: { leverandoer: string; linjer: { key: string; brand: Brand; titel: string; ean: string; bestilSenest: string | null; foreslaaetStk: number; foreslaaetColli: number; status: Status; begrundelse: string }[] }[];
  // v2: indkøbslinjer pr. EAN
  linjer: import("./purchase").PurchaseLine[];
  opsummeringLinjer: Record<import("./purchase").LineStatus, number>;
  forslagEan: { leverandoer: string; linjer: { ean: string; titel: string; brands: Brand[]; bestilSenest: string | null; foreslaaetStk: number; foreslaaetColli: number; raekkerTil: string | null; status: import("./purchase").LineStatus; begrundelse: string }[] }[];
}
