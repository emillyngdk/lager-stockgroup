/**
 * Delt tilstand mellem brugere: planer, overrides (udgår/skjul/lead time/MOQ) og en log.
 * Gemmes som én JSON-fil i Vercel Blob (privat store). Uden BLOB_READ_WRITE_TOKEN
 * (lokalt) bruges data/state.json i repoet.
 */
import fs from "node:fs";
import path from "node:path";

export type Plan = { stk: number; colli: number; bestilDato: string; leadTime: number; note?: string; af?: string; oprettet: string; opdateret: string; status: "planlagt" | "bestilt"; po?: string; poKendt?: string[] };
export type Flag = { udgaar?: boolean; skjul_til?: string | null; ikke_indkoeb?: boolean; note?: string; af?: string; dato?: string; lead_time?: number; coverage_days?: number; moq?: number; eu?: boolean; kategori?: "hybrid" | "standard"; service_level?: "hero" | "normal"; leverandoer?: string };
export type LogEntry = { tid: string; ean: string; af?: string; hvad: string };
export interface State { plans: Record<string, Plan>; overrides: Record<string, Flag>; log: LogEntry[]; opdateret: string }

const PATH = "state/state.json";
const LOCAL = path.join(process.cwd(), "data", "state.json");
const empty = (): State => ({ plans: {}, overrides: {}, log: [], opdateret: new Date().toISOString() });
const hasBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export async function readState(): Promise<State> {
  if (!hasBlob()) {
    try { return JSON.parse(fs.readFileSync(LOCAL, "utf8")) as State; } catch { return empty(); }
  }
  const { get } = await import("@vercel/blob");
  try {
    const r = await get(PATH, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200 || !r.stream) return empty();
    const text = await new Response(r.stream).text();
    return { ...empty(), ...(JSON.parse(text) as State) };
  } catch (e) {
    if ((e as Error).name === "BlobNotFoundError") return empty();
    throw e;
  }
}

export async function writeState(s: State): Promise<void> {
  s.opdateret = new Date().toISOString();
  if (s.log.length > 2000) s.log = s.log.slice(-2000);
  if (!hasBlob()) { fs.mkdirSync(path.dirname(LOCAL), { recursive: true }); fs.writeFileSync(LOCAL, JSON.stringify(s, null, 1)); return; }
  const { put } = await import("@vercel/blob");
  await put(PATH, JSON.stringify(s), { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
}

/** Læs-ændr-skriv med ét forsøg til; kollisioner er usandsynlige med få brugere. */
export async function updateState(fn: (s: State) => void): Promise<State> {
  const s = await readState();
  fn(s);
  await writeState(s);
  return s;
}
