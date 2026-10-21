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
1. Log in op het Google-account van de kerk (of maak gratis `bethel.liturgie@gmail.com` aan).
2. Ga naar: **[https://script.google.com](https://script.google.com)**.
3. Klik linksboven op de grote knop **"Nieuw project"** (New project).
4. Geef het project linksboven een naam, bijv. `Bethelkerk Liturgie Sync`.

---

### Stap 2: Plak de Code
Verwijder eventuele bestaande tekst in de editor en plak de volgende code:

```javascript
/**
 * Google Apps Script voor Bethelkerk Maassluis
 * Stuurt inkomende liturgie-mails automatisch door naar Kerkapp Cloud
 */
const WORKER_ENDPOINT = "https://kerkliturgie-email-bethelkerk.kerkapp.workers.dev/test";
const KERK_ID = "bethel";
const STUUR_BEVESTIGING = true; // Zet op false als je geen automatische reply naar de dominee wilt

function verwerkInkomendeLiturgie() {
  // Zoekt ongelezen mails met 'liturgie' in onderwerp of tekst
  var threads = GmailApp.search('is:unread (subject:liturgie OR subject:dienst OR liturgie)', 0, 5);

  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    var messages = thread.getMessages();
    var lastMsg = messages[messages.length - 1];

    var afzender = lastMsg.getFrom();
    var onderwerp = lastMsg.getSubject();
    var bodyTekst = lastMsg.getPlainBody();

    if (!bodyTekst || bodyTekst.trim().length < 10) {
      bodyTekst = lastMsg.getBody().replace(/<[^>]*>/g, "\n");
    }

    try {
      var response = UrlFetchApp.fetch(WORKER_ENDPOINT, {
        method: "post",
        contentType: "application/json",
        muteHttpExceptions: true,
        payload: JSON.stringify({
          kerk_id: KERK_ID,
          afzender: afzender,
          onderwerp: onderwerp,
          liturgie: bodyTekst
        })
      });

      if (response.getResponseCode() === 200) {
        thread.markRead(); // Markeer als gelezen zodat hij niet dubbel gaat

        if (STUUR_BEVESTIGING) {
          try {
            var data = JSON.parse(response.getContentText());
            var slidesAantal = (data.resultaat && data.resultaat.slides) ? data.resultaat.slides.length : 0;
            var voorganger = (data.resultaat && data.resultaat.voorganger) ? data.resultaat.voorganger : "Voorganger";

            lastMsg.reply(
              "Beste " + voorganger + ",\n\n" +
              "Hartelijk dank! De liturgie voor \"" + onderwerp + "\" is zojuist automatisch ontvangen en verwerkt voor de beamer in de Bethelkerk Maassluis.\n\n" +
              "Er zijn " + slidesAantal + " dia's (liederen, schriftlezing en collecte) klaargezet voor de dienst en OBS Studio.\n\n" +
              "Met vriendelijke groet,\n" +
              "Beamteam Bethelkerk Maassluis"
            );
          } catch(e) {}
        }
      }
    } catch(err) {
      console.error("Fout bij synchroniseren:", err);
    }
  }
}
```

Druk op **Opslaan** (`Cmd + S` op Mac, of klik op het diskette-icoontje).

---

### Stap 3: Stel de automatische timer in (Trigger)
1. Klik in het linkermenu op het **Wekker/Klok-icoon** ("Triggers").
2. Klik rechtsonder op de blauwe knop **"+ Trigger toevoegen"** (+ Add Trigger).
3. Stel de velden als volgt in:
   * **Kies welke functie moet worden uitgevoerd:** `verwerkInkomendeLiturgie`
   * **Selecteer bron van gebeurtenis:** `Tijdgestuurd` (Time-driven)
   * **Selecteer type tijdgestuurde trigger:** `Minutentimer` (Minutes timer)
   * **Selecteer minuteninterval:** `Elke minuut` (of `Elke 5 minuten`)
4. Klik op **Opslaan**.
5. Google zal éénmalig vragen om toestemming (*Review Permissions* ➔ Kies je account ➔ *Advanced* / *Geavanceerd* ➔ *Ga naar Bethelkerk Liturgie Sync* ➔ *Allow*).

---

## 🎯 Klaar!

Vanaf nu gebeurt alles 100% vanzelf:
1. De predikant mailt de liturgie naar het Gmail-adres.
2. Binnen 1 tot 5 minuten staat de dienst in de Cloud.
3. Als de koster of beamist in de kerk de Kerkapp opent, verschijnt de melding:  
   *"📬 Nieuwe liturgie per e-mail ontvangen van ds. Mark Bot. Wil je deze inladen?"*  
   Klik op **OK** en de hele PowerPoint staat klaar voor de beamer en OBS!
