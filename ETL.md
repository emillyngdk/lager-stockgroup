# Daglig opdatering (ETL) – køreplan

Denne fil følges af den planlagte Claude-opgave hver morgen. Målet er: friske rådata i `data/raw/`,
nyt `data/forecast.json`, commit + push til `main` → Vercel bygger sitet automatisk.

Alt data hentes med MCP-værktøjerne **Varemodtagelse** og **Jullytics**. Shell'en kan nå GitHub, men ikke
Varemodtagelse/Jullytics/Vercel – derfor går data via værktøjskald, der gemmes som filer.

## 0. Klargør

```
add_repo emillyngdk/lager-stockgroup (push)  →  git clone --depth 1 https://github.com/emillyngdk/lager-stockgroup ~/lager-stockgroup
cd ~/lager-stockgroup && npm ci
```
De gamle rådata ligger allerede i `data/raw/` (committet). Du overskriver kun det, du henter i dag.
Hvis et kald fejler, så lad den gamle fil ligge og nævn det i commit-beskeden – forecasten kører stadig.

## Sådan gemmes et værktøjssvar

* **Stort svar (> ca. 55 KB)**: det ligger som fil i `/tmp/claude-tool-results/<session>/<id>.json`
  (stien står i tool-resultatet). Kopiér filen: `cp <sti> data/raw/<navn>.json`. Scripts læser formatet direkte.
* **Lille svar (inline)**: skriv det kompakte format nedenfor med Write. Hold det præcist; scripts validerer.

Tip: bed om store sider (`pr_side: 200`, `first: 120`, `limit: 200`), så flest mulige svar lander som filer.

## 1. Shopify-varianter (Jullytics `shopify_hent`) → `data/raw/shopify_<brand>_p<n>.json` / `compact_<brand>_p<n>.json`

Én butik pr. kald (`brand`: gladkokken | casper | herman | tomi). Query (Herman **uden** `inventoryLevels` – butikken mangler read_locations):

```graphql
{ products(first: 120, after: null, query: "status:active") {
    pageInfo { hasNextPage endCursor }
    nodes { id title createdAt publishedAt productType
      variants(first: 20) { nodes { id sku barcode inventoryQuantity
        inventoryItem { unitCost { amount }
          inventoryLevels(first: 5) { nodes { location { name } quantities(names: ["available"]) { quantity } } } } } } } } }
```
Blad med `after: "<endCursor>"` til `hasNextPage` er false. Slet gamle `shopify_<brand>_*` og `compact_<brand>_*` for brandet først, så der ikke ligger forældede sider.

Kompakt format (inline-sider):
```json
{"brand":"casper","compact":true,"nodes":[{"id":"gid://shopify/Product/123","title":"…","createdAt":"2024-01-01T00:00:00Z","publishedAt":"2024-01-01T00:00:00Z","productType":"…",
  "variants":[{"id":"gid://shopify/ProductVariant/456","sku":"5740007810268","barcode":"5740007810268","qty":12,"cost":160.5,"loc":{"Stockgroup":12}}]}]}
```

## 2. BC-lager (Varemodtagelse `lager_pr_lokation`) → `bc_lager_p<n>.json` / `compact_bc_lager_p<n>.json`

Kør `python3 scripts/parse_shopify.py` først; den skriver `data/eans.txt`. Kald med `skuer` = alle EAN'er (op til 500 ad gangen), `pr_side: 200`, `side: 1, 2, …` til alle `antal` er hentet.

Kompakt format: `{"compact":true,"varer":[{"sku":"X5740007810268","ean":"5740007810268","vare":"…","cll":12,"lok":{"NONFOOD":[lager,res_andre,res_shop_group,overflyt_res,disponibelt,bestilt_andre,bestilt_shop_group,disp_efter_alle]}}]}`

## 3. Åbne PO-linjer (Varemodtagelse `aabne_po_linjer`) → `bc_po_p<n>.json` / `compact_bc_po_p<n>.json`

Samme `skuer`, `pr_side: 200`, alle sider.

Kompakt format: `{"compact":true,"lev":{"<po>":"Leverandørnavn"},"ind":{"<po>":"Indkøber"},"linjer":[[po,linje,ean,vare,antal,cll,lokation,"DD-MM-YYYY (forventet)","status","DD-MM-YYYY (levering til lager, eller null)"]]}`
Status er en af: `Bekræftet ETA`, `Planlagt (ikke booket)`, `ETA overskredet`.

## 4. Salg (Jullytics `produktsalg`) → `sales_<brand>_d30.json` og `sales_<brand>_d7.json`

