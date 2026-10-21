/**
 * Cloudflare Email Ingestion Worker voor Kerkapp (Multi-Church Architecture)
 * 
 * Werking voor meerdere kerken:
 * 1. Ontvangt e-mails van voorgangers via Cloudflare Email Routing.
 * 2. Bepaalt automatisch voor welke kerk de e-mail is bestemd via:
 *    - Het e-mailadres (bijv. "bethel@liturgie.nl" of "liturgie+maranatha@liturgie.nl")
 *    - Of de afzender van de predikant (gekoppeld aan een kerk)
 * 3. Analyseert de liturgie (datum, predikant, liederen, schriftlezingen).
 * 4. Haalt ontbrekende liederen en bijbelteksten op uit de centrale Cloudflare D1 database,
 *    bolls.life HSV17 API en Gemini AI fallback.
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

const BIJBEL_BOEKEN = [
  "Genesis", "Exodus", "Leviticus", "Numeri", "Deuteronomium", "Jozua", "Richteren", "Ruth",
  "1 Samuël", "2 Samuël", "1 Koningen", "2 Koningen", "1 Kronieken", "2 Kronieken", "Ezra",
  "Nehemia", "Esther", "Job", "Psalmen", "Spreuken", "Prediker", "Hooglied", "Jesaja",
  "Jeremia", "Klaagliederen", "Ezechiël", "Daniël", "Hosea", "Joël", "Amos", "Obadja",
  "Jona", "Micha", "Nahum", "Habakuk", "Zefanja", "Haggai", "Zacharia", "Maleachi",
  "Mattheüs", "Markus", "Lukas", "Johannes", "Handelingen", "Romeinen", "1 Korinthe",
  "2 Korinthe", "Galaten", "Efeze", "Filippenzen", "Kolossensen", "1 Thessalonicenzen",
  "2 Thessalonicenzen", "1 Timotheüs", "2 Timotheüs", "Titus", "Filemon", "Hebreeën",
  "Jakobus", "1 Petrus", "2 Petrus", "1 Johannes", "2 Johannes", "3 Johannes", "Judas",
  "Openbaring"
];

function losKerkIdOp(inputSlug) {
  const clean = normaliseerSlug(inputSlug || "bethel");
  for (const [id, data] of Object.entries(BEKENDE_KERKEN)) {
    if (clean === id || (data.aliases && data.aliases.includes(clean))) return id;
    for (const alias of (data.aliases || [])) {
      if (clean.includes(alias)) return id;
    }
  }
  return clean;
}

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
    if (request.method === "GET" && (pad === "/dienst" || pad === "/bethel")) {
      const kerkId = (pad === "/bethel") 
        ? "bethel" 
        : losKerkIdOp(url.searchParams.get("kerk") || url.searchParams.get("gemeente") || "bethel");
      if (!env.DB) {
        return json({ error: "D1 database niet gekoppeld" }, 500, corsHeaders);
      }

      await initialiseerTabel(env.DB);
      const row = await env.DB.prepare(
        "SELECT kerk_id, gemeente_naam, voorganger, datum, onderwerp, slides_json, items_json, ontbrekende_liederen, bijgewerkt_op FROM actieve_diensten WHERE kerk_id = ?"
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
      let items = [];
      try { items = JSON.parse(row.items_json || "[]"); } catch(e) {}
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
        items: items,
        slides: slides
      }, 200, corsHeaders);
    }

    // Endpoint: GET /kerken
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

  // 2. Directe mailbox: bijv. bethel@liturgie.nl
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
      items_json TEXT,
      ontbrekende_liederen TEXT,
      bron_afzender TEXT,
      bijgewerkt_op DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  try {
    await db.prepare("ALTER TABLE actieve_diensten ADD COLUMN items_json TEXT").run();
  } catch(e) {}

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS liederen (
      id TEXT PRIMARY KEY,
      tekst TEXT NOT NULL,
      toegevoegd_door TEXT,
      datum DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS bijbel_hsv (
      id TEXT PRIMARY KEY,
      tekst TEXT NOT NULL,
      datum DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

/**
 * Slaat de verwerkte liturgie op in D1 via een UPSERT
 */
