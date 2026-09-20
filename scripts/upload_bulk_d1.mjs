// scripts/upload_bulk_d1.mjs
// Run: ADMIN_SECRET="uw_geheim" node scripts/upload_bulk_d1.mjs <bestand.json>
import fs from 'node:fs';

export async function uploadInBatches(jsonFile, adminSecret) {
  if (!fs.existsSync(jsonFile)) {
    console.error(`Bestand niet gevonden: ${jsonFile}`);
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  // Ondersteun zowel array [{id, tekst}] als object-map {"id": "tekst"}
  let rows = [];
  if (Array.isArray(rawData)) {
    rows = rawData;
  } else if (typeof rawData === 'object' && rawData !== null) {
    rows = Object.entries(rawData).map(([id, tekst]) => ({ id, tekst }));
  }

  // Filter lege of ongeldige rijen
  rows = rows.filter(r => r && r.id && typeof r.tekst === 'string' && r.tekst.trim().length > 0);
  console.log(`Totaal te importeren: ${rows.length} rijen uit ${jsonFile}`);

  const BATCH_SIZE = 100;
  const WORKER_URL = process.env.WORKER_URL || "https://kerkdata.kerkapp.workers.dev/bulk";
  let totaalIngevoerd = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(rows.length / BATCH_SIZE);

    process.stdout.write(`Uploaden batch ${batchNum}/${totalBatches} (${chunk.length} items)... `);

    let poging = 0;
    let succes = false;

    while (poging < 3 && !succes) {
      poging++;
      try {
        const res = await fetch(WORKER_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Key": adminSecret,
            "Origin": "http://localhost" // Cruciaal voor Cloudflare Worker origin-lock
          },
          body: JSON.stringify({
            table: "liederen",
            rows: chunk
          })
        });

        if (res.ok) {
          const data = await res.json();
          console.log(`[OK] (${data.ingevoerd} ingevoerd)`);
          totaalIngevoerd += (data.ingevoerd || chunk.length);
          succes = true;
        } else if (res.status === 429) {
          console.warn(`[429 Rate Limit] Wachten 60s voor herpoging (${poging}/3)...`);
          await new Promise(r => setTimeout(r, 60000));
        } else {
          const errorText = await res.text();
          console.error(`[FAIL] HTTP ${res.status}: ${errorText}`);
          break;
        }
      } catch (err) {
        console.error(`[FOUT] ${err.message} (poging ${poging}/3)`);
        if (poging < 3) await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (!succes) {
      console.error(`[MISLUKT] Batch ${batchNum} kon niet worden geüpload na ${poging} pogingen.`);
    }

    // Korte pauze tussen batches ter bescherming van D1 rate limits
    await new Promise(r => setTimeout(r, 250));
  }

  console.log(`\nBatch upload voltooid! Totaal ingevoerd: ${totaalIngevoerd}/${rows.length}`);
  return totaalIngevoerd;
}

import { fileURLToPath } from 'node:url';
import path from 'node:path';

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const file = process.argv[2];
  const secret = process.env.ADMIN_SECRET || process.argv[3];

  if (!file || !secret) {
    console.log("Gebruik: ADMIN_SECRET=<uw_sleutel> node upload_bulk_d1.mjs <bestand.json>");
    process.exit(1);
  }

  uploadInBatches(file, secret);
}
