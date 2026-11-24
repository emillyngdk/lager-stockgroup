import { getForecast } from "@/lib/data";
import { BRANDS } from "@/lib/forecast/types";
import { LINE_STATUS_META } from "@/lib/forecast/purchase";

export const dynamic = "force-static";

export function GET() {
  const f = getForecast();
  const esc = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const lines = [["Leverandør", "EAN", "BC-SKU", "Vare", "Shops", "Status", "Bestil senest", "Stk", "Colli", "Rækker til", "Plan-status", "Note"].map(esc).join(";")];
  for (const g of f.forslagEan) for (const l of g.linjer) {
    const line = f.linjer.find((x) => x.ean === l.ean);
    lines.push([g.leverandoer, l.ean, line?.bcSku ?? "", l.titel, l.brands.map((b) => BRANDS[b].navn).join("+"), LINE_STATUS_META[l.status].label, l.bestilSenest ?? "", l.foreslaaetStk, l.foreslaaetColli, l.raekkerTil ?? "", line?.plan ? `${line.plan.status}${line.plan.af ? ` (${line.plan.af})` : ""}` : "", line?.plan?.note ?? ""].map(esc).join(";"));
  }
  return new Response("﻿" + lines.join("\r\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="indkoebsforslag-${f.dag0}.csv"` } });
}