async function slaDienstOpInD1(db, kerkId, resultaat, afzender, onderwerp) {
  await initialiseerTabel(db);

  const slidesJson = JSON.stringify(resultaat.slides);
  const itemsJson = JSON.stringify(resultaat.items || []);
  const ontbrekendJson = JSON.stringify(resultaat.ontbrekendeLiederen || []);

  await db.prepare(`
    INSERT INTO actieve_diensten (
      kerk_id, gemeente_naam, voorganger, datum, onderwerp, slides_json, items_json, ontbrekende_liederen, bron_afzender, bijgewerkt_op
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(kerk_id) DO UPDATE SET
      gemeente_naam = excluded.gemeente_naam,
      voorganger = excluded.voorganger,
      datum = excluded.datum,
      onderwerp = excluded.onderwerp,
      slides_json = excluded.slides_json,
      items_json = excluded.items_json,
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
    itemsJson,
    ontbrekendJson,
    afzender
  ).run();
}

function normaliseerBijbelBoek(str) {
  const map = {
    "1 thes": "1 Thessalonicenzen", "2 thes": "2 Thessalonicenzen",
    "thess": "1 Thessalonicenzen", "thes": "1 Thessalonicenzen", "rom": "Romeinen", "joh": "Johannes",
    "gen": "Genesis", "ex": "Exodus", "lev": "Leviticus", "num": "Numeri",
    "deut": "Deuteronomium", "matt": "Mattheüs", "matth": "Mattheüs",
    "mark": "Markus", "luk": "Lukas", "hand": "Handelingen",
    "1 kor": "1 Korinthe", "2 kor": "2 Korinthe", "gal": "Galaten",
    "ef": "Efeze", "efe": "Efeze", "fil": "Filippenzen", "kol": "Kolossensen",
    "1 tim": "1 Timotheüs", "2 tim": "2 Timotheüs", "tit": "Titus",
    "film": "Filemon", "hebr": "Hebreeën", "jak": "Jakobus",
    "1 petr": "1 Petrus", "2 petr": "2 Petrus", "1 joh": "1 Johannes",
    "2 joh": "2 Johannes", "3 joh": "3 Johannes", "jud": "Judas", "openb": "Openbaring",
    "ps": "Psalmen", "psalm": "Psalmen"
  };
  let clean = (str || "").trim().toLowerCase().replace(/\.$/, "");
  for (const [afk, voluit] of Object.entries(map)) {
    if (clean === afk || clean.startsWith(afk)) return voluit;
  }
  return (str || "").trim();
}

function ontleedBijbelReferentie(refStr) {
  const m = refStr.match(/^([0-9]?\s*[A-Za-z\s\.]+?)\s+([0-9]+)(?:\s*[:\.]\s*([0-9\s,\-–—en]+))?/i);
  if (!m) return null;
  const rawBoek = m[1].replace(/\./g, "").trim();
  const hst = parseInt(m[2], 10);
  const versStr = m[3] || "";
  const voluitBoek = normaliseerBijbelBoek(rawBoek);

  const boekIdx = BIJBEL_BOEKEN.findIndex(b => b.toLowerCase() === voluitBoek.toLowerCase());
  const boekNr = boekIdx >= 0 ? boekIdx + 1 : null;

  const verzen = parseerVersNummers(versStr);
  return {
    voluitBoek,
    boekNr,
    hoofdstuk: hst,
    verzen: verzen.length > 0 ? verzen : null,
    standaardTitel: `${voluitBoek} ${hst}${versStr ? ':' + versStr.replace(/\s+/g, '') : ''}`
  };
}

/**
 * Haalt de HSV Bijbeltekst op via D1, Bolls Life API of Gemini AI proxy
 */
async function haalBijbelTekst(refStr, parsed, env) {
  // 1. Directe cache in D1 (sla oude 'Schriftlezing uit...' placeholders over)
  if (env.DB) {
    try {
      const row = await env.DB.prepare("SELECT tekst FROM bijbel_hsv WHERE id = ?").bind(refStr).first();
      if (row && row.tekst && row.tekst.trim().length > 25 && !row.tekst.startsWith("Schriftlezing uit")) return row.tekst;
      if (parsed && parsed.standaardTitel) {
        const row2 = await env.DB.prepare("SELECT tekst FROM bijbel_hsv WHERE id = ?").bind(parsed.standaardTitel).first();
        if (row2 && row2.tekst && row2.tekst.trim().length > 25 && !row2.tekst.startsWith("Schriftlezing uit")) return row2.tekst;
      }
    } catch(e) {}
  }

  if (!parsed || !parsed.boekNr) return null;

  // 2. Bolls Life API (HSV17)
  try {
    const res = await fetch(`https://bolls.life/get-chapter/HSV17/${parsed.boekNr}/${parsed.hoofdstuk}/`, {
      headers: { "User-Agent": "Kerkapp-Email-Ingest/1.0", "Accept": "application/json" }
    });
    if (res.ok) {
      const allVerses = await res.json();
      if (Array.isArray(allVerses) && allVerses.length > 0) {
        let gefilterd = allVerses;
        if (parsed.verzen && parsed.verzen.length > 0) {
          const vSet = new Set(parsed.verzen);
          gefilterd = allVerses.filter(v => vSet.has(v.verse));
        }
        if (gefilterd.length > 0) {
          const lines = gefilterd.map(v => {
            const schoneTekst = (v.text || "")
              .replace(/<[^>]*>/g, "")
              .replace(/[Ⓐ-ⓩ①-⑳⓪-⓿¹²³⁰-₟†‡§¶※⸮⁂⁋⁓]/g, "")
              .replace(/\[\d+\]/g, "")
              .replace(/\s+/g, " ")
              .trim();
            return `${v.verse} ${schoneTekst}`;
          });
          const gecombineerd = lines.join("\n");
          if (env.DB && gecombineerd.length > 20) {
            try {
              await env.DB.prepare("INSERT OR REPLACE INTO bijbel_hsv (id, tekst) VALUES (?, ?)").bind(refStr, gecombineerd).run();
              if (parsed.standaardTitel !== refStr) {
                await env.DB.prepare("INSERT OR REPLACE INTO bijbel_hsv (id, tekst) VALUES (?, ?)").bind(parsed.standaardTitel, gecombineerd).run();
              }
            } catch(e) {}
          }
          return gecombineerd;
        }
      }
    }
  } catch (err) {
    console.warn("[Bijbel Fetch] Bolls Life API fout:", err.message);
  }

  // 3. Fallback: Gemini AI Proxy (met geautoriseerde Origin)
  try {
    const prompt = `Geef de letterlijke tekst van de Herziene Statenvertaling (HSV) voor: ${refStr}. Nummer elk vers duidelijk met het versnummer (bijv. 1 ..., 2 ...). Geef ALLEEN de verzen, zonder toelichting of headers.`;
    const aiRes = await fetch("https://gemini-proxy.kerkapp.workers.dev/v1beta/models/gemini-flash-lite-latest:generateContent", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Origin": "https://tmvsb5797f-hub.github.io"
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 }
      })
    });
    if (aiRes.ok) {
      const data = await aiRes.json();
      const txt = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
      if (txt.length > 20) {
        if (env.DB) {
          try {
            await env.DB.prepare("INSERT OR REPLACE INTO bijbel_hsv (id, tekst) VALUES (?, ?)").bind(refStr, txt).run();
          } catch(e) {}
        }
        return txt;
      }
    }
  } catch(e) {}

  return null;
}

