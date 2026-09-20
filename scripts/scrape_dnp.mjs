// scripts/scrape_dnp.mjs
// Run: node scripts/scrape_dnp.mjs
import fs from 'node:fs';

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

export function parseDnpHtml(html, nr) {
  // Isoleer de hoofdinhoud om site-footer/sidebar contaminatie te voorkomen
  // Slice veilig vanaf entry-content/article/main tot footer/site-info om niet af te breken op geneste divs
  const startIndex = html.search(/<article|<main|<div[^>]*class="[^"]*entry-content[^"]*"/i);
  let contentHtml = startIndex !== -1 ? html.slice(startIndex) : html;
  const endIndex = contentHtml.search(/<footer|<div[^>]*class="[^"]*(?:entry-meta|site-info|comments|site-footer)|<nav/i);
  if (endIndex !== -1) {
    contentHtml = contentHtml.slice(0, endIndex);
  }

  const coupletten = [];
  // Match verzen gebaseerd op 'Vers X' aanduidingen in de HTML
  const versBlokRegex = /(?:Vers\s+(\d+)|<strong>\s*Vers\s+(\d+)\s*<\/strong>|<h3>\s*Vers\s+(\d+)\s*<\/h3>)([\s\S]*?)(?=(?:Vers\s+\d+|<strong>\s*Vers|<h3>\s*Vers|<footer|<div[^>]*class="[^"]*(?:entry-meta|site-info)|<nav|<\/article|<\/main|$))/gi;
  let match;

  while ((match = versBlokRegex.exec(contentHtml)) !== null) {
    const versNr = match[1] || match[2] || match[3];
    const ruweTekst = decodeHtml(match[4]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ''))
      .replace(/\r/g, '')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .join('\n');

    if (ruweTekst.length > 10 && !ruweTekst.includes('Beamsheet') && !ruweTekst.includes('Melodie')) {
      coupletten.push(`${versNr}.\n${ruweTekst}`);
    }
  }

  // Fallback als de pagina geen expliciete 'Vers X' headers heeft
  if (coupletten.length === 0) {
    const pMatches = [...contentHtml.matchAll(/<p>([\s\S]*?)<\/p>/gi)];
    let vNr = 1;
    for (const p of pMatches) {
      const txt = decodeHtml(p[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).trim();
      if (txt.length > 25 && !txt.includes('Beamsheet') && !txt.includes('Copyright') && !txt.includes('Melodie')) {
        coupletten.push(`${vNr}.\n${txt}`);
        vNr++;
      }
    }
  }

  if (coupletten.length === 0) return null;

  return {
    id: `DNP Psalm ${nr}`,
    tekst: coupletten.join('\n\n')
  };
}

async function scrapeDnp() {
  const resultaten = [];

  for (let nr = 1; nr <= 150; nr++) {
    process.stdout.write(`Ophalen DNP Psalm ${nr}/150...\r`);
    try {
      const res = await fetch(`https://denieuwepsalmberijming.nl/de-psalmen/psalm-${nr}`);
      if (!res.ok) continue;
      const html = await res.text();
      const song = parseDnpHtml(html, nr);
      if (song) {
        resultaten.push(song);
      }
    } catch (err) {
      console.warn(`Fout bij DNP Psalm ${nr}:`, err.message);
    }
    await new Promise(r => setTimeout(r, 150));
  }

  const outFile = 'dnp_psalmen_d1.json';
  fs.writeFileSync(outFile, JSON.stringify(resultaten, null, 2));
  console.log(`\nKlaar! ${resultaten.length} DNP psalmen opgeslagen in ${outFile}`);
}

import { fileURLToPath } from 'node:url';
import path from 'node:path';

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  scrapeDnp();
}
