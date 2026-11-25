import ExcelJS from "exceljs";
import { getForecast } from "@/lib/data";
import { readState } from "@/lib/state";
import { BRANDS } from "@/lib/forecast/types";
import { LINE_STATUS_META } from "@/lib/forecast/purchase";
import { effektivStatus, paaListen } from "@/lib/overlay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Hele "Skal bestilles"-listen som Excel – samme linjer som på siden lige nu (inkl. det der er trykket: udgår, PO oprettet, leverandør). */
export async function GET() {
  const f = getForecast();
  const st = await readState().catch(() => ({ plans: {}, overrides: {} }) as { plans: Record<string, { status: "planlagt" | "bestilt" }>; overrides: Record<string, never> });
  const dato = (s: string | null) => (s ? new Date(s + "T12:00:00Z") : null);
  const rows = f.linjer.map((l) => {
    const o = st.overrides?.[l.ean]; const p = st.plans?.[l.ean];
    const { status } = effektivStatus(l.grundStatus ?? l.status, l.dage.bestilSenest, o, p ? { status: p.status } : null, l.poNumre ?? [], l.paaVej.sikker + l.paaVej.usikker, f.dag0);
    return { l, status, lev: o?.leverandoer || l.leverandoer || "Ukendt leverandør" };
  }).filter((x) => paaListen(x.status, x.l.dage.bestilSenest))
    .sort((a, b) => a.lev.localeCompare(b.lev, "da") || (a.l.dage.bestilSenest ?? 9999) - (b.l.dage.bestilSenest ?? 9999) || b.l.genbestilling.foreslaaetStk - a.l.genbestilling.foreslaaetStk);

  const wb = new ExcelJS.Workbook(); wb.creator = "Lager · Stock Group"; wb.created = new Date();
  const ws = wb.addWorksheet("Skal bestilles", { views: [{ state: "frozen", ySplit: 1, xSplit: 3 }] });
  const cols: { h: string; w: number; fmt?: string; get: (x: (typeof rows)[number]) => string | number | Date | null }[] = [
    { h: "Leverandør", w: 34, get: (x) => x.lev },
    { h: "Varenavn", w: 44, get: (x) => x.l.titel },
    { h: "EAN", w: 16, fmt: "@", get: (x) => x.l.ean },
    { h: "BC-nr.", w: 16, fmt: "@", get: (x) => x.l.bcSku ?? "" },
    { h: "Shops", w: 18, get: (x) => [...new Set(x.l.brands)].map((b) => BRANDS[b].kort).join(" + ") },
    { h: "Opgave", w: 15, get: (x) => (x.status === "book_po" ? "Book PO" : x.status === "for_nyt" ? "Vurdér (ny vare)" : x.l.dataKvalitet === "lav" ? "Bestil – tjek tallet" : "Bestil") },
    { h: "Bestil senest", w: 14, fmt: "dd-mm-yyyy", get: (x) => dato(x.l.datoer.bestilSenest) },
    { h: "Foreslået stk", w: 14, fmt: "#,##0", get: (x) => x.l.genbestilling.foreslaaetStk },
    { h: "Bestil stk (ret selv)", w: 18, fmt: "#,##0", get: (x) => x.l.genbestilling.foreslaaetStk },
    { h: "Behov før MOQ", w: 14, fmt: "#,##0", get: (x) => x.l.genbestilling.behovFoerMoq ?? null },
    { h: "MOQ", w: 9, fmt: "#,##0", get: (x) => x.l.genbestilling.moq ?? null },
    { h: "Stk pr. colli", w: 12, fmt: "#,##0", get: (x) => x.l.genbestilling.stkPrColli ?? null },
    { h: "Colli", w: 9, fmt: "#,##0", get: () => null }, // formel
    { h: "Kostpris", w: 11, fmt: "#,##0.00", get: (x) => x.l.oekonomi.unitCost ?? null },
    { h: "Valuta", w: 8, get: (x) => (x.l.oekonomi.unitCost != null ? x.l.oekonomi.valuta ?? "" : "") },
    { h: "Ordreværdi (i valutaen)", w: 21, fmt: "#,##0", get: () => null }, // formel
    { h: "Rækker til (med forslaget)", w: 24, fmt: "dd-mm-yyyy", get: (x) => dato(x.l.datoer.raekkerTil) },
    { h: "Tilgængeligt nu", w: 15, fmt: "#,##0", get: (x) => x.l.lager.tilgaengeligt },
    { h: "Heraf Vejle", w: 12, fmt: "#,##0", get: (x) => x.l.lager.vejleFrit },
    { h: "På vej (booket)", w: 15, fmt: "#,##0", get: (x) => x.l.paaVej.sikker },
    { h: "På vej (ikke booket)", w: 18, fmt: "#,##0", get: (x) => x.l.paaVej.usikker },
    { h: "Stk/dag nu", w: 11, fmt: "#,##0.0", get: (x) => x.l.velocity.base },
    { h: "Normalt stk/dag", w: 15, fmt: "#,##0.0", get: (x) => x.l.velocity.afsaeson },
    { h: "Forventet salg 12 mdr", w: 20, fmt: "#,##0", get: (x) => x.l.velocity.forventet12 },
    { h: "Solgt i salgsperioden", w: 19, fmt: "#,##0", get: (x) => x.l.velocity.solgt365 ?? null },
    { h: "Solgt omregnet til 12 mdr", w: 22, fmt: "#,##0", get: (x) => x.l.velocity.solgtAarsrate ?? null },
    { h: "Dage med salgsdata", w: 17, fmt: "#,##0", get: (x) => Math.min(365, x.l.velocity.salgsdage) },
    { h: "Lead time (dage)", w: 15, fmt: "#,##0", get: (x) => x.l.genbestilling.leadTime },
    { h: "Dækning efter lead time (dage)", w: 26, fmt: "#,##0", get: (x) => x.l.genbestilling.daekningsdage },
    { h: "Datagrundlag", w: 14, get: (x) => (x.l.dataKvalitet === "lav" ? "Usikkert" : x.l.dataKvalitet === "middel" ? "Ny vare" : "OK") },
    { h: "Sommervare", w: 11, get: (x) => (x.l.velocity.sommervare ? "Ja" : "") },
    { h: "Bemærkning", w: 80, get: (x) => [x.l.statusAarsag, ...x.l.advarsler].join(" · ") },
  ];
  ws.columns = cols.map((c) => ({ header: c.h, width: c.w, style: c.fmt ? { numFmt: c.fmt } : {} }));
  const iStk = cols.findIndex((c) => c.h.startsWith("Bestil stk")) + 1, iCll = cols.findIndex((c) => c.h === "Stk pr. colli") + 1, iColli = cols.findIndex((c) => c.h === "Colli") + 1, iPris = cols.findIndex((c) => c.h === "Kostpris") + 1, iVaerdi = cols.findIndex((c) => c.h.startsWith("Ordreværdi")) + 1;
  const L = (i: number) => ws.getColumn(i).letter;
  rows.forEach((x, n) => {
    const r = ws.addRow(cols.map((c) => c.get(x))); const k = n + 2;
    r.getCell(iColli).value = { formula: `IF(${L(iCll)}${k}>0,ROUNDUP(${L(iStk)}${k}/${L(iCll)}${k},0),"")` };
    r.getCell(iVaerdi).value = { formula: `IF(${L(iPris)}${k}>0,${L(iStk)}${k}*${L(iPris)}${k},"")` };
    r.getCell(iStk).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3C4" } };
    if (x.l.dataKvalitet === "lav") r.getCell(cols.findIndex((c) => c.h === "Datagrundlag") + 1).font = { bold: true, color: { argb: "FFE5322D" } };
    if (x.l.datoer.bestilSenest && x.l.datoer.bestilSenest <= f.dag0) r.getCell(cols.findIndex((c) => c.h === "Bestil senest") + 1).font = { bold: true, color: { argb: "FFE5322D" } };
  });
  const head = ws.getRow(1); head.font = { bold: true, color: { argb: "FFFFFFFF" } }; head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF141414" } }; head.height = 22; head.alignment = { vertical: "middle" };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  if (rows.length) {
    const s = ws.addRow([]); const k = rows.length + 2;
    s.getCell(2).value = `I alt ${rows.length} linjer`;
    s.getCell(iStk).value = { formula: `SUBTOTAL(109,${L(iStk)}2:${L(iStk)}${k - 1})` };
    s.font = { bold: true };
  }
  const info = wb.addWorksheet("Om tallene");
  info.getColumn(1).width = 120;
  [
    `Trukket ${new Date().toLocaleString("da-DK", { timeZone: "Europe/Copenhagen" })} · lagerdata fra ${f.dag0}`,
    "",
    "Én linje pr. EAN – mængden dækker alle shops, der sælger varen.",
    "Foreslået stk = forventet salg i lead time + dækningsperioden + sikkerhedslager − det der er tilgængeligt − alt der er på vej.",
    "MOQ: alle forslag er mindst 1.000 stk, medmindre varen har sin egen MOQ (⋯ → Sæt MOQ på sitet). “Behov før MOQ” er det, beregningen selv kom frem til.",
    "Den gule kolonne “Bestil stk (ret selv)” er din: ret tallet, så følger Colli og Ordreværdi med.",
    "Kostpris er shoppens kostpris fra Shopify i den valuta, der står i kolonnen Valuta (DKK, NOK eller EUR) – derfor er der ingen samlet ordreværdi.",
    "Forventet salg 12 mdr er det tal, forslaget står og falder med. Er du uenig i det, så skru mængden tilsvarende.",
    "Solgt omregnet til 12 mdr = hver shops salg ganget op til et helt år (en shop med 200 dages salg tæller 365/200). Sammenlign den med Forventet salg 12 mdr.",
    "Datagrundlag “Usikkert” = under 60 dages salg. “Ny vare” = under 180 dage: der bestilles til kortere dækning.",
    "Sommervare = slush, sirup og is hos Sobczyk og Gladkokken: forslaget antager, at næste sommer sælger som den sidste – og fordeler salget efter sidste års uger.",
    "Listen indeholder ikke varer markeret Udgår, Skjult eller PO oprettet.",
  ].forEach((t) => info.addRow([t]));
  info.getRow(1).font = { bold: true };
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="skal-bestilles-${f.dag0}.xlsx"`, "cache-control": "no-store" } });
}
