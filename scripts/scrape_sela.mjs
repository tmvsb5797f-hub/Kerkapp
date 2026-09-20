// scripts/scrape_sela.mjs
// Run: node scripts/scrape_sela.mjs
import fs from 'node:fs';

const EXCLUDED_SLUGS = new Set([
  'zoeken', 'themas', 'thema', 'bladmuziek', 'categorie', 'overzicht',
  'albums', 'inloggen', 'winkelmand', 'contact', 'nieuws', 'over-sela'
]);

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

export function parseSelaHtml(liedHtml, slug) {
  // Titel extraheren
  const titelMatch = liedHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const titel = titelMatch ? decodeHtml(titelMatch[1].replace(/<[^>]+>/g, '')).trim() : slug;

  // Extract coupletten/strofes (met fallback voor diverse CMS layouts)
  let strofeMatches = [...liedHtml.matchAll(/<p[^>]*class="[^"]*liedtekst[^"]*"[^>]*>([\s\S]*?)<\/p>|<div[^>]*class="[^"]*liedtekst[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)];
  if (strofeMatches.length === 0) {
    strofeMatches = [...liedHtml.matchAll(/<div[^>]*class="[^"]*(?:tekst|lyrics|song-text|lied-tekst)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)];
  }

  const coupletten = [];
  let coupletTeller = 1;

  for (const m of strofeMatches) {
    const rawContent = decodeHtml(m[1] || m[2] || "")
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim();

    // Filter metadata en copyrightvermeldingen weg
    if (!rawContent || rawContent.length < 10) continue;
    if (/^(tekst|muziek|copyright|©|album:|oorspronkelijke titel)/i.test(rawContent)) continue;

    let lines = rawContent.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    // Refrein detectie
    const isRefrein = /refrein|chorus/i.test(m[0]) || /^refrein/i.test(lines[0]);
    if (isRefrein) {
      if (/^refrein:?$/i.test(lines[0])) {
        lines.shift();
      }
      coupletten.push(`Refrein:\n${lines.join('\n')}`);
    } else {
      // Voorkom dubbele nummering als tekst al begint met versnummering (bijv. "1. ")
      if (/^(?:couplet\s*\d+:?|\d+\.?:?)\s*/i.test(lines[0])) {
        lines[0] = lines[0].replace(/^(?:couplet\s*\d+:?|\d+\.?:?)\s*/i, '');
      }
      coupletten.push(`${coupletTeller}.\n${lines.join('\n')}`);
      coupletTeller++;
    }
  }

  if (coupletten.length === 0) return null;

  return {
    id: `Sela ${titel}`,
    tekst: coupletten.join('\n\n')
  };
}

async function scrapeSela() {
  console.log("Index ophalen van sela.nl/liederen...");
  const res = await fetch("https://www.sela.nl/liederen");
  const html = await res.text();

  // Zoek alle unieke links naar individuele liederen
  const slugs = [...new Set([...html.matchAll(/href="\/liederen\/([a-z0-9-]+)"/gi)]
    .map(m => m[1])
    .filter(s => !EXCLUDED_SLUGS.has(s)))];

  console.log(`Gevonden liederen op sela.nl: ${slugs.length}`);
  const resultaten = [];

  for (const slug of slugs) {
    process.stdout.write(`Ophalen: ${slug}...\r`);
    try {
      const liedRes = await fetch(`https://www.sela.nl/liederen/${slug}`);
      if (!liedRes.ok) continue;
      const liedHtml = await liedRes.text();
      const song = parseSelaHtml(liedHtml, slug);
      if (song) {
        resultaten.push(song);
      }
    } catch (e) {
      console.warn(`Fout bij ${slug}:`, e.message);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  const outFile = 'sela_liederen_d1.json';
  fs.writeFileSync(outFile, JSON.stringify(resultaten, null, 2));
  console.log(`\nKlaar! ${resultaten.length} Sela liederen opgeslagen in ${outFile}`);
}

import { fileURLToPath } from 'node:url';
import path from 'node:path';

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  scrapeSela();
}