Pr. brand: `period: "d30", limit: 200, sort: "db"`, `period: "d7", limit: 200, sort: "db"` og 365 dage
(`from` = i dag minus 365 dage, `to` = i går, `limit: 200, sort: "antal"`, filnavn `sales_<brand>_d365.json`). 12 kald i alt.
Store svar kopieres som fil (navngiv `sales_<brand>_d30_full.json`). Inline-svar skrives kompakt:
```json
{"brand":"casper","period":"d30","from":"2026-10-25","to":"2026-11-23","days":30,"rows":[[produktId,solgt,solgtFoer,lager,db,"titel"]]}
```
(`days` = antal dage i perioden; `lager` og `db` må være null.)

## 5. Dagsserie – hentes IKKE dagligt

`dagsserie_*.json` er sæsongrundlaget og ligger fast i repoet. Opdatér den kun manuelt (max 400 dage pr. kald).

## 5a. Delt tilstand fra sitet (planer, udgår, lead time, MOQ)

Indkøberne gemmer planer og flag på sitet. De ligger i Vercel Blob og hentes FØR forecasten:

```
Vercel-værktøjet web_fetch_vercel_url: https://lager-stockgroup.vercel.app/api/state?token=<ETL_TOKEN>
```
`ETL_TOKEN` står i Vercel-projektets miljøvariabler (`filter_project_envs` på prj_5uH0VjvMvE8jPlCjuxWnZi2s6XA7) – værdien er krypteret dér,
så brug den token der står i den planlagte opgaves prompt. Gem svarets JSON uændret som `data/state.json`
(filen er gitignored). Svarer API'et ikke, så kør videre uden (ingen planer/flag i dag) og skriv det i svaret.

`run-forecast.ts` læser `data/state.json`: overrides (udgår, skjul_til, ikke_indkoeb, lead_time, moq, eu, kategori) går ind i motoren,
og planer lægges oven på linjerne. En plan skifter selv fra *Planlagt* til *Bestilt*, når en PO, der ikke var kendt da planen blev gemt, dukker op i BC.

## 5b. Danske produktnavne (Herman og Tomi)

`data/titles_da.json` oversætter hollandske og finske produktnavne til dansk (nøgle `brand:product_id`).
Når `run-forecast.ts` melder "mangler dansk navn", så oversæt de nye produkter og tilføj dem i filen
(kort, klart dansk; behold diametre, liter, cm og modelnavne som DualFry/Damaskus). Originalen vises som undertitel.

## 6. Kør og publicér

```
python3 scripts/parse_shopify.py
python3 scripts/normalize.py
python3 scripts/check.py          # stopper ved manglende sider – ret før du går videre
# data/state.json hentet i trin 5a
npx tsx scripts/run-forecast.ts   # skriver data/forecast.json (rows + linjer) + data/history/<dato>.json
npx next build --turbopack        # skal lykkes før push (SITE_PASSWORD=x er nok lokalt)
git add -A && git commit -m "Data <dato>: <kort status, fx 'udsolgt 40, kritisk 68'>" && git push
```
Vercel bygger ved push. Tjek bagefter med Vercel `list_deployments` (projekt `prj_5uH0VjvMvE8jPlCjuxWnZi2s6XA7`,
team `team_1PhaTsGH0YHOJzCJ84DU7AhB`) at seneste deployment er READY.

## 7. Mails

**Hver dag – nye Bestil nu-linjer.** `python3 scripts/mail_kritisk.py --kun-nye` skriver `data/mail_kritisk.html`
med de indkøbslinjer, der er kommet på *Bestil nu* siden forrige kørsel. Exit 2 = ingen nye, send intet.
Ellers send HTML'en med Gmail `send_message` (fra Emils Gmail) til **martin@stockgroup.dk** og **elm@shop-group.dk**,
emne `Nye varer at bestille – <dato>`, med logoet som inline-vedhæftning: `attachments: [{content: "sha256:<sha256 af public/stock-group-white.png>:<absolut sti>", filename: "stock-group.png", mimeType: "image/png", inline: true}]`
(`sha256sum public/stock-group-white.png`), og `src="cid:att0"` står allerede i HTML'en.

**Mandag – ugens forslag.** `python3 scripts/mail_forslag.py` skriver `data/mail.html` (én linje pr. EAN, pr. leverandør, planlagte mængder
i stedet for forslag). Send til samme to modtagere, emne `Ugens indkøbsforslag – uge <nr>`.

## Hvis noget går galt

* Et værktøj svarer "for_stort": halvér `first`/`pr_side`.
* Herman: fjern `inventoryLevels` fra query'en (read_locations mangler).
* `check.py` fejler: hent de manglende sider – byg aldrig med halve data.
* Byggefejl: ret ikke sitet i den daglige opgave; commit kun data og skriv fejlen i commit-beskeden, så Emil kan se den.
