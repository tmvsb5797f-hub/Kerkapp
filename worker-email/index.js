/**
 * Cloudflare Email Ingestion Worker voor Kerkapp (Multi-Church Architecture)
 * 
 * Werking voor meerdere kerken:
 * 1. Ontvangt e-mails van voorgangers via Cloudflare Email Routing.
 * 2. Bepaalt automatisch voor welke kerk de e-mail is bestemd via:
 *    - Het e-mailadres (bijv. "bethel@liturgie.nl" of "liturgie+maranatha@liturgie.nl")
 *    - Of de afzender van de predikant (gekoppeld aan een kerk)
 * 3. Analyseert de liturgie (datum, predikant, liederen, schriftlezingen).
 * 4. Haalt ontbrekende liederen en bijbelteksten op uit de centrale Cloudflare D1 database.
 * 5. Slaat de complete dienst op in D1 onder de specifieke kerk_id.
 * 6. De beamer-pc en OBS in díe specifieke kerk halen hun dienst direct op via GET /dienst?kerk=<kerk_id>.
 */

// Standaard configuratie per kerk (kan ook dynamisch worden uitgebreid in D1)
const BEKENDE_KERKEN = {
  "bethel": {
    naam: "Bethelkerk Maassluis",
    standaardVoorganger: "ds. Mark Bot",
    aliases: ["bethel", "bethelkerk", "maassluis"]
  },
  "maranatha": {
    naam: "Maranathakerk",
    standaardVoorganger: "ds. J. de Vries",
    aliases: ["maranatha", "maranathakerk"]
  },
  "dorpskerk": {
    naam: "Dorpskerk",
    standaardVoorganger: "ds. A. van der Berg",
    aliases: ["dorpskerk", "hervormd"]
  },
  "kruiskerk": {
    naam: "Kruiskerk",
    standaardVoorganger: "ds. P. Bakker",
    aliases: ["kruiskerk"]
  }
};

export default {
  // 1. Cloudflare Email Routing Handler
  async email(message, env, ctx) {
    const rawEmail = await new Response(message.raw).text();
    const afzender = message.from || "";
    const ontvanger = message.to || "";
    const onderwerp = message.headers.get("subject") || "Geen onderwerp";

    console.log(`[Email Ingest] Ontvangen voor: ${ontvanger} van: ${afzender} | Onderwerp: "${onderwerp}"`);

    // Bepaal de unieke kerk_id
    const kerkId = bepaalKerkId(ontvanger, afzender, env);
    console.log(`[Email Ingest] Gekoppeld aan kerk_id: "${kerkId}"`);

    // Parse tekstinhoud uit de e-mail
    const bodyTekst = extractPlainText(rawEmail);
    if (!bodyTekst || bodyTekst.trim().length < 10) {
      console.warn(`[Email Ingest] E-mail voor ${kerkId} bevatte geen bruikbare tekst.`);
      return;
    }

    // Verwerk liturgie en bouw dia's
    const resultaat = await verwerkLiturgieTekst(bodyTekst, env, onderwerp, kerkId);

    // Sla op in Cloudflare D1 onder deze specifieke kerk
    if (env.DB) {
      await slaDienstOpInD1(env.DB, kerkId, resultaat, afzender, onderwerp);
      console.log(`[Email Ingest] Liturgie voor ${kerkId} succesvol opgeslagen in D1! (${resultaat.slides.length} dia's)`);
    } else {
      console.warn("[Email Ingest] Geen D1 database binding (env.DB) gevonden.");
    }
  },

  // 2. HTTP Handler (voor beamer-pc, OBS en testen)
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pad = url.pathname.replace(/\/+$/, "");

    // CORS headers voor toegang vanuit Kerkapp (GitHub Pages of localhost)
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Kerk-ID",
      "Access-Control-Max-Age": "86400"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Endpoint: GET /dienst?kerk=bethel
    // Haalt de actieve dienst op voor een specifieke kerk
    if (request.method === "GET" && pad === "/dienst") {
      const kerkId = normaliseerSlug(url.searchParams.get("kerk") || url.searchParams.get("gemeente") || "bethel");
      if (!env.DB) {
        return json({ error: "D1 database niet gekoppeld" }, 500, corsHeaders);
      }

      await initialiseerTabel(env.DB);
      const row = await env.DB.prepare(
        "SELECT kerk_id, gemeente_naam, voorganger, datum, onderwerp, slides_json, ontbrekende_liederen, bijgewerkt_op FROM actieve_diensten WHERE kerk_id = ?"
      ).bind(kerkId).first();

      if (!row) {
        return json({ 
          gevonden: false, 
          kerk_id: kerkId, 
          melding: `Geen actieve dienst gevonden voor kerk '${kerkId}'. Mail de liturgie naar ${kerkId}@liturgie.kerkapp.nl` 
        }, 404, corsHeaders);
      }

      let slides = [];
      try { slides = JSON.parse(row.slides_json); } catch(e) {}
      let ontbrekend = [];
      try { ontbrekend = JSON.parse(row.ontbrekende_liederen || "[]"); } catch(e) {}

      return json({
        gevonden: true,
        kerk_id: row.kerk_id,
        gemeente_naam: row.gemeente_naam,
        voorganger: row.voorganger,
        datum: row.datum,
        onderwerp: row.onderwerp,
        bijgewerkt_op: row.bijgewerkt_op,
        ontbrekende_liederen: ontbrekend,
        slides: slides
      }, 200, corsHeaders);
    }

    // Endpoint: GET /kerken
    // Toont alle geconfigureerde kerken
    if (request.method === "GET" && pad === "/kerken") {
      const lijst = Object.entries(BEKENDE_KERKEN).map(([id, info]) => ({
        id,
        naam: info.naam,
        email_alias: `${id}@liturgie.kerkapp.nl`,
        standaardVoorganger: info.standaardVoorganger
      }));
      return json({ kerken: lijst }, 200, corsHeaders);
    }

    // Endpoint: POST /test of POST /dienst (Handmatige invoer / test via UI of curl)
    if (request.method === "POST" && (pad === "/test" || pad === "/dienst")) {
      try {
        const body = await request.json();
        const kerkId = normaliseerSlug(body.kerk_id || body.kerk || "bethel");
        const tekst = body.liturgie || body.tekst || "";
        const onderwerp = body.onderwerp || "Handmatig aangemaakte dienst";

        if (!tekst.trim()) {
          return json({ error: "Veld 'liturgie' ontbreekt of is leeg" }, 400, corsHeaders);
        }

        const resultaat = await verwerkLiturgieTekst(tekst, env, onderwerp, kerkId);

        if (env.DB) {
          await slaDienstOpInD1(env.DB, kerkId, resultaat, body.afzender || "api-test", onderwerp);
        }

        return json({
          status: "ok",
          kerk_id: kerkId,
          resultaat: resultaat
        }, 200, corsHeaders);
      } catch (err) {
        return json({ error: err.message }, 400, corsHeaders);
      }
    }

    // Status / Health Check
    return new Response(
      "Kerkapp Multi-Church Email Ingestion Worker is actief.\n" +
      "- Stuur een e-mail naar <kerkId>@liturgie.kerkapp.nl\n" +
      "- Of haal de dienst op via GET /dienst?kerk=<kerkId>\n" +
      "- Bekijk beschikbare kerken via GET /kerken",
      { headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders } }
    );
  }
};

