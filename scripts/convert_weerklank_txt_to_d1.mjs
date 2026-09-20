// scripts/convert_weerklank_txt_to_d1.mjs
// Run: node scripts/convert_weerklank_txt_to_d1.mjs <bestand.txt> ["Weerklank Lied " | "Weerklank Psalm "]
import fs from 'node:fs';
import path from 'node:path';

export function parseWeerklankTxt(content, customPrefix = null, fileName = '') {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const songs = {};
  let currentSong = null;
  let currentVerse = null;
  let currentText = [];

  function saveCurrent() {
    if (currentSong && currentVerse && currentText.length > 0) {
      if (!songs[currentSong]) songs[currentSong] = [];
      const joinedText = currentText.join('\n').trim();
      if (joinedText) {
        songs[currentSong].push(`${currentVerse}.\n${joinedText}`);
      }
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    // Herken '260:1', '12a:3', 'Lied 260:1', of 'Weerklank 12a:3'
    const match = trimmed.match(/^(?:(?:weerklank|lied|psalm)\s+)?([A-Za-z0-9]+)\s*:\s*(\d+)$/i);
    if (match) {
      saveCurrent();
      currentSong = match[1];
      currentVerse = match[2];
      currentText = [];
    } else if (trimmed === '') {
      if (currentText.length > 0 && currentText[currentText.length - 1] !== '') {
        currentText.push(trimmed);
      }
    } else {
      if (currentSong) currentText.push(trimmed);
    }
  }
  saveCurrent();

  // Bepaal prefix (garandeer altijd een afsluitende spatie)
  let prefix = customPrefix ? (customPrefix.trim() + ' ') : null;
  if (!prefix) {
    const lowerName = fileName.toLowerCase();
    if (lowerName.includes('psalm')) {
      prefix = 'Weerklank Psalm ';
    } else {
      prefix = 'Weerklank Lied ';
    }
  }

  const sortedKeys = Object.keys(songs).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );

  const rows = [];
  for (const songNum of sortedKeys) {
    const cleanSongNum = songNum.replace(new RegExp(`^${prefix.trim()}\\s*`, 'i'), '');
    rows.push({
      id: `${prefix}${cleanSongNum}`,
      tekst: songs[songNum].join('\n\n')
    });
  }

  return rows;
}

export function convertWeerklankTxt(filePath, customPrefix = null) {
  if (!fs.existsSync(filePath)) {
    console.error(`Bestand niet gevonden: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const rows = parseWeerklankTxt(content, customPrefix, path.basename(filePath));

  const prefixSlug = (customPrefix || (path.basename(filePath).toLowerCase().includes('psalm') ? 'weerklank_psalm' : 'weerklank_lied'))
    .trim().toLowerCase().replace(/\s+/g, '_');
  const outFile = `${prefixSlug}_d1.json`;

  fs.writeFileSync(outFile, JSON.stringify(rows, null, 2));
  console.log(`Succesvol ${rows.length} liederen geconverteerd naar ${outFile}`);
  return rows;
}

import { fileURLToPath } from 'node:url';

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const file = process.argv[2];
  const prefix = process.argv[3] || null;

  if (!file) {
    console.log("Gebruik: node convert_weerklank_txt_to_d1.mjs <export.txt> [\"Weerklank Lied \"|\"Weerklank Psalm \"]");
    process.exit(1);
  }

  convertWeerklankTxt(file, prefix);
}
