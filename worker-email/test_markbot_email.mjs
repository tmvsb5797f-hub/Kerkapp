const emailTekst = `From: Mark Bot <markbot@gmail.com>
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

function normaliseerBijbelBoek(str) {
  const map = {
    "1 thes": "1 Thessalonicenzen", "2 thes": "2 Thessalonicenzen",
    "thess": "Thessalonicenzen", "rom": "Romeinen", "joh": "Johannes",
    "gen": "Genesis", "ex": "Exodus", "lev": "Leviticus", "num": "Numeri",
    "deut": "Deuteronomium", "matt": "Mattheüs", "matth": "Mattheüs",
    "mark": "Markus", "luk": "Lukas", "hand": "Handelingen",
    "1 kor": "1 Korinthe", "2 kor": "2 Korinthe", "gal": "Galaten",
    "ef": "Efeze", "efe": "Efeze", "fil": "Filippenzen", "kol": "Kolossensen",
    "1 tim": "1 Timotheüs", "2 tim": "2 Timotheüs", "tit": "Titus",
    "film": "Filemon", "hebr": "Hebreeën", "jak": "Jakobus",
    "1 petr": "1 Petrus", "2 petr": "2 Petrus", "1 joh": "1 Johannes",
    "2 joh": "2 Johannes", "3 joh": "3 Johannes", "jud": "Judas", "openb": "Openbaring",
    "openbaring": "Openbaring", "ps": "Psalmen", "psalm": "Psalmen"
  };
  let clean = str.trim().toLowerCase().replace(/\.$/, "");
  for (const [afk, voluit] of Object.entries(map)) {
    if (clean === afk || clean.startsWith(afk)) return voluit;
  }
  return str;
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

// 1. Voorganger herkenning
let voorganger = "ds. Mark Bot";
if (/mark\s+bot/i.test(emailTekst)) {
  voorganger = "ds. Mark Bot";
}

const lines = emailTekst.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
const items = [];

for (const line of lines) {
  // A. Schriftlezing / Wetslezing
  const scrMatch = line.match(/(?:schriftlezing|lezing|tekst|gods wil voor ons leven)\s*:?\s*([0-9]?\s*[A-Z][a-z0-9\.\s]+?)\s+([0-9]+(?:\s*[:\-\s]\s*[0-9\-]+)?)/i);
  if (scrMatch) {
    const boek = normaliseerBijbelBoek(scrMatch[1]);
    const ref = `${boek} ${scrMatch[2].trim()}`;
    items.push({ type: "Schriftlezing", titel: ref });
    continue;
  }

  // B. Lied herkenning
  // Matcht:
  // - "Zingen Ps 65:1,2"
  // - "Zingen Lw 76:1,4"
  // - "Zingen Ps 73:7,8 DNP"
  // - "Simon: Psalm 23a: De Heer is mijn Herder: 1, 2 en 3"
  // - "Zingen Lw 237"
  // - "Zingen Ps 116:3,4"
  const liedRegex = /(?:zingen|lied)?[^a-z0-9]*\b(psalm|ps|lw|wk|weerklank(?:\s+lied)?|dnp|opwekking|opw|sela|lied|gezang|oth)\.?\s*([0-9]+[a-z]?)(?:.*?[:\s]\s*([0-9,\s–\-en]+))?/i;
  const lMatch = line.match(liedRegex);
  if (lMatch) {
    let bundel = lMatch[1].toLowerCase().replace(/\./g, "");
    let isDnp = /dnp/i.test(line);

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
    const versStr = lMatch[3] || "";
    const verzen = parseerVersNummers(versStr);
    items.push({ type: "Zang", titel: `${bundel} ${nummer}`, verzen });
    continue;
  }

  // C. Preek / Verkondiging
  const preekMatch = line.match(/(?:verkondiging|preek|overdenking)\s*[‘\'":]\s*(.*?)[’\'"]?$/i);
  if (preekMatch) {
    items.push({ type: "Preek", titel: preekMatch[1].trim() });
    continue;
  }
}

console.log("Herkende voorganger:", voorganger);
console.log("Totaal herkende onderdelen:", items.length);
console.log(JSON.stringify(items, null, 2));
