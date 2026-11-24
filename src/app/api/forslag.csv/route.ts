import { getForecast } from "@/lib/data";
import { BRANDS, STATUS_META } from "@/lib/forecast/types";

export const dynamic = "force-static";

export function GET() {
  const f = getForecast();
  const esc = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const lines = [["Leverandør", "Brand", "Vare", "EAN", "Status", "Bestil senest", "Stk", "Colli", "Begrundelse"].map(esc).join(";")];
  for (const g of f.forslag) for (const l of g.linjer) lines.push([g.leverandoer, BRANDS[l.brand].navn, l.titel, l.ean, STATUS_META[l.status].label, l.bestilSenest ?? "", l.foreslaaetStk, l.foreslaaetColli, l.begrundelse].map(esc).join(";"));
  return new Response("﻿" + lines.join("\r\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="ugens-forslag-${f.dag0}.csv"` } });
}
