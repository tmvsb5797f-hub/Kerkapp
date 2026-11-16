/**
 * Modulaire liturgie-import & privacy-helper voor Liturgie Assistent Pro.
 * Werkt zowel in de browser (via window.*) als in Node.js (via module.exports voor tests).
 */
(function (root) {
    'use strict';

    const STANDAARD_BIJBELBOEKEN = [
        "Genesis", "Exodus", "Leviticus", "Numeri", "Deuteronomium", "Jozua", "Richteren", "Ruth",
        "1 Samuël", "2 Samuël", "1 Koningen", "2 Koningen", "1 Kronieken", "2 Kronieken", "Ezra",
        "Nehemia", "Esther", "Job", "Psalmen", "Spreuken", "Prediker", "Hooglied", "Jesaja",
        "Jeremia", "Klaagliederen", "Ezechiël", "Daniël", "Hosea", "Joël", "Amos", "Obadja",
        "Jona", "Micha", "Nahum", "Habakuk", "Zefanja", "Haggai", "Zacharia", "Maleachi",
        "Mattheüs", "Markus", "Lukas", "Johannes", "Handelingen", "Romeinen", "1 Korinthe",
        "2 Korinthe", "Galaten", "Efeze", "Filippenzen", "Kolossensen", "1 Thessalonicensen",
        "2 Thessalonicensen", "1 Timotheüs", "2 Timotheüs", "Titus", "Filemon", "Hebreeën",
        "Jakobus", "1 Petrus", "2 Petrus", "1 Johannes", "2 Johannes", "3 Johannes", "Judas", "Openbaring"
    ];

    /**
     * Lokaal Privacy Shield (AVG/GDPR): filtert pastorale/medische alinea's
     * voordat tekst naar een externe AI wordt verstuurd.
     */
    function filterPastoraleGevoeligeGegevens(ruweTekst) {
        if (!ruweTekst || typeof ruweTekst !== 'string') {
            return { opgeschoondeTekst: '', gefilterdeAantal: 0 };
        }

        const pastoraleRegex = /\b(voorbede[n]?|zieke[n]?|ziekenhuis|ziekenboeg|ziekenbezoek|overleden|overlijden|in\s+memoriam|rouw|rouwbeklag|begrafenis|crematie|pastoraat|pastorale|pastoraal|gedoopt|doopdienst|doopouder[s]?|huwelijk|trouwdienst|trouwbelofte|gebedspunten|gebedspunt|afkondiging(en)?|jarigen|mededeling(en)?)\b/i;
        const liturgieRegex = /\b(psalm|ps\b|lied|liederen|gezang|weerklank|op\s*toonhoogte|dnp|opwekking|schriftlezing|lezing|bijbelgedeelte|bijbellezing|hsv|nbv|nbg|slotlied|aanvangslied|intredelied)\b/i;

        const regels = ruweTekst.split(/\r?\n/);
        let gefilterdeAantal = 0;
        const behoudenRegels = [];

        regels.forEach(regel => {
            const getrimd = regel.trim();
            if (!getrimd) {
                behoudenRegels.push(regel);
                return;
            }

            const isPastoraal = pastoraleRegex.test(getrimd);
            const isLiturgie = liturgieRegex.test(getrimd);

            if (isPastoraal && !isLiturgie) {
                gefilterdeAantal++;
                behoudenRegels.push('[... pastorale alinea gefilterd door lokaal Privacy Shield ...]');
            } else {
                behoudenRegels.push(regel);
            }
        });

        return {
            opgeschoondeTekst: behoudenRegels.join('\n'),
            gefilterdeAantal
        };
    }

    /**
     * Extraheert veilig een JSON-array uit een AI-antwoord (ook bij markdown-blokken of extra tekst).
     */
    function parseJsonArraySafe(rawText) {
        if (!rawText || typeof rawText !== 'string') return null;
        const cleaned = rawText.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
        try {
            const parsed = JSON.parse(cleaned);
            if (Array.isArray(parsed)) return parsed;
        } catch (e) {}
        const start = cleaned.indexOf('[');
        const end = cleaned.lastIndexOf(']');
        if (start !== -1 && end > start) {
            try {
                const parsed = JSON.parse(cleaned.slice(start, end + 1));
                if (Array.isArray(parsed)) return parsed;
            } catch (e) {}
        }
        return null;
    }

    /**
     * Lokale fallback-parser voor kerkelijke liturgieën (Zang + Schriftlezing).
     */
    function parseLiturgieLokaal(tekst, options) {
        if (!tekst || !tekst.trim()) return [];
        const opts = options || {};
        const boekenLijst = Array.isArray(opts.bijbelBoeken)
            ? opts.bijbelBoeken
            : (typeof root.bijbelBoeken !== 'undefined' && Array.isArray(root.bijbelBoeken) ? root.bijbelBoeken : STANDAARD_BIJBELBOEKEN);
        const expandeer = typeof opts.expandeerLiedAfkorting === 'function'
            ? opts.expandeerLiedAfkorting
            : (typeof root.expandeerLiedAfkorting === 'function' ? root.expandeerLiedAfkorting : null);
        const extractVerzen = typeof opts.extractVersNummers === 'function'
            ? opts.extractVersNummers
            : (typeof root.extractVersNummers === 'function' ? root.extractVersNummers : null);

        const boekAliasMap = [
            [/\b(?:gen|ge)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Genesis'],
            [/\b(?:exod|ex)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Exodus'],
            [/\b(?:lev)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Leviticus'],
            [/\b(?:num)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Numeri'],
            [/\b(?:deut|dt)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Deuteronomium'],
            [/\b(?:joz)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Jozua'],
            [/\b(?:richt)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Richteren'],
            [/\b(1\s*sam|1\s*samu[eë]l)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, '1 Samuël'],
            [/\b(2\s*sam|2\s*samu[eë]l)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, '2 Samuël'],
            [/\b(1\s*kon)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, '1 Koningen'],
            [/\b(2\s*kon)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, '2 Koningen'],
            [/\b(1\s*kron)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, '1 Kronieken'],
            [/\b(2\s*kron)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, '2 Kronieken'],
            [/\b(?:neh)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Nehemia'],
            [/\b(?:est)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Esther'],
            [/\b(?:spr)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Spreuken'],
            [/\b(?:pred)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Prediker'],
            [/\b(?:jes)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Jesaja'],
            [/\b(?:jer)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Jeremia'],
            [/\b(?:ez|eze)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Ezechiël'],
            [/\b(?:dan)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Daniël'],
            [/\b(?:hos)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Hosea'],
            [/\b(?:mic)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Micha'],
            [/\b(?:hab)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Habakuk'],
            [/\b(?:zach)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Zacharia'],
            [/\b(?:mal)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Maleachi'],
            [/\b(?:matt?|mt)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Mattheüs'],
            [/\b(?:marc?|mark|mc|mk)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Markus'],
            [/\b(?:luk|luc|lc)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Lukas'],
            [/\b(?:joh|jh)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Johannes'],
            [/\b(?:hand)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Handelingen'],
            [/\b(?:rom)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Romeinen'],
            [/\b(1\s*kor)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, '1 Korinthe'],
            [/\b(2\s*kor)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, '2 Korinthe'],
            [/\b(?:gal)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Galaten'],
            [/\b(?:ef|efe)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Efeze'],
            [/\b(?:fil|filip)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Filippenzen'],
            [/\b(?:kol)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Kolossensen'],
            [/\b(1\s*thess?)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, '1 Thessalonicensen'],
            [/\b(2\s*thess?)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, '2 Thessalonicensen'],
            [/\b(1\s*tim)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, '1 Timotheüs'],
            [/\b(2\s*tim)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, '2 Timotheüs'],
            [/\b(?:tit)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Titus'],
            [/\b(?:filem|film)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Filemon'],
            [/\b(?:hebr?)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Hebreeën'],
            [/\b(?:jak)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Jakobus'],
            [/\b(1\s*petr?|1\s*pt)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, '1 Petrus'],
            [/\b(2\s*petr?|2\s*pt)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, '2 Petrus'],
            [/\b(1\s*joh|1\s*jh)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, '1 Johannes'],
            [/\b(2\s*joh|2\s*jh)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, '2 Johannes'],
            [/\b(3\s*joh|3\s*jh)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, '3 Johannes'],
            [/\b(?:openb|opb)\.?\s+(\d+\s*:\s*[\d,\-\sen]+)/i, 'Openbaring']
        ];

        const volleBoeken = boekenLijst.slice().sort((a, b) => b.length - a.length);
        const resultaten = [];
        const segmenten = tekst.split(/\r?\n|;/).map(s => s.trim()).filter(Boolean);

        for (const seg of segmenten) {
            let matched = false;
            const schoon = seg.replace(/^(?:[-•*]|\d+[.)])\s*/, '').trim();
            if (!schoon) continue;

            for (const boek of volleBoeken) {
                const esc = boek.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const re = new RegExp(`\\b${esc}\\s+(\\d+\\s*:\\s*[\\d,\\-\\sen]+)`, 'i');
                const m = schoon.match(re);
                if (m) {
                    const ref = m[1].replace(/\s+/g, ' ').replace(/\s*:\s*/, ':').trim();
                    resultaten.push({ type: 'Schriftlezing', titel: `${boek} ${ref} (HSV)`, origineel: schoon, verzen: [] });
                    matched = true;
                    break;
                }
            }
            if (matched) continue;

            for (const [re, boekNaam] of boekAliasMap) {
                const m = schoon.match(re);
                if (m) {
                    const refRaw = m[m.length - 1];
                    const ref = refRaw.replace(/\s+/g, ' ').replace(/\s*:\s*/, ':').trim();
                    resultaten.push({ type: 'Schriftlezing', titel: `${boekNaam} ${ref} (HSV)`, origineel: schoon, verzen: [] });
                    matched = true;
                    break;
                }
            }
            if (matched) continue;

            const liedMatch = schoon.match(/\b(DNP\s*(?:Psalm|Ps\.?)\s*\d+|Psalm(?:en)?\s*\d+|Ps\.?\s*\d+|Weerklank(?:\s+Lied)?\s*\d+|WK\s*\d+|Op\s+Toonhoogte\s*\d+|OTH\s*\d+|Opwekking\s*\d+|Opw\.?\s*\d+|Liedboek\s*\d+|Lied\s*\d+|Gezang\s*\d+|Gez\.?\s*\d+|ELB\s*\d+|Joh\.?\s*de\s*Heer\s*\d+|JdH\s*\d+|Hemelhoog\s*\d+|HH\s*\d+|Sela\s+[^\d,;]+)\b/i);
            if (liedMatch) {
                let basis = liedMatch[1].replace(/\s+/g, ' ').trim();
                if (expandeer) {
                    basis = expandeer(basis);
                }
                const rest = schoon.slice(liedMatch.index + liedMatch[0].length);
                const verzen = extractVerzen ? extractVerzen(rest || schoon) : [];
                resultaten.push({ type: 'Zang', titel: basis, origineel: schoon, verzen });
            }
        }
        return resultaten;
    }

    /**
     * Trekt foutieve coupletkopjes in een losse liedtekst automatisch recht naar "1.\n...", "2.\n...".
     * Herkent o.a. "Psalm 102:1", "Weerklank 260:1", "102:1", "Vers 1", "Couplet 2", "1:", "1)".
     */
    function normaliseerLiedTekstKopjes(rawTekst) {
        if (!rawTekst || typeof rawTekst !== 'string') return '';
        const cleaned = rawTekst.replace(/\u00A0/g, ' ').replace(/\r\n?/g, '\n').trim();
        if (!cleaned) return '';

        const regels = cleaned.split('\n');
        const out = [];

        const bundelPrefixRe = /^(?:(?:DNP\s*)?(?:Psalm(?:en)?|Ps\.?|Weerklank(?:\s+Lied)?|Op\s+Toonhoogte|OTH|Opwekking|Opw\.?|Liedboek|Lied|Gezang|Gez\.?|Hemelhoog|HH|ELB|JdH)\s+)?\d+[a-zA-Z]?\s*:\s*(\d{1,2})\.?\.?(?:\s+(.*))?$/i;
        const versWoordRe = /^(?:Vers|Couplet|Strofe)\s+(\d{1,2})\s*[:.]?(?:\s+(.*))?$/i;
        const losNummerRe = /^(\d{1,2})\s*[:)]\s*(.*)$/;
        const inlinePuntRe = /^(\d{1,2})\.\s+(.+)$/;

        for (let i = 0; i < regels.length; i++) {
            const trimmed = regels[i].trim();
            if (!trimmed) {
                if (out.length > 0 && out[out.length - 1] !== '') {
                    out.push('');
                }
                continue;
            }

            let versNr = null;
            let restTekst = '';

            let m = trimmed.match(bundelPrefixRe);
            if (m) {
                versNr = parseInt(m[1], 10);
                restTekst = (m[2] || '').trim();
            } else if ((m = trimmed.match(versWoordRe))) {
                versNr = parseInt(m[1], 10);
                restTekst = (m[2] || '').trim();
            } else if ((m = trimmed.match(losNummerRe))) {
                versNr = parseInt(m[1], 10);
                restTekst = (m[2] || '').trim();
            } else if ((m = trimmed.match(inlinePuntRe))) {
                versNr = parseInt(m[1], 10);
                restTekst = (m[2] || '').trim();
            }

            if (versNr !== null && versNr >= 1 && versNr <= 99) {
                if (out.length > 0 && out[out.length - 1] !== '') {
                    out.push('');
                }
                out.push(`${versNr}.`);
                if (restTekst) {
                    out.push(restTekst);
                }
            } else {
                out.push(trimmed);
            }
        }

        while (out.length > 0 && out[out.length - 1] === '') out.pop();
        return out.join('\n');
    }

    /**
     * Parser voor bulk-liederen in liedbundelsonline-formaat (bijv. "260:1" of "Psalm 102:1").
     */
    function parseBulkLiederenTekst(rawText) {
        if (!rawText || typeof rawText !== 'string') return {};
        const cleaned = rawText.replace(/\u00A0/g, ' ').replace(/\r\n?/g, '\n');
        const lines = cleaned.split('\n');
        const songs = {};
        let currentSong = null;
        let currentVerse = null;
        let currentText = [];

        function saveCurrent() {
            if (currentSong && currentVerse && currentText.length > 0) {
                if (!songs[currentSong]) songs[currentSong] = [];
                const joinedText = currentText.join('\n').trim();
                if (joinedText) {
                    songs[currentSong].push(currentVerse + '.\n' + joinedText);
                }
            }
        }

        const headerRe = /^(?:(?:DNP\s*)?(?:Psalm(?:en)?|Ps\.?|Weerklank(?:\s+Lied)?|Op\s+Toonhoogte|OTH|Opwekking|Opw\.?|Liedboek|Lied|Gezang|Gez\.?|Hemelhoog|HH|ELB|JdH)\s+)?([A-Za-z0-9]+)\s*:\s*(\d+)\.?(?:\s+(.*))?$/i;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const match = line.match(headerRe);
            if (match && /\d/.test(match[1])) {
                saveCurrent();
                currentSong = match[1];
                currentVerse = match[2];
                currentText = [];
                if (match[3] && match[3].trim()) {
                    currentText.push(match[3].trim());
                }
            } else if (line === '') {
                if (currentText.length > 0 && currentText[currentText.length - 1] !== '') {
                    currentText.push(line);
                }
            } else {
                if (currentSong) currentText.push(line);
            }
        }
        saveCurrent();
        return songs;
    }

    const api = {
        filterPastoraleGevoeligeGegevens,
        parseJsonArraySafe,
        parseLiturgieLokaal,
        normaliseerLiedTekstKopjes,
        parseBulkLiederenTekst
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (root) {
        Object.keys(api).forEach(k => {
            root[k] = api[k];
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);
