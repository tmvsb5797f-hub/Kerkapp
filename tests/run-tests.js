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
const liederenEngine = require(path.join(ROOT, 'js', 'liederen-engine.js'));
const preflightCheck = require(path.join(ROOT, 'js', 'preflight-check.js'));

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
    assert.ok(html.includes('src="js/liederen-engine.js"'), 'js/liederen-engine.js script tag ontbreekt');
    assert.ok(html.includes('id="bevestigModal"'), 'Moderne bevestigingsmodal ontbreekt');
    assert.ok(html.includes('window.vraagBevestiging'), 'window.vraagBevestiging helper ontbreekt');
    assert.ok(html.includes('window.sluitArchiefModal'), 'window.sluitArchiefModal ontbreekt');
    const confirmMatches = html.match(/\bconfirm\s*\(/g) || [];
    assert.strictEqual(confirmMatches.length, 1, `Verwachtte alleen de fallback confirm() in vraagBevestiging, vond er ${confirmMatches.length}`);
});

console.log('\n5. Unit-tests: js/liederen-engine.js');

test('isSysteemSleutel en getSchoneLiedSleutels filteren __-sleutels eruit', () => {
    const nepDb = {
        'Psalm 23': 'De HEER is mijn Herder',
        '__week_tikkie_bethel__': '{"url":"x"}',
        '_intern': 'skip',
        'Weerklank 100': 'Lof zij den Heer'
    };
    assert.strictEqual(liederenEngine.isSysteemSleutel('__week_tikkie_bethel__'), true);
    assert.strictEqual(liederenEngine.isSysteemSleutel('Psalm 23'), false);
    assert.deepStrictEqual(liederenEngine.getSchoneLiedSleutels(nepDb), ['Psalm 23', 'Weerklank 100']);
});

test('expandeerLiedAfkorting zet bundelafkortingen netjes om', () => {
    assert.strictEqual(liederenEngine.expandeerLiedAfkorting('wk 15'), 'Weerklank 15');
    assert.strictEqual(liederenEngine.expandeerLiedAfkorting('lw 446'), 'Weerklank Lied 446');
    assert.strictEqual(liederenEngine.expandeerLiedAfkorting('pw 12'), 'Weerklank Psalm 12');
    assert.strictEqual(liederenEngine.expandeerLiedAfkorting('oth 314'), 'Op Toonhoogte 314');
    assert.strictEqual(liederenEngine.expandeerLiedAfkorting('dnp 84'), 'DNP Psalm 84');
    assert.strictEqual(liederenEngine.expandeerLiedAfkorting('ps 23'), 'Psalm 23');
});

test('zoekLiedInDatabase vindt directe matches, multi-vers keys en normaliseert witregels', () => {
    const nepDb = {
        'Psalm 84 vers 1': 'Hoe lieflijk zijn Uw woningen\n\nO HEER der legerscharen!',
        'Psalm 84 vers 2': 'Mijn ziel verlangt en smacht',
        'Weerklank 446': 'Couplet 1\n\nCouplet 2',
        '__meelees_geschiedenis_bethel__': 'Psalm 84'
    };
    const rPs = liederenEngine.zoekLiedInDatabase('ps 84: 1, 2', nepDb);
    assert.strictEqual(rPs.inCloud, true);
    assert.deepStrictEqual(rPs.versNummers, [1, 2]);
    assert.strictEqual(rPs.basisTitel, 'Psalm 84');
    assert.ok(rPs.tekst.includes('Hoe lieflijk zijn Uw woningen\nO HEER der legerscharen!'));

    const rWk = liederenEngine.zoekLiedInDatabase('wk 446', nepDb);
    assert.strictEqual(rWk.inCloud, true);
    assert.strictEqual(rWk.basisTitel, 'Weerklank 446');

    const rSys = liederenEngine.zoekLiedInDatabase('__meelees_geschiedenis_bethel__', nepDb);
    assert.strictEqual(rSys.inCloud, false);
});

