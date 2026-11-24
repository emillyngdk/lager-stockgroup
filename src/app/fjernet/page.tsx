import { Shell } from "@/components/shell";
import { FjernetList } from "@/components/fjernet-list";
import { getForecast, liteLine } from "@/lib/data";

export const dynamic = "force-static";

export default function Fjernet() {
  const f = getForecast();
  return (
    <Shell active="fjernet" title="Fjernede varer" intro="Udgåede varer vises aldrig i indkøbsoversigten igen; skjulte og ikke-indkøb heller ikke, så længe flaget står. De tæller ikke i forslag, mails eller nøgletal. Fortryd med Genindsæt.">
      <FjernetList lines={f.linjer.map(liteLine)} dag0={f.dag0} />
    </Shell>
  );
}
