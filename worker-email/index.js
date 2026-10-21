/**
 * Cloudflare Email Ingestion Worker voor Kerkapp
 * 
 * Werking:
 * 1. Ontvangt e-mails van de predikant (via Cloudflare Email Routing).
 * 2. Analyseert automatisch de datum, voorganger, liederen en schriftlezingen.
 * 3. Haalt ontbrekende teksten op uit de Cloudflare D1 lied- en bijbeldatabase.
 * 4. Stelt de complete liturgie samen en synchroniseert deze naar de Cloud (OBS / Beamer).
 * 5. Kan ook via HTTP POST /test worden aangeroepen voor handmatig testen.
 */

export default {
  // Cloudflare Email Routing handler
  async email(message, env, ctx) {
    const rawEmail = await new Response(message.raw).text();
    const afzender = message.from;
    const onderwerp = message.headers.get("subject") || "Geen onderwerp";

    console.log(`[Email Ingest] E-mail ontvangen van ${afzender}: "${onderwerp}"`);

    // Parse email body (plat tekst gedeelte)
    const bodyTekst = extractPlainText(rawEmail);
    if (!bodyTekst || bodyTekst.trim().length < 10) {
      console.warn("[Email Ingest] E-mail bevatte geen bruikbare tekst.");
      return;
    }

    // Verwerk liturgie
    const resultaat = await verwerkLiturgieTekst(bodyTekst, env, onderwerp);
    console.log(`[Email Ingest] Liturgie verwerkt: ${resultaat.slides.length} dia's klaargezet.`);
  },

  // HTTP Handler (om te testen via curl of browser)
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        }
      });
    }

    if (request.method === "POST") {
      try {
        const body = await request.json();
        const tekst = body.liturgie || body.tekst || "";
        const resultaat = await verwerkLiturgieTekst(tekst, env, body.onderwerp || "Test Dienst");
        return new Response(JSON.stringify(resultaat, null, 2), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 400 });
      }
    }

    return new Response("Kerkapp Email Ingestion Worker is actief. Stuur een e-mail naar het geconfigureerde adres of doe een POST met JSON.", {
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
};

/**
 * Analyseert de tekst van de liturgie, koppelt met D1 en bouwt de dia-lijst
 */
async function verwerkLiturgieTekst(tekst, env, onderwerp = "") {
  const gemeente = env.GEMEENTE_NAAM || "Bethelkerk Maassluis";
  const lines = tekst.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // 1. Herken voorganger
  let voorganger = "ds. Mark Bot";
  for (const l of lines) {
    const vgMatch = l.match(/(?:voorganger|predikant|dominee|ds\.?)\s*:?\s*([A-Z][a-zA-Z\s\.\-]+)/i);
    if (vgMatch) {
      voorganger = vgMatch[1].trim();
      break;
    }
  }

  // 2. Herken datum / dienst
  let datumTekst = new Date().toLocaleDateString("nl-NL", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  for (const l of lines) {
    const dMatch = l.match(/([0-9]{1,2}\s+[a-z]+\s+[0-9]{4}|zondag\s+[0-9]{1,2}\s+[a-z]+)/i);
    if (dMatch) {
      datumTekst = dMatch[1].trim();
      break;
    }
  }

  // 3. Herken liederen en schriftlezingen
  const items = [];
  const zangNamenLijst = [];

  for (const line of lines) {
    // Schriftlezing match
    const scrMatch = line.match(/(?:schriftlezing|lezing|tekst)\s*:?\s*([0-9]?\s*[A-Z][a-z]+\s+[0-9]+(?:\s*[:\-\s]\s*[0-9\-]+)?)/i);
    if (scrMatch) {
      const ref = scrMatch[1].trim();
      // Zoek op in D1 bijbel tabel indien beschikbaar
      let bijbelTekst = "";
      if (env.DB) {
        try {
          const row = await env.DB.prepare("SELECT tekst FROM bijbel_hsv WHERE id = ?").bind(ref).first();
          if (row && row.tekst) bijbelTekst = row.tekst;
        } catch(e) {}
      }

      items.push({
        type: "Schriftlezing",
        titel: ref,
        tekst: bijbelTekst || `Schriftlezing uit ${ref}`,
        regels: (bijbelTekst || `Schriftlezing uit ${ref}`).split("\n")
      });
      continue;
    }

    // Lied match: Psalm, Weerklank, DNP, Opwekking, Sela
    const liedMatch = line.match(/(Weerklank(?:\s+Lied)?|\bPsalm\b|\bDNP\b|\bOpwekking\b|\bSela\b|\bLied\b)\s*([0-9]+[a-z]?)(?:\s*[:\s]\s*([0-9,\s–\-en]+))?/i);
    if (liedMatch) {
      let bundel = liedMatch[1].trim();
      if (/weerklank/i.test(bundel)) bundel = "Weerklank Lied";
      else if (/^psalm$/i.test(bundel)) bundel = "Psalm";
      else if (/^dnp$/i.test(bundel)) bundel = "DNP Psalm";
      else if (/^opwekking$/i.test(bundel)) bundel = "Opwekking";
      else if (/^lied$/i.test(bundel)) bundel = "Weerklank Lied";

      const nummer = liedMatch[2].trim();
      const versStr = liedMatch[3] || "";
      const genormaliseerdeTitel = `${bundel} ${nummer}`;

      // Parseer versnummers (bijv: "1, 3 en 5" of "1-3")
      const verzen = parseerVersNummers(versStr);

      // Zoek liedtekst op in D1
      let liedTekstInD1 = null;
      if (env.DB) {
        try {
          const row = await env.DB.prepare("SELECT tekst FROM liederen WHERE id = ?").bind(genormaliseerdeTitel).first();
          if (row && row.tekst) liedTekstInD1 = row.tekst;
        } catch(e) {}
      }

      zangNamenLijst.push(genormaliseerdeTitel);

      items.push({
        type: "Zang",
        titel: genormaliseerdeTitel,
        verzen: verzen,
        gevondenInDb: !!liedTekstInD1,
        tekst: liedTekstInD1 || `Tekst voor ${genormaliseerdeTitel} ontbreekt nog in database.`
      });
    }
  }

  // 4. Construeer dia-lijst
  const slides = [];

  // Dia 1: Welkomstdia
  slides.push({
    id: "welkom-dia",
    type: "Welkom",
    titel: "Welkom",
    gemeente: gemeente,
    datum: datumTekst,
    voorganger: voorganger,
    zangLijst: zangNamenLijst
  });

  // Dia's per item
  for (const it of items) {
    if (it.type === "Schriftlezing") {
      slides.push({
        id: `lezing-${it.titel}`,
        type: "Schriftlezing",
        titel: it.titel,
        regels: it.regels
      });
    } else if (it.type === "Zang") {
      // Splits coupletten uit de opgeslagen D1 tekst
      const verzenMap = splitsCoupletTekst(it.tekst);
      const teZingenVerzen = (it.verzen && it.verzen.length > 0) 
        ? it.verzen 
        : (verzenMap.length > 0 ? verzenMap.map(v => v.nummer) : [1]);

      for (const vNr of teZingenVerzen) {
        const versObj = verzenMap.find(v => v.nummer === vNr);
        const regels = versObj ? versObj.regels : [`(Couplet ${vNr} ontbreekt in database)`];
        slides.push({
          id: `zang-${it.titel}-${vNr}`,
          type: "Zang",
          titel: `${it.titel} : ${vNr}`,
          basisTitel: it.titel,
          versNummer: vNr,
          regels: regels
        });
      }
    }
  }

  // Collecte dia
  slides.push({
    id: "collecte-dia",
    type: "QR",
    titel: "Collecte & Week-Tikkie",
    subtitel: "Scan met uw mobiel om bij te dragen",
    regels: [
      "Van harte aanbevolen voor de eredienst en de diaconie.",
      "Of gebruik de QR-code die in beeld verschijnt."
    ]
  });

  // Slotdia
  slides.push({
    id: "slot-dia",
    type: "Leeg",
    titel: "Zegenbede"
  });

  return {
    gemeente: gemeente,
    voorganger: voorganger,
    datum: datumTekst,
    itemsGevonden: items.length,
    ontbrekendeLiederen: items.filter(it => it.type === "Zang" && !it.gevondenInDb).map(it => it.titel),
    slides: slides
  };
}

function parseerVersNummers(str) {
  if (!str) return [];
  const nummers = [];
  const parts = str.toLowerCase().replace(/en/g, ",").replace(/&/g, ",").split(",");
  for (let p of parts) {
    p = p.trim();
    if (p.includes("-") || p.includes("–")) {
      const range = p.split(/[-–]/).map(n => parseInt(n.trim(), 10)).filter(Boolean);
      if (range.length === 2 && range[0] <= range[1]) {
        for (let i = range[0]; i <= range[1]; i++) nummers.push(i);
      }
    } else {
      const n = parseInt(p, 10);
      if (n) nummers.push(n);
    }
  }
  return [...new Set(nummers)].sort((a,b) => a-b);
}

function splitsCoupletTekst(tekst) {
  if (!tekst) return [];
  const blokken = tekst.split(/\n\s*\n/);
  const result = [];
  let teller = 1;

  for (const b of blokken) {
    const lines = b.split("\n").map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    let vNr = teller;
    const vMatch = lines[0].match(/^([0-9]+)\.?$/);
    let echteRegels = lines;
    if (vMatch) {
      vNr = parseInt(vMatch[1], 10);
      echteRegels = lines.slice(1);
    }
    result.push({ nummer: vNr, regels: echteRegels });
    teller++;
  }
  return result;
}

function extractPlainText(raw) {
  // Eenvoudige MIME parser: haal text/plain of body uit de raw mail
  if (!raw.includes("Content-Type: multipart/")) {
    const parts = raw.split(/\r?\n\r?\n/);
    return parts.slice(1).join("\n");
  }
  const plainMatch = raw.match(/Content-Type:\s*text\/plain[^\r\n]*[\r\n]+(?:[^\r\n]+[\r\n]+)*\r?\n([\s\S]*?)(?=(?:--[^\r\n]+|$))/i);
  if (plainMatch && plainMatch[1]) {
    return plainMatch[1];
  }
  const parts = raw.split(/\r?\n\r?\n/);
  return parts.slice(1).join("\n");
}
