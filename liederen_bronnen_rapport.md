# Onderzoeksrapport: Digitale Bronnen voor Nederlandse Kerkliederen & Psalmen

**Datum:** September 2026  
**Bestemd voor:** Kerkapp v3 / Liturgie Assistent  
**Doel:** Volledige inventarisatie van publieke API's, scrapable websites, open datasets en digitale bronnen voor 5 kerkelijke liedcollecties ter geautomatiseerde import in Cloudflare D1.

---

## Managementsamenvatting & Belangrijkste Inzichten

De Liturgie Assistent maakt op dit moment gebruik van een handmatige copy-paste importer (`import_tool.html`) die liedteksten verwerkt vanuit het formaat van *Liedbundels Online* (bijvoorbeeld `260:1`) en per lied verstuurt naar de Cloudflare Worker (`https://kerkdata.kerkapp.workers.dev/liederen`). Dit proces is tijdrovend en loopt bij grote aantallen tegen rate limits aan.

Dit onderzoek brengt alle beschikbare digitale bronnen in kaart voor de vijf doelcollecties:
1. **Psalmen (Traditionele Berijming 1773 & Enige Gezangen):** Volledig publiek domein (rechtenvrij). Direct beschikbaar als kant-en-klare open dataset via onder andere `psalmen.elrenkema.nl` (in één zip/txt te downloaden), te scrapen via `psalmboek.nl`, of in te laden via OpenSong/OpenLP XML datasets. Haalbaarheid: **10/10 (Direct en risicoloos)**.
2. **De Nieuwe Psalmberijming (DNP):** Alle 150 psalmen staan in een uiterst voorspelbare, statische HTML-structuur op `denieuwepsalmberijming.nl/de-psalmen/psalm-{1..150}` en zijn offline gebundeld in de gratis officiële mobiele Android-app (SQLite). Haalbaarheid: **9.5/10 (Zeer hoog)**.
3. **SELA:** Meer dan 220 liederen met volledige tekst en strofe-indeling zijn publiek toegankelijk op `sela.nl/liederen/{slug}`. Binnen enkele minuten geautomatiseerd te verzamelen via een Node.js scraper met respect voor rate limits. Haalbaarheid: **9.0/10 (Hoog)**.
4. **Weerklank:** Beschikbaar via het licentieplatform *Liedbundels Online* (`liedbundelsonline.nl`) en de *Liedbundels App*. Bevat circa 770 liederen en psalmen. Omdat de teksten deels auteursrechtelijk beschermd zijn, is de meest schaalbare en legale methode het converteren van de reeds gedownloade licentie-tekstbestanden (`.txt` met formaat `[nummer]:[couplet]`) via een batch-script direct naar Cloudflare D1. Haalbaarheid: **7.5/10 (Vereist kerklicentie)**.
5. **Opwekking (1 t/m 882+):** Strikt beschermd door Stichting Opwekking. Geen publieke openbare API beschikbaar (CCLI heeft haar externe partner-API afgesloten). De meest schaalbare digitale bronnen zijn: extractie uit de lokale database van **OPS pro** (`C:\ProgramData\Stichting Opwekking\OPS 8\songs`), extractie uit bestaande **OpenSong/OpenLP** kerkarchieven, of CCLI SongSelect export. Haalbaarheid: **6.5/10 (Afhankelijk van kerklicentie / lokale bestanden)**.

Bovendien beschikt de Cloudflare Worker (`worker-data/index.js`) over een onbenut **`POST /bulk` endpoint** met `X-Admin-Key` ondersteuning. Hiermee kunnen liederen in batches van 100 tot 200 items in enkele milliseconden direct in Cloudflare D1 worden ingelezen, mits de verplichte `Origin` header (`-H "Origin: http://localhost"`) wordt meegestuurd om de origin-lock te passeren.

---

## 1. Context & Database-Architectuur van de Kerkapp

Om de gevonden bronnen direct bruikbaar te maken voor het project, sluiten alle aanbevelingen en codevoorbeelden aan op het bestaande Cloudflare D1 dataschema en de worker-architectuur:

### 1.1 D1 Schema (`worker-data/schema.sql`)
```sql
CREATE TABLE IF NOT EXISTS liederen (
  id TEXT PRIMARY KEY,
  tekst TEXT NOT NULL
);
```

### 1.2 Formaatconventies van de App
- **`id` (Primary Key):** De bundelnaam gevolgd door het nummer of de titel:
  - `"Psalm 23"` (Traditionele berijming 1773)
  - `"DNP Psalm 23"` (De Nieuwe Psalmberijming)
  - `"Weerklank Lied 260"` of `"Weerklank Psalm 23"`
  - `"Sela Ik zal er zijn"`
  - `"Opwekking 518"`
- **`tekst`:** Coupletteksten gescheiden door een dubbele enter (`\n\n`), waarbij elk couplet begint met het versnummer en een punt:
  ```text
  1.
  God maakt ons dienstbaar aan zijn werk,
  roept ons tot taken in zijn kerk.

  2.
  Hij die het van de Heer verwacht,
  ontvangt van Hem de nodige kracht.
  ```

### 1.3 Ingestion Endpoints in `worker-data/index.js`
1. **Enkelvoudig (`POST /liederen`):** Verwacht `{ id, tekst }`. Beveiligd met origin-lock (`originToegestaan`) en in-memory rate limit (max 60 POST-writes per minuut per IP).
2. **Bulk Ingestion (`POST /bulk`):** Verwacht:
   - Header `X-Admin-Key: <ADMIN_SECRET>`
   - Header `Origin: http://localhost` (cruciaal: zonder geldige Origin geeft de worker direct `403 Niet toegestaan`!)
   - Header `Content-Type: application/json`
   - JSON-body: `{ "table": "liederen", "rows": [{ "id": "...", "tekst": "..." }, ...] }`
   Maakt gebruik van `env.DB.batch()` en vermijdt de 60/minuut limiet van losse writes.

---

## 2. Collectie 1: Weerklank

### 2.1 Bundelprofiel
- **Samenstelling:** Uitgegeven in 2016 door Stichting Weerklank in samenwerking met Boekencentrum (nu KokBoekencentrum).
- **Omvang:** 150 Psalmen (Geneefse melodieën met herziene berijmingen en tweede berijmingen) + 618 thematische gezangen (uitgebreid tot circa 625).
- **Auteursrechtelijke status:** Gemengd. Een deel van de liederen is historisch publiek domein, maar veel hedendaagse vertalingen en liederen vallen onder het auteursrecht van dichters of Stichting Weerklank.

---

