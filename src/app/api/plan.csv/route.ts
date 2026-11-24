import { readState } from "@/lib/state";
import { getForecast } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await readState(); const f = getForecast();
  const esc = (x: unknown) => `"${String(x ?? "").replace(/"/g, '""')}"`;
  const rows = [["EAN", "BC-SKU", "Vare", "Leverandør", "Status", "Stk", "Colli", "Bestildato", "Lead time", "Af", "Oprettet", "Note", "PO"].map(esc).join(";")];
  for (const [ean, p] of Object.entries(s.plans)) {
    const l = f.linjer.find((x) => x.ean === ean);
    rows.push([ean, l?.bcSku ?? "", l?.titel ?? "", l?.leverandoer ?? "", p.status, p.stk, p.colli, p.bestilDato, p.leadTime, p.af ?? "", p.oprettet.slice(0, 10), p.note ?? "", p.po ?? ""].map(esc).join(";"));
  }
  return new Response("﻿" + rows.join("\r\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="planer-${f.dag0}.csv"` } });
}
