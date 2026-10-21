# Bethelkerk Gmail ➔ Kerkapp Koppeling (100% Gratis & Zonder Custom Domain)

Met deze handleiding koppel je een gratis Gmail-adres (bijv. `bethel.liturgie@gmail.com`) direct aan jullie live Cloudflare Worker.

Zodra ds. Mark Bot (of een scriba) een e-mail stuurt met de liturgie:
1. Vangt Gmail dit automatisch op.
2. Wordt de liturgie binnen 5 seconden doorgestuurd naar jullie live Cloudflare Worker.
3. Krijgt de dominee optioneel een nette automatische ontvangstbevestiging ("Bedankt! Er zijn X dia's klaargezet in de Bethelkerk").
4. Staat de complete dienst in de kerk met 1 klik klaar in OBS Studio en op de beamer!

---

## 📋 Stappenplan (Duurt 2 minuten)

### Stap 1: Open Google Apps Script
1. Log in op het Google-account van de kerk.
2. Ga naar: **[https://script.google.com](https://script.google.com)**.
3. Klik linksboven op de grote knop **"Nieuw project"** (New project).
4. Geef het project linksboven een naam, bijv. `Bethelkerk Liturgie Sync`.

---

### Stap 2: Plak de Code
Kopieer de inhoud uit [worker-email/gmail_sync_script.gs](file:///Users/sempons/Downloads/kerkapp%20v3/worker-email/gmail_sync_script.gs) en plak deze in de editor.

Druk op **Opslaan** (`Cmd + S` op Mac).

---

### Stap 3: Test met 1 klik of de verbinding werkt
1. Selecteer bovenin de editor bij de functies: **`testVerbinding`**.
2. Klik op **`Uitvoeren`** (*Run*).
3. Geef éénmalig toestemming (*Review Permissions* ➔ *Geavanceerd* ➔ *Ga naar Bethelkerk Liturgie Sync* ➔ *Toestaan*).
4. Onderin zie je nu:  
   `🎉 GEWELDIG! De verbinding tussen Google en de Bethelkerk Worker werkt perfect!`

---

### Stap 4: Stel de automatische timer in (Trigger)
1. Klik in het linkermenu op het **Wekker/Klok-icoon** ("Triggers").
2. Klik rechtsonder op de blauwe knop **"+ Trigger toevoegen"** (+ Add Trigger).
3. Stel de velden als volgt in:
   * **Kies welke functie moet worden uitgevoerd:** `verwerkInkomendeLiturgie`
   * **Selecteer bron van gebeurtenis:** `Tijdgestuurd` (Time-driven)
   * **Selecteer type tijdgestuurde trigger:** `Minutentimer` (Minutes timer)
   * **Selecteer minuteninterval:** `Elke minuut` (of `Elke 5 minuten`)
4. Klik op **Opslaan**.

---

## 💡 Belangrijke Tips bij het Testen met E-mail:

1. **Markeer je testmail als ONGELEZEN:**  
   Als je zelf een testmail stuurt naar de Gmail en je hebt hem al even geopend in je inbox, is hij *gelezen*. Het script zoekt specifiek naar nieuwe ongelezen mails (`is:unread`). Klik in Gmail op het envelop-icoontje bij de mail om hem weer als **ongelezen** te markeren.
2. **Bekijk de logs:**  
   In Google Apps Script kun je links op **"Uitvoeringen"** (*Executions*) klikken om precies te zien wat het script gedaan heeft en wanneer.
