import type { ForecastRow } from "./forecast/types";
export type RowLite = Omit<ForecastRow, "projektion" | "forklaring" | "paaVej"> & { paaVej: Omit<ForecastRow["paaVej"], "events">; projektionDag0: string };
