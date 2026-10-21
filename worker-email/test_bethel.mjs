// Test-script voor de Bethelkerk Mail Worker
// Simuleert een e-mail van ds. Mark Bot naar de Bethelkerk worker
import worker from "./index.js";

const testEmailTekst = `
Liturgie ochtenddienst zondag 25 oktober 2026
Bethelkerk Maassluis
Voorganger: ds. Mark Bot

Votum en groet
Zingen: Psalm 84: 1 en 2
Wetslezing
Zingen: Weerklank 116: 1 en 3
Gebed
Schriftlezing: Romeinen 8:31-39 (HSV)
Zingen: DNP Psalm 23: 1, 2, 3
Preek
Zingen: Weerklank 446: 1, 2
Dankgebed en voorbeden
Collecte (Week-Tikkie)
Slotlied: Psalm 134: 1, 2, 3
Zegen
`;

async function runTest() {
  console.log("=== TEST: BETHELKERK MAIL WORKER ===");

  // Simuleer een Cloudflare Worker environment
  const mockEnv = {
    GEMEENTE_NAAM: "Bethelkerk Maassluis",
    STANDAARD_KERK_ID: "bethel",
    STANDAARD_VOORGANGER: "ds. Mark Bot"
  };

  const req = new Request("https://kerkliturgie-email-bethelkerk.kerkapp.workers.dev/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kerk_id: "bethel",
      onderwerp: "Liturgie ochtenddienst 25 oktober - ds. Mark Bot",
      liturgie: testEmailTekst
    })
  });

  const res = await worker.fetch(req, mockEnv);
  const json = await res.json();

  console.log("Status:", res.status);
  console.log("Gemeente:", json.resultaat.gemeente);
  console.log("Voorganger:", json.resultaat.voorganger);
  console.log("Datum:", json.resultaat.datum);
  console.log("Aantal items gevonden:", json.resultaat.itemsGevonden);
  console.log("Aantal dia's gegenereerd:", json.resultaat.slides.length);
  console.log("\nEerste dia (Welkom):", JSON.stringify(json.resultaat.slides[0], null, 2));
  console.log("\nOverzicht van alle dia's:");
  json.resultaat.slides.forEach((s, idx) => {
    console.log(`  Dia ${idx + 1}: [${s.type}] ${s.titel || s.id}`);
  });

  console.log("\n=== TEST SUCCESVOL AFGEROND ===");
}

runTest();
