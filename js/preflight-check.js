/**
 * Pre-Flight Zero-Defect Kwaliteitscontrole voor Liturgie Assistent Pro.
 * Werkt zowel in de browser (window.*) als in Node.js (module.exports voor geautomatiseerde tests).
 */
(function (root) {
    'use strict';

    function escapeHtmlLocal(str) {
        if (typeof root.escapeHtml === 'function') return root.escapeHtml(str);
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function evalueerLiturgieRapport(itemsInput, datumInput, voorgangerInput) {
        const datum = String(datumInput || '').trim();
        const voorganger = String(voorgangerInput || '').trim();
        const items = Array.isArray(itemsInput) ? itemsInput : [];

        const checks = [];
        let foutenAantal = 0;
        let waarschuwingenAantal = 0;

        // 1. Dienstgegevens: Datum
        if (!datum) {
            waarschuwingenAantal++;
            checks.push({
                categorie: 'dienst',
                status: 'warning',
                titel: 'Dienstdatum ontbreekt',
                beschrijving: 'Er is nog geen datum ingevuld voor de welkomstdia.',
                actieTekst: 'Datum invullen',
                actieType: 'focus_datum'
            });
        } else {
            checks.push({
                categorie: 'dienst',
                status: 'ok',
                titel: 'Dienstdatum ingesteld',
                beschrijving: `Datum: ${datum}`
            });
        }

        // 2. Dienstgegevens: Voorganger
        if (!voorganger) {
            waarschuwingenAantal++;
            checks.push({
                categorie: 'dienst',
                status: 'warning',
                titel: 'Voorganger ontbreekt',
                beschrijving: 'Er staat geen naam van de predikant of spreker ingevuld.',
                actieTekst: 'Voorganger invullen',
                actieType: 'focus_voorganger'
            });
        } else {
            checks.push({
                categorie: 'dienst',
                status: 'ok',
                titel: 'Voorganger ingevuld',
                beschrijving: `Voorganger: ${voorganger}`
            });
        }

        // 3. Liturgie Volgorde
        if (items.length === 0) {
            foutenAantal++;
            checks.push({
                categorie: 'liturgie',
                status: 'error',
                titel: 'Liturgie is leeg',
                beschrijving: "Er zijn nog geen liederen, schriftlezingen of dia's toegevoegd.",
                actieTekst: 'Lied zoeken',
                actieType: 'focus_invoer'
            });
        } else {
            checks.push({
                categorie: 'liturgie',
                status: 'ok',
                titel: 'Liturgie volgorde gevuld',
                beschrijving: `${items.length === 1 ? '1 onderdeel' : items.length + ' onderdelen'} in de liturgie.`
            });
        }

        // 4. Liederen & Verzen inspectie
        const liedItems = items.filter(it => it && (it.type === 'Zang' || it.type === 'Lied'));
        const ontbrekendeVerzen = [];
        const legeLiederen = [];
        items.forEach((it, idx) => {
            if (!it || (it.type !== 'Zang' && it.type !== 'Lied')) return;
            const hasTekst = Boolean(it.tekst && it.tekst.trim());
            if (Array.isArray(it.geselecteerdeVerzen) && it.geselecteerdeVerzen.length === 0) {
                ontbrekendeVerzen.push({ titel: it.titel || `Lied #${idx + 1}`, index: idx });
            }
            if (!hasTekst) {
                legeLiederen.push({ titel: it.titel || `Lied #${idx + 1}`, index: idx });
            }
        });

        if (ontbrekendeVerzen.length > 0) {
            foutenAantal++;
            checks.push({
                categorie: 'liederen',
                status: 'error',
                titel: 'Lied zonder couplet-selectie',
                beschrijving: `Er zijn geen verzen geselecteerd voor: ${ontbrekendeVerzen.map(x => x.titel).join(', ')}.`,
                actieTekst: 'Couplet kiezen',
                actieType: 'kies_vers',
                diaIndex: ontbrekendeVerzen[0].index
            });
        } else if (liedItems.length > 0) {
            checks.push({
                categorie: 'liederen',
                status: 'ok',
                titel: 'Liederen & verzen compleet',
                beschrijving: `Alle ${liedItems.length} liederen hebben zangtekst en coupletten.`
            });
        }

        if (legeLiederen.length > 0) {
            foutenAantal++;
            checks.push({
                categorie: 'liederen',
                status: 'error',
                titel: 'Lied zonder zangtekst',
                beschrijving: `Geen strofetekst gevonden voor: ${legeLiederen.map(x => x.titel).join(', ')}.`,
                actieTekst: 'Tekst bewerken',
                actieType: 'bewerk_dia',
                diaIndex: legeLiederen[0].index
            });
        }

        // 5. Schriftlezingen inspectie
        const lezingItems = items.filter(it => it && it.type === 'Schriftlezing');
        const legeLezingen = [];
        items.forEach((it, idx) => {
            if (!it || it.type !== 'Schriftlezing') return;
            const hasTekst = Boolean(it.tekst && it.tekst.trim());
            if (!hasTekst) {
                legeLezingen.push({ titel: it.titel || `Lezing #${idx + 1}`, index: idx });
            }
        });

        if (legeLezingen.length > 0) {
            foutenAantal++;
            checks.push({
                categorie: 'schriftlezing',
                status: 'error',
                titel: 'Schriftlezing zonder Bijbeltekst',
                beschrijving: `De tekst van ${legeLezingen.map(x => x.titel).join(', ')} is leeg.`,
                actieTekst: 'Bijbeltekst invullen',
                actieType: 'bewerk_dia',
                diaIndex: legeLezingen[0].index
            });
        } else if (lezingItems.length > 0) {
            checks.push({
                categorie: 'schriftlezing',
                status: 'ok',
                titel: 'Schriftlezing compleet',
                beschrijving: `${lezingItems.length} lezing${lezingItems.length === 1 ? '' : 'en'} met volledige Bijbeltekst.`
            });
        }

        // 6. Week-Tikkie QR Collecte inspectie
        const qrItems = items.filter(it => it && it.type === 'QR');
        if (qrItems.length > 0) {
            let verlopenQr = null;
            let geldigeQr = null;
            qrItems.forEach(it => {
                if (it.geldigTot) {
                    const exp = new Date(it.geldigTot + 'T23:59:59');
                    if (!isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
                        verlopenQr = it;
                    } else {
                        geldigeQr = it;
                    }
                } else {
                    geldigeQr = it;
                }
            });

            if (verlopenQr) {
                foutenAantal++;
                checks.push({
                    categorie: 'tikkie',
                    status: 'error',
                    titel: 'Tikkie QR is verlopen!',
                    beschrijving: `De collecte-Tikkie QR op de dia is verlopen op ${verlopenQr.geldigTot}. Kerkgangers kunnen hierop niet doneren!`,
                    actieTekst: 'Nieuwe Week-Tikkie',
                    actieType: 'open_tikkie'
                });
            } else {
                checks.push({
                    categorie: 'tikkie',
                    status: 'ok',
                    titel: 'Tikkie QR Collecte gereed',
                    beschrijving: geldigeQr?.geldigTot ? `Geldig t/m ${geldigeQr.geldigTot}.` : 'Digitale collecte QR aanwezig op dia.'
                });
            }
        } else {
            checks.push({
                categorie: 'tikkie',
                status: 'info',
                titel: 'Geen Week-Tikkie dia in liturgie',
                beschrijving: 'Er is geen digitale collecte QR toegevoegd aan deze dienst.',
                actieTekst: 'Tikkie instellen',
                actieType: 'open_tikkie'
            });
        }

        // 7. Leesbaarheid & Regellengte
        let overvolleDia = null;
        items.forEach((it, idx) => {
            if (it && it.type !== 'Foto' && it.type !== 'Leeg' && it.type !== 'QR') {
                const regels = (it.tekst || '').split('\n').filter(r => r.trim().length > 0);
                if (regels.length > 10) {
                    overvolleDia = { index: idx, titel: it.titel || `Dia #${idx + 1}`, count: regels.length };
                }
            }
        });
        if (overvolleDia) {
            waarschuwingenAantal++;
            checks.push({
                categorie: 'tekst',
                status: 'warning',
                titel: 'Dia met veel regels tekst',
                beschrijving: `Dia #${overvolleDia.index + 1} (${overvolleDia.titel}) bevat ${overvolleDia.count} regels. Mogelijk klein op de beamer.`,
                actieTekst: 'Bekijk dia',
                actieType: 'bekijk_dia',
                diaIndex: overvolleDia.index
            });
        } else if (items.length > 0) {
            checks.push({
                categorie: 'tekst',
                status: 'ok',
                titel: 'Dia-opmaak & regels gebalanceerd',
                beschrijving: "Geen overvolle dia's gevonden; teksten passen goed op het scherm."
            });
        }

        // 8. Typografie & HTML-entiteiten controle
        let htmlEntityItem = null;
        let plakwoordItem = null;
        items.forEach((it, idx) => {
            if (it && it.tekst && it.type !== 'Foto' && it.type !== 'Leeg' && it.type !== 'QR') {
                if (/&(ndash|mdash|nbsp|hellip|quot|apos|#8211|#8212);/i.test(it.tekst)) {
                    if (!htmlEntityItem) htmlEntityItem = { index: idx, titel: it.titel || `Dia #${idx + 1}` };
                }
                const heeftPlakfout = /([,;:.!?])([A-Za-z\u00C0-\u017E])/.test(it.tekst) ||
                    /(\b\d{1,3})([\p{Lu}][\p{Ll}]+)/u.test(it.tekst) ||
                    /\b(wordenen|hebbenen|makenen|komenen|sprekenen|gevenen|brengenen|staanen|gaanen|zoekenen|vindenen|horenen|zullenen|moetenen|leidenen|Uen|isen|wasen)\b/i.test(it.tekst) ||
                    (function(t) {
                        const m = t.match(/([\p{Ll}])([\p{Lu}])/gu);
                        return m ? m.some(p => !['iP', 'iO', 'iA', 'eB'].includes(p)) : false;
                    })(it.tekst);
                if (heeftPlakfout) {
                    if (!plakwoordItem) plakwoordItem = { index: idx, titel: it.titel || `Dia #${idx + 1}` };
                }
            }
        });

        if (htmlEntityItem || plakwoordItem) {
            waarschuwingenAantal++;
            const probleemTitel = htmlEntityItem ? 'HTML-code in tekst (&ndash;)' : 'Plakwoorden of typografie';
            const probleemDesc = htmlEntityItem
                ? `In '${htmlEntityItem.titel}' staat nog ruwe HTML-code (&ndash;). Klik op 'Repareren' om dit om te zetten naar een streepje (–).`
                : `In '${plakwoordItem.titel}' ontbreken spaties na leestekens of zijn woorden aan elkaar geplakt. Klik op 'Repareren' om dit op te schonen.`;
            checks.push({
                categorie: 'typografie',
                status: 'warning',
                titel: probleemTitel,
                beschrijving: probleemDesc,
                actieTekst: 'Automatisch repareren',
                actieType: 'repareer_typografie'
            });
        } else if (items.length > 0) {
            checks.push({
                categorie: 'typografie',
                status: 'ok',
                titel: 'Typografie & leestekens gecontroleerd',
                beschrijving: 'Geen ruwe HTML-codes of samengevoegde plakwoorden gevonden.'
            });
        }

        let totaalVerzen = 0;
        liedItems.forEach(it => {
            if (Array.isArray(it.geselecteerdeVerzen) && it.geselecteerdeVerzen.length > 0) {
                totaalVerzen += it.geselecteerdeVerzen.length;
            } else if (it.tekst && it.tekst.trim()) {
                const stanzas = it.tekst.trim().split(/\n\s*\n/).filter(Boolean);
                totaalVerzen += Math.max(1, stanzas.length);
            }
        });

        const isGereed = foutenAantal === 0 && waarschuwingenAantal === 0 && items.length > 0;
        const heeftFouten = foutenAantal > 0;

        return {
            isGereed,
            heeftFouten,
            foutenAantal,
            waarschuwingenAantal,
            checks,
            stats: {
                totaalItems: items.length,
                totaalLiederen: liedItems.length,
                totaalVerzen,
                totaalLezingen: lezingItems.length
            }
        };
    }

    function voerPreflightControleUit() {
        const datum = typeof document !== 'undefined' ? (document.getElementById('datumInput')?.value?.trim() || '') : '';
        const voorganger = typeof document !== 'undefined' ? (document.getElementById('voorgangerInput')?.value?.trim() || '') : '';
        const items = typeof root.getLiturgieVolgorde === 'function'
            ? root.getLiturgieVolgorde()
            : (root.liturgieVolgorde || []);
        return evalueerLiturgieRapport(items, datum, voorganger);
    }

    function updatePreflightBadge() {
        if (typeof document === 'undefined') return;
        const dot = document.getElementById('preflightDockDot');
        const badge = document.getElementById('preflightCountBadge');
        const text = document.getElementById('preflightDockText');
        const btn = document.getElementById('preflightDockBtn');
        if (!dot) return;

        const report = voerPreflightControleUit();

        if (report.heeftFouten) {
            dot.className = "w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse flex-shrink-0 transition-all";
            if (badge) {
                badge.className = "text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-red-500 text-white";
                badge.innerText = report.foutenAantal;
            }
            if (text) text.innerText = "Controle";
            if (btn) btn.title = `Controle: ${report.foutenAantal} aandachtspunt(en) gevonden vóór export`;
        } else if (report.waarschuwingenAantal > 0) {
            dot.className = "w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)] flex-shrink-0 transition-all";
            if (badge) {
                badge.className = "text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500 text-white";
                badge.innerText = report.waarschuwingenAantal;
            }
            if (text) text.innerText = "Controle";
            if (btn) btn.title = `Controle: ${report.waarschuwingenAantal} tip(s) voor deze dienst`;
        } else if (report.stats.totaalItems > 0) {
            dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] flex-shrink-0 transition-all";
            if (badge) badge.className = "hidden";
            if (text) text.innerText = "Controle OK";
            if (btn) btn.title = "Controle: 100% gereed voor vertoning op de beamer!";
        } else {
            dot.className = "w-2.5 h-2.5 rounded-full bg-gray-400 flex-shrink-0 transition-all";
            if (badge) badge.className = "hidden";
            if (text) text.innerText = "Controle";
            if (btn) btn.title = "Kwaliteitscontrole van de liturgie";
        }

        if (typeof root.updateDynamicIslandStatus === 'function') {
            root.updateDynamicIslandStatus();
        }
    }

    function openPreflightModal(optReport = null) {
        if (typeof document === 'undefined') return;
        const report = optReport || voerPreflightControleUit();
        const modal = document.getElementById('preflightModal');
        if (!modal) return;

        const pill = document.getElementById('preflightScorePill');
        if (pill) {
            if (report.isGereed) {
                pill.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40";
                pill.innerText = "100% GEREED";
            } else if (report.heeftFouten) {
                pill.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-300/40";
                pill.innerText = `${report.foutenAantal} AANDACHTSPUNTEN`;
            } else {
                pill.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300/40";
                pill.innerText = `${report.waarschuwingenAantal} TIPS`;
            }
        }

        const preflightLabel = document.getElementById('preflightMailBtnLabel');
        if (preflightLabel) {
            let saved = 'sempjons@gmail.com';
            try { saved = localStorage.getItem('liturgieBestemmingEmail') || saved; } catch (e) {}
            preflightLabel.textContent = `Mail naar ${saved}`;
        }

        const bannerBox = document.getElementById('preflightBannerBox');
        if (bannerBox) {
            if (report.isGereed) {
                bannerBox.className = "p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/80 dark:bg-emerald-950/30 flex items-start gap-3";
                bannerBox.innerHTML = `
                    <div class="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                    </div>
                    <div>
                        <h4 class="text-sm font-bold text-emerald-950 dark:text-emerald-200">100% Klaar voor de beamer!</h4>
                        <p class="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5 leading-relaxed">
                            Alle liederen, teksten, gegevens en de Week-Tikkie zijn gecontroleerd en vertoningsklaar. Je kunt direct exporteren.
                        </p>
                    </div>
                `;
            } else if (report.heeftFouten) {
                bannerBox.className = "p-4 rounded-2xl border border-red-200 dark:border-red-800/60 bg-red-50/80 dark:bg-red-950/30 flex items-start gap-3";
                bannerBox.innerHTML = `
                    <div class="w-8 h-8 rounded-xl bg-red-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    </div>
                    <div>
                        <h4 class="text-sm font-bold text-red-950 dark:text-red-200">${report.foutenAantal} aandachtspunt${report.foutenAantal === 1 ? '' : 'en'} gevonden</h4>
                        <p class="text-xs text-red-800 dark:text-red-300 mt-0.5 leading-relaxed">
                            We raden aan om onderstaande punten op te lossen voor een vlekkeloze dienst. Je kunt ook direct doordrukken via 'Toch Exporteren'.
                        </p>
                    </div>
                `;
            } else {
                bannerBox.className = "p-4 rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/30 flex items-start gap-3";
                bannerBox.innerHTML = `
                    <div class="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    </div>
                    <div>
                        <h4 class="text-sm font-bold text-amber-950 dark:text-amber-200">${report.waarschuwingenAantal} tip${report.waarschuwingenAantal === 1 ? '' : 's'} voor deze dienst</h4>
                        <p class="text-xs text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
                            Geen blokkerende fouten gevonden. Controleer eventueel nog even de ontbrekende gegevens voor een optimale welkomstdia.
                        </p>
                    </div>
                `;
            }
        }

        const statsBar = document.getElementById('preflightStatsBar');
        if (statsBar) {
            statsBar.innerHTML = `
                <div class="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                    <span class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">Onderdelen</span>
                    <span class="text-base font-bold text-gray-800 dark:text-gray-100">${report.stats.totaalItems}</span>
                </div>
                <div class="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                    <span class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">Liederen</span>
                    <span class="text-base font-bold text-gray-800 dark:text-gray-100">${report.stats.totaalLiederen}</span>
                </div>
                <div class="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                    <span class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">Verzen / Coup.</span>
                    <span class="text-base font-bold text-gray-800 dark:text-gray-100">${report.stats.totaalVerzen}</span>
                </div>
                <div class="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                    <span class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">Lezingen</span>
                    <span class="text-base font-bold text-gray-800 dark:text-gray-100">${report.stats.totaalLezingen}</span>
                </div>
            `;
        }

        const totalChecksLabel = document.getElementById('preflightTotalChecksLabel');
        if (totalChecksLabel) totalChecksLabel.innerText = `${report.checks.length} controles uitgevoerd`;

        const checklistEl = document.getElementById('preflightChecklist');
        if (checklistEl) {
            checklistEl.innerHTML = report.checks.map((chk) => {
                let badgeClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
                let iconSvg = `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>`;
                let cardBorder = "border-gray-100 dark:border-gray-800/80 bg-white dark:bg-[#252528]";

                if (chk.status === 'error') {
                    badgeClass = "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800";
                    iconSvg = `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>`;
                    cardBorder = "border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/20";
                } else if (chk.status === 'warning') {
                    badgeClass = "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800";
                    iconSvg = `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
                    cardBorder = "border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/20";
                } else if (chk.status === 'info') {
                    badgeClass = "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800";
                    iconSvg = `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
                    cardBorder = "border-gray-100 dark:border-gray-800 bg-white dark:bg-[#252528]";
                }

                let actieKnop = '';
                if (chk.actieTekst) {
                    actieKnop = `
                        <button type="button" onclick="losPreflightActieOp('${escapeHtmlLocal(chk.actieType)}', ${Number(chk.diaIndex ?? -1)})" class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#007AFF] hover:bg-blue-600 text-white transition-all active:scale-95 shadow-xs flex-shrink-0">
                            ${escapeHtmlLocal(chk.actieTekst)} →
                        </button>
                    `;
                }

                return `
                    <div class="p-3 sm:p-3.5 rounded-xl border ${cardBorder} flex items-center justify-between gap-3 transition-all">
                        <div class="flex items-start gap-2.5">
                            <span class="w-5 h-5 rounded-full flex items-center justify-center border ${badgeClass} flex-shrink-0 mt-0.5">
                                ${iconSvg}
                            </span>
                            <div>
                                <h5 class="text-xs font-bold text-gray-900 dark:text-gray-100">${escapeHtmlLocal(chk.titel)}</h5>
                                <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">${escapeHtmlLocal(chk.beschrijving)}</p>
                            </div>
                        </div>
                        ${actieKnop}
                    </div>
                `;
            }).join('');
        }

        const exportBtn = document.getElementById('preflightExportBtn');
        if (exportBtn) {
            if (report.isGereed) {
                exportBtn.className = "w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all active:scale-95 shadow-md flex items-center justify-center gap-1.5";
                exportBtn.innerHTML = `<span>Direct Exporteren naar PowerPoint</span><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>`;
            } else if (report.heeftFouten) {
                exportBtn.className = "w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#007AFF] hover:bg-blue-600 text-white text-xs font-bold transition-all active:scale-95 shadow-md flex items-center justify-center gap-1.5";
                exportBtn.innerHTML = `<span>Toch Exporteren (Negeer Waarschuwing)</span><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>`;
            } else {
                exportBtn.className = "w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#007AFF] hover:bg-blue-600 text-white text-xs font-bold transition-all active:scale-95 shadow-md flex items-center justify-center gap-1.5";
                exportBtn.innerHTML = `<span>Exporteer PowerPoint</span><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>`;
            }
        }

        modal.classList.remove('hidden');
    }

    function sluitPreflightModal() {
        if (typeof document === 'undefined') return;
        const modal = document.getElementById('preflightModal');
        if (modal) modal.classList.add('hidden');
    }

    function exporteerNaPreflight() {
        sluitPreflightModal();
        if (typeof root.maakPowerPoint === 'function') root.maakPowerPoint(null, true);
    }

    function losPreflightActieOp(actieType, diaIndex) {
        if (typeof document === 'undefined') return;
        sluitPreflightModal();
        if (actieType === 'focus_datum') {
            const el = document.getElementById('datumInput');
            if (el) { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        } else if (actieType === 'focus_voorganger') {
            const el = document.getElementById('voorgangerInput');
            if (el) { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        } else if (actieType === 'focus_invoer') {
            const el = document.getElementById('liedInput') || document.getElementById('liedZoekInput');
            if (el) { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        } else if (actieType === 'open_tikkie') {
            if (root.openTikkieModal) root.openTikkieModal();
        } else if ((actieType === 'kies_vers' || actieType === 'bewerk_dia') && diaIndex >= 0) {
            if (root.kiesItemEnPreview) root.kiesItemEnPreview(diaIndex);
            if (root.openBewerkScherm) root.openBewerkScherm(diaIndex);
        } else if (actieType === 'bekijk_dia' && diaIndex >= 0) {
            if (root.kiesItemEnPreview) root.kiesItemEnPreview(diaIndex);
        } else if (actieType === 'repareer_typografie') {
            if (root.repareerAlleTypografieInLiturgie) {
                root.repareerAlleTypografieInLiturgie();
            }
            setTimeout(() => {
                if (root.openPreflightModal) root.openPreflightModal();
            }, 300);
        }
    }

    function repareerAlleTypografieInLiturgie() {
        let hersteldAantal = 0;
        const lijst = typeof root.getLiturgieVolgorde === 'function' ? root.getLiturgieVolgorde() : root.liturgieVolgorde;
        if (Array.isArray(lijst)) {
            lijst.forEach(it => {
                if (it && it.tekst && typeof root.decodeerHtmlEntiteiten === 'function') {
                    const oud = it.tekst;
                    it.tekst = root.decodeerHtmlEntiteiten(it.tekst);
                    if (it.tekst !== oud) hersteldAantal++;
                }
            });
        }
        if (typeof root.bewaarLiturgie === 'function') root.bewaarLiturgie();
        if (typeof root.tekenVolgorde === 'function') root.tekenVolgorde();
        if (typeof root.updatePreflightBadge === 'function') root.updatePreflightBadge();
        if (root.toonToast) {
            root.toonToast(`Typografie opgeschoond: ${hersteldAantal} onderdeel(en) hersteld!`, 'success');
        }
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('DOMContentLoaded', () => {
            const datumEl = document.getElementById('datumInput');
            const voorgangerEl = document.getElementById('voorgangerInput');
            if (datumEl) datumEl.addEventListener('input', () => {
                updatePreflightBadge();
                if (typeof root.bewaarLiturgie === 'function') root.bewaarLiturgie();
            });
            if (voorgangerEl) voorgangerEl.addEventListener('input', () => {
                updatePreflightBadge();
                if (typeof root.bewaarLiturgie === 'function') root.bewaarLiturgie();
            });
            setTimeout(updatePreflightBadge, 400);
        });
    }

    const api = {
        evalueerLiturgieRapport,
        voerPreflightControleUit,
        updatePreflightBadge,
        openPreflightModal,
        sluitPreflightModal,
        exporteerNaPreflight,
        losPreflightActieOp,
        repareerAlleTypografieInLiturgie
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (root) {
        root.PreflightEngine = api;
        Object.keys(api).forEach(k => { root[k] = api[k]; });
    }
})(typeof window !== 'undefined' ? window : globalThis);
