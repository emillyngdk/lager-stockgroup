import { NextResponse, type NextRequest } from "next/server";
import { updateState, type Flag } from "@/lib/state";

export const dynamic = "force-dynamic";
const KEYS: (keyof Flag)[] = ["udgaar", "skjul_til", "ikke_indkoeb", "note", "lead_time", "coverage_days", "moq", "eu", "kategori", "service_level", "leverandoer"];

/** PUT /api/override/<ean>  body = delvis Flag; felter sat til null/undefined fjernes. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ ean: string }> }) {
  const { ean } = await params;
  const b = await req.json().catch(() => null) as (Partial<Flag> & { af?: string }) | null;
  if (!b || !/^\d{8,14}$/.test(ean)) return NextResponse.json({ error: "ugyldigt" }, { status: 400 });
  const af = String(b.af ?? "").slice(0, 40) || undefined;
  let saved: Flag | null = null;
  await updateState((s) => {
    const cur: Flag = { ...(s.overrides[ean] ?? {}) };
    const changes: string[] = [];
    for (const k of KEYS) {
      if (!(k in b)) continue;
      const v = (b as Record<string, unknown>)[k];
      if (v === null || v === undefined || v === "" || v === false) { if (k in cur) { delete cur[k]; changes.push(`${k} fjernet`); } }
      else { (cur as Record<string, unknown>)[k] = typeof v === "string" ? v.slice(0, 300) : v; changes.push(`${k} = ${String(v)}`); }
    }
    cur.af = af; cur.dato = new Date().toISOString().slice(0, 10);
    if (Object.keys(cur).filter((k) => !["af", "dato", "note"].includes(k)).length === 0) { delete s.overrides[ean]; saved = null; }
    else { s.overrides[ean] = cur; saved = cur; }
    s.log.push({ tid: new Date().toISOString(), ean, af, hvad: changes.join(", ") || "ingen ændring" });
  });
  return NextResponse.json(saved ?? {});
}