/**
 * Verdeelt een langere Schriftlezing in nette dia-blokken (2-4 verzen per dia)
 */
function splitsBijbelInDiaRegels(volledigeTekst, refTitel) {
  if (!volledigeTekst) return [];
  const lines = volledigeTekst.split("\n").map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const slides = [];
  let currentChunk = [];
  let currentLen = 0;
  let startVers = null;
  let endVers = null;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const vMatch = l.match(/^([0-9]+)\b/);
    const vNr = vMatch ? parseInt(vMatch[1], 10) : (i + 1);

    if (startVers === null) startVers = vNr;
    endVers = vNr;

    currentChunk.push(l);
    currentLen += l.length;

    const isLaatste = i === lines.length - 1;
    if (isLaatste || currentChunk.length >= 4 || (currentChunk.length >= 2 && currentLen > 240)) {
      const versAanduiding = (startVers === endVers) ? `${startVers}` : `${startVers}-${endVers}`;
      const baseBoekEnHst = refTitel.replace(/:.*$/, "").trim();
      slides.push({
        id: `lezing-${refTitel}-${startVers}`,
        type: "Schriftlezing",
        titel: `${baseBoekEnHst} : ${versAanduiding}`,
        basisTitel: refTitel,
        regels: [...currentChunk]
      });
      currentChunk = [];
      currentLen = 0;
      startVers = null;
    }
  }

  return slides;
}

/**
 * Haalt liedtekst op uit D1 (inclusief losse verzen) of via Gemini AI fallback
 */
