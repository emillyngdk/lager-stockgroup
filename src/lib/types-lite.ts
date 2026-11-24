import type { ForecastRow } from "./forecast/types";
export type RowLite = Omit<ForecastRow, "projektion" | "forklaring" | "paaVej"> & { paaVej: Omit<ForecastRow["paaVej"], "events">; projektionDag0: string };
import type { PurchaseLine, LineShop } from "./forecast/purchase";
export type LineLite = Omit<PurchaseLine, "demandPrDag" | "projektion" | "forklaring" | "paaVej" | "shops"> & {
  paaVej: Omit<PurchaseLine["paaVej"], "events">; dag0: string;
  shops: Pick<LineShop, "brand" | "key" | "velocity" | "ecom" | "dageTilUdsolgt" | "status" | "hero">[];
};