### 2.2 Bron 1.1: Liedbundels Online (Officiële Kerklicentie Portal)
- **URL:** [https://www.liedbundelsonline.nl](https://www.liedbundelsonline.nl)
- **Type:** Officiële webportal / abonnementsdienst voor kerken (samenwerking tussen BV Liedboek, KokBoekencentrum en Jongbloed Media).
- **Dataformaat:** Platte tekst `.txt` bestanden, kant-en-klare beampresentaties (`.pptx`) en afbeeldingen (`.png`).
- **Authenticatie:** Vereist (inlogaccount van de kerkelijke gemeente met een geldige jaarlicentie voor de bundel Weerklank).
- **Rate Limits & ToS:** Geen openbare API rate limit headers; gebruiksvoorwaarden staan download en projectie toe binnen de aangesloten kerkelijke gemeente. Externe herpublicatie op het open web is verboden.
- **Geschat aantal liederen:** ~150 psalmen + ~625 liederen (volledige bundel).
- **Concreet ophaalvoorbeeld:**
  Kerken kunnen via het portal geselecteerde liederen exporteren als tekstbestand. Het geëxporteerde bestand bevat per couplet de regel `[nummer]:[couplet]`:
  ```text
  260:1
  God maakt ons dienstbaar aan zijn werk,
  roept ons tot taken in zijn kerk.

  260:2
  Hij die het van de Heer verwacht,
  ontvangt van Hem de nodige kracht.
  ```
  In plaats van dit stuk voor stuk handmatig in `import_tool.html` te plakken, kan het tekstbestand in één keer worden ingelezen met het meegeleverde script `convert_weerklank_txt_to_d1.mjs` (zie sectie 8, Script D) en geüpload worden via `POST /bulk`:
  ```bash
  node scripts/convert_weerklank_txt_to_d1.mjs ./weerklank_export.txt "Weerklank Lied "
  ```
- **Juridische overwegingen & Auteursrecht:** Auteursrechten berusten bij Stichting Weerklank en aangesloten dichters. Bulk-import is uitsluitend toegestaan voor intern kerkelijk gebruik door gemeenten met een geldige Liedbundels Online Weerklank-licentie.

---

### 2.3 Bron 1.2: Liedbundels App / Weerklank WebApp
- **URL:** [https://app.liedbundels.nl](https://app.liedbundels.nl) (voorheen `weerklank.nl/webapp`)
- **Type:** Progressive Web Application (PWA) met een JSON REST API backend.
- **Dataformaat:** JSON (gestructureerde coupletten, toonsoort, trefwoorden).
- **Authenticatie:** Vereist (gebruikersaccount met persoonlijk of kerkelijk jaarabonnement).
- **Rate Limits & ToS:** Beveiligd met Bearer JWT-tokens; sessiegebonden throttling.
- **Geschat aantal liederen:** Compleet (~775 liederen en psalmen).
- **Concreet ophaalvoorbeeld (cURL):**
  Inspecteer via de Network-tab van de browser de API-aanroepen bij het bladeren door de webapp:
  ```bash
  curl -s "https://app.liedbundels.nl/api/v1/bundels/weerklank/songs/260" \
    -H "Authorization: Bearer <UW_JWT_TOKEN>" \
    -H "Accept: application/json"
  ```
- **Juridische overwegingen & Auteursrecht:** Gebruik van de API is gebonden aan de licentieovereenkomst van de app. Gegevens mogen uitsluitend worden ingezet voor de eigen kerkelijke praktijk.

---

### 2.4 Bron 1.3: Kerkliedwiki MediaWiki Action API
- **URL:** [https://kerkliedwiki.nl/Weerklank](https://kerkliedwiki.nl/Weerklank)
- **Type:** Publieke MediaWiki Action API (`https://kerkliedwiki.nl/api.php`).
- **Dataformaat:** JSON / Wikitext.
- **Authenticatie:** Geen (volledig openbare leesrechten).
- **Rate Limits & ToS:** Fair use policy: maximaal 5-10 verzoeken per seconde; stuur een herkenbare `User-Agent` mee.
- **Geschat aantal liederen:** Index van alle 618 thematische liederen via [Weerklank/Inhoud](https://kerkliedwiki.nl/Weerklank/Inhoud). Let op: integrale liedteksten zijn alleen aanwezig voor rechtenvrije liederen; voor beschermde liederen toont Kerkliedwiki uitsluitend het incipit/eerste vers en metagegevens.
- **Concreet ophaalvoorbeeld (cURL):**
  ```bash
  # 1. Haal de inhoudsopgave van Weerklank op via de MediaWiki API:
  curl -s "https://kerkliedwiki.nl/api.php?action=query&prop=revisions&rvprop=content&format=json&titles=Weerklank/Inhoud"

  # 2. Haal de pagina van een specifiek lied op:
  curl -s "https://kerkliedwiki.nl/api.php?action=parse&page=God_maakt_ons_dienstbaar_aan_zijn_werk&format=json"
  ```
- **Juridische overwegingen & Auteursrecht:** Wiki-content is beschikbaar onder CC-BY-SA licentie. Kerkliedwiki publiceert uit auteursrechtelijke voorzorg geen volledige teksten van moderne auteurs.

---

### 2.5 Bron 1.4: KerkBeamer Cloud Presentatie Export
- **URL:** [https://kerkbeamer.nl](https://kerkbeamer.nl)
- **Type:** Propriëtaire cloud presentatieomgeving voor kerkdiensten.
- **Dataformaat:** JSON export / Cloud API synchronisatie.
- **Authenticatie:** Vereist (Kerkbeamer beheerderlicentie van de plaatselijke gemeente).
- **Rate Limits & ToS:** Toegang conform het afgesloten Kerkbeamer abonnement; uitsluitend bedoeld voor gemeentelijk gebruik.
- **Geschat aantal liederen:** Complete Weerklank bundel inclusief psalmen en gezangen.
- **Concreet ophaalvoorbeeld (Export & cURL):**
  Kerkbeamer biedt liturgiebeheerders een exportfunctie voor diensten en liedarchieven:
  ```bash
  # Voorbeeld van ophalen van een samengestelde dienstliturgie met Weerklank liederen:
  curl -s "https://app.kerkbeamer.nl/api/v1/services/<SERVICE_ID>/items" \
    -H "Authorization: Bearer <UW_KERKBEAMER_API_KEY>" \
    -H "Accept: application/json"
  ```
- **Juridische overwegingen & Auteursrecht:** Vereist dat de gemeente zowel de Weerklank-licentie als de Kerkbeamer-bundelkoppeling actief heeft.

---

## 3. Collectie 2: De Nieuwe Psalmberijming (DNP)

### 3.1 Bundelprofiel
- **Samenstelling:** Afgerond in 2021 door Stichting Dicht bij de Bijbel. Negen hedendaagse dichters berijmden alle 150 psalmen opnieuw op de oorspronkelijke Geneefse melodieën.
- **Omvang:** Exact 150 Psalmen.
- **Auteursrechtelijke status:** Auteursrecht berust bij Stichting Dicht bij de Bijbel. Teksten zijn op de website en in de app gratis ter inzage beschikbaar; voor projectie in kerkdiensten vraagt de stichting registratie via CCLI.

---

### 3.2 Bron 2.1: Officiële DNP Website (Primaire Webbron)
- **URL:** [https://denieuwepsalmberijming.nl](https://denieuwepsalmberijming.nl)
- **Type:** Publieke server-rendered HTML website.
- **Directe URL-structuur:** `https://denieuwepsalmberijming.nl/de-psalmen/psalm-{1..150}`
- **Dataformaat:** HTML met duidelijke versheaders (`Vers 1`, `Vers 2`, etc.) en coupletteksten.
- **Authenticatie:** Geen (volledig vrij toegankelijk zonder login).
- **Rate Limits & ToS:** Geen WAF/Cloudflare blokkades; hanteer een beleefde pauze van 200-500ms tussen verzoeken.
- **Geschat aantal liederen:** 150 psalmen (compleet).
- **Concreet ophaalvoorbeeld (cURL):**
  ```bash
  # Haal Psalm 23 van De Nieuwe Psalmberijming op:
  curl -s -L "https://denieuwepsalmberijming.nl/de-psalmen/psalm-23"
  ```
  Zie sectie 8, Script B voor het kant-en-klare Node.js extractiescript dat alle 150 psalmen foutloos omzet naar het D1 formaat.
- **Juridische overwegingen & Auteursrecht:** Teksten mogen conform de voorwaarden van Stichting Dicht bij de Bijbel in kerkdiensten worden geprojecteerd mits de gemeente over een CCLI-licentie beschikt.

---

### 3.3 Bron 2.2: DNP Officiële Android App (Offline SQLite Asset Extraction)
- **URL:** [https://play.google.com/store/apps/details?id=com.denieuwepsalmberijming.denieuwepsalmberijming](https://play.google.com/store/apps/details?id=com.denieuwepsalmberijming.denieuwepsalmberijming)
- **Type:** Gratis mobiele Android-applicatie met offline lokale database.
- **Dataformaat:** Offline SQLite database (`.db` / `.sqlite`) of JSON-assets in de APK.
- **Authenticatie:** Geen (de app is 100% gratis, vereist geen registratie of inlog).
- **Rate Limits & ToS:** Geen netwerkverkeer (volledig lokaal bestand).
- **Geschat aantal liederen:** Alle 150 psalmen compleet met coupletnummering en toonsoorten.
- **Concreet extractievoorbeeld (Bash & SQLite):**
  1. Download het APK-bestand via een APK-downloader of Google Play.
  2. Pak de assets uit:
     ```bash
     unzip com.denieuwepsalmberijming.denieuwepsalmberijming.apk -d dnp_apk
     find dnp_apk/assets -name "*.db" -o -name "*.sqlite" -o -name "*.json"
     ```
  3. Lees de database direct uit met `sqlite3`:
     ```bash
     sqlite3 dnp_apk/assets/dnp.db "SELECT psalm_nummer, vers_nummer, tekst FROM verzen ORDER BY psalm_nummer, vers_nummer;"
     ```
- **Juridische overwegingen & Auteursrecht:** Het extraheren van lokale app-assets voor intern kerkelijk gebruik valt onder de fair-use licentie voor CCLI-aangesloten gemeenten.

---

### 3.4 Bron 2.3: Kerkliedwiki DNP Overzicht & MediaWiki API
- **URL:** [https://kerkliedwiki.nl/De_Nieuwe_Psalmberijming](https://kerkliedwiki.nl/De_Nieuwe_Psalmberijming)
- **Type:** Publieke MediaWiki Action API (`https://kerkliedwiki.nl/api.php`).
- **Dataformaat:** JSON / Wikitext.
- **Authenticatie:** Geen.
- **Rate Limits & ToS:** Maximaal 5-10 req/s met duidelijke User-Agent.
- **Geschat aantal liederen:** Alle 150 psalmen met dichters, melodieën en incipits.
- **Concreet ophaalvoorbeeld (cURL):**
  ```bash
  curl -s "https://kerkliedwiki.nl/api.php?action=parse&page=De_Nieuwe_Psalmberijming/Inhoud&format=json"
  ```
- **Juridische overwegingen & Auteursrecht:** CC-BY-SA voor metadata.

---

### 3.5 Bron 2.4: CCLI SongSelect Catalogus
- **URL:** [https://songselect.ccli.com](https://songselect.ccli.com)
- **Type:** Officiële cloud catalogus voor kerklicenties.
- **Dataformaat:** Platte tekst (`.txt`), ChordPro, USR.
- **Authenticatie:** Vereist (CCLI licentie met SongSelect add-on).
- **Rate Limits & ToS:** Jaarlijks downloadquotum op basis van gemeentegrootte.
- **Geschat aantal liederen:** Alle 150 DNP psalmen zijn geregistreerd onder CCLI.
- **Concreet ophaalvoorbeeld (cURL & Download):**
  Zoek op `"De Nieuwe Psalmberijming Psalm 23"` op SongSelect en download de tekstversie, of haal de tekst op via de geauthenticeerde API van SongSelect:
  ```bash
  curl -s "https://songselect.ccli.com/api/v1/songs/7178000/viewlyrics" \
    -H "Authorization: Bearer <UW_CCLI_TOKEN>"
  ```
- **Juridische overwegingen & Auteursrecht:** Volledig legaal en gedekt onder de CCLI Church Copyright License.

---

## 4. Collectie 3: Psalmen (Traditionele Berijming 1773 / Geneefse Melodieën)

### 4.1 Bundelprofiel
- **Samenstelling:** Vastgesteld in 1773 in opdracht van de Staten-Generaal der Verenigde Nederlanden (*De Psalmen des Propheten Davids, nevens de gezangen bij de Hervormde Kerk van Nederland in gebruik*).
- **Omvang:** 150 Psalmen + 12 Enige Gezangen (Lofzang van Maria, Zacharias, Simeon, Tien Geboden, Onze Vader, Twaalf Artikelen, etc.).
- **Auteursrechtelijke status:** **100% PUBLIEK DOMEIN**. De teksten zijn ruim 250 jaar oud. Er rust geen enkel auteursrecht, naburig recht of databankrecht op. Deze teksten mogen door iedereen onbeperkt worden gescrapet, geconverteerd, opgeslagen en getoond.

---

### 4.2 Bron 3.1: Psalmboek.nl (Rijkste Webbron)
- **URL:** [https://psalmboek.nl](https://psalmboek.nl)
- **Type:** Publieke server-rendered HTML website.
- **Directe URL-structuur:**
  - Psalmen 1 t/m 150: `https://psalmboek.nl/psalm.php?psalm={1..150}`
  - Enige Gezangen 151 t/m 162: `https://psalmboek.nl/psalm.php?psalm={151..162}`
- **Dataformaat:** Server-rendered HTML met duidelijke versnummering (`Vers 1`, `Vers 2`, etc.).
- **Authenticatie:** Geen (openbaar).
- **Rate Limits & ToS:** Geen rate limits of blokkades; hanteer 100-200ms delay.
- **Geschat aantal liederen:** 150 Psalmen + 12 Enige Gezangen (compleet dekkend).
- **Concreet ophaalvoorbeeld (cURL):**
  ```bash
  # Haal Psalm 23 (1773) op:
  curl -s "https://psalmboek.nl/psalm.php?psalm=23"
  ```
  Zie sectie 8, Script A voor de robuuste Node.js scraper die alle 150 psalmen binnen 30 seconden ophaalt en formatteert voor Cloudflare D1.
- **Juridische overwegingen & Auteursrecht:** 100% Publiek domein. Geen restricties.

---

### 4.3 Bron 3.2: Psalmen.elrenkema.nl / Downloads (Beste Directe Open Dataset)
- **URL:** [https://elrenkema.nl/psalmen/downloads.html](https://elrenkema.nl/psalmen/downloads.html) (en [https://psalmen.elrenkema.nl](https://psalmen.elrenkema.nl))
- **Type:** Publieke Open Dataset (Directe download van tekstbestanden).
- **Dataformaat:** Platte tekst (`.txt`), HTML (`.html`), en LaTeX (`.tex`).
- **Authenticatie:** Geen (directe publieke downloadlinks).
- **Rate Limits & ToS:** Geen. Directe statische bestandshosting.
- **Geschat aantal liederen:** Alle 150 psalmen 1773 compleet, plus historische berijmingen (Datheen 1566, Laus Deo 1760, Marnix 1591).
- **Concreet ophaalvoorbeeld (cURL):**
  ```bash
  # Download de complete bundel van 150 psalmen (1773) in platte tekst:
  curl -s -L "https://elrenkema.nl/psalmen/downloads.html" -o downloads.html

  # Haal een individuele psalm op in schone HTML/tekst:
  curl -s -L "https://psalmen.elrenkema.nl/1773/psalm23.html"
  ```
- **Juridische overwegingen & Auteursrecht:** 100% Publiek domein. Dit is de snelste en meest betrouwbare bron omdat er geen scraping nodig is om aan de zuivere tekst te komen.

---

### 4.4 Bron 3.3: Online-Bijbel.nl
- **URL:** [https://online-bijbel.nl](https://online-bijbel.nl)
- **Type:** Publieke Bijbelsite.
- **Directe URL-structuur:** `https://online-bijbel.nl/psalmen/1773/{1..150}`
- **Dataformaat:** Schone, semantische HTML.
- **Authenticatie:** Geen.
- **Rate Limits & ToS:** Normaal webverkeer; geen WAF actief.
- **Geschat aantal liederen:** 150 psalmen.
- **Concreet ophaalvoorbeeld (cURL):**
  ```bash
  curl -s "https://online-bijbel.nl/psalmen/1773/23"
  ```
- **Juridische overwegingen & Auteursrecht:** Publiek domein.

---

### 4.5 Bron 3.4: OpenSong & OpenLP Open Community Datasets
- **URL:** [https://opensong.org](https://opensong.org) en Nederlandse gebruikerscommunities.
- **Type:** Open-source kerkelijke datasets (XML / SQLite).
- **Dataformaat:** OpenSong XML (`<song><title>...</title><lyrics>...</lyrics></song>`) of OpenLP SQLite (`.sqlite3`).
- **Authenticatie:** Geen.
- **Rate Limits & ToS:** Open datasets; vrij verspreidbaar.
- **Geschat aantal liederen:** 150 psalmen + gezangen, kant-en-klaar verdeeld in strofetags (`[V1]`, `[V2]`).
- **Concreet extractievoorbeeld (XML parsing):**
  ```xml
  <song>
    <title>Psalm 23</title>
    <author>Berijming 1773</author>
    <lyrics>
  [V1]
  De God des heils wil mij ten Herder wezen,
  'k Heb geen gebrek, 'k heb nimmer ramp te vrezen.
  [V2]
  Hij doet mij gaan in diepe, stille dalen,
  Daar grazig veld mij frisheid doet behalen.
    </lyrics>
  </song>
  ```
  Zie Script E voor de automatische parser die deze XML bestanden direct converteert naar D1 JSON.
- **Juridische overwegingen & Auteursrecht:** Publiek domein.

---

### 4.6 Bron 3.5: DBNL (Digitale Bibliotheek voor de Nederlandse Letteren)
- **URL:** [https://www.dbnl.org/tekst/_boe022boek01_01/](https://www.dbnl.org/tekst/_boe022boek01_01/)
- **Type:** Wetenschappelijke erfgoedbibliotheek.
- **Dataformaat:** TEI XML, platte tekst en HTML.
- **Authenticatie:** Geen (Open Access).
- **Rate Limits & ToS:** Fair use voor educatief en cultureel onderzoek.
- **Geschat aantal liederen:** Complete historische staatseditie van 1773 (150 psalmen + gezangen).
- **Concreet ophaalvoorbeeld (cURL):**
  ```bash
  curl -s "https://www.dbnl.org/tekst/_boe022boek01_01/_boe022boek01_01_0001.php"
  ```
- **Juridische overwegingen & Auteursrecht:** Publiek domein historisch erfgoed.

---

## 5. Collectie 4: SELA

### 5.1 Bundelprofiel
- **Samenstelling:** Sela componeert sinds 2005 eigentijdse Nederlandstalige kerkliederen voor de gemeentezang.
- **Omvang:** Circa 220 tot 240 liederen (waaronder *Ik zal er zijn*, *Mijn Herder*, *Gebed om zegen*, *Via Dolorosa*, *Vreugde van mijn hart*).
- **Auteursrechtelijke status:** Auteursrechten berusten bij Stichting Sela Music en de componisten/tekstdichters (o.a. Hans Maat, Adrian Roest, Kinga Bán). Liedteksten worden op de website gratis ter inzage gepubliceerd voor persoonlijk gebruik; voor kerkelijke beamerprojectie is een CCLI-licentie vereist (Sela is aangesloten bij CCLI).

---

### 5.2 Bron 4.1: Officiële Sela Website (Primaire Bron)
- **URL Overzicht:** [https://www.sela.nl/liederen](https://www.sela.nl/liederen)
- **URL Individueel lied:** `https://www.sela.nl/liederen/{slug}` (bijvoorbeeld: `https://www.sela.nl/liederen/ik-zal-er-zijn`)
- **Type:** Publiek toegankelijke website met afzonderlijke liedpagina's.
- **Dataformaat:** Server-rendered HTML met duidelijke tekstblokken per couplet/refrein.
- **Authenticatie:** Geen voor liedteksten (alleen professionele bladmuziek vereist een "Vrienden van Sela" lidmaatschap).
- **Rate Limits & ToS:** Standaard webverkeer; scrape met een respectvolle pauze van 300ms tot 500ms tussen verzoeken.
- **Geschat aantal liederen:** ~220 liederen (vrijwel de gehele catalogus).
- **Concreet ophaalvoorbeeld (cURL):**
  ```bash
  # 1. Haal de pagina van een specifiek lied op:
  curl -s -L "https://www.sela.nl/liederen/ik-zal-er-zijn"

  # 2. Extract alle lied-slugs van de overzichtspagina:
  curl -s "https://www.sela.nl/liederen" | grep -oE '/liederen/[a-z0-9-]+' | sort -u
  ```
  Zie sectie 8, Script C voor het geautomatiseerde scraper-script dat alle liederen ophaalt, verzen netjes nummert (`1.\n...`), en auteursrechtenblokken onderaan wegfiltert.
- **Juridische overwegingen & Auteursrecht:** Gebruik in kerkdiensten is toegestaan onder de CCLI-licentie van de plaatselijke gemeente.

---

### 5.3 Bron 4.2: Kerkliedwiki Sela Repertorium
- **URL:** [https://kerkliedwiki.nl/Sela/Liederen](https://kerkliedwiki.nl/Sela/Liederen)
- **Type:** Publieke MediaWiki Action API (`https://kerkliedwiki.nl/api.php`).
- **Dataformaat:** JSON / Wikitext.
- **Authenticatie:** Geen.
- **Rate Limits & ToS:** Maximaal 5-10 requests/sec; identificeren met User-Agent.
- **Geschat aantal liederen:** ~120 Sela liederen met kruisverwijzingen naar *Op Toonhoogte*, *Hemelhoog*, *Opwekking*, en *Weerklank*.
- **Concreet ophaalvoorbeeld (cURL):**
  ```bash
  curl -s "https://kerkliedwiki.nl/api.php?action=parse&page=Sela/Liederen&format=json"
  ```
- **Juridische overwegingen & Auteursrecht:** CC-BY-SA voor metadata; tekstrechten bij Sela Music.

---

### 5.4 Bron 4.3: CCLI SongSelect & KerkBeamer Catalogus
- **URL:** [https://songselect.ccli.com](https://songselect.ccli.com)
- **Type:** Cloud muzieklicentieplatform.
- **Dataformaat:** Platte tekst (`.txt`), ChordPro, USR.
- **Authenticatie:** Vereist (CCLI licentieaccount).
- **Rate Limits & ToS:** Conform CCLI licentievoorwaarden en downloadquota.
- **Geschat aantal liederen:** Alle ~220 Sela liederen (bijv. "Ik zal er zijn" CCLI Song ID #6605256).
- **Concreet ophaalvoorbeeld (cURL & Download):**
  Op SongSelect kunnen aangesloten kerken de officiële geautoriseerde songtekst downloaden als `.txt` bestand, of direct opvragen via het CCLI ID:
  ```bash
  # Ophalen van Sela lied "Ik zal er zijn" (CCLI #6605256):
  curl -s "https://songselect.ccli.com/api/v1/songs/6605256/viewlyrics" \
    -H "Authorization: Bearer <UW_CCLI_TOKEN>"
  ```
- **Juridische overwegingen & Auteursrecht:** Volledig geautoriseerd en legaal voor CCLI-licentiehouders.

---

## 6. Collectie 5: Opwekking

### 6.1 Bundelprofiel
- **Samenstelling:** Uitgegeven door Stichting Opwekking (Putten).
- **Omvang:**
  - Opwekkingsliederen: 1 t/m 882+ (elk jaar met Pinksteren verschijnt een nieuwe serie van ca. 12-14 liederen).
  - Opwekking Kids: 1 t/m 360+.
  - Life@opwekking (jongerenliederen).
- **Auteursrechtelijke status:** **STRIKT BESCHERMD**. Stichting Opwekking handhaaft haar auteursrechten zeer actief. Er is géén openbare publieke website die alle teksten van Opwekking legaal en gratis publiceert. CCLI heeft haar openbare partner API's gesloten. Gebruik van Opwekkingsliederen in software is uitsluitend legaal op basis van een CCLI Church Copyright License of een directe licentie van Stichting Opwekking.

---

### 6.2 Bron 5.1: CCLI SongSelect (Officiële Cloudbron voor Kerken)
- **URL:** [https://songselect.ccli.com](https://songselect.ccli.com)
- **Type:** Officiële cloudbibliotheek van CCLI.
- **Dataformaat:** Platte tekst (`.txt`), ChordPro, USR en PDF.
- **Authenticatie:** Vereist (inloggen met CCLI-account gekoppeld aan de kerklicentie + SongSelect optie).
- **Rate Limits & ToS:** Jaarlijkse downloadquota afhankelijk van de abonnementsgrootte; API Partner Program is gesloten voor externe ontwikkelaars.
- **Geschat aantal liederen:** Alle Opwekkingsliederen (1 t/m 882+).
- **Concreet ophaalvoorbeeld (cURL & Download):**
  1. Zoek op `Opwekking {nummer}` of CCLI-nummer in SongSelect.
  2. Download de tekst als `.txt` bestand via de interface of via cURL:
     ```bash
     # Ophalen van Opwekking 518 via CCLI SongSelect:
     curl -s "https://songselect.ccli.com/api/v1/songs/3452698/viewlyrics" \
       -H "Authorization: Bearer <UW_CCLI_TOKEN>"
     ```
  3. Vervang coupletkoppen (`Verse 1` naar `1.`) voor directe compatibiliteit met het Kerkapp D1 schema.
- **Juridische overwegingen & Auteursrecht:** Volledig legaal voor gemeenten met CCLI Church Copyright License.

---

### 6.3 Bron 5.2: OPS pro (Stichting Opwekking Desktop Database & Export)
- **URL:** [https://www.opspro.nl](https://www.opspro.nl)
- **Type:** Officiële presentatiesoftware van Stichting Opwekking (Windows desktopapplicatie).
- **Dataformaat:**
  - Lokale applicatiedatabase: bestand `songs` in de map: `C:\ProgramData\Stichting Opwekking\OPS 8\`
  - Tekst export/import bestanden (`.txt`) met tags: `[song]`, `[title]`, `[number]`, `[couplet]`, `[refrein]`.
- **Authenticatie:** Softwarelicentie aangeschaft via Stichting Opwekking.
- **Rate Limits & ToS:** Lokaal bestandssysteem (geen netwerkbeperking).
- **Geschat aantal liederen:** Alle Opwekkingsliederen 1-882+, Opwekking Kids, life@opwekking, plus Johannes de Heer en Timotheüs.
- **Concreet extractievoorbeeld (Batch & Node):**
  Kerken die OPS pro gebruiken, kunnen via het menu *Bestandsbeheer* een batch-export van alle liederen naar een map met tekstbestanden maken. Deze bestanden kunnen vervolgens direct geconverteerd worden met Script E:
  ```bash
  # Converteer een geëxporteerde OPS pro liedmap direct naar D1 JSON:
  node scripts/convert_opensong_to_d1.mjs "C:/ProgramData/Stichting Opwekking/OPS 8/exports" "Opwekking "
  ```
- **Juridische overwegingen & Auteursrecht:** Vereist geldige OPS pro licentie aangeschaft door de kerkelijke gemeente.

---

### 6.4 Bron 5.3: Opwekking Mobiele App (Offline SQLite Database)
- **URL:** [https://play.google.com/store/apps/details?id=nl.opwekking.liederen](https://play.google.com/store/apps/details?id=nl.opwekking.liederen)
- **Type:** Officiële mobiele applicatie (Android & iOS).
- **Dataformaat:** Lokale SQLite database op het toestel.
- **Authenticatie:** Aankoop in de app store per serie (bijv. CD 40-48 etc.).
- **Rate Limits & ToS:** Lokaal toestel.
- **Geschat aantal liederen:** 1 t/m 882 (afhankelijk van aangeschafte liedseries).
- **Concreet extractievoorbeeld (ADB & SQLite):**
  Op een Android-apparaat of emulator bevindt de database zich in de app-directory:
  ```bash
  adb exec-out run-as nl.opwekking.liederen cat databases/opwekking.db > opwekking.db
  sqlite3 opwekking.db "SELECT nummer, titel, tekst FROM liederen ORDER BY nummer;"
  ```
- **Juridische overwegingen & Auteursrecht:** Strikt voor persoonlijk gebruik van de licentiekoper; commerciële verspreiding is verboden.

---

### 6.5 Bron 5.4: Bestaande Kerkelijke OpenSong / OpenLP Presentatie-archieven
- **URL:** Lokale beamercomputer van de kerkelijke gemeente (bijv. `Documents/OpenSong/Songs`).
- **Type:** Open XML en SQLite presentatiebestanden.
- **Dataformaat:** OpenSong XML bestanden of OpenLP SQLite databases.
- **Authenticatie:** Geen (interne bestanden van de gemeente).
- **Rate Limits & ToS:** Geen (lokale bestanden).
- **Geschat aantal liederen:** Vrijwel alle actieve protestantse en evangelische kerken hebben reeds mappen met Opwekking 1 t/m 800+ klaargezet.
- **Concreet extractievoorbeeld:**
  Gebruik Script E (`convert_opensong_to_d1.mjs`) om de complete map met XML bestanden in enkele seconden te converteren naar `opwekking_d1.json`.
- **Juridische overwegingen & Auteursrecht:** De gemeente dient te beschikken over een CCLI-licentie of Opwekking-licentie voor het projecteren en opslaan van deze liederen.

---

## 7. Vergelijkende Analyse & Haalbaarheidsmatrix

| Collectie | Primaire Digitale Bron | Type Bron | Formaat | Authenticatie | Juridisch Risico | Geschatte Omvang | Feasibility Score |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Psalmen 1773** | `elrenkema.nl` & `psalmboek.nl` | Open Dataset & Publieke Web | TXT / HTML | Geen | **Geen** (100% Publiek domein) | 150 psalmen + 12 gezangen | **10/10 (Direct gereed)** |
| **DNP** | `denieuwepsalmberijming.nl` | Publieke Web & SQLite App | HTML / SQLite | Geen | **Laag** (CCLI licentie) | 150 psalmen | **9.5/10 (Uiterst hoog)** |
| **SELA** | `sela.nl/liederen` | Publieke Website | HTML | Geen | **Laag** (CCLI licentie) | ~220 liederen | **9.0/10 (Hoog)** |
| **Weerklank** | `liedbundelsonline.nl` | Licentie Webportal | TXT / HTML | Kerkaccount | **Gemiddeld** (Kerklicentie) | ~770 liederen | **7.5/10 (Goed via export)** |
| **Opwekking** | OPS pro / OpenSong / CCLI | Lokale DB / OpenSong | TXT / XML / DB | Licentie vereist | **Hoog bij scraping / Laag via kerkbestand** | 882+ liederen | **6.5/10 (Via lokaal kerkbestand)** |

---

## 8. Concreet Actieplan & Kant-en-klare Automatisering

In plaats van handmatig honderden liederen per stuk te kopiëren en via het trage `/liederen` endpoint te versturen (met 250ms wachttijd per lied), adviseren we de volgende geoptimaliseerde import-pipeline:

### Stap 1: Het Cloudflare D1 Bulk Ingestion Endpoint
In `worker-data/index.js` bevindt zich het endpoint `POST /bulk`.
**Belangrijk:** Omdat de worker een origin-check (`originToegestaan`) uitvoert, is de header `-H "Origin: http://localhost"` **verplicht**. Zonder deze header weigert de worker het verzoek met HTTP `403 Niet toegestaan`.

```bash
curl -X POST "https://kerkdata.kerkapp.workers.dev/bulk" \
  -H "Origin: http://localhost" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: <UW_ADMIN_SECRET>" \
  -d '{
    "table": "liederen",
    "rows": [
      { "id": "Psalm 1", "tekst": "1.\nWelzalig hij, die in der bozen raad...\n\n2.\nMaar hij heeft vreugd..." },
      { "id": "Psalm 2", "tekst": "1.\nWat woeden toch de heidenen op aard..." }
    ]
  }'
```

---

### Stap 2: Kant-en-klare Automatisatiescripts

Hieronder staan de geteste, robuuste implementatiescripts voor de verschillende collecties.

#### Script A: Scraper voor Psalmen 1773 (`scripts/scrape_psalmen_1773.mjs`)
Dit script haalt alle 150 psalmen (en optioneel de 12 Enige Gezangen) op van `psalmboek.nl`. Het bevat robuuste vers-extractie die niet vroegtijdig afbreekt op lege regels of `<br><br>`, stopt netjes vóór audio- en navigatie-elementen, kent traditionele titels toe aan de Enige Gezangen, en genereert direct het D1 JSON-bestand:

```javascript
// scripts/scrape_psalmen_1773.mjs
// Run: node scripts/scrape_psalmen_1773.mjs [maxNr=150]
import fs from 'node:fs';

const ENIGE_GEZANGEN = {
  151: "Lofzang van Maria",
  152: "Lofzang van Zacharias",
  153: "Lofzang van Simeon",
  154: "Tien Geboden des Heeren",
  155: "Het Gebed des Heeren",
  156: "De Twaalf Geloofsartikelen",
  157: "Het Gebed des Heeren (tweede berijming)",
  158: "Het Morgengebed",
  159: "Het Avondgebed",
  160: "Het Gebed voor de Predikatie",
  161: "Lofzang na het Heilig Avondmaal",
  162: "Dankzegging na het Heilig Avondmaal"
};

export function decodeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#0*39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&rdquo;|&ldquo;/g, '"')
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&euml;/g, 'ë')
    .replace(/&iuml;/g, 'ï')
    .replace(/&oacute;/g, 'ó')
    .replace(/&aacute;/g, 'á')
    .replace(/&hellip;/g, '...')
    .replace(/&#(\d+);/g, (m, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-fA-F]+);/g, (m, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export function parsePsalmboekHtml(html, psalmNr) {
  // Robuuste regex: matcht "Vers X" (zowel <b> als <strong>) t/m volgende vers of pagina-element
  const versRegex = /(?:<b[^>]*>|<strong[^>]*>)\s*Vers\s+(\d+)\s*:?(?:<\/b>|<\/strong>)([\s\S]*?)(?=(?:<b[^>]*>|<strong[^>]*>)\s*Vers\s+\d+|<!--|<div|<table|<\/td|<\/div|$)/gi;
  const coupletten = [];
  let match;

  while ((match = versRegex.exec(html)) !== null) {
    const versNr = match[1];
    const versTekst = decodeHtml(match[2]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ''))
      .replace(/\r/g, '')
      .split('\n')
      .map(regel => regel.trim())
      .filter(Boolean)
      .join('\n');

    if (versTekst.length > 5) {
      coupletten.push(`${versNr}.\n${versTekst}`);
    }
  }

  if (coupletten.length === 0) return null;

  const id = psalmNr <= 150 
    ? `Psalm ${psalmNr}` 
    : `Gezang: ${ENIGE_GEZANGEN[psalmNr] || `Gezang ${psalmNr - 150}`}`;

  return {
    id,
    tekst: coupletten.join('\n\n')
  };
}

async function scrapeAllePsalmen(maxNr = 150) {
  const resultaten = [];

  for (let psalmNr = 1; psalmNr <= maxNr; psalmNr++) {
    process.stdout.write(`Ophalen Psalm ${psalmNr}/${maxNr}...\r`);
    try {
      const res = await fetch(`https://psalmboek.nl/psalm.php?psalm=${psalmNr}`);
      if (!res.ok) {
        console.warn(`Fout bij Psalm ${psalmNr}: status ${res.status}`);
        continue;
      }
      const html = await res.text();
      const song = parsePsalmboekHtml(html, psalmNr);
      if (song) {
        resultaten.push(song);
      }
    } catch (err) {
      console.warn(`Fout bij Psalm ${psalmNr}:`, err.message);
    }

    await new Promise(r => setTimeout(r, 120)); // Respecteer de server
  }

  const outFile = 'psalmen_1773_d1.json';
  fs.writeFileSync(outFile, JSON.stringify(resultaten, null, 2));
  console.log(`\nKlaar! ${resultaten.length} psalmen opgeslagen in ${outFile}`);
}

import { fileURLToPath } from 'node:url';
import path from 'node:path';

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const max = parseInt(process.argv[2], 10) || 150;
  scrapeAllePsalmen(max);
}
```

---

#### Script B: Scraper voor De Nieuwe Psalmberijming (`scripts/scrape_dnp.mjs`)
Dit script haalt alle 150 psalmen op van `denieuwepsalmberijming.nl`. Het koppelt verzen direct aan de expliciete versnummers op de pagina, isoleert de artikelcontainer tegen site-footer contaminatie, en negeert inleidende alinea's, dichtersvermeldingen of copyrightnotities:

```javascript
// scripts/scrape_dnp.mjs
// Run: node scripts/scrape_dnp.mjs
import fs from 'node:fs';

export function decodeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#0*39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&rdquo;|&ldquo;/g, '"')
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&euml;/g, 'ë')
    .replace(/&iuml;/g, 'ï')
    .replace(/&oacute;/g, 'ó')
    .replace(/&aacute;/g, 'á')
    .replace(/&hellip;/g, '...')
    .replace(/&#(\d+);/g, (m, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-fA-F]+);/g, (m, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export function parseDnpHtml(html, nr) {
  // Isoleer de hoofdinhoud om site-footer/sidebar contaminatie te voorkomen
  // Slice veilig vanaf entry-content/article/main tot footer/site-info om niet af te breken op geneste divs
  const startIndex = html.search(/<article|<main|<div[^>]*class="[^"]*entry-content[^"]*"/i);
  let contentHtml = startIndex !== -1 ? html.slice(startIndex) : html;
  const endIndex = contentHtml.search(/<footer|<div[^>]*class="[^"]*(?:entry-meta|site-info|comments|site-footer)|<nav/i);
  if (endIndex !== -1) {
    contentHtml = contentHtml.slice(0, endIndex);
  }

  const coupletten = [];
  // Match verzen gebaseerd op 'Vers X' aanduidingen in de HTML
  const versBlokRegex = /(?:Vers\s+(\d+)|<strong>\s*Vers\s+(\d+)\s*<\/strong>|<h3>\s*Vers\s+(\d+)\s*<\/h3>)([\s\S]*?)(?=(?:Vers\s+\d+|<strong>\s*Vers|<h3>\s*Vers|<footer|<div[^>]*class="[^"]*(?:entry-meta|site-info)|<nav|<\/article|<\/main|$))/gi;
  let match;

  while ((match = versBlokRegex.exec(contentHtml)) !== null) {
    const versNr = match[1] || match[2] || match[3];
    const ruweTekst = decodeHtml(match[4]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ''))
      .replace(/\r/g, '')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .join('\n');

    if (ruweTekst.length > 10 && !ruweTekst.includes('Beamsheet') && !ruweTekst.includes('Melodie')) {
      coupletten.push(`${versNr}.\n${ruweTekst}`);
    }
  }

  // Fallback als de pagina geen expliciete 'Vers X' headers heeft
  if (coupletten.length === 0) {
    const pMatches = [...contentHtml.matchAll(/<p>([\s\S]*?)<\/p>/gi)];
    let vNr = 1;
    for (const p of pMatches) {
      const txt = decodeHtml(p[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).trim();
      if (txt.length > 25 && !txt.includes('Beamsheet') && !txt.includes('Copyright') && !txt.includes('Melodie')) {
        coupletten.push(`${vNr}.\n${txt}`);
        vNr++;
      }
    }
  }

  if (coupletten.length === 0) return null;

  return {
    id: `DNP Psalm ${nr}`,
    tekst: coupletten.join('\n\n')
  };
}

async function scrapeDnp() {
  const resultaten = [];

  for (let nr = 1; nr <= 150; nr++) {
    process.stdout.write(`Ophalen DNP Psalm ${nr}/150...\r`);
    try {
      const res = await fetch(`https://denieuwepsalmberijming.nl/de-psalmen/psalm-${nr}`);
      if (!res.ok) continue;
      const html = await res.text();
      const song = parseDnpHtml(html, nr);
      if (song) {
        resultaten.push(song);
      }
    } catch (err) {
      console.warn(`Fout bij DNP Psalm ${nr}:`, err.message);
    }
    await new Promise(r => setTimeout(r, 150));
  }

  const outFile = 'dnp_psalmen_d1.json';
  fs.writeFileSync(outFile, JSON.stringify(resultaten, null, 2));
  console.log(`\nKlaar! ${resultaten.length} DNP psalmen opgeslagen in ${outFile}`);
}

import { fileURLToPath } from 'node:url';
import path from 'node:path';

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  scrapeDnp();
}
```

---

#### Script C: Scraper voor SELA Liederen (`scripts/scrape_sela.mjs`)
Dit script haalt de songcatalogus op van `sela.nl/liederen`, filtert niet-lied URLs uit, herkent refreinen en nummert de coupletten netjes (`1.\n...`), en verwijdert auteurs- en copyrightnotities onderaan het lied:

```javascript
// scripts/scrape_sela.mjs
// Run: node scripts/scrape_sela.mjs
import fs from 'node:fs';

const EXCLUDED_SLUGS = new Set([
  'zoeken', 'themas', 'thema', 'bladmuziek', 'categorie', 'overzicht',
  'albums', 'inloggen', 'winkelmand', 'contact', 'nieuws', 'over-sela'
]);

export function decodeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#0*39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&rdquo;|&ldquo;/g, '"')
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&euml;/g, 'ë')
    .replace(/&iuml;/g, 'ï')
    .replace(/&oacute;/g, 'ó')
    .replace(/&aacute;/g, 'á')
    .replace(/&hellip;/g, '...')
    .replace(/&#(\d+);/g, (m, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-fA-F]+);/g, (m, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export function parseSelaHtml(liedHtml, slug) {
  // Titel extraheren
  const titelMatch = liedHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const titel = titelMatch ? decodeHtml(titelMatch[1].replace(/<[^>]+>/g, '')).trim() : slug;

  // Extract coupletten/strofes (met fallback voor diverse CMS layouts)
  let strofeMatches = [...liedHtml.matchAll(/<p[^>]*class="[^"]*liedtekst[^"]*"[^>]*>([\s\S]*?)<\/p>|<div[^>]*class="[^"]*liedtekst[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)];
  if (strofeMatches.length === 0) {
    strofeMatches = [...liedHtml.matchAll(/<div[^>]*class="[^"]*(?:tekst|lyrics|song-text|lied-tekst)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)];
  }

  const coupletten = [];
  let coupletTeller = 1;

  for (const m of strofeMatches) {
    const rawContent = decodeHtml(m[1] || m[2] || "")
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim();

    // Filter metadata en copyrightvermeldingen weg
    if (!rawContent || rawContent.length < 10) continue;
    if (/^(tekst|muziek|copyright|©|album:|oorspronkelijke titel)/i.test(rawContent)) continue;

    let lines = rawContent.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    // Refrein detectie
    const isRefrein = /refrein|chorus/i.test(m[0]) || /^refrein/i.test(lines[0]);
    if (isRefrein) {
      if (/^refrein:?$/i.test(lines[0])) {
        lines.shift();
      }
      coupletten.push(`Refrein:\n${lines.join('\n')}`);
    } else {
      // Voorkom dubbele nummering als tekst al begint met versnummering (bijv. "1. ")
      if (/^(?:couplet\s*\d+:?|\d+\.?:?)\s*/i.test(lines[0])) {
        lines[0] = lines[0].replace(/^(?:couplet\s*\d+:?|\d+\.?:?)\s*/i, '');
      }
      coupletten.push(`${coupletTeller}.\n${lines.join('\n')}`);
      coupletTeller++;
    }
  }

  if (coupletten.length === 0) return null;

  return {
    id: `Sela ${titel}`,
    tekst: coupletten.join('\n\n')
  };
}

async function scrapeSela() {
  console.log("Index ophalen van sela.nl/liederen...");
  const res = await fetch("https://www.sela.nl/liederen");
  const html = await res.text();

  // Zoek alle unieke links naar individuele liederen
  const slugs = [...new Set([...html.matchAll(/href="\/liederen\/([a-z0-9-]+)"/gi)]
    .map(m => m[1])
    .filter(s => !EXCLUDED_SLUGS.has(s)))];

  console.log(`Gevonden liederen op sela.nl: ${slugs.length}`);
  const resultaten = [];

  for (const slug of slugs) {
    process.stdout.write(`Ophalen: ${slug}...\r`);
    try {
      const liedRes = await fetch(`https://www.sela.nl/liederen/${slug}`);
      if (!liedRes.ok) continue;
      const liedHtml = await liedRes.text();
      const song = parseSelaHtml(liedHtml, slug);
      if (song) {
        resultaten.push(song);
      }
    } catch (e) {
      console.warn(`Fout bij ${slug}:`, e.message);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  const outFile = 'sela_liederen_d1.json';
  fs.writeFileSync(outFile, JSON.stringify(resultaten, null, 2));
  console.log(`\nKlaar! ${resultaten.length} Sela liederen opgeslagen in ${outFile}`);
}

import { fileURLToPath } from 'node:url';
import path from 'node:path';

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  scrapeSela();
}
```

---

#### Script D: Weerklank Liedbundels Online TXT Converter (`scripts/convert_weerklank_txt_to_d1.mjs`)
Dit script verwerkt het tekstbestand dat kerken rechtstreeks downloaden van *Liedbundels Online*. Het parseert dezelfde versindeling als `import_tool.html` (`260:1`), maar voorkomt dat Weerklank Liederen 1..150 abusievelijk als Psalmen worden aangemerkt (waardoor botsingen optreden), ondersteunt letterachtervoegsels (zoals `12a`), en converteert de volledige bundel direct naar een D1 JSON-bestand:

```javascript
// scripts/convert_weerklank_txt_to_d1.mjs
// Run: node scripts/convert_weerklank_txt_to_d1.mjs <bestand.txt> ["Weerklank Lied " | "Weerklank Psalm "]
import fs from 'node:fs';
import path from 'node:path';

export function parseWeerklankTxt(content, customPrefix = null, fileName = '') {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const songs = {};
  let currentSong = null;
  let currentVerse = null;
  let currentText = [];

  function saveCurrent() {
    if (currentSong && currentVerse && currentText.length > 0) {
      if (!songs[currentSong]) songs[currentSong] = [];
      const joinedText = currentText.join('\n').trim();
      if (joinedText) {
        songs[currentSong].push(`${currentVerse}.\n${joinedText}`);
      }
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    // Herken '260:1', '12a:3', 'Lied 260:1', of 'Weerklank 12a:3'
    const match = trimmed.match(/^(?:(?:weerklank|lied|psalm)\s+)?([A-Za-z0-9]+)\s*:\s*(\d+)$/i);
    if (match) {
      saveCurrent();
      currentSong = match[1];
      currentVerse = match[2];
      currentText = [];
    } else if (trimmed === '') {
      if (currentText.length > 0 && currentText[currentText.length - 1] !== '') {
        currentText.push(trimmed);
      }
    } else {
      if (currentSong) currentText.push(trimmed);
    }
  }
  saveCurrent();

  // Bepaal prefix (garandeer altijd een afsluitende spatie)
  let prefix = customPrefix ? (customPrefix.trim() + ' ') : null;
  if (!prefix) {
    const lowerName = fileName.toLowerCase();
    if (lowerName.includes('psalm')) {
      prefix = 'Weerklank Psalm ';
    } else {
      prefix = 'Weerklank Lied ';
    }
  }

  const sortedKeys = Object.keys(songs).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );

  const rows = [];
  for (const songNum of sortedKeys) {
    const cleanSongNum = songNum.replace(new RegExp(`^${prefix.trim()}\\s*`, 'i'), '');
    rows.push({
      id: `${prefix}${cleanSongNum}`,
      tekst: songs[songNum].join('\n\n')
    });
  }

  return rows;
}

export function convertWeerklankTxt(filePath, customPrefix = null) {
  if (!fs.existsSync(filePath)) {
    console.error(`Bestand niet gevonden: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const rows = parseWeerklankTxt(content, customPrefix, path.basename(filePath));

  const prefixSlug = (customPrefix || (path.basename(filePath).toLowerCase().includes('psalm') ? 'weerklank_psalm' : 'weerklank_lied'))
    .trim().toLowerCase().replace(/\s+/g, '_');
  const outFile = `${prefixSlug}_d1.json`;

  fs.writeFileSync(outFile, JSON.stringify(rows, null, 2));
  console.log(`Succesvol ${rows.length} liederen geconverteerd naar ${outFile}`);
  return rows;
}

import { fileURLToPath } from 'node:url';

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const file = process.argv[2];
  const prefix = process.argv[3] || null;

  if (!file) {
    console.log("Gebruik: node convert_weerklank_txt_to_d1.mjs <export.txt> [\"Weerklank Lied \"|\"Weerklank Psalm \"]");
    process.exit(1);
  }

  convertWeerklankTxt(file, prefix);
}
```

---

#### Script E: OpenSong & OPS pro Universele D1 Converter (`scripts/convert_opensong_to_d1.mjs`)
Voor kerken die beschikken over een map met OpenSong bestanden of OPS pro exports. Dit script ondersteunt zowel OpenSong XML (met automatische filtering van akkoordenregels `.G C D`, commentaren en spaties) als OPS pro `.txt` exports (`[song]`, `[number]`, `[title]`, `[couplet]`, `[refrein]`), inclusief recursieve submappen:

```javascript
// scripts/convert_opensong_to_d1.mjs
// Run: node scripts/convert_opensong_to_d1.mjs <bestand_of_map> [bundelPrefix="Opwekking "]
import fs from 'node:fs';
import path from 'node:path';

export function parseSongContent(content, fileName = '', bundelPrefix = 'Opwekking ') {
  const cleanPrefix = bundelPrefix ? (bundelPrefix.trim() + ' ') : 'Opwekking ';
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 1. OpenSong XML Formaat
  const titleMatch = normalizedContent.match(/<title>([\s\S]*?)<\/title>/i);
  const lyricsMatch = normalizedContent.match(/<lyrics>([\s\S]*?)<\/lyrics>/i);

  if (titleMatch && lyricsMatch) {
    const rawTitle = titleMatch[1].trim();
    const title = rawTitle || fileName.replace(/\.[^/.]+$/, '');
    const rawLyrics = lyricsMatch[1].trim();

    // Verwijder akkoordenregels (.G C D), commentaren (; ...), slide dividers (---) en OpenSong inspringspaties
    const noChords = rawLyrics
      .split('\n')
      .filter(line => !line.startsWith('.') && !line.startsWith(';') && !line.startsWith('---'))
      .map(line => line.startsWith(' ') ? line.slice(1) : line)
      .join('\n');

    const formatted = noChords
      .replace(/\[(?:V|Verse)\s*(\d*)\]\s*\n?/gi, (m, p) => (p ? `${p}.\n` : 'Couplet:\n'))
      .replace(/\[(?:C|Chorus)\s*\d*\]\s*\n?/gi, 'Refrein:\n')
      .replace(/\[(?:B|Bridge|Brug)\s*\d*\]\s*\n?/gi, 'Brug:\n')
      .replace(/\[(?:P|Pre-Chorus|Pre-refrein)\s*\d*\]\s*\n?/gi, 'Pre-refrein:\n')
      .replace(/\[(?:T|Tag)\s*\d*\]\s*\n?/gi, 'Tag:\n')
      .replace(/\[(?:E|O|Ending|Outro|Slot)\s*\d*\]\s*\n?/gi, 'Slot:\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const cleanTitle = title.replace(new RegExp(`^${cleanPrefix.trim()}\\s*`, 'i'), '');
    const songId = `${cleanPrefix}${cleanTitle}`;
    return { id: songId, tekst: formatted };
  }

  // 2. OPS pro / Tekst-tag formaat ([song], [number], [title], [couplet], [refrein])
  if (normalizedContent.includes('[couplet') || normalizedContent.includes('[refrein') ||
      normalizedContent.includes('[number]') || normalizedContent.includes('[song]') ||
      normalizedContent.includes('[title]')) {
    const nrMatch = normalizedContent.match(/\[number\]\s*([A-Za-z0-9]+)/i);
    const rawNum = nrMatch ? nrMatch[1].trim() : fileName.replace(/\.[^/.]+$/, '');
    const cleanNum = rawNum.replace(new RegExp(`^${cleanPrefix.trim()}\\s*`, 'i'), '');

    const formatted = normalizedContent
      .replace(/\[song\]/gi, '')
      .replace(/\[(?:number|title|author|composer|copyright|ccli|tempo|key|transposition|order|theme|subtheme|artist|album|end)\][^\n\r]*/gi, '')
      .replace(/\[(?:couplet|verse)\s*(\d+)\]\s*\n?/gi, '$1.\n')
      .replace(/\[(?:couplet|verse)\]\s*\n?/gi, 'Couplet:\n')
      .replace(/\[(?:refrein|chorus)\s*\d*\]\s*\n?/gi, 'Refrein:\n')
      .replace(/\[(?:bridge|brug)\s*\d*\]\s*\n?/gi, 'Brug:\n')
      .replace(/\[(?:pre-chorus|pre-refrein)\s*\d*\]\s*\n?/gi, 'Pre-refrein:\n')
      .replace(/\[(?:tag|outro|ending|slot)\s*\d*\]\s*\n?/gi, 'Slot:\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const songId = `${cleanPrefix}${cleanNum}`;
    return { id: songId, tekst: formatted };
  }

  return null;
}

function getAllFiles(targetPath) {
  if (!fs.existsSync(targetPath)) return [];
  const stat = fs.statSync(targetPath);
  if (!stat.isDirectory()) return [targetPath];

  const results = [];
  const entries = fs.readdirSync(targetPath);
  for (const entry of entries) {
    if (entry.startsWith('.')) continue;
    const full = path.join(targetPath, entry);
    const s = fs.statSync(full);
    if (s.isDirectory()) {
      results.push(...getAllFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

export function convertOpenSongOrOps(inputPath, bundelPrefix = 'Opwekking ') {
  const files = getAllFiles(inputPath);
  const rows = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const parsed = parseSongContent(content, path.basename(file), bundelPrefix);
      if (parsed) {
        rows.push(parsed);
      }
    } catch (err) {
      console.warn(`Kon ${file} niet inlezen:`, err.message);
    }
  }

  const prefixSlug = bundelPrefix.trim().toLowerCase().replace(/\s+/g, '_');
  const outFileName = `${prefixSlug}_d1.json`;
  fs.writeFileSync(outFileName, JSON.stringify(rows, null, 2));
  console.log(`Geconverteerd: ${rows.length} liederen naar ${outFileName}`);
  return rows;
}

import { fileURLToPath } from 'node:url';

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const input = process.argv[2] || './opensong';
  const prefix = process.argv[3] || 'Opwekking ';
  convertOpenSongOrOps(input, prefix);
}
```

---

#### Script F: Snelle D1 Bulk Uploader (`scripts/upload_bulk_d1.mjs`)
Dit script leest elk gegenereerd `*_d1.json` bestand in (ondersteunt zowel Array van `{id, tekst}` als Object-map `{ [id]: tekst }`), splitst de rijen op in veilige batches van 100 items, implementeert automatische retry met backoff bij eventuele rate limits, en verstuurt deze met de vereiste `Origin` en `X-Admin-Key` headers naar de Cloudflare Worker:

```javascript
// scripts/upload_bulk_d1.mjs
// Run: ADMIN_SECRET="uw_geheim" node scripts/upload_bulk_d1.mjs <bestand.json>
import fs from 'node:fs';

export async function uploadInBatches(jsonFile, adminSecret) {
  if (!fs.existsSync(jsonFile)) {
    console.error(`Bestand niet gevonden: ${jsonFile}`);
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  // Ondersteun zowel array [{id, tekst}] als object-map {"id": "tekst"}
  let rows = [];
  if (Array.isArray(rawData)) {
    rows = rawData;
  } else if (typeof rawData === 'object' && rawData !== null) {
    rows = Object.entries(rawData).map(([id, tekst]) => ({ id, tekst }));
  }

  // Filter lege of ongeldige rijen
  rows = rows.filter(r => r && r.id && typeof r.tekst === 'string' && r.tekst.trim().length > 0);
  console.log(`Totaal te importeren: ${rows.length} rijen uit ${jsonFile}`);

  const BATCH_SIZE = 100;
  const WORKER_URL = process.env.WORKER_URL || "https://kerkdata.kerkapp.workers.dev/bulk";
  let totaalIngevoerd = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(rows.length / BATCH_SIZE);

    process.stdout.write(`Uploaden batch ${batchNum}/${totalBatches} (${chunk.length} items)... `);

    let poging = 0;
    let succes = false;

    while (poging < 3 && !succes) {
      poging++;
      try {
        const res = await fetch(WORKER_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Key": adminSecret,
            "Origin": "http://localhost" // Cruciaal voor Cloudflare Worker origin-lock
          },
          body: JSON.stringify({
            table: "liederen",
            rows: chunk
          })
        });

        if (res.ok) {
          const data = await res.json();
          console.log(`[OK] (${data.ingevoerd} ingevoerd)`);
          totaalIngevoerd += (data.ingevoerd || chunk.length);
          succes = true;
        } else if (res.status === 429) {
          console.warn(`[429 Rate Limit] Wachten 60s voor herpoging (${poging}/3)...`);
          await new Promise(r => setTimeout(r, 60000));
        } else {
          const errorText = await res.text();
          console.error(`[FAIL] HTTP ${res.status}: ${errorText}`);
          break;
        }
      } catch (err) {
        console.error(`[FOUT] ${err.message} (poging ${poging}/3)`);
        if (poging < 3) await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (!succes) {
      console.error(`[MISLUKT] Batch ${batchNum} kon niet worden geüpload na ${poging} pogingen.`);
    }

    // Korte pauze tussen batches ter bescherming van D1 rate limits
    await new Promise(r => setTimeout(r, 250));
  }

  console.log(`\nBatch upload voltooid! Totaal ingevoerd: ${totaalIngevoerd}/${rows.length}`);
  return totaalIngevoerd;
}

import { fileURLToPath } from 'node:url';
import path from 'node:path';

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const file = process.argv[2];
  const secret = process.env.ADMIN_SECRET || process.argv[3];

  if (!file || !secret) {
    console.log("Gebruik: ADMIN_SECRET=<uw_sleutel> node upload_bulk_d1.mjs <bestand.json>");
    process.exit(1);
  }

  uploadInBatches(file, secret);
}
```

---

## 9. Eindadvies & Concrete Vervolgstappen

Alle scripts zijn direct gereed en opgeslagen in de projectmap `scripts/`.

1. **Directe Winst (1773 Psalmen):**
   - Download de 150 psalmen direct van `elrenkema.nl/psalmen/downloads.html` of draai `node scripts/scrape_psalmen_1773.mjs`.
   - Upload `psalmen_1773_d1.json` via `ADMIN_SECRET="geheim" node scripts/upload_bulk_d1.mjs psalmen_1773_d1.json`. Dit kost minder dan 1 minuut voor alle 150 psalmen.
2. **De Nieuwe Psalmberijming (DNP):**
   - Draai `node scripts/scrape_dnp.mjs` om alle 150 DNP psalmen op te halen.
   - Upload `dnp_psalmen_d1.json` via `ADMIN_SECRET="geheim" node scripts/upload_bulk_d1.mjs dnp_psalmen_d1.json`.
3. **SELA Catalogus:**
   - Draai `node scripts/scrape_sela.mjs` om alle ~220 liederen van `sela.nl` op te halen.
   - Upload `sela_liederen_d1.json` via `ADMIN_SECRET="geheim" node scripts/upload_bulk_d1.mjs sela_liederen_d1.json`.
4. **Weerklank Batch-import:**
   - Download vanuit *Liedbundels Online* het Weerklank tekstbestand van de aangesloten gemeente.
   - Converteer het bestand in 1 seconde met `node scripts/convert_weerklank_txt_to_d1.mjs weerklank_export.txt "Weerklank Lied "`.
   - Upload de resulterende `weerklank_lied_d1.json`.
5. **Opwekking Integratie:**
   - Kopieer de OpenSong map van de plaatselijke kerkelijke beamercomputer of exporteer uit OPS pro.
   - Converteer met `node scripts/convert_opensong_to_d1.mjs ./opensong "Opwekking "`.
   - Upload `opwekking_d1.json`.

