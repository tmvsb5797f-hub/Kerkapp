/**
 * VersKiezer - Slimme Couplet- en Verskiezer voor Kerkapp
 * Biedt:
 * 1. Interactieve vers-chips met directe weergave van de eerste tekstregel van elk couplet
 * 2. Inklapbaar ruw tekstvak op iPhone (.engine-phone) bij bestaande database-liederen
 * 3. Inline snel-verzen-wisselaar direct op de kaart in de Orde van Dienst (iPad & MacBook)
 */

(function() {
    'use strict';

    let _huidigeVerzenData = null; // { basisTitel, alleVerzen: [{ nr, tekst }], geselecteerd: Set }

    function escapeHtmlAttr(str) {
        return String(str || '').replace(/[&<>"']/g, m => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[m]));
    }

    // Haalt een schone eerste regel uit een couplettekst (zonder versnummer-prefix of markdown)
    function haalEersteRegelPreview(tekst, maxLen = 34) {
        if (!tekst) return '';
        const regels = tekst.split('\n').map(r => r.trim()).filter(Boolean);
        if (!regels.length) return '';
        let eerste = regels[0]
            .replace(/^(?:vers|couplet|vs\.?|\[)?\s*\d+[.:\]\)]?\s*/i, '')
            .replace(/\*\*/g, '')
            .replace(/<\/?b>/gi, '')
            .trim();
        if (!eerste && regels.length > 1) {
            eerste = regels[1].replace(/\*\*/g, '').replace(/<\/?b>/gi, '').trim();
        }
        if (eerste.length > maxLen) {
            return eerste.substring(0, maxLen - 1).trim() + '…';
        }
        return eerste;
    }

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

    // Zoekt alle beschikbare coupletten van een lied op uit de database of het item zelf
    function verzamelAlleVerzenVoorItem(item) {
        if (!item || item.type !== 'Zang') return { basisTitel: '', alleVerzen: [], inCloud: false };
        const basisTitel = item.basisTitel ? haalBasisTitelOp(item.basisTitel) : haalBasisTitelOp(item.titel);
        let alleVerzen = [];
        let inCloud = false;

        let dbRes = null;
        if (typeof window.zoekLiedInDatabase === 'function') {
            dbRes = window.zoekLiedInDatabase(item.titel);
            if (!dbRes || !dbRes.inCloud) {
                dbRes = window.zoekLiedInDatabase(basisTitel);
            }
        }

        if (dbRes && dbRes.inCloud && dbRes.tekst) {
            inCloud = true;
            const rawVerzen = dbRes.tekst.split(/\n[ \t]*\n/).map(v => v.trim()).filter(Boolean);
            const nrs = (dbRes.versNummers && dbRes.versNummers.length === rawVerzen.length)
                ? dbRes.versNummers
                : rawVerzen.map((_, i) => i + 1);

            alleVerzen = rawVerzen.map((tekst, idx) => ({
                nr: nrs[idx] || (idx + 1),
                tekst: tekst
            }));
        } else if (item.tekst && item.tekst.trim()) {
            const stanzas = item.tekst.split(/\n[ \t]*\n/).map(v => v.trim()).filter(Boolean);
            const nrsInTitel = parseerVersNummersUitTitel(item.titel);
            alleVerzen = stanzas.map((tekst, idx) => ({
                nr: (nrsInTitel.length === stanzas.length ? nrsInTitel[idx] : idx + 1),
                tekst: tekst
            }));
        }

        return { basisTitel, alleVerzen, inCloud };
    }
    window.verzamelAlleVerzenVoorItem = verzamelAlleVerzenVoorItem;

    // Beheert de inklapbare ruwe tekst-editor op mobiel wanneer een lied een rijke vers-kiezer heeft
    window.toggleMobielHandmatigeTekstEditor = function(forceExpand = null) {
        const wrapper = document.getElementById('handmatigeTekstEditorSectie');
        const toggleBtn = document.getElementById('mobielTekstEditorToggleBtn');
        if (!wrapper) return;

        const isHidden = wrapper.classList.contains('hidden');
        const show = forceExpand !== null ? forceExpand : isHidden;

        if (show) {
            wrapper.classList.remove('hidden');
            wrapper.classList.add('flex');
            if (toggleBtn) {
                toggleBtn.innerHTML = '<span>🔼</span><span>Liedtekst-editor verbergen</span>';
            }
        } else {
            wrapper.classList.add('hidden');
            wrapper.classList.remove('flex');
            if (toggleBtn) {
                toggleBtn.innerHTML = '<span>✏️</span><span>Liedtekst handmatig aanpassen (optioneel)</span>';
            }
        }
    };

    // Initialiseert de verskiezer voor een item in het bewerkscherm
    window.initVersKiezerVoorItem = function(item, index) {
        const container = document.getElementById('versKiezerContainer');
        const knoppenVak = document.getElementById('versKiezerKnoppen');
        const toggleBtn = document.getElementById('mobielTekstEditorToggleBtn');
        if (!container || !knoppenVak) return;

        // Standaard: toon altijd de tekst-editor en verberg de inklap-knop
        if (toggleBtn) toggleBtn.classList.add('hidden');
        window.toggleMobielHandmatigeTekstEditor(true);

        // Alleen tonen bij liederen / zang
        if (!item || item.type !== 'Zang') {
            container.classList.add('hidden');
            _huidigeVerzenData = null;
            return;
        }

        const { basisTitel, alleVerzen, inCloud } = verzamelAlleVerzenVoorItem(item);

        // Als er maar 1 vers is en geen database-alternatieven, verberg de balk
        if (alleVerzen.length <= 1) {
            container.classList.add('hidden');
            _huidigeVerzenData = null;
            return;
        }

        // Bepaal welke verzen momenteel geselecteerd zijn
        const nrsInItem = (Array.isArray(item.geselecteerdeVerzen) && item.geselecteerdeVerzen.length > 0)
            ? item.geselecteerdeVerzen.map(n => parseInt(n, 10)).filter(n => !isNaN(n))
            : (typeof window.extractVersNummers === 'function' ? window.extractVersNummers(item.titel) : parseerVersNummersUitTitel(item.titel));
        const geselecteerd = new Set();

        if (nrsInItem.length > 0) {
            nrsInItem.forEach(n => geselecteerd.add(n));
        } else {
            alleVerzen.forEach(v => geselecteerd.add(v.nr));
        }

        const gekozenNummersInit = alleVerzen.filter(v => geselecteerd.has(v.nr)).map(v => v.nr);

        _huidigeVerzenData = {
            basisTitel: basisTitel,
            alleVerzen: alleVerzen,
            geselecteerd: geselecteerd,
            gekozenNummers: gekozenNummersInit,
            itemIndex: index
        };
        window._huidigeVerzenData = _huidigeVerzenData;

        container.classList.remove('hidden');
        window.renderVersKiezerKnoppen();

        // Op iPhone / smal mobiel (< 640px): klap het ruwe tekstvak standaard in als het lied uit de database komt,
        // zodat de gebruiker direct alle coupletten met hun eerste regel ziet zonder dat het toetsenbord in de weg zit.
        if (inCloud && window.innerWidth < 640 && toggleBtn) {
            toggleBtn.classList.remove('hidden');
            window.toggleMobielHandmatigeTekstEditor(false);
        }
    };

    // Rendert de interactieve pill-knoppen met eerste tekstregel per couplet
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
            const eersteRegel = haalEersteRegelPreview(vers.tekst, 32);
            const activeClasses = isActief
                ? 'bg-[#007AFF] text-white shadow-xs font-bold ring-1 ring-[#007AFF]'
                : 'bg-white dark:bg-[#2C2C2E] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200/90 dark:border-white/10 font-medium';
            const subTextClasses = isActief
                ? 'text-blue-100 font-normal'
                : 'text-gray-400 dark:text-gray-400 font-normal';

            html += `
                <button type="button" 
                        onclick="window.toggleVersSelectie(${vers.nr})"
                        class="shrink-0 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl text-left flex flex-col gap-0.5 transition-all duration-150 active:scale-95 cursor-pointer max-w-[185px] sm:max-w-[210px] ${activeClasses}"
                        title="${escapeHtmlAttr(vers.tekst)}">
                    <div class="flex items-center gap-1 text-[11px] sm:text-xs leading-tight">
                        <span>${isActief ? '✓' : '○'}</span>
                        <span>Vers ${vers.nr}</span>
                    </div>
                    ${eersteRegel ? `<span class="text-[10px] leading-tight truncate max-w-full ${subTextClasses}">${escapeHtmlAttr(eersteRegel)}</span>` : ''}
                </button>
            `;
        }
        knoppenVak.innerHTML = html;
    };

    // Wisselt de selectie van een specifiek vers in de bewerk-modal
    window.toggleVersSelectie = function(versNr) {
        if (!_huidigeVerzenData) return;
        const { geselecteerd } = _huidigeVerzenData;

        if (geselecteerd.has(versNr)) {
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

        const gekozenVerzen = alleVerzen
            .filter(v => geselecteerd.has(v.nr))
            .sort((a, b) => a.nr - b.nr);

        const nieuweTekst = gekozenVerzen.map(v => v.tekst).join('\n\n');
        const gekozenNummers = gekozenVerzen.map(v => v.nr);

        const ta = document.getElementById('handmatigeTekst');
        if (ta) ta.value = nieuweTekst;

        let nieuweTitel = basisTitel;
        const isAlles = (gekozenNummers.length === alleVerzen.length) &&
            gekozenNummers.every((n, i) => n === i + 1);
        if (!isAlles && gekozenNummers.length > 0) {
            nieuweTitel = `${basisTitel} : ${gekozenNummers.join(', ')}`;
        }

        const modalTitelEl = document.getElementById('modalTitel');
        if (modalTitelEl) modalTitelEl.innerText = "Bewerk: " + nieuweTitel;
        const modalTitelInp = document.getElementById('modalTitelInput');
        if (modalTitelInp) modalTitelInp.value = nieuweTitel;

        window.tijdelijkeTitel = nieuweTitel;
        try {
            if (typeof tijdelijkeTitel !== 'undefined') {
                tijdelijkeTitel = nieuweTitel;
            }
        } catch(e) {}

        _huidigeVerzenData.gekozenNummers = gekozenNummers;
        _huidigeVerzenData.basisTitel = basisTitel;
        _huidigeVerzenData.nieuweTitel = nieuweTitel;
        window._huidigeVerzenData = _huidigeVerzenData;

        window.renderVersKiezerKnoppen();
    };

    // --- INLINE VERS-CHIPS OP DE KAART IN DE ORDE VAN DIENST ---
    // Genereert compacte klikbare vers-knopjes [1] [2] [3] direct op het kaartje in de Orde van Dienst
    window.bouwInlineVersChipsHtml = function(item, itemIdx) {
        if (!item || item.type !== 'Zang') return '';
        const { alleVerzen } = verzamelAlleVerzenVoorItem(item);
        if (!alleVerzen || alleVerzen.length <= 1) return '';

        const nrsInItem = (Array.isArray(item.geselecteerdeVerzen) && item.geselecteerdeVerzen.length > 0)
            ? item.geselecteerdeVerzen.map(n => parseInt(n, 10)).filter(n => !isNaN(n))
            : (typeof window.extractVersNummers === 'function' ? window.extractVersNummers(item.titel) : parseerVersNummersUitTitel(item.titel));

        const geselecteerd = new Set();
        if (nrsInItem.length > 0) {
            nrsInItem.forEach(n => geselecteerd.add(n));
        } else {
            alleVerzen.forEach(v => geselecteerd.add(v.nr));
        }

        // Toon maximaal 12 inline chips om de kaart overzichtelijk te houden
        const teTonen = alleVerzen.slice(0, 12);
        let chipsHtml = '<div class="flex items-center gap-1 flex-wrap mt-1.5" onclick="event.stopPropagation()">';
        chipsHtml += '<span class="text-[9px] font-semibold text-gray-400 dark:text-gray-500 mr-0.5 select-none">Verzen:</span>';

        for (const v of teTonen) {
            const actief = geselecteerd.has(v.nr);
            const eersteRegel = haalEersteRegelPreview(v.tekst, 45);
            const cls = actief
                ? 'bg-[#007AFF] text-white font-bold shadow-2xs border border-[#007AFF]'
                : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 hover:bg-blue-50 hover:text-[#007AFF] dark:hover:bg-blue-950/50 border border-transparent font-medium';
            chipsHtml += `<button type="button" onclick="event.stopPropagation(); window.toggleVersInlineOpKaart(${itemIdx}, ${v.nr})" class="min-w-[22px] h-[20px] px-1.5 rounded-md text-[10px] leading-none inline-flex items-center justify-center transition-all active:scale-90 cursor-pointer ${cls}" title="Vers ${v.nr}: ${escapeHtmlAttr(eersteRegel)} (klik om aan/uit te zetten)">${v.nr}</button>`;
        }

        if (alleVerzen.length > 12) {
            chipsHtml += `<button type="button" onclick="event.stopPropagation(); openBewerkScherm(${itemIdx})" class="px-1.5 h-[20px] rounded-md text-[9px] font-semibold bg-gray-100 dark:bg-white/10 text-gray-500 hover:text-[#007AFF] cursor-pointer" title="Meer verzen kiezen">+${alleVerzen.length - 12}</button>`;
        }
        chipsHtml += '</div>';
        return chipsHtml;
    };

    // Zet met 1 klik direct op de kaart in de Orde van Dienst een vers aan of uit
    window.toggleVersInlineOpKaart = function(itemIdx, versNr) {
        const lijst = window.liturgieVolgorde;
        if (!Array.isArray(lijst) || itemIdx < 0 || itemIdx >= lijst.length) return;
        const item = lijst[itemIdx];
        if (!item || item.type !== 'Zang') return;

        const { basisTitel, alleVerzen } = verzamelAlleVerzenVoorItem(item);
        if (!alleVerzen || alleVerzen.length <= 1) return;

        const nrsInItem = (Array.isArray(item.geselecteerdeVerzen) && item.geselecteerdeVerzen.length > 0)
            ? item.geselecteerdeVerzen.map(n => parseInt(n, 10)).filter(n => !isNaN(n))
            : (typeof window.extractVersNummers === 'function' ? window.extractVersNummers(item.titel) : parseerVersNummersUitTitel(item.titel));

        const geselecteerd = new Set();
        if (nrsInItem.length > 0) {
            nrsInItem.forEach(n => geselecteerd.add(n));
        } else {
            alleVerzen.forEach(v => geselecteerd.add(v.nr));
        }

        if (geselecteerd.has(versNr)) {
            if (geselecteerd.size <= 1) {
                if (window.toonToast) window.toonToast("Minstens één vers moet geselecteerd blijven.", "info");
                return;
            }
            geselecteerd.delete(versNr);
        } else {
            geselecteerd.add(versNr);
        }

        if (typeof window.pushLiturgieUndoState === 'function') {
            window.pushLiturgieUndoState(`Vers ${versNr} gewijzigd bij ${basisTitel}`);
        }

        const gekozenVerzen = alleVerzen
            .filter(v => geselecteerd.has(v.nr))
            .sort((a, b) => a.nr - b.nr);
        const gekozenNummers = gekozenVerzen.map(v => v.nr);

        item.tekst = gekozenVerzen.map(v => v.tekst).join('\n\n');
        item.geselecteerdeVerzen = gekozenNummers;
        item.basisTitel = basisTitel;

        const isAlles = (gekozenNummers.length === alleVerzen.length) &&
            gekozenNummers.every((n, i) => n === i + 1);
        item.titel = (!isAlles && gekozenNummers.length > 0)
            ? `${basisTitel} vers ${gekozenNummers.join(', ')}`
            : basisTitel;

        if (window.DeviceEngine && typeof window.DeviceEngine.haptic === 'function') {
            window.DeviceEngine.haptic('selection');
        }

        if (typeof window.tekenVolgorde === 'function') {
            window.tekenVolgorde();
        }
        if (typeof window.renderSlidePreview === 'function') {
            window.renderSlidePreview(itemIdx);
        }
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

        const alineas = item.tekst.split(/\n[ \t]*\n/).filter(r => r.trim());
        return Math.max(1, alineas.length);
    };

})();