/**
 * Bepaalt de unieke kerkId op basis van ontvanger (To) of afzender (From)
 */
function bepaalKerkId(ontvanger, afzender, env) {
  const toClean = (ontvanger || "").toLowerCase();

  // 1. Plus-addressing: bijv. liturgie+bethel@kerkapp.nl
  const plusMatch = toClean.match(/\+([a-z0-9\-_]+)@/i);
  if (plusMatch) return normaliseerSlug(plusMatch[1]);

  // 2. Directe mailbox: bijv. bethel@liturgie.nl of maranatha@...
  const mailboxMatch = toClean.match(/^([a-z0-9\-_]+)@/i);
  if (mailboxMatch) {
    const box = mailboxMatch[1];
    if (box !== "liturgie" && box !== "info" && box !== "beamer") {
      return normaliseerSlug(box);
    }
  }

  // 3. Subdomein: bijv. liturgie@bethel.kerkapp.nl
  const subMatch = toClean.match(/@([a-z0-9\-_]+)\.[a-z0-9\-_.]+/i);
  if (subMatch && subMatch[1] !== "liturgie" && subMatch[1] !== "mail") {
    return normaliseerSlug(subMatch[1]);
  }

  // 4. Match op bekende kerken via aliassen
  for (const [id, data] of Object.entries(BEKENDE_KERKEN)) {
    for (const alias of data.aliases) {
      if (toClean.includes(alias)) return id;
    }
  }

  // 5. Fallback naar environment var of bethel
  return normaliseerSlug(env.STANDAARD_KERK_ID || "bethel");
}

function normaliseerSlug(str) {
  return (str || "bethel")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\-_]/g, "")
    .slice(0, 50) || "bethel";
}

/**
 * Zorgt dat de D1 tabel voor actieve diensten bestaat
 */
async function initialiseerTabel(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS actieve_diensten (
      kerk_id TEXT PRIMARY KEY,
      gemeente_naam TEXT,
      voorganger TEXT,
      datum TEXT,
      onderwerp TEXT,
      slides_json TEXT NOT NULL,
      ontbrekende_liederen TEXT,
      bron_afzender TEXT,
      bijgewerkt_op DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

/**
 * Slaat de verwerkte liturgie op in D1 via een UPSERT
 */
async function slaDienstOpInD1(db, kerkId, resultaat, afzender, onderwerp) {
  await initialiseerTabel(db);

  const slidesJson = JSON.stringify(resultaat.slides);
  const ontbrekendJson = JSON.stringify(resultaat.ontbrekendeLiederen || []);

  await db.prepare(`
    INSERT INTO actieve_diensten (
      kerk_id, gemeente_naam, voorganger, datum, onderwerp, slides_json, ontbrekende_liederen, bron_afzender, bijgewerkt_op
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(kerk_id) DO UPDATE SET
      gemeente_naam = excluded.gemeente_naam,
      voorganger = excluded.voorganger,
      datum = excluded.datum,
      onderwerp = excluded.onderwerp,
      slides_json = excluded.slides_json,
      ontbrekende_liederen = excluded.ontbrekende_liederen,
      bron_afzender = excluded.bron_afzender,
      bijgewerkt_op = CURRENT_TIMESTAMP
  `).bind(
    kerkId,
    resultaat.gemeente,
    resultaat.voorganger,
    resultaat.datum,
    onderwerp,
    slidesJson,
    ontbrekendJson,
    afzender
  ).run();
}

/**
 * Analyseert de tekst van de liturgie, koppelt met D1 en bouwt de dia-lijst
 */
async function verwerkLiturgieTekst(tekst, env, onderwerp = "", kerkId = "bethel") {
  const kerkInfo = BEKENDE_KERKEN[kerkId] || {
    naam: env.GEMEENTE_NAAM || "Kerkelijke Gemeente",
    standaardVoorganger: "Gastpredikant"
  };

  const gemeente = kerkInfo.naam;
  const lines = tekst.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // 1. Herken voorganger
  let voorganger = kerkInfo.standaardVoorganger || "Gastpredikant";
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
    kerkId: kerkId,
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

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status: status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });
}
