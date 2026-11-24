export function fmtDato(d: string | null | undefined): string {
  if (!d) return "–";
  const [y, m, day] = d.split("-").map(Number);
  const mdr = ["jan.", "feb.", "mar.", "apr.", "maj", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "dec."];
  const now = new Date();
  return `${day}. ${mdr[m - 1]}${y !== now.getFullYear() ? " " + y : ""}`;
}
export function fmtTal(n: number | null | undefined, dec = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "–";
  return n.toLocaleString("da-DK", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
