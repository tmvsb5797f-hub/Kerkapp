/**
 * VersKiezer - Slimme Couplet- en Verskiezer voor Kerkapp
 * Biedt een interactieve selectiebalk met badges [1] [2] [3] waarmee
 * liturgie-samenstellers met 1 klik verzen kunnen in- of uitschakelen.
 */

(function() {
    'use strict';

    let _huidigeVerzenData = null; // { basisTitel, alleVerzen: [{ nr, tekst }], geselecteerd: Set }

    // Parseert versnummers uit een liturgietitel (bijv. "Psalm 84: 1, 3" -> [1, 3])
    function parseerVersNummersUitTitel(titel) {
        if (!titel) return [];
        const match = titel.match(/(?::|\bvers(en)?|\bvs\.?|\bcouplet(ten)?)\s*([\d,\s\-–—en&]+)$/i);
        if (!match) return [];
        const raw = match[match.length - 1];
        const nummers = [];
        
        // Split op komma's, 'en', '&'
        const delen = raw.split(/[,&]|\ben\b/i);
        for (let deel of delen) {
            deel = deel.trim();
            // Controleer op reeksen zoals 1-3 of 1–4
            const reeksMatch = deel.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
            if (reeksMatch) {
                const start = parseInt(reeksMatch[1], 10);
                const eind = parseInt(reeksMatch[2], 10);
                if (start <= eind && eind - start <= 50) {
                    for (let i = start; i <= eind; i++) {
                        if (!nummers.includes(i)) nummers.push(i);
                    }
                }
            } else {
                const n = parseInt(deel, 10);
                if (!isNaN(n) && !nummers.includes(n)) {
                    nummers.push(n);
                }
            }
        }
        return nummers.sort((a, b) => a - b);
    }

    // Haalt de basistitel op zonder versannotatie (bijv. "Psalm 121 : 1, 2" -> "Psalm 121")
    function haalBasisTitelOp(titel) {
        if (!titel) return "";
        return titel
            .replace(/\s+(vers(en)?|vs\.?|couplet(ten)?)\s+[\d,\s\-–—en&]+$/i, '')
            .replace(/:\s*[\d,\s\-–—en&]+$/, '')
            .trim();
    }

    // Initialiseert de verskiezer voor een item in het bewerkscherm
    window.initVersKiezerVoorItem = function(item, index) {
        const container = document.getElementById('versKiezerContainer');
        const knoppenVak = document.getElementById('versKiezerKnoppen');
        if (!container || !knoppenVak) return;

        // Alleen tonen bij liederen / zang
        if (!item || item.type !== 'Zang') {
            container.classList.add('hidden');
            _huidigeVerzenData = null;
            return;
        }

        const basisTitel = haalBasisTitelOp(item.titel);
        let alleVerzen = [];

        // 1. Zoek eerst in de liederen database of alle coupletten beschikbaar zijn
        let dbRes = null;
        if (typeof window.zoekLiedInDatabase === 'function') {
            dbRes = window.zoekLiedInDatabase(item.titel);
            if (!dbRes || !dbRes.inCloud) {
                dbRes = window.zoekLiedInDatabase(basisTitel);
            }
        }

        if (dbRes && dbRes.inCloud && dbRes.tekst) {
            const rawVerzen = dbRes.tekst.split(/\n[ \t]*\n/).map(v => v.trim()).filter(Boolean);
            const nrs = (dbRes.versNummers && dbRes.versNummers.length === rawVerzen.length)
                ? dbRes.versNummers
                : rawVerzen.map((_, i) => i + 1);

            alleVerzen = rawVerzen.map((tekst, idx) => ({
                nr: nrs[idx] || (idx + 1),
                tekst: tekst
            }));
        } else if (item.tekst && item.tekst.trim()) {
            // 2. Als lied niet in DB staat, haal verzen uit de huidige tekst
            const stanzas = item.tekst.split(/\n[ \t]*\n/).map(v => v.trim()).filter(Boolean);
            const nrsInTitel = parseerVersNummersUitTitel(item.titel);
            
            alleVerzen = stanzas.map((tekst, idx) => ({
                nr: (nrsInTitel.length === stanzas.length ? nrsInTitel[idx] : idx + 1),
                tekst: tekst
            }));
        }

        // Als er maar 1 vers is en geen database-alternatieven, verberg de balk
        if (alleVerzen.length <= 1) {
            container.classList.add('hidden');
            _huidigeVerzenData = null;
            return;
        }

        // Bepaal welke verzen momenteel geselecteerd zijn
        const nrsInTitel = parseerVersNummersUitTitel(item.titel);
        const geselecteerd = new Set();

        if (nrsInTitel.length > 0) {
            nrsInTitel.forEach(n => geselecteerd.add(n));
        } else {
            // Als er geen nummers in de titel staan, selecteer alle verzen die momenteel in de tekst voorkomen
            alleVerzen.forEach(v => geselecteerd.add(v.nr));
        }

        _huidigeVerzenData = {
            basisTitel: basisTitel,
            alleVerzen: alleVerzen,
            geselecteerd: geselecteerd,
            itemIndex: index
        };

        container.classList.remove('hidden');
        window.renderVersKiezerKnoppen();
    };

    // Rendert de interactieve pill-knoppen
    window.renderVersKiezerKnoppen = function() {
        const knoppenVak = document.getElementById('versKiezerKnoppen');
        const toggleAllesBtn = document.getElementById('versKiezerToggleAllesBtn');
        if (!knoppenVak || !_huidigeVerzenData) return;

        const { alleVerzen, geselecteerd } = _huidigeVerzenData;
        const alleGekozen = alleVerzen.every(v => geselecteerd.has(v.nr));

        if (toggleAllesBtn) {
            toggleAllesBtn.textContent = alleGekozen ? 'Alles deselecteren' : 'Alles selecteren';
        }

        let html = '';
        for (let vers of alleVerzen) {
            const isActief = geselecteerd.has(vers.nr);
            const activeClasses = isActief
                ? 'bg-[#007AFF] text-white shadow-xs font-bold ring-1 ring-[#007AFF] scale-[1.02]'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200/90 font-medium';

            html += `
                <button type="button" 
                        onclick="window.toggleVersSelectie(${vers.nr})"
                        class="px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all duration-150 active:scale-95 cursor-pointer ${activeClasses}"
                        title="Klik om vers ${vers.nr} aan/uit te zetten">
                    <span>${isActief ? '✓' : '○'}</span>
                    <span>Vers ${vers.nr}</span>
                </button>
            `;
        }
        knoppenVak.innerHTML = html;
    };

    // Wisselt de selectie van een specifiek vers
    window.toggleVersSelectie = function(versNr) {
        if (!_huidigeVerzenData) return;
        const { geselecteerd, alleVerzen, basisTitel } = _huidigeVerzenData;

        if (geselecteerd.has(versNr)) {
            // Voorkom dat er 0 verzen overblijven
            if (geselecteerd.size <= 1) {
                if (window.toonToast) window.toonToast("Minstens één vers moet geselecteerd blijven.", "info");
                return;
            }
            geselecteerd.delete(versNr);
        } else {
            geselecteerd.add(versNr);
        }

        window.synchroniseerVersSelectieNaarTekst();
    };

    // Schakelt tussen alles selecteren of enkel het eerste vers
    window.toggleAlleVerzenInModal = function() {
        if (!_huidigeVerzenData) return;
        const { geselecteerd, alleVerzen } = _huidigeVerzenData;
        const alleGekozen = alleVerzen.every(v => geselecteerd.has(v.nr));

        if (alleGekozen) {
            geselecteerd.clear();
            if (alleVerzen.length > 0) geselecteerd.add(alleVerzen[0].nr);
        } else {
            alleVerzen.forEach(v => geselecteerd.add(v.nr));
        }

        window.synchroniseerVersSelectieNaarTekst();
    };

    // Bouwt de tekst en titel opnieuw op basis van de geselecteerde verzen
    window.synchroniseerVersSelectieNaarTekst = function() {
        if (!_huidigeVerzenData) return;
        const { geselecteerd, alleVerzen, basisTitel } = _huidigeVerzenData;

        // Filter en sorteer de gekozen verzen
        const gekozenVerzen = alleVerzen
            .filter(v => geselecteerd.has(v.nr))
            .sort((a, b) => a.nr - b.nr);

        const nieuweTekst = gekozenVerzen.map(v => v.tekst).join('\n\n');
        const gekozenNummers = gekozenVerzen.map(v => v.nr);

        // Update textarea
        const ta = document.getElementById('handmatigeTekst');
        if (ta) ta.value = nieuweTekst;

        // Bouw geüpdatete titel
        let nieuweTitel = basisTitel;
        if (gekozenNummers.length > 0 && gekozenNummers.length < alleVerzen.length) {
            nieuweTitel = `${basisTitel} : ${gekozenNummers.join(', ')}`;
        }

        // Update modal titel
        const modalTitelEl = document.getElementById('modalTitel');
        if (modalTitelEl) modalTitelEl.innerText = "Bewerk: " + nieuweTitel;

        // Houd tijdelijke titel bij in de globale scope
        if (typeof tijdelijkeTitel !== 'undefined') {
            tijdelijkeTitel = nieuweTitel;
        }

        window.renderVersKiezerKnoppen();
    };

    // Berekent snel het aantal dia's voor elk liturgie-item
    window.telDiasVoorItem = function(item) {
        if (!item) return 0;
        if (item.type === 'Foto' || item.type === 'QR' || item.type === 'Leeg') return 1;
        if (!item.tekst || !item.tekst.trim()) return 1;

        if (typeof window.berekenSubSlidesVoorItem === 'function') {
            try {
                const subSlides = window.berekenSubSlidesVoorItem(item);
                if (Array.isArray(subSlides) && subSlides.length > 0) {
                    return subSlides.length;
                }
            } catch(e) {}
        }

        // Fallback: aantal alinea's gescheiden door witregels
        const alineas = item.tekst.split(/\n[ \t]*\n/).filter(r => r.trim());
        return Math.max(1, alineas.length);
    };

})();
