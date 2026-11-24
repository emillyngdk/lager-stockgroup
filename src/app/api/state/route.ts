import { NextResponse, type NextRequest } from "next/server";
import { readState } from "@/lib/state";

export const dynamic = "force-dynamic";

/** GET /api/state            → hele tilstanden (planer, overrides, log)
 *  GET /api/state?ean=<ean>  → kun for ét EAN
 *  Adgang: session-cookie (middleware) eller ?token=<ETL_TOKEN> / header x-etl-token (bruges af den daglige opdatering). */
export async function GET(req: NextRequest) {
  const s = await readState();
  const ean = req.nextUrl.searchParams.get("ean");
  if (ean) return NextResponse.json({ plan: s.plans[ean] ?? null, override: s.overrides[ean] ?? null, log: s.log.filter((l) => l.ean === ean).slice(-20) });
  return NextResponse.json(s, { headers: { "cache-control": "no-store" } });
}