async function haalLiedTekstOp(db, bundel, nummer, versNummers, extraTitel) {
  if (!db) return null;

  const basisKeys = [
    `${bundel} ${nummer}`,
    `${bundel.replace(/\s+lied$/i, '')} ${nummer}`,
    `Psalm ${nummer}`,
    `DNP Psalm ${nummer}`,
    `Weerklank ${nummer}`,
    `Weerklank Lied ${nummer}`,
    `Lied ${nummer}`
  ];

  // 1. Directe match op volledige titel
  for (const k of basisKeys) {
    try {
      const row = await db.prepare("SELECT tekst FROM liederen WHERE id = ?").bind(k).first();
      if (row && row.tekst && row.tekst.trim().length > 10) return row.tekst;
    } catch(e) {}
  }

  // 2. Zoek op individuele vers-keys (bijv. "Psalm 65 vers 1", "Psalm 65 vers 2")
  const prefixen = [
    `${bundel} ${nummer} vers %`,
    `Psalm ${nummer} vers %`,
    `DNP Psalm ${nummer} vers %`,
    `Weerklank ${nummer} vers %`
  ];
  for (const p of prefixen) {
    try {
      const rows = await db.prepare("SELECT id, tekst FROM liederen WHERE id LIKE ?").bind(p).all();
      if (rows && rows.results && rows.results.length > 0) {
        const gesorteerd = rows.results.sort((a, b) => {
          const nA = parseInt(a.id.match(/vers\s+(\d+)$/i)?.[1] || 0, 10);
          const nB = parseInt(b.id.match(/vers\s+(\d+)$/i)?.[1] || 0, 10);
          return nA - nB;
        });
        const gecombineerd = gesorteerd.map((r, i) => {
          const vNr = parseInt(r.id.match(/vers\s+(\d+)$/i)?.[1] || (i + 1), 10);
          const schoneTekst = r.tekst.trim().replace(/\n[ \t]*\n/g, '\n');
          return `${vNr}.\n${schoneTekst}`;
        }).join("\n\n");
        return gecombineerd;
      }
    } catch(e) {}
  }

  // 3. Fallback: Gemini AI Proxy voor liedtekst (met geautoriseerde Origin)
  try {
    const vStr = (versNummers && versNummers.length > 0) ? `couplet ${versNummers.join(', ')}` : "alle coupletten";
    const titelDetail = extraTitel ? ` (getiteld "${extraTitel}")` : "";
    const prompt = `Geef de Nederlandse tekst van het kerklied of christelijke lied "${bundel} ${nummer}"${titelDetail} (${vStr}). Nummer elk couplet duidelijk met "1." of "2." op een eigen regel gevolgd door de couplettekst en een witregel. Geef ALLEEN de coupletteksten zonder inleiding of toelichting.`;
    
    const aiRes = await fetch("https://gemini-proxy.kerkapp.workers.dev/v1beta/models/gemini-flash-lite-latest:generateContent", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Origin": "https://tmvsb5797f-hub.github.io"
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 }
      })
    });
    if (aiRes.ok) {
      const data = await aiRes.json();
      let txt = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
      txt = txt.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
      if (txt.length > 25 && !txt.toLowerCase().includes("kan ik niet vinden")) {
        try {
          await db.prepare("INSERT OR REPLACE INTO liederen (id, tekst, toegevoegd_door) VALUES (?, ?, 'AI-Email-Sync')")
            .bind(`${bundel} ${nummer}`, txt).run();
        } catch(e) {}
        return txt;
      }
    }
  } catch(e) {}

  return null;
}

