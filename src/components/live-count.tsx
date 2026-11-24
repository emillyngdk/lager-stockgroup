"use client";
import { useEffect, useState } from "react";
import type { LineStatus } from "@/lib/forecast/purchase";
import { effektivStatus, paaListen, type OverlayFlag } from "@/lib/overlay";

export type ListeBase = { e: string; s: LineStatus; b: number | null; p: string[]; v: number };
type St = { overrides?: Record<string, OverlayFlag>; plans?: Record<string, { status: "planlagt" | "bestilt" }> };

/** Antal opgaver på "Skal bestilles" – regnet live ud fra det der er trykket på sitet, så tallet i menuen falder med det samme. */
export function LiveListeCount({ base, dag0, initial }: { base: ListeBase[]; dag0: string; initial: number }) {
  const [n, setN] = useState(initial);
  useEffect(() => {
    const regn = (d: St) => setN(base.filter((x) => paaListen(effektivStatus(x.s, x.b, d.overrides?.[x.e], d.plans?.[x.e] ?? null, x.p, x.v, dag0).status, x.b)).length);
    const hent = () => fetch("/api/state").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) regn(d); }).catch(() => {});
    hent();
    let t: ReturnType<typeof setTimeout> | null = null;
    const igen = () => { if (t) clearTimeout(t); t = setTimeout(hent, 400); };
    const h = (ev: Event) => regn((ev as CustomEvent<St>).detail);
    window.addEventListener("lager:state", h); window.addEventListener("lager:refetch", igen);
    return () => { window.removeEventListener("lager:state", h); window.removeEventListener("lager:refetch", igen); if (t) clearTimeout(t); };
  }, [base, dag0]);
  return <>{n}</>;
}
