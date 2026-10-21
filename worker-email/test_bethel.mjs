import worker from "./index.js";

const markBotEmail = `From: Mark Bot <markbot@gmail.com>
Date: Wed, 2 Sep 2026 at 11:12
Subject: Re: liturgie zondagochtend
To: kosters en organisten CGK Maassluis <liturgie@cgkmaassluis.nl>
...en de ppt! 🙈
Op wo 2 sep 2026 om 11:07 schreef Mark Bot <markbot@gmail.com>:
broer, zus,zie hieronder, + ppt in de bijlage,
vriendelijke groet,
Mark Bot
Ochtend – voorbereiding Heilig Avondmaal
welkom en mededelingen van de kerkenraad door de ouderling van dienst
Zingen lied jongere: Simon: Psalm 23a: De Heer is mijn Herder: 1, 2 en 3
Stil gebed
Votum en groet
Zingen Ps 65:1,2
Gods wil voor ons leven: 1 Thes. 4:1-12
Zingen Lw 76:1,4
Gebed
Schriftlezing 1 Thes. 1:1-10
Zingen Ps 73:7,8 DNP
Verkondiging ‘Geloven in Thessalonica: door strijd tot overwinning. Deel 1’
Zingen Lw 237
Dankgebed
Collecte
Zingen Ps 116:3,4
Zegen.`;

async function run() {
  console.log("=== TEST MARK BOT REAL EMAIL ===");
  const req = new Request("https://kerkliturgie-email-bethelkerk.kerkapp.workers.dev/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kerk_id: "bethel",
      afzender: "Mark Bot <markbot@gmail.com>",
      onderwerp: "liturgie zondagochtend",
      liturgie: markBotEmail
    })
  });

  const res = await worker.fetch(req, {
    STANDAARD_KERK_ID: "bethel",
    GEMEENTE_NAAM: "Bethelkerk Maassluis",
    STANDAARD_VOORGANGER: "ds. Mark Bot"
  });

  const data = await res.json();
  console.log("Status:", res.status);
  console.log("Gemeente:", data.resultaat.gemeente);
  console.log("Voorganger:", data.resultaat.voorganger);
  console.log("Datum:", data.resultaat.datum);
  console.log("Aantal items:", data.resultaat.itemsGevonden);
  console.log("Aantal dia's:", data.resultaat.slides.length);
  console.log("\nDia-overzicht:");
  data.resultaat.slides.forEach((s, idx) => {
    console.log(`  Dia ${idx + 1}: [${s.type}] ${s.titel}`);
  });
}

run();
