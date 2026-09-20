# Automatisatiescripts voor Liedimport (Kerkapp v3)

Deze map bevat kant-en-klare Node.js scripts om liedteksten uit diverse bronnen geautomatiseerd te verzamelen, te formatteren conform het Kerkapp D1 schema, en in bulk te uploaden naar Cloudflare D1.

## Overzicht van Scripts

| Script | Bron | Doel | Aanroep |
| :--- | :--- | :--- | :--- |
| `scrape_psalmen_1773.mjs` | `psalmboek.nl` | Alle 150 psalmen + 12 gezangen ophalen | `node scripts/scrape_psalmen_1773.mjs 150` |
| `scrape_dnp.mjs` | `denieuwepsalmberijming.nl` | Alle 150 DNP psalmen ophalen | `node scripts/scrape_dnp.mjs` |
| `scrape_sela.mjs` | `sela.nl/liederen` | Alle ~220 Sela liederen ophalen | `node scripts/scrape_sela.mjs` |
| `convert_weerklank_txt_to_d1.mjs` | Liedbundels Online TXT | Weerklank Liederen of Psalmen converteren | `node scripts/convert_weerklank_txt_to_d1.mjs export.txt "Weerklank Lied "` |
| `convert_opensong_to_d1.mjs` | OpenSong XML / OPS pro TXT | Kerkelijke liedbestanden converteren (chords filteren) | `node scripts/convert_opensong_to_d1.mjs ./liedmap "Opwekking "` |
| `upload_bulk_d1.mjs` | Elk `*_d1.json` bestand | In batches van 100 versturen naar `POST /bulk` | `ADMIN_SECRET="geheim" node scripts/upload_bulk_d1.mjs psalmen_1773_d1.json` |

## Schema Conventies
Elk script produceert een JSON-bestand met rijen die direct aansluiten op het D1-schema (`worker-data/schema.sql`):
```json
[
  {
    "id": "Psalm 23",
    "tekst": "1.\nDe God des heils wil mij ten Herder wezen...\n\n2.\nAl ging ik ook in een dal..."
  }
]
```
