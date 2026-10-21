# Kerkapp Email Ingestion Worker (Multi-Church)

Met deze Cloudflare Worker kan de predikant of scriba van **elke aangesloten kerk** simpelweg een e-mail sturen (bijvoorbeeld naar `bethel@liturgie.kerkapp.nl` of `maranatha@liturgie.kerkapp.nl`), waarna de complete liturgie direct klaarstaat in OBS Studio en op de beamer-pc van díe specifieke kerk!

---

## 🏛️ Hoe meerdere kerken worden gescheiden (Multi-Tenancy)

De worker herkent automatisch voor wie de e-mail bedoeld is op basis van de `To:` header:

| E-mailadres | Herkende `kerk_id` | Bestemd voor |
| :--- | :--- | :--- |
| `bethelliturgie@gmail.com` / `bethel@liturgie.kerkapp.nl` | `bethel` | Bethelkerk Maassluis |
| `maranatha@liturgie.kerkapp.nl` | `maranatha` | Maranathakerk |
| `dorpskerk@liturgie.kerkapp.nl` | `dorpskerk` | Dorpskerk |
| `liturgie+kruiskerk@kerkapp.nl` | `kruiskerk` | Kruiskerk (via plus-addressing) |

Elke kerk heeft haar eigen rij in de Cloudflare D1-database (`actieve_diensten`). Hierdoor kunnen kerken elkaar **nooit** overschrijven of elkaars diensten zien.

---

## 🚀 Hoe het werkt

1. **Predikant stuurt mail**: Bijvoorbeeld naar `bethel@liturgie.kerkapp.nl` met onderwerp *"Liturgie ochtenddienst 25 oktober - ds. Mark Bot"*.
2. **Cloudflare Email Routing**: Vangt de mail direct op en triggert deze Worker.
3. **AI / Regex Parser**: Herkent automatisch:
   - Voorganger & Datum
   - Liederen (Psalmen 1773, Weerklank, DNP, Opwekking, Sela) inclusief verzen (`1, 3 en 5`)
   - Schriftlezing (HSV)
4. **Cloudflare D1 Koppeling**: Haalt automatisch de coupletteksten op uit de centrale liederen- en bijbeldatabase.
5. **D1 Opslag**: Slaat de geconstrueerde dia-structuur op onder `kerk_id: "bethel"`.
6. **In de kerk**: De beamer-pc en OBS halen hun dienst automatisch op via `GET /dienst?kerk=bethel`.

---

## 📡 API Endpoints

### 1. Actieve dienst ophalen voor een kerk
```bash
GET https://kerkliturgie-email-ingest.<jouw-subdomain>.workers.dev/dienst?kerk=bethel
```
**Response (JSON):**
```json
{
  "gevonden": true,
  "kerk_id": "bethel",
  "gemeente_naam": "Bethelkerk Maassluis",
  "voorganger": "ds. Mark Bot",
  "datum": "zondag 25 oktober 2026",
  "slides": [
    { "type": "Welkom", "titel": "Welkom", "voorganger": "ds. Mark Bot" },
    { "type": "Zang", "titel": "Psalm 84 : 1", "regels": [...] }
  ]
}
```

### 2. Lijst met geconfigureerde kerken bekijken
```bash
GET https://kerkliturgie-email-ingest.<jouw-subdomain>.workers.dev/kerken
```

### 3. Testen zonder e-mail (POST)
```bash
curl -X POST https://kerkliturgie-email-ingest.<jouw-subdomain>.workers.dev/test \
  -H "Content-Type: application/json" \
  -d '{
    "kerk_id": "bethel",
    "onderwerp": "Ochtenddienst zondag 25 oktober",
    "liturgie": "Voorganger: ds. Mark Bot\nZingen: Psalm 84: 1, 2\nSchriftlezing: Romeinen 8:31-39\nZingen: Weerklank 116: 1 en 3"
  }'
```

---

## ⚙️ Cloudflare Email Routing Instellen

1. Ga in het [Cloudflare Dashboard](https://dash.cloudflare.com) naar je domein.
2. Ga naar **Email Routing** ➔ **Routing rules**.
3. Voeg een Catch-all of specifieke regel toe:
   - **Catch-all rule**: stuur alle adressen (`*@liturgie.jouwdomein.nl`) door naar de Worker `kerkliturgie-email-ingest`.
   - Of **Custom address**: `bethel@...` ➔ Send to Worker `kerkliturgie-email-ingest`.
4. Deploy de worker:
   ```bash
   cd worker-email
   npx wrangler deploy
   ```
