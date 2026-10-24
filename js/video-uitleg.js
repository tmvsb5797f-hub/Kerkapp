/**
 * =========================================================================
 * KERKAPP - VIDEO UITLEG ENGINE & WEBAUDIO VOICE-OVER SYNTHESIZER
 * =========================================================================
 * Bevat:
 * - Interactieve WebAudio engine gesynchroniseerd met voiceover & SFX
 * - Canvas animaties, tijdlijn visualisaties en fullscreen modal controls
 * =========================================================================
 */

    // =========================================================================
    // VIDEO UITLEG ENGINE: 100% GESYNCHRONISEERD MET STEM & SOUND EFFECTS
    // =========================================================================
    (function() {
        let videoAudioCtx = null;
        let videoSfxEnabled = true;

        function getVideoAudioCtx() {
            if (!videoAudioCtx) {
                videoAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (videoAudioCtx.state === 'suspended') videoAudioCtx.resume();
            return videoAudioCtx;
        }

        function playVmClick() {
            if (!videoSfxEnabled) return;
            try {
                const ctx = getVideoAudioCtx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(240, ctx.currentTime + 0.04);
                gain.gain.setValueAtTime(0.18, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.05);
            } catch (e) {}
        }

        function playVmType() {
            if (!videoSfxEnabled) return;
            try {
                const ctx = getVideoAudioCtx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(1400 + Math.random() * 250, ctx.currentTime);
                gain.gain.setValueAtTime(0.07, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.035);
            } catch (e) {}
        }

        function playVmSuccess() {
            if (!videoSfxEnabled) return;
            try {
                const ctx = getVideoAudioCtx();
                [659.25, 987.77].forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.09);
                    gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.09);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.09 + 0.35);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(ctx.currentTime + idx * 0.09);
                    osc.stop(ctx.currentTime + idx * 0.09 + 0.36);
                });
            } catch (e) {}
        }

        function playVmWhoosh() {
            if (!videoSfxEnabled) return;
            try {
                const ctx = getVideoAudioCtx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(160, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(380, ctx.currentTime + 0.1);
                osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
                gain.gain.setValueAtTime(0.001, ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.08);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.21);
            } catch (e) {}
        }

        function playVmChuckle() {
            if (!videoSfxEnabled) return;
            try {
                const ctx = getVideoAudioCtx();
                [440, 554.37, 659.25, 880].forEach((f, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.065);
                    gain.gain.setValueAtTime(0.09, ctx.currentTime + i * 0.065);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.065 + 0.16);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(ctx.currentTime + i * 0.065);
                    osc.stop(ctx.currentTime + i * 0.065 + 0.17);
                });
            } catch (e) {}
        }

        const TOTAL_AUDIO_SEC = 246.0;
        let vmCurrentIdx = -1;
        let vmIsPlaying = false;
        let vmTriggeredSfx = new Set();
        let vmVirtualTime = 0;
        let vmLastPerfTime = 0;

        const vmScenes = [
            {
                id: "intro",
                title: "1. Introductie & Overzicht",
                start: 0.0,
                end: 23.0,
                render: function(c) {
                    c.innerHTML = `
                        <div class="flex flex-col items-center justify-center text-center gap-4 max-w-lg">
                            <div class="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#007AFF] via-blue-500 to-indigo-500 flex items-center justify-center text-4xl shadow-[0_12px_45px_rgba(0,122,255,0.6)]">
                                ⛪
                            </div>
                            <div class="flex flex-col gap-1">
                                <h2 class="text-2xl md:text-4xl font-black text-white tracking-tight">Liturgie Assistent <span class="text-[#007AFF]">Pro</span></h2>
                                <div class="text-xs md:text-sm text-gray-400 font-medium">De complete liturgie &amp; beamer workflow in één applicatie</div>
                            </div>
                            <div class="flex items-center gap-2 mt-1 flex-wrap justify-center">
                                <span class="px-3 py-1 bg-white/10 rounded-full text-xs text-blue-300 font-semibold border border-white/10">✨ AI Liedzoeker</span>
                                <span class="px-3 py-1 bg-white/10 rounded-full text-xs text-purple-300 font-semibold border border-white/10">⚡ Slim Importeren</span>
                                <span class="px-3 py-1 bg-white/10 rounded-full text-xs text-emerald-300 font-semibold border border-white/10">🎥 OBS Broadcast</span>
                            </div>
                            <div id="vmNoStressBadge" class="opacity-0 transition-opacity duration-500 px-3.5 py-1.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 shadow-sm">
                                <span>✓</span> Geen verspringende lettertypes · Binnen 3 minuten gereed
                            </div>
                        </div>
                    `;
                },
                update: function(relTime, absTime) {
                    checkVmSfx('s1_whoosh', absTime, 0.2, playVmWhoosh);
                    checkVmSfx('s1_chime', absTime, 18.0, playVmSuccess);
                    const b = document.getElementById('vmNoStressBadge');
                    if (b) b.style.opacity = relTime >= 10.0 ? '1' : '0';
                    moveVmCursor(50, relTime < 6.0 ? 75 : (relTime < 16.0 ? 65 : 80));
                }
            },
            {
                id: "datum",
                title: "2. Datum & Voorganger",
                start: 23.0,
                end: 42.0,
                render: function(c) {
                    c.innerHTML = `
                        <div class="w-full max-w-lg bg-gray-900/95 rounded-2xl p-5 border border-white/10 shadow-2xl flex flex-col gap-3.5">
                            <div class="flex items-center justify-between border-b border-white/10 pb-2.5">
                                <div class="flex items-center gap-2">
                                    <span class="text-base">📅</span>
                                    <span class="text-xs font-bold text-gray-300 uppercase tracking-wider">0. Dienstgegevens</span>
                                </div>
                                <span id="vmDatumPill" class="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold border border-blue-400/30">Voor Welkomstdia</span>
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label class="text-[10px] font-semibold text-gray-400 block mb-1">Datum</label>
                                    <div id="vmDatumBox" class="bg-gray-800 border-2 border-transparent rounded-xl px-3 py-2 text-xs text-gray-400 flex items-center justify-between transition-all">
                                        <span id="vmDatumTxt">Klik om datum te kiezen...</span>
                                        <span>📆</span>
                                    </div>
                                </div>
                                <div>
                                    <label class="text-[10px] font-semibold text-gray-400 block mb-1">Voorganger</label>
                                    <div id="vmVoorgangerBox" class="bg-gray-800 border-2 border-transparent rounded-xl px-3 py-2 text-xs text-gray-400 flex items-center transition-all">
                                        <span id="vmVoorgangerTxt">Bijv: dominee Mark Bot</span>
                                    </div>
                                </div>
                            </div>
                            <div id="vmKalenderCard" class="bg-gray-800/95 p-3 rounded-xl border border-gray-700 opacity-0 transition-all duration-300 flex flex-col gap-1.5 shadow-lg">
                                <div class="text-xs font-bold text-white flex justify-between"><span>Januari 2026</span><span class="text-blue-400 font-semibold">Zondagen</span></div>
                                <div class="grid grid-cols-7 gap-1 text-center text-[10px]">
                                    <span class="text-gray-500 py-1">4</span>
                                    <span class="text-gray-500 py-1">11</span>
                                    <span id="vmZondagPill" class="bg-gray-700 text-gray-200 font-bold rounded-lg py-1 transition-all">18</span>
                                    <span class="text-gray-500 py-1">25</span>
                                </div>
                            </div>
                        </div>
                    `;
                },
                update: function(relTime, absTime) {
                    checkVmSfx('s2_whoosh', absTime, 23.2, playVmWhoosh);
                    checkVmSfx('s2_click_datum', absTime, 25.0, () => { triggerVmClick(); playVmClick(); });
                    checkVmSfx('s2_click_zondag', absTime, 28.0, () => { triggerVmClick(); playVmClick(); });
                    checkVmSfx('s2_click_voorganger', absTime, 30.5, () => { triggerVmClick(); playVmClick(); });
                    checkVmSfx('s2_chime', absTime, 38.0, playVmSuccess);

                    const dBox = document.getElementById('vmDatumBox');
                    const dTxt = document.getElementById('vmDatumTxt');
                    const kal = document.getElementById('vmKalenderCard');
                    const zPill = document.getElementById('vmZondagPill');
                    const vBox = document.getElementById('vmVoorgangerBox');
                    const vTxt = document.getElementById('vmVoorgangerTxt');
                    const pill = document.getElementById('vmDatumPill');

                    if (relTime < 2.0) {
                        moveVmCursor(30, 35);
                    } else if (relTime < 5.0) {
                        if (dBox) dBox.className = "bg-gray-800 border-2 border-blue-400 rounded-xl px-3 py-2 text-xs text-white flex items-center justify-between";
                        if (kal) kal.style.opacity = '1';
                        moveVmCursor(45, 65);
                    } else if (relTime < 7.5) {
                        if (zPill) zPill.className = "bg-blue-600 text-white font-bold rounded-lg py-1 shadow";
                        if (dTxt) dTxt.innerText = "Zondag 18 januari 2026";
                        if (kal) kal.style.opacity = '0';
                        moveVmCursor(70, 35);
                    } else {
                        if (zPill) zPill.className = "bg-blue-600 text-white font-bold rounded-lg py-1 shadow";
                        if (kal) kal.style.opacity = '0';
                        if (dTxt) dTxt.innerText = "Zondag 18 januari 2026";
                        if (vBox) vBox.className = "bg-gray-800 border-2 border-blue-400 rounded-xl px-3 py-2 text-xs text-white flex items-center";
                        
                        const full = "dominee Mark Bot";
                        const progress = Math.min(1, Math.max(0, (relTime - 7.5) / 4.0));
                        const chars = Math.floor(progress * full.length);
                        if (vTxt) vTxt.innerText = full.substring(0, chars);

                        for (let i = 1; i <= full.length; i++) {
                            checkVmSfx('s2_vm_type_' + i, absTime, 30.5 + i * 0.22, playVmType);
                        }

                        if (relTime >= 15.0) {
                            if (vBox) vBox.className = "bg-gray-800 border-2 border-emerald-500 rounded-xl px-3 py-2 text-xs text-white flex items-center";
                            if (pill) {
                                pill.className = "text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-400/30";
                                pill.innerText = "✓ Welkomstdia Klaar";
                            }
                        }
                    }
                }
            },
            {
                id: "liederen",
                title: "3. Liederen & Bijbel",
                start: 42.0,
                end: 75.0,
                render: function(c) {
                    c.innerHTML = `
                        <div class="w-full max-w-lg flex flex-col gap-3">
                            <div class="bg-gray-900/90 rounded-2xl p-4 border border-white/10 shadow-2xl flex flex-col gap-3">
                                <div class="text-xs font-bold text-gray-300 flex items-center justify-between">
                                    <span>🎵 1. Liederen Zoeken</span>
                                    <span class="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">Database: 6.000+ liederen</span>
                                </div>
                                <div id="vmLiedInputBox" class="bg-gray-800 border-2 border-transparent rounded-xl px-3.5 py-2 text-xs text-gray-400 flex items-center justify-between transition-all">
                                    <span id="vmLiedQuery">Zoek lied (bijv. 'wk 14', 'psalm 84', 'sela')...</span>
                                    <span>🔍</span>
                                </div>
                                <div id="vmLiedCard" class="bg-gray-800/90 p-3 rounded-xl border border-gray-700 opacity-0 transition-all duration-300 flex flex-col gap-2">
                                    <div class="flex justify-between items-center text-xs font-bold text-white">
                                        <span>Weerklank Lied 14 - Halleluja! Laat opklinken</span>
                                        <span class="text-[10px] text-blue-400 font-normal">4 coupletten</span>
                                    </div>
                                    <div class="flex items-center gap-1.5">
                                        <span class="text-[10px] text-gray-400">Kies verzen:</span>
                                        <span id="vmV1" class="px-2 py-0.5 rounded bg-gray-700 text-[10px] font-bold text-gray-300 transition-all">Vers 1</span>
                                        <span id="vmV2" class="px-2 py-0.5 rounded bg-gray-700 text-[10px] font-bold text-gray-300 transition-all">Vers 2</span>
                                        <span id="vmV3" class="px-2 py-0.5 rounded bg-gray-700 text-[10px] font-bold text-gray-300 transition-all">Vers 3</span>
                                        <span id="vmV4" class="px-2 py-0.5 rounded bg-gray-700 text-[10px] font-bold text-gray-300 transition-all">Vers 4</span>
                                    </div>
                                </div>
                            </div>
                            <div id="vmBijbelCard" class="bg-gray-900/90 rounded-2xl p-3 border border-white/10 opacity-0 transition-all duration-300 flex items-center justify-between shadow-lg">
                                <div class="flex items-center gap-2 text-xs font-bold text-white">
                                    <span>📖</span>
                                    <span>Schriftlezing: Johannes 3:1-16 (HSV)</span>
                                </div>
                                <span class="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold">16 verzen klaar</span>
                            </div>
                        </div>
                    `;
                },
                update: function(relTime, absTime) {
                    checkVmSfx('s3_whoosh', absTime, 42.2, playVmWhoosh);
                    checkVmSfx('s3_click_zoek', absTime, 49.0, () => { triggerVmClick(); playVmClick(); });
                    checkVmSfx('s3_song_found', absTime, 54.0, playVmSuccess);
                    checkVmSfx('s3_click_v1', absTime, 60.0, () => { triggerVmClick(); playVmClick(); });
                    checkVmSfx('s3_click_v2', absTime, 61.5, () => { triggerVmClick(); playVmClick(); });
                    checkVmSfx('s3_click_v4', absTime, 63.0, () => { triggerVmClick(); playVmClick(); });
                    checkVmSfx('s3_click_bijbel', absTime, 68.0, () => { triggerVmClick(); playVmClick(); });
                    checkVmSfx('s3_bible_chime', absTime, 72.5, playVmSuccess);

                    const zBox = document.getElementById('vmLiedInputBox');
                    const zTxt = document.getElementById('vmLiedQuery');
                    const card = document.getElementById('vmLiedCard');
                    const bCard = document.getElementById('vmBijbelCard');
                    const v1 = document.getElementById('vmV1');
                    const v2 = document.getElementById('vmV2');
                    const v4 = document.getElementById('vmV4');

                    if (relTime < 7.0) {
                        moveVmCursor(50, 35);
                    } else if (relTime < 12.0) {
                        if (zBox) zBox.className = "bg-gray-800 border-2 border-blue-400 rounded-xl px-3.5 py-2 text-xs text-white flex items-center justify-between";
                        const query = "wk 14";
                        const p = Math.min(1, (relTime - 7.0) / 2.5);
                        const chars = Math.floor(p * query.length);
                        if (zTxt) zTxt.innerText = query.substring(0, chars);
                        for (let i = 1; i <= query.length; i++) {
                            checkVmSfx('s3_vm_type_' + i, absTime, 49.0 + i * 0.35, playVmType);
                        }
                    } else if (relTime < 18.0) {
                        if (card) card.style.opacity = '1';
                        moveVmCursor(45, 50);
                    } else if (relTime < 25.0) {
                        if (card) card.style.opacity = '1';
                        if (relTime >= 18.0 && v1) v1.className = "px-2 py-0.5 rounded bg-blue-600 text-[10px] font-bold text-white shadow";
                        if (relTime >= 19.5 && v2) v2.className = "px-2 py-0.5 rounded bg-blue-600 text-[10px] font-bold text-white shadow";
                        if (relTime >= 21.0 && v4) v4.className = "px-2 py-0.5 rounded bg-blue-600 text-[10px] font-bold text-white shadow";
                        moveVmCursor(relTime < 19.5 ? 45 : (relTime < 21.0 ? 55 : 75), 50);
                    } else {
                        if (card) card.style.opacity = '1';
                        if (v1) v1.className = "px-2 py-0.5 rounded bg-blue-600 text-[10px] font-bold text-white shadow";
                        if (v2) v2.className = "px-2 py-0.5 rounded bg-blue-600 text-[10px] font-bold text-white shadow";
                        if (v4) v4.className = "px-2 py-0.5 rounded bg-blue-600 text-[10px] font-bold text-white shadow";
                        if (bCard) bCard.style.opacity = '1';
                        moveVmCursor(50, 75);
                    }
                }
            },
            {
                id: "import",
                title: "4. Slim Importeren (AI)",
                start: 75.0,
                end: 112.0,
                render: function(c) {
                    c.innerHTML = `
                        <div class="w-full max-w-lg bg-gray-900/95 rounded-2xl p-5 border border-white/10 shadow-2xl flex flex-col gap-3">
                            <div class="flex items-center justify-between border-b border-white/10 pb-2">
                                <div class="flex items-center gap-2">
                                    <span class="text-base">📋</span>
                                    <span class="text-xs font-bold text-gray-200">Plak Hele Mail van Predikant</span>
                                </div>
                                <span class="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-400/30">AI Herkenning</span>
                            </div>
                            <div class="bg-gray-950 p-3 rounded-xl border border-gray-800 text-[11px] font-mono text-gray-300 leading-relaxed max-h-28 overflow-hidden select-none">
                                "Beste koster, hierbij nog snel de liturgie voor morgen:<br/>
                                Votum en groet<br/>
                                Zingen: WK 14: 1, 2 en 4<br/>
                                Lezing: Johannes 3:1-16 (HSV)<br/>
                                Zingen na preek: Psalm 84: 1 en 3<br/>
                                Collecte voor de diaconie"
                            </div>
                            <div id="vmImportTags" class="flex flex-wrap gap-1.5 opacity-0 transition-opacity duration-300">
                                <span class="text-[10px] font-bold bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-lg border border-blue-400/30">🎵 Weerklank 14 (v1,2,4)</span>
                                <span class="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-400/30">📖 Johannes 3:1-16 (HSV)</span>
                                <span class="text-[10px] font-bold bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-lg border border-blue-400/30">🎵 Psalm 84 (v1,3)</span>
                            </div>
                            <button id="vmBtnImport" class="w-full py-2.5 rounded-xl bg-[#007AFF] text-white text-xs font-bold shadow-lg opacity-0 transition-all flex items-center justify-center gap-1.5">
                                <span>⚡</span> Direct Toevoegen aan Liturgie
                            </button>
                        </div>
                    `;
                },
                update: function(relTime, absTime) {
                    checkVmSfx('s4_whoosh', absTime, 75.2, playVmWhoosh);
                    checkVmSfx('s4_chuckle', absTime, 81.2, playVmChuckle);
                    checkVmSfx('s4_click_mail', absTime, 93.0, () => { triggerVmClick(); playVmClick(); });
                    checkVmSfx('s4_scan_whoosh', absTime, 99.0, playVmWhoosh);
                    checkVmSfx('s4_click_add', absTime, 108.0, () => { triggerVmClick(); playVmClick(); });
                    checkVmSfx('s4_add_chime', absTime, 109.0, playVmSuccess);

                    const tags = document.getElementById('vmImportTags');
                    const btn = document.getElementById('vmBtnImport');

                    if (relTime < 18.0) {
                        moveVmCursor(50, 45);
                    } else if (relTime < 24.0) {
                        moveVmCursor(50, 50);
                    } else if (relTime < 33.0) {
                        if (tags) tags.style.opacity = '1';
                        if (btn) btn.style.opacity = '1';
                        moveVmCursor(50, 70);
                    } else {
                        if (tags) tags.style.opacity = '1';
                        if (btn) {
                            btn.style.opacity = '1';
                            if (relTime >= 33.0) {
                                btn.className = "w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-lg scale-105 flex items-center justify-center gap-1.5";
                                btn.innerText = "✓ 4 items direct toegevoegd!";
                            }
                        }
                        moveVmCursor(50, 85);
                    }
                }
            },
            {
                id: "volgorde",
                title: "5. Volgorde & Resize",
                start: 112.0,
                end: 148.0,
                render: function(c) {
                    c.innerHTML = `
                        <div class="w-full max-w-2xl grid grid-cols-2 gap-4">
                            <!-- Linker kolom: volgorde lijst -->
                            <div class="bg-gray-900/90 rounded-2xl p-3 border border-white/10 flex flex-col gap-2">
                                <span class="text-xs font-bold text-gray-300">Volgorde &amp; Slepen</span>
                                <div class="flex flex-col gap-1.5 text-xs">
                                    <div class="p-2 bg-gray-800 rounded-lg text-gray-300">1. Welkom &amp; Groet</div>
                                    <div class="p-2 bg-gray-800 rounded-lg text-gray-300">2. Weerklank 14</div>
                                    <div id="vmItemCollecte" class="p-2 bg-blue-500/20 border border-blue-400/50 rounded-lg text-white font-bold transition-all duration-500 shadow">3. Collecte</div>
                                    <div class="p-2 bg-gray-800 rounded-lg text-gray-300">4. Schriftlezing &amp; Preek</div>
                                </div>
                            </div>
                            <!-- Rechter kolom: dia preview canvas -->
                            <div class="bg-gray-900/90 rounded-2xl p-3 border border-white/10 flex flex-col gap-2">
                                <div class="flex justify-between items-center text-xs font-bold text-gray-300">
                                    <span>Preview Scherm</span>
                                    <span class="text-[10px] text-blue-400">Tekstvak Resizen</span>
                                </div>
                                <div class="aspect-video bg-black rounded-xl p-3 relative flex items-center justify-center border border-gray-800 overflow-hidden">
                                    <div id="vmSlideBox" class="border-2 border-transparent bg-white/5 p-2 rounded-lg relative transition-all duration-300 flex items-center justify-center text-center">
                                        <span id="vmSlideTxt" class="text-[11px] font-bold text-white">Psalm 84 : 1</span>
                                        <!-- 4 hoek resize handles -->
                                        <div id="vmHtl" class="absolute -top-1 -left-1 w-2.5 h-2.5 bg-[#007AFF] rounded-full opacity-0"></div>
                                        <div id="vmHtr" class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#007AFF] rounded-full opacity-0"></div>
                                        <div id="vmHbl" class="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-[#007AFF] rounded-full opacity-0"></div>
                                        <div id="vmHbr" class="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-[#007AFF] rounded-full opacity-0"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                },
                update: function(relTime, absTime) {
                    checkVmSfx('s5_whoosh', absTime, 112.2, playVmWhoosh);
                    checkVmSfx('s5_click_grab', absTime, 121.0, () => { triggerVmClick(); playVmClick(); });
                    checkVmSfx('s5_drag_whoosh', absTime, 123.0, playVmWhoosh);
                    checkVmSfx('s5_drop_click', absTime, 125.0, () => { triggerVmClick(); playVmClick(); });
                    checkVmSfx('s5_click_textbox', absTime, 134.0, () => { triggerVmClick(); playVmClick(); });
                    checkVmSfx('s5_click_corner', absTime, 137.0, () => { triggerVmClick(); playVmClick(); });
                    checkVmSfx('s5_resize_chime', absTime, 144.0, playVmSuccess);

                    const dragCard = document.getElementById('vmItemCollecte');
                    const sBox = document.getElementById('vmSlideBox');
                    const sTxt = document.getElementById('vmSlideTxt');
                    const hTL = document.getElementById('vmHtl');
                    const hTR = document.getElementById('vmHtr');
                    const hBL = document.getElementById('vmHbl');
                    const hBR = document.getElementById('vmHbr');

                    if (relTime < 9.0) {
                        moveVmCursor(25, 42);
                    } else if (relTime < 13.0) {
                        moveVmCursor(25, 65);
                        if (dragCard) {
                            dragCard.style.transform = "translateY(42px)";
                            if (relTime >= 12.0) {
                                dragCard.className = "p-2 bg-emerald-600/30 border border-emerald-500 rounded-lg text-emerald-200 font-bold shadow";
                                dragCard.innerText = "5. Collecte (Na de preek!) ✓";
                            }
                        }
                    } else if (relTime < 22.0) {
                        moveVmCursor(70, 48);
                        if (dragCard) dragCard.style.transform = "translateY(42px)";
                    } else if (relTime < 25.0) {
                        moveVmCursor(70, 48);
                        if (sBox) sBox.className = "border-2 border-[#007AFF] bg-blue-500/15 p-2 rounded-lg relative transition-all duration-300 flex items-center justify-center text-center";
                        [hTL, hTR, hBL, hBR].forEach(h => { if (h) h.style.opacity = '1'; });
                    } else {
                        moveVmCursor(84, 65);
                        if (sBox) {
                            sBox.className = "border-2 border-[#007AFF] bg-blue-500/15 p-2 rounded-lg relative transition-all duration-500 flex items-center justify-center text-center shadow-lg";
                            sBox.style.width = "92%";
                            sBox.style.height = "80%";
                        }
                        if (sTxt) {
                            sTxt.innerHTML = "Psalm 84 : 1<br/><span class='text-[9px] text-blue-300 font-normal'>- Versleepbaar &amp; Breder kader</span>";
                        }
                        [hTL, hTR, hBL, hBR].forEach(h => { if (h) h.style.opacity = '1'; });
                    }
                }
            },
            {
                id: "extras",
                title: "6. Meelezen & Tikkie",
                start: 148.0,
                end: 170.0,
                render: function(c) {
                    c.innerHTML = `
                        <div class="w-full max-w-lg grid grid-cols-2 gap-4">
                            <div id="vmCardTikkie" class="bg-gray-900/90 p-4 rounded-2xl border border-white/10 flex flex-col items-center text-center gap-2 transition-all">
                                <span class="text-2xl">📱</span>
                                <span class="text-xs font-bold text-white">Tikkie QR Collecte</span>
                                <span class="text-[10px] text-gray-400">Automatische dia met QR code</span>
                                <span id="vmTikkieBadge" class="opacity-0 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-400/30 transition-opacity">✓ Toegevoegd als Dia</span>
                            </div>
                            <div id="vmCardMeelees" class="bg-gray-900/90 p-4 rounded-2xl border border-white/10 flex flex-col items-center text-center gap-2 transition-all">
                                <span class="text-2xl">📖</span>
                                <span class="text-xs font-bold text-white">Live Meeleesversie</span>
                                <span class="text-[10px] text-gray-400">Voor slechthorenden &amp; ouderen</span>
                                <span id="vmMeeleesBadge" class="opacity-0 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold border border-blue-400/30 transition-opacity">✓ Live Synchroon</span>
                            </div>
                        </div>
                    `;
                },
                update: function(relTime, absTime) {
                    checkVmSfx('s6_whoosh', absTime, 148.2, playVmWhoosh);
                    checkVmSfx('s6_click_tikkie', absTime, 152.0, () => { triggerVmClick(); playVmClick(); });
                    checkVmSfx('s6_click_meelees', absTime, 156.0, () => { triggerVmClick(); playVmClick(); });
                    checkVmSfx('s6_chime', absTime, 166.0, playVmSuccess);

                    const cT = document.getElementById('vmCardTikkie');
                    const cM = document.getElementById('vmCardMeelees');
                    const bT = document.getElementById('vmTikkieBadge');
                    const bM = document.getElementById('vmMeeleesBadge');

                    if (relTime < 4.0) {
                        moveVmCursor(35, 52);
                    } else if (relTime < 8.0) {
                        moveVmCursor(35, 52);
                        if (cT) cT.className = "bg-gray-800 p-4 rounded-2xl border-2 border-emerald-500 flex flex-col items-center text-center gap-2 scale-105 transition-all shadow-lg";
                        if (bT) bT.style.opacity = '1';
                    } else {
                        moveVmCursor(68, 52);
                        if (cT) cT.className = "bg-gray-800 p-4 rounded-2xl border-2 border-emerald-500 flex flex-col items-center text-center gap-2 transition-all";
                        if (bT) bT.style.opacity = '1';
                        if (cM) cM.className = "bg-gray-800 p-4 rounded-2xl border-2 border-[#007AFF] flex flex-col items-center text-center gap-2 scale-105 transition-all shadow-lg";
                        if (bM) bM.style.opacity = '1';
                    }
                }
            },
            {
                id: "export",
                title: "7. Exporteer PowerPoint",
                start: 170.0,
                end: 197.0,
                render: function(c) {
                    c.innerHTML = `
                        <div class="w-full max-w-md bg-gray-900/95 rounded-2xl p-5 border border-white/10 shadow-2xl flex flex-col gap-3">
                            <div class="flex items-center justify-between border-b border-white/10 pb-2">
                                <span class="text-xs font-bold text-gray-200">Exporteer PowerPoint</span>
                                <span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-400/30">16:9 Breedbeeld</span>
                            </div>
                            <div id="vmExportModal" class="bg-gray-800 p-3 rounded-xl border border-gray-700 opacity-0 transition-all duration-300 flex flex-col gap-2">
                                <span class="text-[11px] font-bold text-white">Welkomstdia Aanpassen (Optioneel)</span>
                                <div class="text-[10px] text-gray-400">✓ Titel aanpassen &nbsp; ✓ Liednummers instellen</div>
                            </div>
                            <div id="vmDownloadBadge" class="opacity-0 transition-opacity duration-300 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-center gap-2">
                                <span>📥</span> Liturgie_18-01-2026.pptx gedownload!
                            </div>
                            <button id="vmBtnExport" class="w-full py-2.5 rounded-xl bg-[#007AFF] text-white text-xs font-bold shadow-lg flex items-center justify-center gap-1.5">
                                <span>📊</span> Exporteer PowerPoint
                            </button>
                        </div>
                    `;
                },
                update: function(relTime, absTime) {
                    checkVmSfx('s7_whoosh', absTime, 170.2, playVmWhoosh);
                    checkVmSfx('s7_click_export', absTime, 174.5, () => { triggerVmClick(); playVmClick(); });
                    checkVmSfx('s7_click_modal', absTime, 182.0, () => { triggerVmClick(); playVmClick(); });
                    checkVmSfx('s7_click_final', absTime, 187.0, () => { triggerVmClick(); playVmClick(); });
                    checkVmSfx('s7_dl_chime', absTime, 193.0, playVmSuccess);

                    const modal = document.getElementById('vmExportModal');
                    const badge = document.getElementById('vmDownloadBadge');

                    if (relTime < 4.5) {
                        moveVmCursor(50, 48);
                    } else if (relTime < 17.0) {
                        if (modal) modal.style.opacity = '1';
                        moveVmCursor(50, 68);
                    } else {
                        if (modal) modal.style.opacity = '0.4';
                        if (badge) badge.style.opacity = '1';
                        moveVmCursor(50, 80);
                    }
                }
            },
            {
                id: "obs",
                title: "8. OBS Live Regie",
                start: 197.0,
                end: 230.0,
                render: function(c) {
                    c.innerHTML = `
                        <div class="w-full max-w-lg bg-gray-900/95 rounded-2xl p-5 border border-white/10 shadow-2xl flex flex-col gap-3">
                            <div class="flex items-center justify-between border-b border-white/10 pb-2">
                                <span class="text-xs font-bold text-gray-200">🎥 OBS &amp; Beamer Regie (Live Zonder PowerPoint)</span>
                                <span class="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-400/30">Browser Live</span>
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <div class="bg-gray-950 p-2.5 rounded-xl border border-gray-800 flex flex-col gap-1.5">
                                    <span class="text-[10px] text-gray-400 font-bold">Beamer Output</span>
                                    <div id="vmObsBeamerInner" class="aspect-video bg-gray-950 rounded-lg flex items-center justify-center text-[10px] text-white font-bold p-1 border border-gray-800">
                                        Lied 14 : Vers 1
                                    </div>
                                    <span class="text-[9px] text-gray-500 text-center">Spatiebalk = Volgende dia · Toets B = Zwart</span>
                                </div>
                                <div class="bg-gray-950 p-2.5 rounded-xl border border-gray-800 flex flex-col gap-1.5">
                                    <span class="text-[10px] text-gray-400 font-bold">Draadloze Mobiele Remote</span>
                                    <div class="aspect-video bg-gray-900 rounded-lg flex flex-col items-center justify-center p-1.5 gap-1 border border-gray-700">
                                        <span class="text-[9px] text-gray-300">Pincode: 1234</span>
                                        <button id="vmRemoteBtnNext" class="bg-blue-600 text-white font-bold px-2 py-0.5 rounded text-[10px] shadow">Volgende Dia</button>
                                    </div>
                                    <span class="text-[9px] text-emerald-400 text-center">✓ Verbonden met telefoon</span>
                                </div>
                            </div>
                        </div>
                    `;
                },
                update: function(relTime, absTime) {
                    checkVmSfx('s8_whoosh', absTime, 197.2, playVmWhoosh);
                    checkVmSfx('s8_click_info', absTime, 204.0, () => { triggerVmClick(); playVmClick(); });
                    checkVmSfx('s8_key_space', absTime, 212.0, () => { triggerVmClick(); playVmClick(); });
                    checkVmSfx('s8_key_b', absTime, 215.0, () => { triggerVmClick(); playVmClick(); });
                    checkVmSfx('s8_key_b_off', absTime, 218.0, () => { triggerVmClick(); playVmClick(); });
                    checkVmSfx('s8_remote_click', absTime, 221.0, () => { triggerVmClick(); playVmClick(); });
                    checkVmSfx('s8_chime', absTime, 226.0, playVmSuccess);

                    const bInner = document.getElementById('vmObsBeamerInner');
                    const rNext = document.getElementById('vmRemoteBtnNext');

                    if (relTime < 15.0) {
                        moveVmCursor(50, 50);
                    } else if (relTime < 24.0) {
                        moveVmCursor(20, 58);
                        if (relTime >= 18.0 && relTime <= 21.0) {
                            if (bInner) {
                                bInner.className = "aspect-video bg-black rounded-lg flex items-center justify-center text-[10px] text-red-400 font-bold p-1 border border-red-900";
                                bInner.innerText = "ZWART SCHERM (Toets B)";
                            }
                        } else {
                            if (bInner) {
                                bInner.className = "aspect-video bg-gray-950 rounded-lg flex items-center justify-center text-[10px] text-white font-bold p-1 border border-gray-800";
                                bInner.innerText = "Lied 14 : Vers 2";
                            }
                        }
                    } else {
                        moveVmCursor(82, 58);
                        if (bInner) {
                            bInner.className = "aspect-video bg-gray-950 rounded-lg flex items-center justify-center text-[10px] text-emerald-300 font-bold p-1 border border-emerald-700";
                            bInner.innerText = "Lied 14 : Vers 3 (via Mobiel)";
                        }
                        if (rNext) {
                            rNext.className = "bg-emerald-500 text-black font-bold px-1.5 py-0.5 rounded scale-105 shadow";
                        }
                    }
                }
            },
            {
                id: "outro",
                title: "9. Afsluiting & Zegen",
                start: 230.0,
                end: 246.0,
                render: function(c) {
                    c.innerHTML = `
                        <div class="flex flex-col items-center justify-center text-center gap-3.5 max-w-md">
                            <div class="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 via-blue-500 to-indigo-500 flex items-center justify-center text-3xl shadow-[0_12px_45px_rgba(52,199,89,0.5)]">
                                ✨
                            </div>
                            <h2 class="text-xl md:text-3xl font-black text-white tracking-tight">Veel zegen met de voorbereiding!</h2>
                            <p class="text-xs text-gray-300">Liturgie Assistent Pro werkt direct op computer, tablet &amp; smartphone.</p>
                            <button onclick="sluitVideoUitleg()" class="mt-1 px-5 py-2 rounded-2xl bg-[#007AFF] text-white text-xs font-bold shadow-lg hover:bg-blue-600 active:scale-95 transition-all">
                                Direct aan de slag in de app →
                            </button>
                        </div>
                    `;
                },
                update: function(relTime, absTime) {
                    checkVmSfx('s9_whoosh', absTime, 230.2, playVmWhoosh);
                    checkVmSfx('s9_final_chime', absTime, 241.0, playVmSuccess);
                    moveVmCursor(50, 75);
                }
            }
        ];

        function checkVmSfx(key, currentTime, triggerTime, fn) {
            if (!vmTriggeredSfx.has(key) && currentTime >= triggerTime && currentTime <= triggerTime + 1.2) {
                vmTriggeredSfx.add(key);
                fn();
            }
        }

        function moveVmCursor(x, y) {
            const c = document.getElementById('videoModalCursor');
            if (!c) return;
            c.style.opacity = '1';
            c.style.left = x + '%';
            c.style.top = y + '%';
        }

        function triggerVmClick() {
            const c = document.getElementById('videoModalCursor');
            const r = document.getElementById('videoModalRipple');
            if (!c || !r) return;
            r.style.left = c.style.left;
            r.style.top = c.style.top;
            r.style.transform = 'scale(1.7)';
            r.style.opacity = '1';
            setTimeout(() => {
                r.style.transform = 'scale(0)';
                r.style.opacity = '0';
            }, 200);
        }

        function getVmSceneForTime(t) {
            for (let i = 0; i < vmScenes.length; i++) {
                if (t >= vmScenes[i].start && t < vmScenes[i].end) return i;
            }
            return vmScenes.length - 1;
        }

        function syncVmFrame() {
            if (!vmIsPlaying) return;
            const a = document.getElementById('videoModalAudio');
            const now = performance.now();
            const delta = vmLastPerfTime ? (now - vmLastPerfTime) / 1000 : 0;
            vmLastPerfTime = now;

            let t = 0;
            if (a && !a.paused && !a.ended && !isNaN(a.currentTime) && a.currentTime > 0) {
                t = a.currentTime;
                vmVirtualTime = t;
            } else {
                vmVirtualTime += delta;
                t = vmVirtualTime;
                if (a && a.paused && !a.ended && a.readyState >= 2 && !a.error) {
                    a.play().catch(() => {});
                }
            }

            const pBar = document.getElementById('videoModalProgressBar');
            if (pBar) pBar.style.width = Math.min(100, Math.max(0, (t / TOTAL_AUDIO_SEC) * 100)) + '%';

            const timeLbl = document.getElementById('videoModalTimeCurrent');
            if (timeLbl) {
                const m = Math.floor(t / 60);
                const s = Math.floor(t % 60);
                timeLbl.innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
            }

            const totalLbl = document.getElementById('videoModalTimeTotal');
            if (totalLbl) {
                const dur = (a && !isNaN(a.duration) && a.duration > 10) ? a.duration : TOTAL_AUDIO_SEC;
                const tm = Math.floor(dur / 60);
                const ts = Math.floor(dur % 60);
                totalLbl.innerText = `${tm}:${ts < 10 ? '0' : ''}${ts}`;
            }

            const newIdx = getVmSceneForTime(t);
            if (newIdx !== vmCurrentIdx) {
                vmCurrentIdx = newIdx;
                const s = vmScenes[vmCurrentIdx];
                const container = document.getElementById('videoModalSceneContainer');
                const title = document.getElementById('videoModalSceneTitle');
                if (title) title.innerText = s.title;
                if (container && s.render) s.render(container);
            }

            const s = vmScenes[vmCurrentIdx];
            if (s && s.update) s.update(t - s.start, t);

            if (t >= TOTAL_AUDIO_SEC - 0.2 || (a && a.ended)) {
                pauseVideoUitleg();
                return;
            }

            requestAnimationFrame(syncVmFrame);
        }

        let _voiceoverBlobUrl = null;
        function getVoiceoverAudioUrl() {
            const href = window.location.href.split('?')[0].split('#')[0];
            if (href.startsWith('file://')) {
                const lastSlash = href.lastIndexOf('/');
                return href.substring(0, lastSlash + 1) + 'uitleg_voiceover.mp3';
            }
            try {
                const u = new URL(href);
                let path = u.pathname;
                if (path.endsWith('.html')) {
                    path = path.substring(0, path.lastIndexOf('/') + 1);
                } else if (!path.endsWith('/')) {
                    path = path + '/';
                }
                return u.origin + path + 'uitleg_voiceover.mp3';
            } catch(e) {
                return 'uitleg_voiceover.mp3';
            }
        }

        async function laadVoiceoverAudio() {
            const a = document.getElementById('videoModalAudio');
            if (!a) return;
            const targetUrl = getVoiceoverAudioUrl();

            // Zorg dat a.src direct het gegarandeerd kloppende absolute pad gebruikt
            if (!a.src || (a.src.endsWith('/uitleg_voiceover.mp3') && !a.src.includes('/Kerkapp/'))) {
                a.src = targetUrl;
            }

            if (_voiceoverBlobUrl) {
                if (a.src !== _voiceoverBlobUrl) {
                    const cur = a.currentTime || 0;
                    const playing = !a.paused && vmIsPlaying;
                    a.src = _voiceoverBlobUrl;
                    try { a.currentTime = cur; } catch(e) {}
                    if (playing) a.play().catch(() => {});
                }
                return;
            }

            // Haal audio op via Blob buffer: omzeilt Range/206 header & Service Worker cache issues!
            try {
                const res = await fetch(targetUrl);
                if (res.ok) {
                    const blob = await res.blob();
                    _voiceoverBlobUrl = URL.createObjectURL(blob);
                    const cur = a.currentTime || 0;
                    const playing = !a.paused && vmIsPlaying;
                    a.src = _voiceoverBlobUrl;
                    try { a.currentTime = cur; } catch(e) {}
                    if (playing) a.play().catch(() => {});
                    console.log("✓ Voice-over audio succesvol gebufferd via Blob.");
                }
            } catch(err) {
                console.warn("Voiceover blob fetch waarschuwing:", err);
            }
        }

        window.openVideoUitlegModal = function(autoPlay = false) {
            const modal = document.getElementById('videoUitlegModal');
            if (!modal) return;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            laadVoiceoverAudio();

            const chk = document.getElementById('videoModalNietMeerTonenCheckbox');
            if (chk) {
                chk.checked = !!localStorage.getItem('liturgieAssistentVideoNietAutomatisch');
            }

            // Render scene 0
            vmCurrentIdx = 0;
            const s0 = vmScenes[0];
            const container = document.getElementById('videoModalSceneContainer');
            const title = document.getElementById('videoModalSceneTitle');
            if (title) title.innerText = s0.title;
            if (container && s0.render) s0.render(container);
            if (s0.update) s0.update(0, 0);

            vmVirtualTime = 0;
            vmLastPerfTime = 0;
            const a = document.getElementById('videoModalAudio');
            if (a) {
                try { a.currentTime = 0; } catch(err) {}
                vmTriggeredSfx.clear();
            }

            if (autoPlay) {
                startVideoUitlegPlay();
            } else {
                // Probeer browser autoplay
                getVideoAudioCtx();
                if (a) {
                    const promise = a.play();
                    if (promise !== undefined) {
                        promise.then(() => {
                            // Autoplay gelukt!
                            startVideoUitlegPlay();
                        }).catch(() => {
                            // Browser blokkeert autoplay zonder click: toon play overlay
                            pauseVideoUitleg();
                        });
                    }
                }
            }
        };

        window.isVideoFullscreen = function() {
            const dialog = document.getElementById('videoModalDialog');
            return !!(
                document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement ||
                dialog?.classList.contains('video-modal-fullscreen-active')
            );
        };

        function updateFullscreenButtonsUI(isFs) {
            const headerBtn = document.getElementById('videoModalHeaderFullscreenBtn');
            const iconSpan = document.getElementById('videoModalFullscreenIcon');
            const labelSpan = document.getElementById('videoModalFullscreenLabel');

            const expandSvg = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>`;
            const compressSvg = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 14h6m0 0v6m0-6L3 21m17-7h-6m0 0v6m0-6l7 7M10 4v6m0 0H4m6 0L3 3m10 7h6m-6 0V4m0 6l7-7"/></svg>`;
            const smallExpandSvg = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>`;
            const smallCompressSvg = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 14h6m0 0v6m0-6L3 21m17-7h-6m0 0v6m0-6l7 7M10 4v6m0 0H4m6 0L3 3m10 7h6m-6 0V4m0 6l7-7"/></svg>`;

            if (headerBtn) {
                headerBtn.innerHTML = isFs ? compressSvg : expandSvg;
                headerBtn.title = isFs ? "Verlaat volledig scherm (Esc of f)" : "Volledig scherm (f)";
            }
            if (iconSpan) {
                iconSpan.innerHTML = isFs ? smallCompressSvg : smallExpandSvg;
            }
            if (labelSpan) {
                labelSpan.textContent = isFs ? "Venster" : "Volledig scherm";
            }
        }

        window.toggleVideoFullscreen = function() {
            const dialog = document.getElementById('videoModalDialog');
            const modal = document.getElementById('videoUitlegModal');
            if (!dialog || !modal) return;

            const isFs = isVideoFullscreen();

            if (isFs) {
                // Verlaat volledig scherm
                if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
                    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
                    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                    else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
                    else if (document.msExitFullscreen) document.msExitFullscreen();
                }
                dialog.classList.remove('video-modal-fullscreen-active');
                modal.classList.remove('video-modal-backdrop-fullscreen');
                updateFullscreenButtonsUI(false);
            } else {
                // Open volledig scherm
                const req = dialog.requestFullscreen || dialog.webkitRequestFullscreen || dialog.mozRequestFullScreen || dialog.msRequestFullscreen;
                if (req) {
                    try {
                        const p = req.call(dialog);
                        if (p && p.catch) {
                            p.catch(() => {
                                // Fallback als browser native fullscreen weigert (bv iframe of permissie)
                                dialog.classList.add('video-modal-fullscreen-active');
                                modal.classList.add('video-modal-backdrop-fullscreen');
                                updateFullscreenButtonsUI(true);
                            });
                        }
                    } catch (err) {
                        dialog.classList.add('video-modal-fullscreen-active');
                        modal.classList.add('video-modal-backdrop-fullscreen');
                        updateFullscreenButtonsUI(true);
                    }
                } else {
                    dialog.classList.add('video-modal-fullscreen-active');
                    modal.classList.add('video-modal-backdrop-fullscreen');
                    updateFullscreenButtonsUI(true);
                }
            }
        };

        const handleNativeFullscreenChange = () => {
            const isNativeFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
            const dialog = document.getElementById('videoModalDialog');
            const modal = document.getElementById('videoUitlegModal');
            if (!isNativeFs) {
                dialog?.classList.remove('video-modal-fullscreen-active');
                modal?.classList.remove('video-modal-backdrop-fullscreen');
                updateFullscreenButtonsUI(false);
            } else {
                updateFullscreenButtonsUI(true);
            }
        };
        document.addEventListener('fullscreenchange', handleNativeFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleNativeFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleNativeFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleNativeFullscreenChange);

        window.sluitVideoUitleg = function() {
            if (isVideoFullscreen()) {
                if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                const dialog = document.getElementById('videoModalDialog');
                const modal = document.getElementById('videoUitlegModal');
                dialog?.classList.remove('video-modal-fullscreen-active');
                modal?.classList.remove('video-modal-backdrop-fullscreen');
                updateFullscreenButtonsUI(false);
            }
            pauseVideoUitleg();
            const modal = document.getElementById('videoUitlegModal');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        };

        window.startVideoUitlegPlay = function() {
            getVideoAudioCtx();
            vmIsPlaying = true;
            vmLastPerfTime = performance.now();
            laadVoiceoverAudio();
            const overlay = document.getElementById('videoModalPlayOverlay');
            if (overlay) {
                overlay.style.opacity = '0';
                overlay.style.pointerEvents = 'none';
            }
            const icon = document.getElementById('videoModalPlayIcon');
            if (icon) icon.innerText = '⏸';

            const a = document.getElementById('videoModalAudio');
            if (a) {
                a.muted = false;
                if (!a.volume || a.volume === 0) a.volume = 1.0;
                if (a.ended || a.currentTime >= TOTAL_AUDIO_SEC - 0.2 || vmVirtualTime >= TOTAL_AUDIO_SEC - 0.2) {
                    try { a.currentTime = 0; } catch(err) {}
                    vmVirtualTime = 0;
                    vmTriggeredSfx.clear();
                }
                const p = a.play();
                if (p !== undefined) {
                    p.catch(err => {
                        console.warn("Audio play prevented:", err);
                        // Geen probleem: de video speelt visueel direct door via virtualTime!
                    });
                }
            }
            requestAnimationFrame(syncVmFrame);
        };

        window.toggleVideoVoiceoverMute = function() {
            const a = document.getElementById('videoModalAudio');
            if (!a) return;
            a.muted = !a.muted;
            if (!a.muted && a.volume === 0) a.volume = 1.0;
            const icon = document.getElementById('videoModalMuteIcon');
            const label = document.getElementById('videoModalMuteLabel');
            if (icon) icon.innerText = a.muted ? "🔇" : "🔊";
            if (label) label.innerText = a.muted ? "Gedempt" : "Stem";
            if (window.toonToast) window.toonToast(a.muted ? "Voice-over gedempt" : "Voice-over aan", "info");
        };

        window.vmLaadCustomAudio = function(event) {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            const a = document.getElementById('videoModalAudio');
            if (a) {
                a.src = URL.createObjectURL(file);
                a.muted = false;
                a.volume = 1.0;
                a.currentTime = 0;
                vmVirtualTime = 0;
                vmLastPerfTime = performance.now();
                vmTriggeredSfx.clear();
                a.load();
                const notice = document.getElementById('videoModalAudioNotice');
                if (notice) notice.classList.add('hidden');
                if (window.toonToast) window.toonToast("Audio succesvol geladen!", "success");
                startVideoUitlegPlay();
            }
        };

        window.pauseVideoUitleg = function() {
            vmIsPlaying = false;
            vmLastPerfTime = 0;
            const overlay = document.getElementById('videoModalPlayOverlay');
            if (overlay) {
                overlay.style.opacity = '1';
                overlay.style.pointerEvents = 'auto';
            }
            const icon = document.getElementById('videoModalPlayIcon');
            if (icon) icon.innerText = '▶';

            const a = document.getElementById('videoModalAudio');
            if (a) a.pause();
        };

        window.toggleVideoUitlegPlay = function() {
            if (vmIsPlaying) pauseVideoUitleg();
            else startVideoUitlegPlay();
        };

        window.seekVideoModal = function(e) {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const sec = ratio * TOTAL_AUDIO_SEC;
            vmVirtualTime = sec;
            vmLastPerfTime = performance.now();
            const a = document.getElementById('videoModalAudio');
            if (a) {
                try { a.currentTime = sec; } catch(err) {}
                vmTriggeredSfx.clear();
            }
            syncVmFrame();
            if (!vmIsPlaying) startVideoUitlegPlay();
        };

        window.nextVideoModalChapter = function() {
            if (vmCurrentIdx < vmScenes.length - 1) {
                const targetSec = vmScenes[vmCurrentIdx + 1].start;
                vmVirtualTime = targetSec;
                vmLastPerfTime = performance.now();
                const a = document.getElementById('videoModalAudio');
                if (a) { try { a.currentTime = targetSec; } catch(err) {} vmTriggeredSfx.clear(); }
                syncVmFrame();
                if (!vmIsPlaying) startVideoUitlegPlay();
            }
        };

        window.prevVideoModalChapter = function() {
            if (vmCurrentIdx > 0) {
                const targetSec = vmScenes[vmCurrentIdx - 1].start;
                vmVirtualTime = targetSec;
                vmLastPerfTime = performance.now();
                const a = document.getElementById('videoModalAudio');
                if (a) { try { a.currentTime = targetSec; } catch(err) {} vmTriggeredSfx.clear(); }
                syncVmFrame();
                if (!vmIsPlaying) startVideoUitlegPlay();
            }
        };

        window.toggleVideoUitlegSfx = function() {
            videoSfxEnabled = !videoSfxEnabled;
            const icon = document.getElementById('videoModalSfxIcon');
            const txt = document.getElementById('videoModalSfxText');
            if (icon) icon.innerText = videoSfxEnabled ? "🔊" : "🔇";
            if (txt) txt.innerText = videoSfxEnabled ? "FX: Aan" : "FX: Uit";
        };

        window.toggleVideoNietMeerTonen = function(checked) {
            try {
                if (checked) {
                    localStorage.setItem('liturgieAssistentVideoNietAutomatisch', '1');
                } else {
                    localStorage.removeItem('liturgieAssistentVideoNietAutomatisch');
                }
            } catch(e) {}
        };

        // Keyboard navigation for video modal
        document.addEventListener('keydown', (e) => {
            const modal = document.getElementById('videoUitlegModal');
            if (!modal || modal.classList.contains('hidden')) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                if (isVideoFullscreen()) {
                    toggleVideoFullscreen();
                } else {
                    sluitVideoUitleg();
                }
            } else if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                toggleVideoUitlegPlay();
            } else if (e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                toggleVideoFullscreen();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                nextVideoModalChapter();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                prevVideoModalChapter();
            }
        });

        // Zorg dat de audio correct initialiseert en eventuele laadfouten opvangt
        setTimeout(() => {
            laadVoiceoverAudio();
            const a = document.getElementById('videoModalAudio');
            if (a) {
                a.addEventListener('error', () => {
                    console.warn("Fout bij laden van video voiceover:", a.error);
                    laadVoiceoverAudio();
                    const notice = document.getElementById('videoModalAudioNotice');
                    if (notice) notice.classList.remove('hidden');
                });
                a.addEventListener('loadedmetadata', () => {
                    const totalLbl = document.getElementById('videoModalTimeTotal');
                    if (totalLbl && a.duration && !isNaN(a.duration) && a.duration > 10) {
                        const tm = Math.floor(a.duration / 60);
                        const ts = Math.floor(a.duration % 60);
                        totalLbl.innerText = `${tm}:${ts < 10 ? '0' : ''}${ts}`;
                    }
                });
            }
        }, 150);
    })();
    