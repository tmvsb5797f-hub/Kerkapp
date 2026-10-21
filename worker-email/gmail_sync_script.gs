/**
 * Google Apps Script voor Bethelkerk Maassluis
 * 
 * Doel:
 * Haalt automatisch binnengekomen liturgie e-mails op uit Gmail (bijv. van ds. Mark Bot)
 * en stuurt deze direct door naar de Cloudflare Worker van de Bethelkerk.
 * 
 * Installatie (1 minuut):
 * 1. Ga naar https://script.google.com en klik op "Nieuw project".
 * 2. Plak deze hele code in de editor en klik op Opslaan (Ctrl+S / Cmd+S).
 * 3. Klik op "Klok-icoontje" (Triggers) links in het menu.
 * 4. Klik op "+ Trigger toevoegen":
 *    - Functie: verwerkInkomendeLiturgie
 *    - Tijdgebaseerd ➔ Minutentimer ➔ Elke 5 minuten (of elke minuut).
 * 5. Geef éénmalig toestemming (Google popup). Klaar!
 */

// URL van de live Bethelkerk Cloudflare Worker
const WORKER_ENDPOINT = "https://kerkliturgie-email-bethelkerk.kerkapp.workers.dev/test";
const KERK_ID = "bethel";

// Stuur optioneel een automatische ontvangstbevestiging terug naar de predikant
const STUUR_ONTVANGSTBEVESTIGING = true;

function verwerkInkomendeLiturgie() {
  // Zoek naar ongelezen e-mails met 'liturgie' in het onderwerp of de tekst
  // (Of pas de zoekopdracht aan naar bijv. 'is:unread' als het een speciaal liturgie-adres is)
  const threads = GmailApp.search('is:unread (subject:liturgie OR subject:dienst OR liturgie)', 0, 5);

  if (threads.length === 0) {
    console.log("Geen nieuwe ongelezen liturgie e-mails gevonden.");
    return;
  }

  for (let i = 0; i < threads.length; i++) {
    const thread = threads[i];
    const messages = thread.getMessages();
    const lastMsg = messages[messages.length - 1]; // Pak het nieuwste bericht in de thread

    const afzender = lastMsg.getFrom();
    const onderwerp = lastMsg.getSubject();
    let bodyTekst = lastMsg.getPlainBody();

    // Als de plain body leeg is, strip dan HTML-tags uit de body
    if (!bodyTekst || bodyTekst.trim().length < 10) {
      bodyTekst = lastMsg.getBody().replace(/<[^>]*>/g, "\n");
    }

    console.log(`Verwerken van e-mail van ${afzender}: "${onderwerp}"`);

    try {
      // 1. Verstuur naar de Cloudflare Worker
      const response = UrlFetchApp.fetch(WORKER_ENDPOINT, {
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

      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();

      if (responseCode === 200) {
        console.log(`Succesvol doorgestuurd naar Bethelkerk Worker! Response: ${responseText}`);

        // Markeer de thread als gelezen zodat hij niet dubbel wordt verwerkt
        thread.markRead();
        thread.addLabel(getOrCreateLabel("Kerkapp/Verwerkt"));

        // 2. Optioneel: Stuur een nette ontvangstbevestiging terug naar de dominee
        if (STUUR_ONTVANGSTBEVESTIGING) {
          try {
            const data = JSON.parse(responseText);
            const slidesAantal = (data.resultaat && data.resultaat.slides) ? data.resultaat.slides.length : 0;
            const voorganger = (data.resultaat && data.resultaat.voorganger) ? data.resultaat.voorganger : "Voorganger";

            lastMsg.reply(
              `Beste ${voorganger},\n\n` +
              `Hartelijk dank! De liturgie voor "${onderwerp}" is zojuist automatisch ontvangen en verwerkt door het Kerkapp systeem van de Bethelkerk Maassluis.\n\n` +
              `Er zijn ${slidesAantal} dia's klaargezet voor de beamer en de livestream in OBS Studio.\n\n` +
              `Met vriendelijke groet,\n` +
              `Beamteam Bethelkerk Maassluis`
            );
            console.log(`Ontvangstbevestiging gestuurd naar ${afzender}`);
          } catch (replyErr) {
            console.warn("Kon geen reply sturen:", replyErr);
          }
        }
      } else {
        console.error(`Fout van worker (${responseCode}): ${responseText}`);
      }
    } catch (err) {
      console.error(`Fout bij versturen naar worker: ${err.message}`);
    }
  }
}

// Hulpfunctie om een label aan te maken in Gmail als deze nog niet bestaat
function getOrCreateLabel(naam) {
  let label = GmailApp.getUserLabelByName(naam);
  if (!label) {
    label = GmailApp.createLabel(naam);
  }
  return label;
}
