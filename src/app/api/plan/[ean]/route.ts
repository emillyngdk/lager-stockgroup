import { NextResponse, type NextRequest } from "next/server";
import { updateState, type Plan } from "@/lib/state";
import { getForecast } from "@/lib/data";

export const dynamic = "force-dynamic";
const iso = /^\d{4}-\d{2}-\d{2}$/;

export async function PUT(req: NextRequest, { params }: { params: Promise<{ ean: string }> }) {
  const { ean } = await params;
  const b = await req.json().catch(() => null) as Partial<Plan> | null;
  if (!b || !/^\d{8,14}$/.test(ean)) return NextResponse.json({ error: "ugyldigt" }, { status: 400 });
  const stk = Math.round(Number(b.stk)); const colli = Math.round(Number(b.colli ?? 0)); const leadTime = Math.round(Number(b.leadTime));
  if (!(stk > 0) || !(leadTime > 0) || !iso.test(String(b.bestilDato))) return NextResponse.json({ error: "stk, leadTime og bestilDato skal være gyldige" }, { status: 400 });
  const af = String(b.af ?? "").slice(0, 40) || undefined; const note = String(b.note ?? "").slice(0, 300) || undefined;
  let saved: Plan | undefined;
  await updateState((s) => {
    const old = s.plans[ean];
    const poKendt = old?.poKendt ?? (getForecast().linjer.find((l) => l.ean === ean)?.paaVej.events.map((e) => e.po) ?? []);
    saved = { stk, colli, bestilDato: String(b.bestilDato), leadTime, note, af, oprettet: old?.oprettet ?? new Date().toISOString(), opdateret: new Date().toISOString(), status: "planlagt", poKendt };
    s.plans[ean] = saved;
    s.log.push({ tid: saved.opdateret, ean, af, hvad: `${old ? "Plan rettet" : "Plan gemt"}: ${stk} stk${colli ? ` (${colli} colli)` : ""}, bestil ${saved!.bestilDato}, lead time ${leadTime} d${note ? ` – ${note}` : ""}` });
  });
  return NextResponse.json(saved);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ ean: string }> }) {
  const { ean } = await params;
  await updateState((s) => { if (s.plans[ean]) { delete s.plans[ean]; s.log.push({ tid: new Date().toISOString(), ean, hvad: "Plan fjernet" }); } });
  return NextResponse.json({ ok: true });
}
