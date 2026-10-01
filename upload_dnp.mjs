import fs from 'node:fs';

const rows = JSON.parse(fs.readFileSync('dnp_psalmen_d1.json', 'utf8'));
let success = 0;

async function run() {
  for (const row of rows) {
    process.stdout.write(`Upload ${row.id}... `);
    const res = await fetch("https://kerkdata.kerkapp.workers.dev/liederen", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://tmvsb5797f-hub.github.io"
      },
      body: JSON.stringify(row)
    });
    if (res.ok) {
      console.log("OK");
      success++;
    } else {
      console.log("FAIL", res.status, await res.text());
    }
    await new Promise(r => setTimeout(r, 250));
  }
  console.log(`Klaar! ${success}/${rows.length} succesvol.`);
}
run();
