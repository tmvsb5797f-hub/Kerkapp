// scripts/convert_opensong_to_d1.mjs
// Run: node scripts/convert_opensong_to_d1.mjs <bestand_of_map> [bundelPrefix="Opwekking "]
import fs from 'node:fs';
import path from 'node:path';

export function parseSongContent(content, fileName = '', bundelPrefix = 'Opwekking ') {
  const cleanPrefix = bundelPrefix ? (bundelPrefix.trim() + ' ') : 'Opwekking ';
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 1. OpenSong XML Formaat
  const titleMatch = normalizedContent.match(/<title>([\s\S]*?)<\/title>/i);
  const lyricsMatch = normalizedContent.match(/<lyrics>([\s\S]*?)<\/lyrics>/i);

  if (titleMatch && lyricsMatch) {
    const rawTitle = titleMatch[1].trim();
    const title = rawTitle || fileName.replace(/\.[^/.]+$/, '');
    const rawLyrics = lyricsMatch[1].trim();

    // Verwijder akkoordenregels (.G C D), commentaren (; ...), slide dividers (---) en OpenSong inspringspaties
    const noChords = rawLyrics
      .split('\n')
      .filter(line => !line.startsWith('.') && !line.startsWith(';') && !line.startsWith('---'))
      .map(line => line.startsWith(' ') ? line.slice(1) : line)
      .join('\n');

    const formatted = noChords
      .replace(/\[(?:V|Verse)\s*(\d*)\]\s*\n?/gi, (m, p) => (p ? `${p}.\n` : 'Couplet:\n'))
      .replace(/\[(?:C|Chorus)\s*\d*\]\s*\n?/gi, 'Refrein:\n')
      .replace(/\[(?:B|Bridge|Brug)\s*\d*\]\s*\n?/gi, 'Brug:\n')
      .replace(/\[(?:P|Pre-Chorus|Pre-refrein)\s*\d*\]\s*\n?/gi, 'Pre-refrein:\n')
      .replace(/\[(?:T|Tag)\s*\d*\]\s*\n?/gi, 'Tag:\n')
      .replace(/\[(?:E|O|Ending|Outro|Slot)\s*\d*\]\s*\n?/gi, 'Slot:\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const cleanTitle = title.replace(new RegExp(`^${cleanPrefix.trim()}\\s*`, 'i'), '');
    const songId = `${cleanPrefix}${cleanTitle}`;
    return { id: songId, tekst: formatted };
  }

  // 2. OPS pro / Tekst-tag formaat ([song], [number], [title], [couplet], [refrein])
  if (normalizedContent.includes('[couplet') || normalizedContent.includes('[refrein') ||
      normalizedContent.includes('[number]') || normalizedContent.includes('[song]') ||
      normalizedContent.includes('[title]')) {
    const nrMatch = normalizedContent.match(/\[number\]\s*([A-Za-z0-9]+)/i);
    const rawNum = nrMatch ? nrMatch[1].trim() : fileName.replace(/\.[^/.]+$/, '');
    const cleanNum = rawNum.replace(new RegExp(`^${cleanPrefix.trim()}\\s*`, 'i'), '');

    const formatted = normalizedContent
      .replace(/\[song\]/gi, '')
      .replace(/\[(?:number|title|author|composer|copyright|ccli|tempo|key|transposition|order|theme|subtheme|artist|album|end)\][^\n\r]*/gi, '')
      .replace(/\[(?:couplet|verse)\s*(\d+)\]\s*\n?/gi, '$1.\n')
      .replace(/\[(?:couplet|verse)\]\s*\n?/gi, 'Couplet:\n')
      .replace(/\[(?:refrein|chorus)\s*\d*\]\s*\n?/gi, 'Refrein:\n')
      .replace(/\[(?:bridge|brug)\s*\d*\]\s*\n?/gi, 'Brug:\n')
      .replace(/\[(?:pre-chorus|pre-refrein)\s*\d*\]\s*\n?/gi, 'Pre-refrein:\n')
      .replace(/\[(?:tag|outro|ending|slot)\s*\d*\]\s*\n?/gi, 'Slot:\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const songId = `${cleanPrefix}${cleanNum}`;
    return { id: songId, tekst: formatted };
  }

  return null;
}

function getAllFiles(targetPath) {
  if (!fs.existsSync(targetPath)) return [];
  const stat = fs.statSync(targetPath);
  if (!stat.isDirectory()) return [targetPath];

  const results = [];
  const entries = fs.readdirSync(targetPath);
  for (const entry of entries) {
    if (entry.startsWith('.')) continue;
    const full = path.join(targetPath, entry);
    const s = fs.statSync(full);
    if (s.isDirectory()) {
      results.push(...getAllFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

export function convertOpenSongOrOps(inputPath, bundelPrefix = 'Opwekking ') {
  const files = getAllFiles(inputPath);
  const rows = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const parsed = parseSongContent(content, path.basename(file), bundelPrefix);
      if (parsed) {
        rows.push(parsed);
      }
    } catch (err) {
      console.warn(`Kon ${file} niet inlezen:`, err.message);
    }
  }

  const prefixSlug = bundelPrefix.trim().toLowerCase().replace(/\s+/g, '_');
  const outFileName = `${prefixSlug}_d1.json`;
  fs.writeFileSync(outFileName, JSON.stringify(rows, null, 2));
  console.log(`Geconverteerd: ${rows.length} liederen naar ${outFileName}`);
  return rows;
}

import { fileURLToPath } from 'node:url';

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const input = process.argv[2] || './opensong';
  const prefix = process.argv[3] || 'Opwekking ';
  convertOpenSongOrOps(input, prefix);
}
