/**
 * Centrale Liederen- & Injectie-Engine voor Liturgie Assistent Pro.
 * Verantwoordelijk voor systeemsleutel-filtering, afkorting-expansie,
 * database-opzoeking, vers-extractie en uniforme Zang-injectie in liturgieVolgorde.
 */
(function (root) {
    'use strict';

    /**
     * Interne cloud/localStorage systeemsleutels (__week_tikkie__, __meelees_geschiedenis__, etc.)
     * mogen nooit als lied getoond, doorzocht of genormaliseerd worden.
     */
    function isSysteemSleutel(key) {
        return typeof key === 'string' && (key.startsWith('__') || key.startsWith('_'));
    }

    /**
     * Geeft alle lied-sleutels terug met uitsluiting van interne systeemsleutels.
     */
    function getSchoneLiedSleutels(db) {
        const bron = db || root.liederenDatabase || {};
        return Object.keys(bron).filter(k => !isSysteemSleutel(k));
    }

    /**
     * Expandeert bundel-afkortingen (wk, lw, pw, oth, opw, dnp, ps, gk, lb, hh, jdh, el).
     */
    function expandeerLiedAfkorting(titel) {
        if (!titel || typeof titel !== 'string') return '';
        let t = titel.trim();
        const prefixMatch = t.match(/^(voorzang|slotlied|aanvangslied|zingen|lied)\s*[:\-]\s*/i);
        let prefix = '';
        if (prefixMatch) {
            prefix = prefixMatch[0];
            t = t.substring(prefix.length).trim();
        }

        t = t.replace(/^(?:PW|Pw|pw)\s*([0-9]+[a-z]?)\b/i, 'Weerklank Psalm $1');
        t = t.replace(/^(?:LW|Lw|lw|WL|Wl|wl)\s*([0-9]+[a-z]?)\b/i, 'Weerklank Lied $1');
        t = t.replace(/^(?:WK|Wk|wk)\s*([0-9]+[a-z]?)\b/i, 'Weerklank $1');
        t = t.replace(/^(?:OTH|Oth|oth)\s*([0-9]+[a-z]?)\b/i, 'Op Toonhoogte $1');
        t = t.replace(/^(?:OPW|Opw|opw)\s*([0-9]+[a-z]?)\b/i, 'Opwekking $1');
        t = t.replace(/^(?:DNP\s*Ps(?:alm)?|DNP|Dnp|dnp)\s*([0-9]+[a-z]?)\b/i, 'DNP Psalm $1');
        t = t.replace(/^(?:PS|Ps|ps)(?!\s*alm|\s*DNP)\s*([0-9]+[a-z]?)\b/i, 'Psalm $1');
        t = t.replace(/^(?:GK|Gk|gk)\s*([0-9]+[a-z]?)\b/i, 'Gereformeerd Kerkboek $1');
        t = t.replace(/^(?:LB|Lb|lb)\s*([0-9]+[a-z]?)\b/i, 'Liedboek $1');
        t = t.replace(/^(?:HH|Hh|hh)\s*([0-9]+[a-z]?)\b/i, 'Hemelhoog $1');
        t = t.replace(/^(?:JDH|Jdh|JdH|jdh)\s*([0-9]+[a-z]?)\b/i, 'Joh. de Heer $1');
        t = t.replace(/^(?:EL|El|el)\s*([0-9]+[a-z]?)\b/i, 'Evangelische Liedbundel $1');

        return prefix + t;
    }

    /**
     * Haalt een schone basistitel uit een titel met eventuele vers-aanduiding.
     */
    function extractBasisTitel(titel) {
        return (titel || '')
            .replace(/\s+(?:vers(?:en)?|vs\.?|couplet(?:ten)?)\s+[\d,\s\-–—en&]+$/i, '')
            .replace(/:\s*[\d,\s\-–—en&]+$/, '')
            .replace(/\s*\([\d,\s\-–—en&]+\)$/, '')
            .trim();
    }

    /**
     * Zoekt een lied in de database (inclusief multi-vers keys "Psalm 84 vers 1" en afkortingen).
     */
    function zoekLiedInDatabase(titel, dbOverride) {
        const db = dbOverride || root.liederenDatabase;
        if (!db) return { inCloud: false, tekst: '', versNummers: [] };

        let genormaliseerd = expandeerLiedAfkorting((titel || '').trim());
        genormaliseerd = genormaliseerd.replace(/^ps\.?\s*(\d+)/i, 'Psalm $1');
        if (!genormaliseerd) return { inCloud: false, tekst: '', versNummers: [] };

        const baseTitel = genormaliseerd
            .replace(/\s+(vers(en)?|vs\.?|couplet(ten)?)\s+[\d,\s\-–—en&]+$/i, '')
            .replace(/:\s*[\d,\s\-–—en&]+$/, '')
            .trim();

        const alleKeys = getSchoneLiedSleutels(db);

        const zoekMultiVers = (zoekTerm) => {
            if (!zoekTerm) return null;
            const escaped = zoekTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const versRegex = new RegExp('^' + escaped + '\\s+vers\\s+(\\d+)$', 'i');
            const versKeys = alleKeys
                .filter(k => versRegex.test(k))
                .sort((a, b) => {
                    const nA = parseInt(a.match(/vers\s+(\d+)$/i)?.[1] || 0, 10);
                    const nB = parseInt(b.match(/vers\s+(\d+)$/i)?.[1] || 0, 10);
                    return nA - nB;
                });

            if (versKeys.length > 0) {
                const genormaliseerdeVerzen = versKeys.map(k => {
                    const raw = (db[k] || '').trim();
                    return raw.replace(/\n[ \t]*\n[ \t]*/g, '\n').trim();
                });
                const gecombineerdeTekst = genormaliseerdeVerzen.join('\n\n');
                const versNummers = versKeys.map(k => parseInt(k.match(/vers\s+(\d+)$/i)?.[1] || 0, 10));
                return { inCloud: true, tekst: gecombineerdeTekst, versNummers, basisTitel: zoekTerm };
            }
            return null;
        };

        const vindDirecteMatch = (zoekTerm) => {
            if (!zoekTerm) return null;
            let tekst = null;
            let gevondenKey = zoekTerm;
            if (!isSysteemSleutel(zoekTerm) && db[zoekTerm]) {
                tekst = db[zoekTerm];
            } else {
                const lowerTerm = zoekTerm.toLowerCase();
                const ciKey = alleKeys.find(k => k.toLowerCase() === lowerTerm);
                if (ciKey && db[ciKey]) {
                    tekst = db[ciKey];
                    gevondenKey = ciKey;
                }
            }
            if (!tekst) return null;

            const lines = tekst.split('\n');
            const emptyLines = lines.filter(l => l.trim() === '').length;
            const textLines = lines.filter(l => l.trim() !== '').length;
            if (emptyLines >= textLines - 2 && textLines > 2) {
                tekst = lines.filter(l => l.trim() !== '').join('\n');
            }

            const verzen = tekst.split(/\n[ \t]*\n/).map(v => v.trim()).filter(Boolean);
            return { inCloud: true, tekst, versNummers: verzen.map((_, i) => i + 1), basisTitel: gevondenKey };
        };

        let resultaat = zoekMultiVers(baseTitel);
        if (!resultaat && baseTitel !== genormaliseerd) {
            resultaat = zoekMultiVers(genormaliseerd);
        }
        if (!resultaat) {
            resultaat = vindDirecteMatch(baseTitel);
        }
        if (!resultaat && baseTitel !== genormaliseerd) {
            resultaat = vindDirecteMatch(genormaliseerd);
        }

        return resultaat || { inCloud: false, tekst: '', versNummers: [] };
    }

    /**
     * Haalt direct de volledige tekst van een lied uit de database op basis van (basis)titel.
     */
    function haalLiedTekstUitDatabase(basisTitel, dbOverride) {
        const res = zoekLiedInDatabase(basisTitel, dbOverride);
        return res && res.inCloud ? res.tekst : '';
    }

    /**
     * Haalt alle losse coupletten/verzen op uit bronTekst of uit de database.
     */
    function haalLiedVerzenOp(titel, bronTekst, dbOverride) {
        if (bronTekst && bronTekst.trim() && bronTekst.trim() !== ' ') {
            return bronTekst.split(/\n[ \t]*\n/).map(v => v.trim()).filter(Boolean);
        }
        const dbResult = zoekLiedInDatabase(titel, dbOverride);
        if (dbResult.inCloud && dbResult.tekst) {
            return dbResult.tekst.split(/\n[ \t]*\n/).map(v => v.trim()).filter(Boolean);
        }
        return [];
    }

    /**
     * Bouwt een genormaliseerd Zang-item voor liturgieVolgorde.
     */
    function maakZangItem(opts) {
        const o = opts || {};
        const schoneTitel = (o.titel || '').trim();
        const basisTitel = (o.basisTitel || extractBasisTitel(schoneTitel) || schoneTitel).trim();
        const tekst = (o.tekst !== undefined && o.tekst !== null && String(o.tekst).trim() !== '')
            ? String(o.tekst).trim()
            : ' ';

        let geselecteerdeVerzen;
        if (Array.isArray(o.geselecteerdeVerzen) && o.geselecteerdeVerzen.length > 0) {
            geselecteerdeVerzen = o.geselecteerdeVerzen
                .map(n => parseInt(n, 10))
                .filter(n => !isNaN(n));
        } else {
            const verzen = tekst.trim() ? tekst.split(/\n[ \t]*\n/).map(v => v.trim()).filter(Boolean) : [];
            geselecteerdeVerzen = verzen.map((_, i) => i + 1);
        }

        return {
            type: 'Zang',
            titel: schoneTitel,
            basisTitel,
            tekst,
            geselecteerdeVerzen
        };
    }

    /**
     * Injecteert een lied uniform in liturgieVolgorde (inclusief undo-snapshot en hertekenen).
     */
    function injecteerLiedInLiturgie(opts) {
        const o = opts || {};
        const item = maakZangItem(o);
        if (!item.titel) return null;

        const lijst = Array.isArray(o.doellijst)
            ? o.doellijst
            : (typeof root.getLiturgieVolgorde === 'function' ? root.getLiturgieVolgorde() : root.liturgieVolgorde);

        if (!Array.isArray(lijst)) return null;

        if (!o.skipUndo && typeof root.pushLiturgieUndoState === 'function') {
            root.pushLiturgieUndoState(o.undoLabel || `Lied toegevoegd: ${item.titel}`);
        }

        lijst.push(item);

        if (!o.skipRender) {
            if (typeof root.bewaarLiturgie === 'function') root.bewaarLiturgie();
            if (typeof root.tekenVolgorde === 'function') root.tekenVolgorde();
        }
        return item;
    }

    const api = {
        isSysteemSleutel,
        getSchoneLiedSleutels,
        expandeerLiedAfkorting,
        extractBasisTitel,
        zoekLiedInDatabase,
        haalLiedTekstUitDatabase,
        haalLiedVerzenOp,
        maakZangItem,
        injecteerLiedInLiturgie
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (root) {
        root.LiederenEngine = api;
        Object.keys(api).forEach(k => {
            root[k] = api[k];
        });
    }
})(typeof window !== 'undefined' ? window : globalThis);
