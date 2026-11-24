"use client";
import { idagLokal, type OverlayFlag } from "./overlay";

/** Det en linje skal have med for at kunne markeres "PO oprettet" */
export type PoKandidat = { ean: string; poNumre: string[]; paaVejStk: number };
export const PO_NULSTIL = { po_oprettet: null, po_kendt: null, po_paavej: null, po_nr: null } as const;

async function put(ean: string, body: Record<string, unknown>): Promise<OverlayFlag | null> {
  const r = await fetch(`/api/override/${ean}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (r.ok && typeof window !== "undefined") window.dispatchEvent(new Event("lager:refetch"));
  return r.ok ? ((await r.json()) as OverlayFlag) : null;
}

/** Markér som "PO oprettet": gemmer dato + de PO'er og stk der allerede fandtes, så den daglige kørsel kan se om en ny PO dukker op. */
export async function markerPoOprettet(linjer: PoKandidat[], af: string, poNr?: string): Promise<Record<string, OverlayFlag>> {
  const ud: Record<string, OverlayFlag> = {};
  const dato = idagLokal();
  await Promise.all(linjer.map(async (l) => {
    const saved = await put(l.ean, { po_oprettet: dato, po_kendt: l.poNumre, po_paavej: l.paaVejStk, po_nr: poNr?.trim() || null, af });
    if (saved) ud[l.ean] = saved;
  }));
  return ud;
}

export async function saetFlag(eans: string[], body: Record<string, unknown>, af: string): Promise<Record<string, OverlayFlag>> {
  const ud: Record<string, OverlayFlag> = {};
  await Promise.all(eans.map(async (ean) => { const saved = await put(ean, { ...body, af }); if (saved) ud[ean] = saved; }));
  return ud;
}

/** Fortæl andre dele af siden (fx tallet i menuen) at tilstanden er ændret */
export function meldStateAendret(overrides: Record<string, OverlayFlag>, plans?: Record<string, unknown>) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("lager:state", { detail: { overrides, plans } }));
}

// Når en række forsvinder, glider den næste op under musen. Et hurtigt dobbeltklik må ikke markere den næste vare.
let laastTil = 0;
export const hurtigKlik = (fn: () => void) => { if (Date.now() < laastTil) return; laastTil = Date.now() + 900; fn(); };
