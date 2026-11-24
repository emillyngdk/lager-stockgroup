import type { LineStatus } from "./forecast/purchase";

/** Hvor længe en vare markeret "PO oprettet" er væk fra listen, før den kommer tilbage hvis BC ikke viser en ny PO. */
export const PO_OPRETTET_DAGE = 7;
/** Hvor langt frem "Skal bestilles" kigger: kun opgaver hvis dato ligger inden for så mange dage – gælder alle varer og alle typer opgaver. */
export const LISTE_HORISONT = 60;

export type OverlayFlag = {
  udgaar?: boolean; ikke_indkoeb?: boolean; skjul_til?: string | null; leverandoer?: string; af?: string; note?: string;
  /** dato (YYYY-MM-DD) hvor nogen trykkede "PO oprettet" */
  po_oprettet?: string;
  /** PO-numre der allerede fandtes på EAN'et da der blev trykket – en ny PO er et nummer der ikke står her */
  po_kendt?: string[];
  /** stk på vej (alle åbne PO'er) da der blev trykket – stiger tallet, er der lagt mere på en eksisterende PO */
  po_paavej?: number;
  /** valgfrit PO-nummer indtastet ved markering */
  po_nr?: string;
};
export type PlanFlag = { status: "planlagt" | "bestilt" } | null | undefined;

export type PoTilstand = {
  dato: string; frist: string; af?: string; poNr?: string;
  /** afventer = inden for 7 dage og ingen PO set endnu · fundet = ny PO i BC · udloebet = 7 dage gået uden PO */
  tilstand: "afventer" | "fundet" | "udloebet";
  nyPo: string | null;
};

const plusDage = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const idagLokal = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Copenhagen" });

export function poTilstand(o: OverlayFlag | null | undefined, poNumre: string[], paaVejStk: number, dag0: string): PoTilstand | null {
  if (!o?.po_oprettet) return null;
  const frist = plusDage(o.po_oprettet, PO_OPRETTET_DAGE);
  const kendt = new Set(o.po_kendt ?? []);
  const nyPo = (o.po_nr && poNumre.includes(o.po_nr) && !kendt.has(o.po_nr) ? o.po_nr : poNumre.find((p) => !kendt.has(p))) ?? null;
  const merePaaVej = o.po_paavej != null && paaVejStk > o.po_paavej;
  const tilstand: PoTilstand["tilstand"] = nyPo || merePaaVej ? "fundet" : dag0 > frist ? "udloebet" : "afventer";
  // En fundet PO er en løst opgave – efter fristen glemmes markeringen, så varen regnes helt normalt igen
  if (tilstand === "fundet" && dag0 > frist) return null;
  return { dato: o.po_oprettet, frist, af: o.af, poNr: o.po_nr, tilstand, nyPo };
}

/** Står linjen på "Skal bestilles"? (statussen før manuelle flag) */
export function paaListen(status: LineStatus, bestilSenestDage: number | null): boolean {
  if (status === "bestil_nu" || status === "bestil_14") return true;
  if (status === "bestil_30" || status === "book_po" || status === "for_nyt") return bestilSenestDage != null && bestilSenestDage <= LISTE_HORISONT;
  return false;
}

/** Effektiv status = grundstatus fra beregningen + det folk har trykket på sitet. Samme regel overalt. */
export function effektivStatus(grund: LineStatus, bestilSenestDage: number | null, o: OverlayFlag | null | undefined, plan: PlanFlag, poNumre: string[], paaVejStk: number, dag0: string): { status: LineStatus; po: PoTilstand | null } {
  const po = poTilstand(o, poNumre, paaVejStk, dag0);
  if (o?.udgaar) return { status: "udgaar", po };
  if (o?.ikke_indkoeb) return { status: "ikke_indkoeb", po };
  if (o?.skjul_til && o.skjul_til >= dag0) return { status: "skjult", po };
  if (plan) return { status: plan.status, po };
  if (po?.tilstand === "afventer" && paaListen(grund, bestilSenestDage)) return { status: "po_oprettet", po };
  // Ny PO fundet i BC, og den dækker behovet – den står bare som "ikke booket" endnu. Det er ikke en ny opgave.
  if (po?.tilstand === "fundet" && grund === "book_po") return { status: "bestilt", po };
  return { status: grund, po };
}
