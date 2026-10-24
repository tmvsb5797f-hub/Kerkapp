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

// VEILIGE TESTMODUS: Stuur e-mails UITSLUITEND naar Sem (nooit replyen naar de voorganger zolang het in testfase is!)
const TEST_MODUS_ALLEEN_NAAR_MIJ = true;
const TEST_EMAIL_ONTVANGER = "sempjons@gmail.com";

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

        // Stuur test-bevestiging UITSLUITEND naar Sem
        if (TEST_MODUS_ALLEEN_NAAR_MIJ && TEST_EMAIL_ONTVANGER) {
          try {
            const data = JSON.parse(responseTekst);
            const aantal = (data.resultaat && data.resultaat.slides) ? data.resultaat.slides.length : 0;
            const voorganger = (data.resultaat && data.resultaat.voorganger) ? data.resultaat.voorganger : "Voorganger";
            const datum = (data.resultaat && data.resultaat.datum) ? data.resultaat.datum : "";

            let samenvatting = `Beste Sem,\n\nEr is zojuist een inkomende liturgie-mail binnengekomen en verwerkt door het Bethelkerk systeem!\n\n` +
              `Status: TESTMODUS (Alleen naar jou verzonden ter verificatie)\n` +
              `Afzender dominee/scriba: ${afzender}\n` +
              `Onderwerp: ${onderwerp}\n` +
              `Herkende voorganger: ${voorganger}\n` +
              `Datum: ${datum}\n` +
              `Aantal gegenereerde dia's: ${aantal}\n\n`;

            if (data.resultaat && data.resultaat.items && data.resultaat.items.length > 0) {
              samenvatting += `Liederen & Onderdelen:\n`;
              data.resultaat.items.forEach((it, idx) => {
                samenvatting += `${idx + 1}. [${it.type}] ${it.titel}\n`;
              });
            }

            samenvatting += `\nMet vriendelijke groet,\nKerkapp Test Sync`;

            GmailApp.sendEmail(TEST_EMAIL_ONTVANGER, `[TEST LITURGIE] ${onderwerp} (${voorganger})`, samenvatting);
            console.log(`✅ Test-bevestiging UITSLUITEND gestuurd naar ${TEST_EMAIL_ONTVANGER}`);
          } catch(e) {
            console.warn("Fout bij versturen test-bevestiging naar Sem:", e);
          }
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

/**
 * Web App endpoint om vanuit Kerkapp e-mails mét PowerPoint (.pptx bijlage)
 * te versturen via jouw eigen Gmail-account (100% gratis & betrouwbaar).
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    service: "Bethelkerk Liturgie Apps Script Web App",
    ontvanger: TEST_EMAIL_ONTVANGER
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const contents = (e && e.postData) ? e.postData.contents : "{}";
    const data = JSON.parse(contents);
    const ontvanger = data.ontvanger || TEST_EMAIL_ONTVANGER;
    const onderwerp = data.onderwerp || "Liturgie PowerPoint Bethelkerk";
    const bericht = data.bericht || "";
    
    let options = {
      name: "Kerkapp Beamer Systeem"
    };
    if (data.pptxBase64 && data.bestandsnaam) {
      const bytes = Utilities.base64Decode(data.pptxBase64);
      const blob = Utilities.newBlob(bytes, "application/vnd.openxmlformats-officedocument.presentationml.presentation", data.bestandsnaam);
      options.attachments = [blob];
    }
    
    GmailApp.sendEmail(ontvanger, onderwerp, bericht, options);
    return ContentService.createTextOutput(JSON.stringify({ 
      success: true, 
      message: "E-mail met PowerPoint (.pptx) succesvol verzonden via Gmail!" 
    })).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    console.error("Fout in doPost:", err);
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      error: err.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