test('maakZangItem en injecteerLiedInLiturgie bouwen uniforme liturgie-items', () => {
    const nepVolgorde = [];
    const toegevoegd = liederenEngine.injecteerLiedInLiturgie({
        titel: 'Weerklank 100',
        tekst: 'Vers 1\n\nVers 2',
        doellijst: nepVolgorde,
        skipRender: true,
        skipUndo: true
    });
    assert.strictEqual(nepVolgorde.length, 1);
    assert.strictEqual(toegevoegd.type, 'Zang');
    assert.strictEqual(toegevoegd.basisTitel, 'Weerklank 100');
    assert.deepStrictEqual(toegevoegd.geselecteerdeVerzen, [1, 2]);
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

console.log('\n6. Unit-tests: js/preflight-check.js & Audit/Security Regressietests');

test('PreflightEngine detecteert lege liturgie, ontbrekende coupletten en HTML-entities', () => {
    const leegRapport = preflightCheck.evalueerLiturgieRapport([], '', '');
    assert.strictEqual(leegRapport.heeftFouten, true);
    assert.strictEqual(leegRapport.isGereed, false);
    assert.ok(leegRapport.foutenAantal >= 1);
    assert.ok(leegRapport.waarschuwingenAantal >= 2);

    const foutLiedRapport = preflightCheck.evalueerLiturgieRapport([
        { type: 'Zang', titel: 'Psalm 84', tekst: 'Hoe lieflijk &ndash; zijn Uw woningen', geselecteerdeVerzen: [] }
    ], '2026-11-29', 'Ds. J. de Vries');
    assert.strictEqual(foutLiedRapport.heeftFouten, true);
    assert.ok(foutLiedRapport.checks.some(c => c.categorie === 'liederen' && c.status === 'error'));
    assert.ok(foutLiedRapport.checks.some(c => c.categorie === 'typografie' && c.status === 'warning'));
});

test('PreflightEngine markeert een complete, schone liturgie als 100% gereed', () => {
    const schoonRapport = preflightCheck.evalueerLiturgieRapport([
        { type: 'Zang', titel: 'Psalm 84: 1, 2', tekst: '1.\nHoe lieflijk zijn Uw woningen\n\n2.\nMijn ziel verlangt en smacht', geselecteerdeVerzen: [1, 2] },
        { type: 'Schriftlezing', titel: 'Romeinen 8: 31-39', tekst: 'Wat zullen wij dan van deze dingen zeggen?' }
    ], '2026-11-29', 'Ds. J. de Vries');
    assert.strictEqual(schoonRapport.heeftFouten, false);
    assert.strictEqual(schoonRapport.waarschuwingenAantal, 0);
    assert.strictEqual(schoonRapport.isGereed, true);
    assert.strictEqual(schoonRapport.stats.totaalLiederen, 1);
    assert.strictEqual(schoonRapport.stats.totaalVerzen, 2);
    assert.strictEqual(schoonRapport.stats.totaalLezingen, 1);
});

test('Service Worker beschermt index.html tegen cache-overschrijving door subpagina\'s', () => {
    const sw = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');
    assert.ok(sw.includes("'./js/preflight-check.js'"), 'js/preflight-check.js ontbreekt in APP_SHELL');
    assert.ok(sw.includes('isAppRoot'), 'isAppRoot check ontbreekt in service-worker.js');
    assert.ok(sw.includes('res.status === 200'), 'HTTP 200 status-check ontbreekt bij navigatie-caching');
});

test('uitleg_video.html gebruikt publieke Tailwind CDN i.p.v. interne dev-URL', () => {
    const videoHtml = fs.readFileSync(path.join(ROOT, 'uitleg_video.html'), 'utf8');
    assert.ok(!videoHtml.includes('gstatic.com/antigravity/web/dev'), 'Interne dev Tailwind URL staat nog in uitleg_video.html');
    assert.ok(videoHtml.includes('https://cdn.tailwindcss.com'), 'Publieke Tailwind CDN ontbreekt in uitleg_video.html');
});

test('index.html bevat beveiliging (SVG sanitizer, HTTPS check, gehashte PIN), KerkDB-fallbacks en data-gemeente', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert.ok(html.includes('src="js/preflight-check.js"'), 'js/preflight-check.js script-koppeling ontbreekt');
    assert.ok(html.includes('window.sanitizeBannerSvg'), 'SVG XSS-sanitizer ontbreekt');
    assert.ok(html.includes('window.isVeiligeHttpsUrl'), 'HTTPS URL-validator ontbreekt');
    assert.ok(html.includes('verifieerBeheerCode'), 'SHA-256 beheercode-verificatie ontbreekt');
    assert.ok(!html.includes('"14825"') && !html.includes("'14825'"), 'Plaintext onderhoudscode staat nog in de broncode');
    assert.ok(html.includes('window._adminGeautoriseerd'), 'Admin-autorisatie op publieke feedbacklijst ontbreekt');
    assert.ok(html.includes('window.bewaarLiederenCacheVeilig'), 'Veilige KerkDB liederenCache fallback ontbreekt');
    assert.ok(html.includes('liederenCacheVolledig'), 'IndexedDB sleutel liederenCacheVolledig ontbreekt');
    assert.ok(html.includes('data-gemeente='), 'Apostrof-veilige data-gemeente attribuut ontbreekt');
});

console.log(`\nResultaat: ${geslaagd} geslaagd, ${gefaald} gefaald\n`);
if (gefaald > 0) process.exit(1);
