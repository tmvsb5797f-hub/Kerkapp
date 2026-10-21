# Kerkapp Email Ingestion Worker

Met deze Cloudflare Worker kan de predikant of scriba simpelweg een e-mail sturen (bijvoorbeeld naar `liturgie@jouwkerk.nl`) en de complete liturgie staat direct klaar in OBS Studio en op de Beamer!

---

## 🚀 Hoe het werkt

1. **Predikant stuurt mail**: Bijvoorbeeld met onderwerp *"Liturgie ochtenddienst 25 oktober - ds. Mark Bot"*.
2. **Cloudflare Email Routing**: Vangt de mail direct op en triggert deze Worker.
3. **AI / Regex Parser**: Herkent automatisch:
   - Voorganger & Datum
   - Liederen (Psalmen, Weerklank, DNP, Opwekking, Sela) inclusief coupletnummers
   - Schriftlezing
4. **Cloudflare D1 Koppeling**: Haalt automatisch de coupletteksten op uit de centrale liederen-database.
5. **Kerkapp Live Cloud**: Synchroniseert de dia's direct naar OBS Studio en de Beamer!

---

## ⚙️ Installatie & Inrichten (Stap voor Stap)

### Stap 1: Worker Deployen
Vanuit deze map:
```bash
cd "worker-email"
npx wrangler deploy
```

### Stap 2: Cloudflare Email Routing Instellen
1. Ga in het [Cloudflare Dashboard](https://dash.cloudflare.com) naar je domeinnaam (bijv. `jouwkerk.nl` of een subdomein).
2. Klik in het linkermenu op **Email Routing** ➔ **Routing rules**.
3. Klik op **Create rule**:
   - **Custom address**: bijv. `liturgie@jouwkerk.nl`
   - **Action**: kies *Send to a Worker*
   - **Worker**: selecteer `kerkliturgie-email-ingest`
4. Klik op **Save**.

Vanaf dat moment triggert elke e-mail die binnenkomt op dat adres direct de automatische liturgie-generatie!

---

## 🧪 Testen zonder e-mail

Je kunt de worker ook testen via een HTTP POST verzoek:
```bash
curl -X POST https://kerkliturgie-email-ingest.<jouw-subdomain>.workers.dev \
  -H "Content-Type: application/json" \
  -d '{
    "onderwerp": "Ochtenddienst zondag 25 oktober",
    "liturgie": "Voorganger: ds. Mark Bot\nZingen: Psalm 84: 1, 2\nSchriftlezing: Romeinen 8:31-39\nZingen: Weerklank 116: 1 en 3"
  }'
```
