/**
 * Geautomatiseerde test-suite voor Liturgie Assistent Pro.
 * Uitvoeren met: node tests/run-tests.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const liturgieImport = require(path.join(ROOT, 'js', 'liturgie-import.js'));

let geslaagd = 0;
let gefaald = 0;

function test(naam, fn) {
    try {
        fn();
        geslaagd++;
        console.log(`  ✓ ${naam}`);
    } catch (err) {
        gefaald++;
        console.error(`  ✗ ${naam}`);
        console.error(`    ${err.stack || err.message}`);
    }
}

console.log('\n1. HTML & Script Structuurtests');

['index.html', 'import_tool.html', 'uitleg_video.html', 'over.html'].forEach(file => {
    const filePath = path.join(ROOT, file);
    test(`${file}: <div> tags in balans`, () => {
        const html = fs.readFileSync(filePath, 'utf8');
        const opens = (html.match(/<div\b/g) || []).length;
        const closes = (html.match(/<\/div>/g) || []).length;
        assert.strictEqual(opens, closes, `${file}: ${opens} <div vs ${closes} </div>`);
    });

    test(`${file}: inline <script> en JSON-LD syntaxis geldig`, () => {
        const html = fs.readFileSync(filePath, 'utf8');
        const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
        scripts.forEach((m, i) => {
            const attrs = m[1];
            if (/src=/.test(attrs)) return;
            if (/application\/ld\+json/.test(attrs)) {
                JSON.parse(m[2]);
            } else {
                new Function(m[2]);
            }
        });
    });
});

console.log('\n2. JS Modules & Service Worker');

test('Alle js/*.js bestanden en service-worker.js hebben geldige JS-syntaxis', () => {
    const jsDir = path.join(ROOT, 'js');
    const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).map(f => path.join(jsDir, f));
    files.push(path.join(ROOT, 'service-worker.js'));
    files.forEach(f => {
        const src = fs.readFileSync(f, 'utf8');
        new Function(src);
    });
});

test('Service Worker APP_SHELL bestanden bestaan allemaal op schijf', () => {
    const sw = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');
    const match = sw.match(/const\s+APP_SHELL\s*=\s*\[([\s\S]*?)\];/);
    assert.ok(match, 'APP_SHELL niet gevonden in service-worker.js');
    const entries = [...match[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
    assert.ok(entries.length >= 5, 'APP_SHELL bevat te weinig entries');
    entries.forEach(entry => {
        if (entry === './') return;
        const target = path.join(ROOT, entry.replace(/^\.\//, ''));
        assert.ok(fs.existsSync(target), `APP_SHELL entry ontbreekt: ${entry}`);
    });
});

console.log('\n3. Unit-tests: js/liturgie-import.js');

test('Privacy Shield filtert pastorale regels maar behoudt liturgie', () => {
    const input = [
        'Aanvangslied: Psalm 84: 1, 3',
        'Voorbede voor zieke broeder Jansen in het ziekenhuis',
        'Schriftlezing: Romeinen 8:31-39',
        'Afkondigingen: jarigen deze week'
    ].join('\n');
    const res = liturgieImport.filterPastoraleGevoeligeGegevens(input);
    assert.strictEqual(res.gefilterdeAantal, 2);
    assert.ok(res.opgeschoondeTekst.includes('Psalm 84: 1, 3'));
    assert.ok(res.opgeschoondeTekst.includes('Romeinen 8:31-39'));
    assert.ok(!res.opgeschoondeTekst.includes('Jansen'));
    assert.ok(!res.opgeschoondeTekst.includes('jarigen'));
});

test('parseJsonArraySafe verwerkt JSON, codeblokken en omringende tekst', () => {
    assert.deepStrictEqual(liturgieImport.parseJsonArraySafe('[{"a":1}]'), [{ a: 1 }]);
    assert.deepStrictEqual(liturgieImport.parseJsonArraySafe('```json\n[{"type":"Zang"}]\n```'), [{ type: 'Zang' }]);
    assert.deepStrictEqual(liturgieImport.parseJsonArraySafe('Hier is het resultaat:\n[{"x":2}]\nVeel succes!'), [{ x: 2 }]);
    assert.strictEqual(liturgieImport.parseJsonArraySafe('geen json'), null);
});

test('parseLiturgieLokaal herkent psalmen, liederen en Bijbelteksten (ook afgekort)', () => {
    const tekst = [
        '1. Zingen: Psalm 84: 1, 3 en 5',
        'Mededelingen en collecte',
        'Schriftlezing: Rom. 8:31-39',
        'Zingen: Weerklank 123: 1-3',
        'Lezing: 1 Kor. 13:1-13',
        'Slotlied: Opwekking 710'
    ].join('\n');
    const items = liturgieImport.parseLiturgieLokaal(tekst);
    assert.strictEqual(items.length, 5);
    assert.strictEqual(items[0].type, 'Zang');
    assert.strictEqual(items[0].titel, 'Psalm 84');
    assert.strictEqual(items[1].type, 'Schriftlezing');
    assert.strictEqual(items[1].titel, 'Romeinen 8:31-39 (HSV)');
    assert.strictEqual(items[2].type, 'Zang');
    assert.strictEqual(items[2].titel, 'Weerklank 123');
    assert.strictEqual(items[3].type, 'Schriftlezing');
    assert.strictEqual(items[3].titel, '1 Korinthe 13:1-13 (HSV)');
    assert.strictEqual(items[4].type, 'Zang');
    assert.strictEqual(items[4].titel, 'Opwekking 710');
});

test('parseBulkLiederenTekst verwerkt liedbundelsonline-formaat, spaties en CRLF', () => {
    const raw = '260:1\r\nGod maakt ons dienstbaar\u00A0aan zijn werk.\r\n\r\n260 : 2.\r\nTweede couplet regel 1\r\nTweede couplet regel 2\r\n\r\nPsalm 102:1 Hoor, o HEERE\r\n\r\n12a:1\r\nLied 12a vers 1';
    const songs = liturgieImport.parseBulkLiederenTekst(raw);
    assert.deepStrictEqual(Object.keys(songs), ['102', '260', '12a']);
    assert.strictEqual(songs['260'].length, 2);
    assert.ok(songs['260'][0].startsWith('1.\nGod maakt ons dienstbaar'));
    assert.ok(songs['260'][1].startsWith('2.\nTweede couplet regel 1'));
    assert.ok(songs['102'][0].startsWith('1.\nHoor, o HEERE'));
    assert.strictEqual(songs['12a'].length, 1);
});

test('normaliseerLiedTekstKopjes trekt Psalm 102:1 en Vers 2 recht naar 1. / 2.', () => {
    const input = 'Psalm 102:1 Hoor, o HEERE, mijn gebed\nEn laat mijn hulpgeroep tot U komen.\nPsalm 102:2\nVerberg Uw aangezicht niet voor mij\n\nVers 3:\nWant mijn dagen zijn verdwenen';
    const expected = '1.\nHoor, o HEERE, mijn gebed\nEn laat mijn hulpgeroep tot U komen.\n\n2.\nVerberg Uw aangezicht niet voor mij\n\n3.\nWant mijn dagen zijn verdwenen';
    assert.strictEqual(liturgieImport.normaliseerLiedTekstKopjes(input), expected);
});

console.log('\n4. Regressietests: iPad/iPhone touch & Bulk Importer');

test('index.html bevat touch drag/resize voor tekstvak en QR-code + modulaire import', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert.ok(html.includes('src="js/liturgie-import.js"'), 'js/liturgie-import.js script tag ontbreekt');
    assert.ok(html.includes('#slideTextBox.slide-box-active, #qrPreviewBox.slide-box-active'), 'touch-action: none CSS ontbreekt');
    assert.ok(html.includes('.resize-handle::after'), 'grotere touch hitbox ontbreekt');
    assert.ok(html.includes('window._toggleSlideTextBox'), '_toggleSlideTextBox koppeling ontbreekt');
    assert.ok(html.includes('touchcancel'), 'touchcancel cleanup ontbreekt');
    assert.ok(html.includes('id="slideAlignAllBtn"'), 'Alles-uitlijnen knop ontbreekt');
    assert.ok(html.includes('window.pasUitlijningToeOpAlles'), 'pasUitlijningToeOpAlles functie ontbreekt');
    assert.ok(html.includes('window.isHeleLiedOpWelkomstdia'), 'Hele lied welkomstdia helper ontbreekt');
    assert.ok(html.includes('id="schriftlezingKeuzeModal"'), 'Schriftlezing keuze modal ontbreekt');
    assert.ok(html.includes('window.toggleSchriftlezingWelkomstdia'), 'toggleSchriftlezingWelkomstdia ontbreekt');
    assert.ok(html.includes('function bouwHarmonieBannerSvg'), 'Modulaire SVG banner generator ontbreekt');
    assert.ok(html.includes('function maakThemaVanDesignSpec'), 'Design spec thema builder ontbreekt');
    assert.ok(html.includes('id="archiefStatusBox"'), 'PPTX upload voortgangs-pop-up ontbreekt');
});

test('device-engine.js negeert interne drag-and-drop bij file drop overlay', () => {
    const js = fs.readFileSync(path.join(ROOT, 'js', 'device-engine.js'), 'utf8');
    assert.ok(js.includes('isBestandSleep'), 'isBestandSleep check ontbreekt');
    assert.ok(js.includes("includes('Files')"), 'Files dataTransfer check ontbreekt');
});

test('import_tool.html bevat timeout, retries, stop-knop en live parsePreview', () => {
    const html = fs.readFileSync(path.join(ROOT, 'import_tool.html'), 'utf8');
    assert.ok(html.includes('REQUEST_TIMEOUT_MS'), 'REQUEST_TIMEOUT_MS ontbreekt');
    assert.ok(html.includes('uploadMetRetry'), 'uploadMetRetry ontbreekt');
    assert.ok(html.includes('stopUpload'), 'stopUpload ontbreekt');
    assert.ok(html.includes('updateParsePreview'), 'updateParsePreview ontbreekt');
});

console.log(`\nResultaat: ${geslaagd} geslaagd, ${gefaald} gefaald\n`);
if (gefaald > 0) process.exit(1);