/**
 * Analyseert de tekst van de liturgie, koppelt met D1/Bolls/AI en bouwt de dia-lijst
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
  if (/mark\s+bot/i.test(tekst) || /mark\s+bot/i.test(onderwerp)) {
    voorganger = "ds. Mark Bot";
  } else {
    for (const l of lines) {
      const vgMatch = l.match(/\b(?:voorganger|predikant|dominee|ds)\b\.?\s*:?\s*([A-Z][a-zA-Z\s\.\-]+)/i);
      if (vgMatch && !/wil voor ons leven|kerkenraad|ouderling|diaken|mededelingen|voorzang/i.test(vgMatch[1])) {
        voorganger = vgMatch[1].trim();
        break;
      }
    }
  }

  // 2. Herken datum / dienst
  let datumTekst = new Date().toLocaleDateString("nl-NL", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  for (const l of lines) {
    const dMatch = l.match(/([0-9]{1,2}\s+[a-z]+\s+[0-9]{4}|zondag\s+[0-9]{1,2}\s+[a-z]+|ochtend\s*–?\s*[^\r\n]+|avond\s*–?\s*[^\r\n]+)/i);
    if (dMatch) {
      datumTekst = dMatch[1].trim();
      break;
    }
  }

  // 3. Herken liederen, schriftlezingen en liturgische onderdelen
  const items = [];
  const zangNamenLijst = [];

  for (const line of lines) {
    // A. Schriftlezing & Lezingen
    const scrMatch = line.match(/(?:schriftlezing|lezing|tekst|gods wil voor ons leven)\s*:?\s*([0-9]?\s*[A-Z][a-z0-9\.\s]+?)\s+([0-9]+(?:\s*[:\-\s\.]\s*[0-9\-–—en,]+)?)/i);
    if (scrMatch) {
      const rawRef = `${scrMatch[1]} ${scrMatch[2]}`.trim();
      const parsedRef = ontleedBijbelReferentie(rawRef);
      const refTitel = parsedRef ? parsedRef.standaardTitel : rawRef;

      const bijbelTekst = await haalBijbelTekst(rawRef, parsedRef, env);

      items.push({
        type: "Schriftlezing",
        titel: refTitel,
        tekst: bijbelTekst || `Schriftlezing uit ${refTitel}`,
        gevondenInDb: !!bijbelTekst,
        verzen: parsedRef?.verzen || []
      });
      continue;
    }

    // B. Lied herkenning
    const liedRegex = /(?:zingen|lied)?[^a-z0-9]*\b(psalm|ps|lw|wk|weerklank(?:\s+lied)?|dnp|opwekking|opw|sela|lied|gezang|oth)\.?\s*([0-9]+[a-z]?)(?:.*?[:\s]\s*([0-9,\s–\-—en]+))?/i;
    const lMatch = line.match(liedRegex);
    if (lMatch) {
      let bundel = lMatch[1].toLowerCase().replace(/\./g, "");
      let isDnp = /\bdnp\b/i.test(line);

      if (bundel === "lw" || bundel === "wk" || bundel.includes("weerklank")) {
        bundel = "Weerklank Lied";
      } else if (bundel === "ps" || bundel === "psalm") {
        bundel = isDnp ? "DNP Psalm" : "Psalm";
      } else if (bundel === "dnp") {
        bundel = "DNP Psalm";
      } else if (bundel === "opw" || bundel === "opwekking") {
        bundel = "Opwekking";
      } else {
        bundel = "Weerklank Lied";
      }

      const nummer = lMatch[2].trim();
      let versStr = lMatch[3] || "";

      const trailingVers = line.match(/(?::|\bverzen?\b|\bvs\.?\b|\bcouplet(?:ten)?\b)\s*([0-9,\s–\-—en]+)$/i);
      if (trailingVers && (!versStr || trailingVers[1].length > versStr.length)) {
        versStr = trailingVers[1];
      }

      let extraTitel = "";
      const extraMatch = line.match(/psalm\s*[0-9]+[a-z]?\s*:\s*([^:]+?)\s*:\s*[0-9]/i);
      if (extraMatch) {
        extraTitel = extraMatch[1].trim();
      }

      const genormaliseerdeTitel = `${bundel} ${nummer}`;
      const verzen = parseerVersNummers(versStr);

      const liedTekst = await haalLiedTekstOp(env.DB, bundel, nummer, verzen, extraTitel);

      zangNamenLijst.push(genormaliseerdeTitel);
      items.push({
        type: "Zang",
        titel: genormaliseerdeTitel,
        extraTitel: extraTitel,
        verzen: verzen,
        gevondenInDb: !!liedTekst,
        tekst: liedTekst || ""
      });
      continue;
    }

    // C. Preek / Verkondiging
    const preekMatch = line.match(/(?:verkondiging|preek|overdenking)\s*[‘\'":]\s*(.*?)[’\'"]?$/i);
    if (preekMatch) {
      items.push({
        type: "Preek",
        titel: `Preek: ${preekMatch[1].trim()}`
      });
      continue;
    }

    // D. Liturgische orde
    if (/stil gebed/i.test(line)) {
      items.push({ type: "Liturgisch", titel: "Stil gebed" });
    } else if (/votum\s+en\s+groet/i.test(line)) {
      items.push({ type: "Liturgisch", titel: "Votum en groet" });
    } else if (/dankgebed/i.test(line)) {
      items.push({ type: "Liturgisch", titel: "Dankgebed" });
    } else if (/gebed/i.test(line)) {
      items.push({ type: "Liturgisch", titel: line });
    } else if (/collecte/i.test(line)) {
      items.push({ type: "Collecte", titel: "Collecte & Week-Tikkie" });
    } else if (/zegen/i.test(line)) {
      items.push({ type: "Zegen", titel: "Zegenbede" });
    }
  }

  // 4. Construeer complete dia-lijst voor beamer en OBS
  const slides = [];

  // Welkomstdia
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
      if (it.tekst && it.tekst.length > 20 && !it.tekst.startsWith("Schriftlezing uit")) {
        const bijbelDiaLijst = splitsBijbelInDiaRegels(it.tekst, it.titel);
        slides.push(...bijbelDiaLijst);
      } else {
        slides.push({
          id: `lezing-${it.titel}`,
          type: "Schriftlezing",
          titel: it.titel,
          regels: [it.titel, "Tekst kan direct in Kerkapp worden geladen."]
        });
      }
    } else if (it.type === "Preek") {
      slides.push({
        id: "preek-dia",
        type: "Vrije tekst",
        titel: it.titel,
        regels: [it.titel, `Voorganger: ${voorganger}`]
      });
    } else if (it.type === "Liturgisch") {
      slides.push({
        id: `lit-${it.titel.replace(/\s+/g, '-').toLowerCase()}`,
        type: "Vrije tekst",
        titel: it.titel,
        regels: [it.titel]
      });
    } else if (it.type === "Collecte") {
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
    } else if (it.type === "Zegen") {
      slides.push({
        id: "slot-dia",
        type: "Leeg",
        titel: "Zegenbede"
      });
    } else if (it.type === "Zang") {
      const verzenMap = splitsCoupletTekst(it.tekst);
      const teZingenVerzen = (it.verzen && it.verzen.length > 0)
        ? it.verzen
        : (verzenMap.length > 0 ? verzenMap.map(v => v.nummer) : [1]);

      for (const vNr of teZingenVerzen) {
        const versObj = verzenMap.find(v => v.nummer === vNr);
        const regels = versObj 
          ? versObj.regels 
          : [`(Tekst voor couplet ${vNr} ontbreekt - sleep de PPTX van ds. Mark Bot in Kerkapp of gebruik Liedbundels Online)`];
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

  // Zorg voor minstens collecte en zegen als die niet in items stonden
  if (!items.some(i => i.type === "Collecte")) {
    slides.push({
      id: "collecte-dia",
      type: "QR",
      titel: "Collecte & Week-Tikkie",
      subtitel: "Scan met uw mobiel om bij te dragen",
      regels: ["Van harte aanbevolen voor de eredienst en de diaconie."]
    });
  }
  if (!items.some(i => i.type === "Zegen")) {
    slides.push({
      id: "slot-dia",
      type: "Leeg",
      titel: "Zegenbede"
    });
  }

  return {
    gemeente: gemeente,
    kerkId: kerkId,
    voorganger: voorganger,
    datum: datumTekst,
    itemsGevonden: items.length,
    ontbrekendeLiederen: items.filter(it => it.type === "Zang" && !it.gevondenInDb).map(it => it.titel),
    items: items,
    slides: slides
  };
}

function parseerVersNummers(str) {
  if (!str) return [];
  const nummers = [];
  const parts = str.toLowerCase().replace(/en/g, ",").replace(/&/g, ",").split(",");
  for (let p of parts) {
    p = p.trim();
    if (p.includes("-") || p.includes("–") || p.includes("—")) {
      const range = p.split(/[-–—]/).map(n => parseInt(n.trim(), 10)).filter(Boolean);
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
  const blokken = tekst.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const result = [];
  let teller = 1;

  for (const b of blokken) {
    const lines = b.split("\n").map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    let vNr = teller;
    const headerMatch = lines[0].match(/^(?:vers|couplet|vs\.?)?\s*([0-9]+)\.?\s*:?$/i);
    let echteRegels = lines;
    if (headerMatch) {
      vNr = parseInt(headerMatch[1], 10);
      echteRegels = lines.slice(1);
    } else {
      const inlineMatch = lines[0].match(/^([0-9]+)\.?\s+(.+)$/);
      if (inlineMatch) {
        vNr = parseInt(inlineMatch[1], 10);
        echteRegels = [inlineMatch[2], ...lines.slice(1)];
      }
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
