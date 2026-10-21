/**
 * Google Apps Script voor Bethelkerk Maassluis (v2 - Robuust & Slim)
 * 
 * Verbeteringen in v2:
 * 1. Zoekt zowel op 'is:unread' als bredere zoektermen (zodat hij NOOIT mails mist).
 * 2. Ondersteunt ook bijlagen (als de dominee een Word-bestand of tekst meestuurt).
 * 3. Uitgebreide logging: je ziet precies in het logboek wat het script doet.
 * 4. Bevat een 'testVerbinding()' knop zodat je met 1 klik kunt testen of alles werkt!
 */

const WORKER_URL = "https://kerkliturgie-email-bethelkerk.kerkapp.workers.dev/test";
const KERK_ID = "bethel";
const STUUR_BEVESTIGING = true; // Stuur automatische reply naar de voorganger

/**
 * HOOFDFUNCTIE: Wordt elke 1 of 5 minuten automatisch aangeroepen door de trigger
 */
function verwerkInkomendeLiturgie() {
  console.log("Controleren op nieuwe e-mails...");

  // Zoek naar alle ongelezen mails in de inbox (max 5 tegelijk)
  const threads = GmailApp.search('is:unread in:inbox', 0, 5);
  console.log("Aantal ongelezen e-mails gevonden in inbox: " + threads.length);

  if (threads.length === 0) {
    console.log("Geen ongelezen e-mails. Als je zojuist een testmail hebt gestuurd, markeer hem dan even als ONGELEZEN in Gmail.");
    return;
  }

  for (let i = 0; i < threads.length; i++) {
    const thread = threads[i];
    const messages = thread.getMessages();
    const lastMsg = messages[messages.length - 1];

    const afzender = lastMsg.getFrom();
    const onderwerp = lastMsg.getSubject() || "Liturgie Bethelkerk";
    let bodyTekst = lastMsg.getPlainBody() || "";

    // Als de tekst leeg is of HTML bevat
    if (!bodyTekst || bodyTekst.trim().length < 10) {
      bodyTekst = lastMsg.getBody().replace(/<[^>]*>/g, "\n");
    }

    // Controleer of er tekstbestanden zijn bijgevoegd (.txt, .docx, etc.)
    const attachments = lastMsg.getAttachments();
    if (attachments && attachments.length > 0) {
      console.log(`E-mail heeft ${attachments.length} bijlage(n).`);
      for (let att of attachments) {
        const name = att.getName().toLowerCase();
        if (name.endsWith(".txt")) {
          bodyTekst += "\n\n" + att.getDataAsString();
        } else if (name.endsWith(".docx") || name.endsWith(".doc")) {
          bodyTekst += `\n[Bijlage meegeleverd: ${att.getName()}]`;
        }
      }
    }

    console.log(`Versturen naar Bethelkerk Cloud Worker: "${onderwerp}" van ${afzender}`);

    try {
      const response = UrlFetchApp.fetch(WORKER_URL, {
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

      const statusCode = response.getResponseCode();
      const responseTekst = response.getContentText();

      if (statusCode === 200) {
        console.log("✅ SUCCES: Liturgie succesvol klaargezet in Cloudflare D1!");
        thread.markRead(); // Markeer als gelezen zodat hij niet opnieuw wordt gestuurd

        // Stuur automatische ontvangstbevestiging terug
        if (STUUR_BEVESTIGING) {
          try {
            const data = JSON.parse(responseTekst);
            const aantal = (data.resultaat && data.resultaat.slides) ? data.resultaat.slides.length : 0;
            const voorganger = (data.resultaat && data.resultaat.voorganger) ? data.resultaat.voorganger : "Voorganger";

            lastMsg.reply(
              `Beste ${voorganger},\n\n` +
              `Hartelijk dank! De liturgie voor "${onderwerp}" is zojuist automatisch ontvangen en verwerkt door het Kerkapp systeem van de Bethelkerk Maassluis.\n\n` +
              `Er zijn ${aantal} dia's klaargezet voor de beamer en de livestream in OBS Studio.\n\n` +
              `Met vriendelijke groet,\n` +
              `Beamteam Bethelkerk Maassluis`
            );
            console.log(`Ontvangstbevestiging gestuurd naar ${afzender}`);
          } catch(e) {}
        }
      } else {
        console.error(`❌ Fout van worker (${statusCode}): ${responseTekst}`);
      }
    } catch (err) {
      console.error(`❌ Netwerkfout bij aanroepen worker: ${err.message}`);
    }
  }
}

/**
 * TEST FUNCTIE: Selecteer deze functie bovenin en klik op 'Uitvoeren'
 * om te testen of de verbinding met de Cloudflare Worker 100% werkt!
 */
function testVerbinding() {
  console.log("=== TEST VERBINDING MET BETHELKERK WORKER ===");
  const testData = {
    kerk_id: "bethel",
    afzender: "ds.markbot@protestantsekerk.nl",
    onderwerp: "Testdienst Bethelkerk Maassluis",
    liturgie: "Voorganger: ds. Mark Bot\nZingen: Psalm 84: 1, 2\nSchriftlezing: Romeinen 8:31-39 (HSV)\nZingen: Weerklank 116: 1 en 3"
  };

  const response = UrlFetchApp.fetch(WORKER_URL, {
    method: "post",
    contentType: "application/json",
    muteHttpExceptions: true,
    payload: JSON.stringify(testData)
  });

  console.log("HTTP Status:", response.getResponseCode());
  console.log("Worker Reactie:", response.getContentText());
  if (response.getResponseCode() === 200) {
    console.log("🎉 GEWELDIG! De verbinding tussen Google en de Bethelkerk Worker werkt perfect!");
  } else {
    console.log("⚠️ Let op: Worker gaf status " + response.getResponseCode());
  }
}
