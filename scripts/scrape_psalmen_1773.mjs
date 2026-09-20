// scripts/scrape_psalmen_1773.mjs
// Run: node scripts/scrape_psalmen_1773.mjs [maxNr=150]
import fs from 'node:fs';

const ENIGE_GEZANGEN = {
  151: "Lofzang van Maria",
  152: "Lofzang van Zacharias",
  153: "Lofzang van Simeon",
  154: "Tien Geboden des Heeren",
  155: "Het Gebed des Heeren",
  156: "De Twaalf Geloofsartikelen",
  157: "Het Gebed des Heeren (tweede berijming)",
  158: "Het Morgengebed",
  159: "Het Avondgebed",
  160: "Het Gebed voor de Predikatie",
  161: "Lofzang na het Heilig Avondmaal",
  162: "Dankzegging na het Heilig Avondmaal"
};

export function decodeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#0*39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&rdquo;|&ldquo;/g, '"')
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&euml;/g, 'ë')
    .replace(/&iuml;/g, 'ï')
    .replace(/&oacute;/g, 'ó')
    .replace(/&aacute;/g, 'á')
    .replace(/&hellip;/g, '...')
    .replace(/&#(\d+);/g, (m, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-fA-F]+);/g, (m, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export function parsePsalmboekHtml(html, psalmNr) {
  // Robuuste regex: matcht "Vers X" (zowel <b> als <strong>) t/m volgende vers of pagina-element
  const versRegex = /(?:<b[^>]*>|<strong[^>]*>)\s*Vers\s+(\d+)\s*:?(?:<\/b>|<\/strong>)([\s\S]*?)(?=(?:<b[^>]*>|<strong[^>]*>)\s*Vers\s+\d+|<!--|<div|<table|<\/td|<\/div|$)/gi;
  const coupletten = [];
  let match;

  while ((match = versRegex.exec(html)) !== null) {
    const versNr = match[1];
    const versTekst = decodeHtml(match[2]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ''))
      .replace(/\r/g, '')
      .split('\n')
      .map(regel => regel.trim())
      .filter(Boolean)
      .join('\n');

    if (versTekst.length > 5) {
      coupletten.push(`${versNr}.\n${versTekst}`);
    }
  }

  if (coupletten.length === 0) return null;

  const id = psalmNr <= 150 
    ? `Psalm ${psalmNr}` 
    : `Gezang: ${ENIGE_GEZANGEN[psalmNr] || `Gezang ${psalmNr - 150}`}`;

  return {
    id,
    tekst: coupletten.join('\n\n')
  };
}

async function scrapeAllePsalmen(maxNr = 150) {
  const resultaten = [];

  for (let psalmNr = 1; psalmNr <= maxNr; psalmNr++) {
    process.stdout.write(`Ophalen Psalm ${psalmNr}/${maxNr}...\r`);
    try {
      const res = await fetch(`https://psalmboek.nl/psalm.php?psalm=${psalmNr}`);
      if (!res.ok) {
        console.warn(`Fout bij Psalm ${psalmNr}: status ${res.status}`);
        continue;
      }
      const html = await res.text();
      const song = parsePsalmboekHtml(html, psalmNr);
      if (song) {
        resultaten.push(song);
      }
    } catch (err) {
      console.warn(`Fout bij Psalm ${psalmNr}:`, err.message);
    }

    await new Promise(r => setTimeout(r, 120)); // Respecteer de server
  }

  const outFile = 'psalmen_1773_d1.json';
  fs.writeFileSync(outFile, JSON.stringify(resultaten, null, 2));
  console.log(`\nKlaar! ${resultaten.length} psalmen opgeslagen in ${outFile}`);
}

import { fileURLToPath } from 'node:url';
import path from 'node:path';

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const max = parseInt(process.argv[2], 10) || 150;
  scrapeAllePsalmen(max);
}
