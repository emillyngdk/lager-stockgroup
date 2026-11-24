import { Shell } from "@/components/shell";
import { getForecast } from "@/lib/data";

export const dynamic = "force-static";

export default function Om() {
  const f = getForecast();
  const c = f.config;
  const idx = f.saeson.ugeIndeks;
  const max = Math.max(...idx.slice(1, 53));
  return (
    <Shell active="om" title="Sådan regnes der" intro="Hvert tal på sitet kan føres tilbage til disse trin. Ingen black box.">
      <div className="flex flex-col gap-4 max-w-3xl">
        {[
          ["0. Indkøbslinjer: én pr. EAN", `Indkøb ser én linje pr. EAN på tværs af alle fire shops. Behovet er summen af shoppenes afsæsonaliserede salg gange hver shops sæsonindeks, dag for dag 2 år frem. Tilgængeligt er shoppenes egne lokationer + hele den frie Vejle-pulje (én gang) + overskud på 3PL. På vej er alle åbne PO'er for EAN'et. Lead time, sikkerhedslager, reorder point og foreslået mængde regnes på den samlede linje; fordelingen pr. shop er kun et overflytningsforslag. “Rækker til” følger den optimistiske kurve, lægger den nye ordre til på modtagelsesdagen og finder første dag lageret rammer 0 efter det.`],
          ["1. Salgshastighed", `Jullytics giver solgte stk pr. produkt for de sidste 7 og 30 dage samt perioden før. Det giver fire vinduer: 7, 14, 30 og 60 dage. Vægtet velocity = ${c.weights.v7} × v7 + ${c.weights.v30} × v30 + ${c.weights.v60} × v60. Nyheder (under 14 dage) bruger kun v7; unge varer (14–55 dage) 60/40 af v7 og v30. Gave- og demovarianter med samme EAN lægges oven i hovedvarianten, og bundles med “EAN+EAN” som SKU lægger deres salg på komponenterne.`],
          ["2. Sæson", `Et ugeindeks (ISO-uge) regnes som ugens salg delt med årsgennemsnittet, glattet over ${c.seasonSmoothWeeks} uger og klemt til ${c.seasonClamp[0]}–${c.seasonClamp[1]}. Kilde lige nu: ${f.saeson.kilde} – den eneste hele årscyklus vi har. Hvert vindue afsæsonaliseres med sit eget sæsongennemsnit, så Black Week ikke læses som normalt niveau. Fremskrivningen ganger normalniveauet med indekset for hver kommende uge.`],
          ["3. Lagerpuljer", `Tilgængeligt = Shopify-lager på brandets egen lokation + den del af BC-lokationen (NONFOOD i Vejle, NL-NONFOOD, FI-NONFOOD) vi kan regne med: Shop Groups egne reservationer plus det disponible, der ikke er i konkurrence med ureserverede B2B-ordrer. Universelle varer deler Vejle-puljen efter salgshastighed. Optimistisk = hele det disponible.`],
          ["4. På vej", `Åbne PO-linjer fra BC. “Bekræftet ETA” (booket hos SGL/GoForward) er sikre; “Planlagt (ikke booket)” og “ETA overskredet” er usikre. Salgbar dato = levering til lager + ${c.receivingDays} dages modtagelse. Den konservative kurve bruger kun sikre leveringer; den optimistiske alle.`],
          ["5. Projektion", `Lageret fremskrives dag for dag ${c.horizonDays} dage frem. Dage til udsolgt = første dag den konservative kurve rammer 0. Uden leveringer regnes op til 400 dage frem til overlager-vurderingen.`],
          ["6. Lead time, sikkerhedslager og reorder point", `Lead time: ${c.leadTimeDefault.hybrid} dage (6 mdr.) for alt Hybrid, ${c.leadTimeDefault.asia} dage (5 mdr.) for alle andre varer og ca. ${c.leadTimeDefault.eu} dage for europæiske leverandører (kan sættes pr. vare). Sikkerhedslager = z × σ × √lead time, hvor z = ${c.zHero} for hero-produkter (de produkter der tilsammen giver 80 % af DB i brandet) og ${c.zNormal} for resten, og σ = velocity × variationskoefficient efter alder (${Object.entries(c.cvByAge).map(([k, v]) => `${k} ${v}`).join(", ")}). Oven i lægges alderstillæg (${Object.entries(c.extraSafetyByAge).map(([k, v]) => `${k} ${Math.round(v * 100)} %`).join(", ")}). Reorder point = forventet salg i lead time + sikkerhedslager.`],
          ["7. Bestil senest og foreslået mængde", `Bestil senest = den dag den optimistiske kurve (alle åbne PO'er, for de er jo bestilt) rammer reorder point. Foreslået mængde = salg i lead time + ${c.coverageDays.asia}/${c.coverageDays.eu} dages dækning + sikkerhedslager − tilgængeligt − alt på vej, rundet op til hele colli.`],
          ["8. Status på indkøbslinjer", `Bestil nu: reorder point er nået (eller linjen tør inden en ny PO kan nå hjem). Inden 14/45 dage: reorder point rammes inden for 14 eller 45 dage. Book PO: behovet er dækket af en PO, der er bestilt men ikke booket – den skal bookes eller fremrykkes. Planlagt/Bestilt: en plan er gemt på sitet; den skifter til Bestilt når en ny PO ses i BC. Dækket: intet at gøre de næste 45 dage. Overlager og For nyt som pr. shop. Udgår, Skjult og Ikke indkøb sættes manuelt fra linjesidens ⋯-menu.`],
          ["8b. Status pr. shop", `Udsolgt: 0 tilgængeligt. Kritisk: tør inden ${c.status.bestilNuDays} dage på den konservative kurve, eller tør inden lead time selv med alle åbne PO'er. Bestil nu: bestil senest inden ${c.status.bestilNuDays} dage. OBS: bestil senest inden ${c.status.obsDays} dage, kun ubooket PO redder lageret, eller trend over ${Math.round(c.status.trendObs * 100)} %. Overlager: over ${c.status.overlagerDays} dages dækning uden nye køb, eller ingen salg. For nyt: under 14 dage i salg.`],
          ["Kendte huller i v1", `Lead time er faste standarder (Hybrid 6 mdr., øvrige 5 mdr., EU 30 dage), ikke målt på egne PO'er. Udsolgte dage trækkes ikke ud af velocity (Jullytics giver periodetotaler, ikke dagstal pr. produkt). Bundles uden “EAN+EAN”-SKU tæller ikke på komponenterne. Sæson er lånt fra Sobczyk for alle brands indtil de har et helt år.`],
        ].map(([h, t]) => <section key={h} className="card p-5"><h2 className="font-extrabold text-lg mb-1">{h}</h2><p className="text-sm font-medium leading-relaxed text-[#333]">{t}</p></section>)}
        <section className="card p-5">
          <h2 className="font-extrabold text-lg mb-3">Sæsonindeks pr. uge</h2>
          <svg viewBox="0 0 760 140" className="w-full h-auto">{idx.slice(1, 53).map((v, i) => <rect key={i} x={10 + i * 14.4} y={130 - (v / max) * 120} width="11" height={(v / max) * 120} fill={v >= 1 ? "#141414" : "#c9c4b8"} rx="2" />)}{[1, 10, 20, 30, 40, 52].map((w) => <text key={w} x={10 + (w - 1) * 14.4 + 5} y={139} fontSize="9" textAnchor="middle" fill="#8a8a8a">{w}</text>)}</svg>
          <p className="text-xs text-[var(--muted)] mt-1">Mørk = over årsgennemsnit. Kilde: {f.saeson.kilde}.</p>
        </section>
      </div>
    </Shell>
  );
}
