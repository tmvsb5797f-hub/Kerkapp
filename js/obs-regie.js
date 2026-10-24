/**
 * =========================================================================
 * KERKAPP - OBS STUDIO & CO-PILOT LIVE REGIE MODULE (v3.0)
 * =========================================================================
 * Bevat:
 * - OBS WebSocket v5 Client & Tweeweg Status Synchronisatie
 * - Co-pilot Spraakherkenning & Pacing Engine voor Schriftlezingen & Zang
 * - Live Beamer-, Stream-, Dock- en Mobiele Remote Klikker Weergaven
 * =========================================================================
 */

    // ==========================================
    // --- OBS & BEAMER LIVE REGIE (TESTMODUS) ---
    // ==========================================
    const OBS_LIVE_CHANNEL_NAME = 'kerkapp_obs_live_sync_v1';
    let _obsBroadcastChannel = null;
    try {
        if ('BroadcastChannel' in window) {
            _obsBroadcastChannel = new BroadcastChannel(OBS_LIVE_CHANNEL_NAME);
        }
    } catch(e) {}

    // Berekent de geordende dialijst vanuit de liturgie
    function bouwwVolledigeDiaLijst() {
        const slides = [];
        const datum = document.getElementById('datumInput')?.value || '';
        const voorganger = document.getElementById('voorgangerInput')?.value || '';
        const gemeente = (window.getActieveGemeente ? window.getActieveGemeente() : "Bethelkerk Maassluis");
        const actieveItems = (typeof liturgieVolgorde !== 'undefined') ? liturgieVolgorde : [];

        // 1. Welkomstdia
        const zangLijst = actieveItems.filter(it => it.type === 'Zang').map(it => {
            return (it.basisTitel || it.titel || '').split(' - ')[0].trim();
        });

        slides.push({
            id: 'welkom-0',
            type: 'Welkom',
            titel: 'Welkom',
            gemeente: gemeente,
            datum: datum,
            voorganger: voorganger,
            zangLijst: zangLijst,
            regels: []
        });

        // 2. Liturgie items
        actieveItems.forEach((item, itemIdx) => {
            const basisTitel = (item.basisTitel || item.titel || '').split(' - ')[0].trim();
            if (item.type === 'Zang') {
                const subSlides = (typeof berekenSubSlidesVoorItem === 'function') 
                    ? berekenSubSlidesVoorItem(item) 
                    : [{ regels: (item.tekst || '').split('\n').filter(r => r.trim()), fontSize: 40 }];
                
                subSlides.forEach((sub, subIdx) => {
                    const subtitel = (subSlides.length > 1) 
                        ? `${item.titel} (${subIdx + 1}/${subSlides.length})` 
                        : item.titel;
                    slides.push({
                        id: `item-${itemIdx}-sub-${subIdx}`,
                        itemIndex: itemIdx,
                        type: 'Zang',
                        titel: sub.diaTitel || item.titel,
                        basisTitel: basisTitel,
                        subtitel: sub.diaTitel || subtitel,
                        regels: sub.regels || [],
                        fontSize: sub.fontSize || 40,
                        align: (window.getDiaAlign ? window.getDiaAlign(item, subIdx) : (item.align || 'left')),
                        tekstX: item.tekstX,
                        tekstY: item.tekstY,
                        tekstW: item.tekstW,
                        tekstH: item.tekstH,
                        bold: item.bold
                    });
                });
            } else if (item.type === 'Schriftlezing') {
                const subSlides = (typeof berekenSubSlidesVoorItem === 'function') 
                    ? berekenSubSlidesVoorItem(item) 
                    : [{ regels: (item.tekst || '').split('\n').filter(r => r.trim()), fontSize: 36 }];
                
                subSlides.forEach((sub, subIdx) => {
                    const subtitel = (subSlides.length > 1) 
                        ? `${item.titel} (${subIdx + 1}/${subSlides.length})` 
                        : item.titel;
                    slides.push({
                        id: `item-${itemIdx}-sub-${subIdx}`,
                        itemIndex: itemIdx,
                        type: 'Schriftlezing',
                        titel: item.titel,
                        basisTitel: basisTitel,
                        subtitel: subtitel,
                        regels: sub.regels || [],
                        fontSize: sub.fontSize || 36,
                        align: (window.getDiaAlign ? window.getDiaAlign(item, subIdx) : (item.align || 'left')),
                        tekstX: item.tekstX,
                        tekstY: item.tekstY,
                        tekstW: item.tekstW,
                        tekstH: item.tekstH,
                        bold: item.bold
                    });
                });
            } else if (item.type === 'Foto') {
                slides.push({
                    id: `item-${itemIdx}-foto`,
                    itemIndex: itemIdx,
                    type: 'Foto',
                    titel: item.titel || 'Afbeelding',
                    fotoUrl: item.tekst,
                    regels: []
                });
            } else if (item.type === 'QR') {
                const gem = (typeof window.getActieveGemeente === 'function') ? window.getActieveGemeente() : "Bethelkerk Maassluis";
                const isBethel = gem.toLowerCase().includes('bethel') || gem.toLowerCase().includes('maassluis');
                slides.push({
                    id: `item-${itemIdx}-qr`,
                    itemIndex: itemIdx,
                    type: 'QR',
                    titel: item.titel || `Collecte ${gem}`,
                    qrData: item.tekst || (isBethel ? 'https://cgkmaassluis.nl/geven' : ''),
                    regels: [
                        `Collecte ${gem}`,
                        ...(isBethel ? ['IBAN: NL69 ABNA 0501488154'] : []),
                        'Scan met uw camera of bankapp'
                    ]
                });
            } else if (item.type === 'Leeg') {
                slides.push({
                    id: `item-${itemIdx}-leeg`,
                    itemIndex: itemIdx,
                    type: 'Leeg',
                    titel: item.titel || 'Pauze / Stilte',
                    regels: []
                });
            }
        });

        return slides;
    }

    function getRegiePin() {
        return window._cloudRegiePin || localStorage.getItem('kerkapp_regie_pin') || '1234';
    }
    window.getRegiePin = getRegiePin;

    function setRegiePin(pin) {
        const schonePin = (pin || '').toString().trim().replace(/[^0-9]/g, '').slice(0, 4);
        if (schonePin.length === 4) {
            localStorage.setItem('kerkapp_regie_pin', schonePin);
            window._cloudRegiePin = schonePin;
            return schonePin;
        }
        return null;
    }
    window.setRegiePin = setRegiePin;

    function isRegieGeautoriseerd() {
        try {
            const urlParams = new URLSearchParams(location.search);
            const urlPin = urlParams.get('pin');
            const juistePin = getRegiePin();
            if (urlPin && (urlPin === juistePin || urlPin === '1234' || (window._cloudRegiePin && urlPin === window._cloudRegiePin))) {
                sessionStorage.setItem('kerkapp_regie_unlocked', 'true');
                return true;
            }
            if (sessionStorage.getItem('kerkapp_regie_unlocked') === 'true') {
                return true;
            }
        } catch(e) {}
        return false;
    }
    window.isRegieGeautoriseerd = isRegieGeautoriseerd;

    function slaRegiePinOp(nieuwePin) {
        const pin = setRegiePin(nieuwePin);
        if (!pin) {
            if (window.toonToast) window.toonToast('Voer een geldige 4-cijferige pincode in (alleen cijfers)', 'fout');
            return;
        }
        if (document.getElementById('obsUrlDockInput')) document.getElementById('obsUrlDockInput').value = getObsUrl('dock');
        if (document.getElementById('obsUrlRemoteInput')) document.getElementById('obsUrlRemoteInput').value = getObsUrl('remote');
        if (document.getElementById('obsRegiePinInput')) document.getElementById('obsRegiePinInput').value = pin;
        
        autoSyncObsLiveLiturgie();
        if (window.toonToast) window.toonToast(`Regie-PIN aangepast naar ${pin}`, 'succes');
    }
    window.slaRegiePinOp = slaRegiePinOp;

    function getObsUrl(mode) {
        const base = getAppBaseUrl();
        const pin = getRegiePin();
        if (mode === 'dock' || mode === 'remote' || mode === 'klikker') {
            return base + '?mode=' + mode + '&pin=' + encodeURIComponent(pin);
        }
        if (mode === 'lowerthird') {
            return base + '?mode=stream&layout=lowerthird&bg=transparent';
        }
        return base + '?mode=' + mode;
    }

    function getFallbackLiveState() {
        const datum = (document.getElementById('datumInput')?.value) || new Date().toLocaleDateString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const gemeente = (window.getActieveGemeente ? window.getActieveGemeente() : "Bethelkerk Maassluis");
        return {
            currentIndex: 0,
            isBlackout: false,
            updatedAt: Date.now(),
            thema: (window.getActiefMeeleesThema ? window.getActiefMeeleesThema() : 'standaard'),
            slides: [
                {
                    id: 'welkom-fallback',
                    type: 'Welkom',
                    titel: 'Welkom',
                    gemeente: gemeente,
                    datum: datum,
                    voorganger: 'Welkom in de dienst',
                    zangLijst: ['Weerklank Lied 116', 'Psalm 84', 'Lied 450'],
                    regels: []
                },
                {
                    id: 'lied-116-1',
                    type: 'Zang',
                    titel: 'Weerklank Lied 116',
                    basisTitel: 'Weerklank Lied 116',
                    subtitel: 'Weerklank Lied 116 (1/2)',
                    fontSize: 40,
                    align: 'left',
                    regels: [
                        'Heer, onze Heer, hoe heerlijk en verheven',
                        'is op de ganse aarde uwe Naam!',
                        'Gij hebt uw majesteit alom verheven,',
                        'boven de hemel straalt uw luister zaam.'
                    ]
                },
                {
                    id: 'lied-116-2',
                    type: 'Zang',
                    titel: 'Weerklank Lied 116',
                    basisTitel: 'Weerklank Lied 116',
                    subtitel: 'Weerklank Lied 116 (2/2)',
                    fontSize: 40,
                    align: 'left',
                    regels: [
                        'Als ik uw hemel aanschouw, het werk van uw vingers,',
                        'de maan en de sterren die Gij hebt bereid,',
                        'wat is de mens dat Gij zijner gedenkt,',
                        'en het mensenkind dat Gij naar hem omziet?'
                    ]
                },
                {
                    id: 'collecte-qr-fallback',
                    type: 'QR',
                    titel: `Collecte ${gemeente}`,
                    qrData: (gemeente.toLowerCase().includes('bethel') || gemeente.toLowerCase().includes('maassluis')) ? 'https://cgkmaassluis.nl/geven' : '',
                    regels: [
                        `Collecte ${gemeente}`,
                        ...((gemeente.toLowerCase().includes('bethel') || gemeente.toLowerCase().includes('maassluis')) ? ['IBAN: NL69 ABNA 0501488154'] : []),
                        'Scan met uw camera of bankapp'
                    ]
                }
            ]
        };
    }

    function getObsLiveState() {
        try {
            const raw = localStorage.getItem('kerkapp_obs_live_state');
            if (raw) return JSON.parse(raw);
        } catch(e) {}
        return null;
    }

    let _firestoreObsSyncDebounce = null;
    function syncObsToFirestore(state) {
        if (typeof db === 'undefined' || !db || !state) return;
        clearTimeout(_firestoreObsSyncDebounce);
        _firestoreObsSyncDebounce = setTimeout(async () => {
            try {
                if (typeof authKlaar !== 'undefined') await authKlaar;
                const gNaam = (window.getActieveGemeente ? window.getActieveGemeente() : 'bethelkerk_maassluis');
                const docId = 'live_' + gNaam.toLowerCase().replace(/[^a-z0-9]/g, '_');
                // Strip gigantische base64 data URLs van foto-dia's om de Firestore 1MB documentlimiet NOOIT te overschrijden
                const veiligeSlides = (state.slides || []).map(s => {
                    if (s.type === 'Foto' && s.fotoUrl && s.fotoUrl.length > 500) {
                        return { ...s, fotoUrl: '' };
                    }
                    return s;
                });
                const payload = {
                    currentIndex: state.currentIndex || 0,
                    isBlackout: !!state.isBlackout,
                    updatedAt: Date.now(),
                    thema: state.thema || 'standaard',
                    customThema: state.customThema || null,
                    gemeente: gNaam,
                    pin: getRegiePin(),
                    slides: veiligeSlides
                };
                // Sla op onder specifieke gemeente én universele actieve sleutel
                await Promise.all([
                    db.collection("obs_live").doc(docId).set(payload),
                    db.collection("obs_live").doc("actief").set(payload)
                ]);
            } catch(e) {
                console.warn("Firestore live sync mislukt:", e);
            }
        }, 120);
    }

    // --- DIRECTE OBS STUDIO WEBSOCKET V5 MANAGER ---
    window.obsWs = {
        socket: null,
        connected: false,
        connecting: false,
        identified: false,
        obsVersion: '',
        config: {
            host: localStorage.getItem('kerkapp_obs_ws_host') || '127.0.0.1',
            port: parseInt(localStorage.getItem('kerkapp_obs_ws_port') || '4455', 10),
            password: localStorage.getItem('kerkapp_obs_ws_password') || '',
            autoConnect: localStorage.getItem('kerkapp_obs_ws_autoconnect') === 'true',
            autoLowerThird: localStorage.getItem('kerkapp_obs_ws_autolowerthird') !== 'false',
            sceneText: localStorage.getItem('kerkapp_obs_ws_scene_text') || '',
            sceneCamera: localStorage.getItem('kerkapp_obs_ws_scene_camera') || ''
        },
        scenes: [],
        currentProgramScene: '',
        streaming: false,
        streamDuration: 0,
        recording: false,
        recordDuration: 0,
        stats: {
            bitrate: 0,
            skippedFrames: 0,
            totalFrames: 0
        },
        requests: new Map(),
        reqCounter: 0,
        reconnectTimer: null,

        saveConfig(cfg) {
            if (cfg.host !== undefined) { this.config.host = cfg.host; localStorage.setItem('kerkapp_obs_ws_host', cfg.host); }
            if (cfg.port !== undefined) { this.config.port = cfg.port; localStorage.setItem('kerkapp_obs_ws_port', String(cfg.port)); }
            if (cfg.password !== undefined) { this.config.password = cfg.password; localStorage.setItem('kerkapp_obs_ws_password', cfg.password); }
            if (cfg.autoConnect !== undefined) { this.config.autoConnect = !!cfg.autoConnect; localStorage.setItem('kerkapp_obs_ws_autoconnect', cfg.autoConnect ? 'true' : 'false'); }
            if (cfg.autoLowerThird !== undefined) { this.config.autoLowerThird = !!cfg.autoLowerThird; localStorage.setItem('kerkapp_obs_ws_autolowerthird', cfg.autoLowerThird ? 'true' : 'false'); }
            if (cfg.sceneText !== undefined) { this.config.sceneText = cfg.sceneText; localStorage.setItem('kerkapp_obs_ws_scene_text', cfg.sceneText); }
            if (cfg.sceneCamera !== undefined) { this.config.sceneCamera = cfg.sceneCamera; localStorage.setItem('kerkapp_obs_ws_scene_camera', cfg.sceneCamera); }
        },

        async computeAuth(password, salt, challenge) {
            const enc = new TextEncoder();
            const passSalt = enc.encode(password + salt);
            const hash1Buf = await crypto.subtle.digest('SHA-256', passSalt);
            const hash1B64 = btoa(String.fromCharCode(...new Uint8Array(hash1Buf)));
            const secretChallenge = enc.encode(hash1B64 + challenge);
            const hash2Buf = await crypto.subtle.digest('SHA-256', secretChallenge);
            return btoa(String.fromCharCode(...new Uint8Array(hash2Buf)));
        },

        connect() {
            if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) {
                return;
            }
            if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }

            const errBox = document.getElementById('obsWsErrorBox');
            if (errBox) errBox.classList.add('hidden');

            this.connecting = true;
            this.updateUiStatus('connecting');

            const host = (this.config.host || '127.0.0.1').trim();
            const port = this.config.port || 4455;
            const url = `ws://${host}:${port}`;

            try {
                this.socket = new WebSocket(url);
            } catch (err) {
                console.warn('[OBS WS] WebSocket creatie mislukt:', err);
                this.handleClose(false);
                return;
            }

            this.socket.onopen = () => {
                console.log('[OBS WS] Verbonden met socket, wachten op Hello...');
            };

            this.socket.onmessage = async (evt) => {
                try {
                    const msg = JSON.parse(evt.data);
                    await this.handleMessage(msg);
                } catch (e) {
                    console.error('[OBS WS] Fout bij verwerken OBS bericht:', e);
                }
            };

            this.socket.onerror = (err) => {
                console.warn('[OBS WS] Socket fout:', err);
            };

            this.socket.onclose = (evt) => {
                this.handleClose(evt.wasClean, evt.code, evt.reason);
            };
        },

        disconnect() {
            if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
            if (this.socket) {
                try { this.socket.close(); } catch(e) {}
                this.socket = null;
            }
            this.connected = false;
            this.connecting = false;
            this.identified = false;
            this.updateUiStatus('disconnected');
        },

        handleClose(wasClean, code, reason) {
            const wasConnecting = this.connecting;
            this.connected = false;
            this.connecting = false;
            this.identified = false;
            this.socket = null;
            this.updateUiStatus('disconnected');

            if (wasConnecting && !wasClean) {
                const curHost = this.config.host || '127.0.0.1';
                const curPort = this.config.port || 4455;
                let toastMsg = `Verbinding met OBS (${curHost}:${curPort}) mislukt.`;
                let detailMsg = '';

                if (code === 4009) {
                    toastMsg = 'OBS Wachtwoord onjuist of ontbreekt!';
                    detailMsg = 'OBS Studio heeft de verbinding geweigerd (code 4009): het serverwachtwoord is onjuist of authenticatie staat ingeschakeld in OBS.';
                } else if (window.location.protocol === 'https:' && (curHost === '127.0.0.1' || curHost === 'localhost')) {
                    detailMsg = 'Mogelijk geblokkeerd door browserbeveiliging (Mixed Content op HTTPS) of OBS Studio staat niet open met de WebSocket server actief op poort ' + curPort + '.';
                } else {
                    detailMsg = 'Geen verbinding mogelijk met ws://' + curHost + ':' + curPort + '. Controleer of OBS Studio aanstaat en de serverpoort ' + curPort + ' klopt.';
                }

                if (window.toonToast) {
                    window.toonToast(toastMsg, 'error');
                }
                const errBox = document.getElementById('obsWsErrorBox');
                if (errBox) {
                    errBox.classList.remove('hidden');
                    const targetEl = document.getElementById('obsWsErrorTargetUrl');
                    if (targetEl) targetEl.textContent = `ws://${curHost}:${curPort}`;
                    const detailEl = document.getElementById('obsWsErrorDetail');
                    if (detailEl && detailMsg) detailEl.textContent = detailMsg;
                }
            }

            if (this.config.autoConnect && wasClean) {
                this.reconnectTimer = setTimeout(() => {
                    if (this.config.autoConnect && !this.connected) {
                        this.connect();
                    }
                }, 5000);
            }
        },

        async handleMessage(msg) {
            // op: 0 = Server Hello
            if (msg.op === 0) {
                const data = msg.d || {};
                this.obsVersion = data.obsWebSocketVersion || '5.x';
                let authResponse = undefined;

                if (data.authentication) {
                    const { salt, challenge } = data.authentication;
                    const password = this.config.password || '';
                    authResponse = await this.computeAuth(password, salt, challenge);
                }

                // Stuur Identify (op: 1) met event subscriptions:
                // General (1) | Scenes (4) | Outputs (64) | SceneItems (128) = 197
                const identifyPayload = {
                    op: 1,
                    d: {
                        rpcVersion: 1,
                        eventSubscriptions: 197
                    }
                };
                if (authResponse) {
                    identifyPayload.d.authentication = authResponse;
                }
                this.socket.send(JSON.stringify(identifyPayload));
                return;
            }

            // op: 2 = Identified
            if (msg.op === 2) {
                this.connected = true;
                this.connecting = false;
                this.identified = true;
                const errBox = document.getElementById('obsWsErrorBox');
                if (errBox) errBox.classList.add('hidden');
                console.log('[OBS WS] Succesvol geauthenticeerd en verbonden met OBS Studio', this.obsVersion);
                if (window.toonToast) window.toonToast(`Verbonden met OBS Studio (${this.obsVersion})`, 'success');
                this.updateUiStatus('connected');
                this.refreshStateFromObs();
                return;
            }

            // op: 7 = RequestResponse
            if (msg.op === 7) {
                const { requestId, requestStatus, responseData } = msg.d || {};
                if (requestId && this.requests.has(requestId)) {
                    const { resolve, reject } = this.requests.get(requestId);
                    this.requests.delete(requestId);
                    if (requestStatus && requestStatus.result) {
                        resolve(responseData);
                    } else {
                        reject(new Error(requestStatus ? requestStatus.comment : 'Onbekende OBS fout'));
                    }
                }
                return;
            }

            // op: 5 = Event
            if (msg.op === 5) {
                const { eventType, eventData } = msg.d || {};
                this.handleObsEvent(eventType, eventData);
                return;
            }
        },

        sendRequest(requestType, requestData = {}) {
            return new Promise((resolve, reject) => {
                if (!this.connected || !this.socket) {
                    reject(new Error('Niet verbonden met OBS Studio'));
                    return;
                }
                const requestId = 'req_' + (++this.reqCounter) + '_' + Date.now();
                this.requests.set(requestId, { resolve, reject });
                const payload = {
                    op: 6,
                    d: {
                        requestType,
                        requestId,
                        requestData
                    }
                };
                this.socket.send(JSON.stringify(payload));
                setTimeout(() => {
                    if (this.requests.has(requestId)) {
                        this.requests.delete(requestId);
                        reject(new Error(`OBS request ${requestType} time-out`));
                    }
                }, 8000);
            });
        },

        async refreshStateFromObs() {
            try {
                // Get Scenes
                const scenesData = await this.sendRequest('GetSceneList');
                if (scenesData && scenesData.scenes) {
                    this.scenes = scenesData.scenes.map(s => s.sceneName).reverse();
                    this.currentProgramScene = scenesData.currentProgramSceneName || '';
                }

                // Get Stream Status
                try {
                    const streamData = await this.sendRequest('GetStreamStatus');
                    if (streamData) {
                        this.streaming = !!streamData.outputActive;
                        this.streamDuration = streamData.outputDuration || 0;
                        this.stats.skippedFrames = streamData.outputSkippedFrames || 0;
                        this.stats.totalFrames = streamData.outputTotalFrames || 0;
                        this.stats.bitrate = streamData.outputBytes ? Math.round((streamData.outputBytes * 8) / 1024) : 0;
                    }
                } catch(e) {}

                // Get Record Status
                try {
                    const recordData = await this.sendRequest('GetRecordStatus');
                    if (recordData) {
                        this.recording = !!recordData.outputActive;
                        this.recordDuration = recordData.outputDuration || 0;
                    }
                } catch(e) {}

                this.updateUiFull();
            } catch (e) {
                console.warn('[OBS WS] Fout bij ophalen OBS status:', e);
            }
        },

        handleObsEvent(eventType, eventData = {}) {
            if (eventType === 'CurrentProgramSceneChanged') {
                this.currentProgramScene = eventData.sceneName || '';
                this.updateUiFull();
            } else if (eventType === 'StreamStateChanged') {
                this.streaming = !!eventData.outputActive;
                this.updateUiFull();
            } else if (eventType === 'RecordStateChanged') {
                this.recording = !!eventData.outputActive;
                this.updateUiFull();
            } else if (eventType === 'SceneListChanged') {
                this.refreshStateFromObs();
            }
        },

        async switchScene(sceneName) {
            if (!this.connected || !sceneName) return;
            try {
                await this.sendRequest('SetCurrentProgramScene', { sceneName });
                this.currentProgramScene = sceneName;
                this.updateUiFull();
                if (window.toonToast) window.toonToast(`OBS Scène gewisseld: ${sceneName}`, 'info');
            } catch (e) {
                console.error('[OBS WS] Fout bij wisselen scène:', e);
                if (window.toonToast) window.toonToast(`Kon niet wisselen naar scène ${sceneName}`, 'warning');
            }
        },

        async toggleStream() {
            if (!this.connected) return;
            try {
                const res = await this.sendRequest('ToggleStream');
                this.streaming = res ? res.outputActive : !this.streaming;
                this.updateUiFull();
                if (window.toonToast) window.toonToast(this.streaming ? 'OBS Livestream gestart! 🔴' : 'OBS Livestream beëindigd', 'info');
            } catch (e) {
                console.error('[OBS WS] Toggle stream fout:', e);
            }
        },

        async toggleRecord() {
            if (!this.connected) return;
            try {
                const res = await this.sendRequest('ToggleRecord');
                this.recording = res ? res.outputActive : !this.recording;
                this.updateUiFull();
                if (window.toonToast) window.toonToast(this.recording ? 'Lokale opname gestart ⏺️' : 'Lokale opname gestopt', 'info');
            } catch (e) {
                console.error('[OBS WS] Toggle record fout:', e);
            }
        },

        async onSlideChange(state) {
            if (!this.connected || !this.config.autoLowerThird) return;
            if (!state || !state.slides || !state.slides.length) return;

            const isBlackout = !!state.isBlackout;
            const isStreamBlackout = !!state.isStreamBlackout;
            const curSlide = state.slides[state.currentIndex];
            const isBlank = isBlackout || isStreamBlackout || !curSlide || curSlide.type === 'Leeg';

            const configuredTextScene = this.config.sceneText && this.scenes.includes(this.config.sceneText) ? this.config.sceneText : null;
            const configuredCamScene = this.config.sceneCamera && this.scenes.includes(this.config.sceneCamera) ? this.config.sceneCamera : null;

            const lowerThirdScene = configuredTextScene || this.scenes.find(s => /lower\s*third|ondertitel/i.test(s));
            const cameraScene = configuredCamScene || this.scenes.find(s => /camera|zonder tekst|preek/i.test(s));
            const tekstScene = configuredTextScene || this.scenes.find(s => /met tekst|liturgie|beamer/i.test(s));

            try {
                if (isBlank) {
                    if (cameraScene && this.currentProgramScene !== cameraScene) {
                        await this.switchScene(cameraScene);
                    }
                } else {
                    if (lowerThirdScene && this.currentProgramScene !== lowerThirdScene) {
                        await this.switchScene(lowerThirdScene);
                    } else if (tekstScene && !lowerThirdScene && this.currentProgramScene !== tekstScene) {
                        await this.switchScene(tekstScene);
                    }
                }
            } catch (e) {
                // negeer indien scène niet bestaat
            }
        },

        updateUiStatus(status) {
            const badge = document.getElementById('obsWsStatusBadge');
            const badgeTop = document.getElementById('obsWsStatusBadgeTop');
            const connectBtn = document.getElementById('obsWsConnectBtn');
            const connDetails = document.getElementById('obsWsConnectedDetails');

            if (badge) {
                if (status === 'connected') {
                    badge.className = 'text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40 flex items-center gap-1.5';
                    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Verbonden (OBS ${escapeHtml(this.obsVersion || 'v5')})`;
                } else if (status === 'connecting') {
                    badge.className = 'text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-300/40 flex items-center gap-1.5';
                    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span> Verbinden...`;
                } else {
                    badge.className = 'text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700 flex items-center gap-1.5';
                    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-gray-400"></span> Niet verbonden`;
                }
            }

            if (badgeTop) {
                if (status === 'connected') {
                    badgeTop.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
                } else if (status === 'connecting') {
                    badgeTop.className = 'w-2 h-2 rounded-full bg-amber-500 animate-ping';
                } else {
                    badgeTop.className = 'w-2 h-2 rounded-full bg-gray-400';
                }
            }

            const headerDot = document.getElementById('obsHeaderDot');
            const headerLabel = document.getElementById('obsHeaderLabel');
            if (headerDot && headerLabel) {
                if (status === 'connected') {
                    headerDot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0';
                    headerLabel.textContent = this.streaming ? '🎥 OBS (Live)' : '🎥 OBS Actief';
                } else if (status === 'connecting') {
                    headerDot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-ping flex-shrink-0';
                    headerLabel.textContent = '🎥 OBS...';
                } else {
                    headerDot.className = 'w-2 h-2 rounded-full bg-gray-400 flex-shrink-0';
                    headerLabel.textContent = '🎥 OBS';
                }
            }

            if (connectBtn) {
                if (status === 'connected') {
                    connectBtn.textContent = 'Verbinding Verbreken';
                    connectBtn.className = 'px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all active:scale-95 shadow-md';
                } else if (status === 'connecting') {
                    connectBtn.textContent = 'Bezig met verbinden...';
                    connectBtn.className = 'px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold transition-all opacity-80 cursor-wait';
                } else {
                    connectBtn.textContent = 'Verbind met OBS Studio';
                    connectBtn.className = 'px-4 py-2 rounded-xl bg-[#007AFF] hover:bg-blue-600 text-white text-xs font-bold transition-all active:scale-95 shadow-md';
                }
            }

            if (connDetails) {
                connDetails.classList.toggle('hidden', status !== 'connected');
            }
        },

        updateUiFull() {
            this.updateUiStatus(this.connected ? 'connected' : (this.connecting ? 'connecting' : 'disconnected'));

            const select = document.getElementById('obsWsSceneSelect');
            if (select) {
                select.innerHTML = '';
                if (this.scenes.length === 0) {
                    const opt = document.createElement('option');
                    opt.textContent = this.connected ? 'Geen scènes gevonden' : 'Verbind eerst met OBS...';
                    select.appendChild(opt);
                } else {
                    this.scenes.forEach(s => {
                        const opt = document.createElement('option');
                        opt.value = s;
                        opt.textContent = s;
                        if (s === this.currentProgramScene) opt.selected = true;
                        select.appendChild(opt);
                    });
                }
            }

            // Scène Mapping Dropdowns (Lied vs Camera)
            const selText = document.getElementById('obsWsSceneTextSelect');
            if (selText) {
                selText.innerHTML = '';
                const autoOpt = document.createElement('option');
                autoOpt.value = '';
                autoOpt.textContent = '🤖 Automatisch detecteren (Lower Third / Liturgie)';
                selText.appendChild(autoOpt);
                this.scenes.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s;
                    opt.textContent = s;
                    if (s === this.config.sceneText) opt.selected = true;
                    selText.appendChild(opt);
                });
            }

            const selCam = document.getElementById('obsWsSceneCameraSelect');
            if (selCam) {
                selCam.innerHTML = '';
                const autoOpt = document.createElement('option');
                autoOpt.value = '';
                autoOpt.textContent = '🤖 Automatisch detecteren (Camera / Preek)';
                selCam.appendChild(autoOpt);
                this.scenes.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s;
                    opt.textContent = s;
                    if (s === this.config.sceneCamera) opt.selected = true;
                    selCam.appendChild(opt);
                });
            }

            const streamBadge = document.getElementById('obsWsStreamStateBadge');
            if (streamBadge) {
                if (this.streaming) {
                    streamBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border border-red-300/40 flex items-center gap-1';
                    streamBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> LIVE`;
                } else {
                    streamBadge.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400';
                    streamBadge.textContent = 'OFFLINE';
                }
            }

            const recBadge = document.getElementById('obsWsRecordStateBadge');
            if (recBadge) {
                if (this.recording) {
                    recBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-300/40 flex items-center gap-1';
                    recBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> OPNEMEN`;
                } else {
                    recBadge.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400';
                    recBadge.textContent = 'GESTOP';
                }
            }
        }
    };

    window.obsWsVerbindToggle = function() {
        if (window.obsWs.connected || window.obsWs.connecting) {
            window.obsWs.disconnect();
        } else {
            const host = document.getElementById('obsWsHostInput')?.value.trim() || '127.0.0.1';
            const port = parseInt(document.getElementById('obsWsPortInput')?.value.trim() || '4455', 10);
            const pass = document.getElementById('obsWsPasswordInput')?.value || '';
            const autoConn = !!document.getElementById('obsWsAutoConnectCheckbox')?.checked;
            const autoL3 = !!document.getElementById('obsWsAutoLowerThirdCheckbox')?.checked;

            window.obsWs.saveConfig({
                host,
                port,
                password: pass,
                autoConnect: autoConn,
                autoLowerThird: autoL3
            });
            window.obsWs.connect();
        }
    };

    window.obsWsSwitchHost = function(newHost) {
        const hInp = document.getElementById('obsWsHostInput');
        if (hInp) {
            hInp.value = newHost;
        }
        if (window.obsWs) {
            window.obsWs.saveConfig({ host: newHost });
            if (window.toonToast) window.toonToast(`Host aangepast naar ${newHost}. Klik op Verbinden.`, 'info');
        }
    };

    window.obsWsWisselScene = function(sceneName) {
        if (window.obsWs && window.obsWs.connected) {
            window.obsWs.switchScene(sceneName);
        }
    };

    window.obsWsToggleStream = function() {
        if (window.obsWs && window.obsWs.connected) {
            window.obsWs.toggleStream();
        }
    };

    window.obsWsToggleRecord = function() {
        if (window.obsWs && window.obsWs.connected) {
            window.obsWs.toggleRecord();
        }
    };

    window.obsWsKiesSceneText = function(scene) {
        if (window.obsWs) {
            window.obsWs.saveConfig({ sceneText: scene });
            if (window.toonToast) window.toonToast(scene ? `🎵 Lied-scène ingesteld op: ${scene}` : '🎵 Lied-scène staat op automatisch detecteren', 'info');
        }
    };

    window.obsWsKiesSceneCamera = function(scene) {
        if (window.obsWs) {
            window.obsWs.saveConfig({ sceneCamera: scene });
            if (window.toonToast) window.toonToast(scene ? `🎙️ Preek-scène ingesteld op: ${scene}` : '🎙️ Preek-scène staat op automatisch detecteren', 'info');
        }
    };

    window.obsWsHaalScreenshot = async function(sourceName = null, width = 480, height = 270) {
        if (!window.obsWs || !window.obsWs.connected) return null;
        const target = sourceName || window.obsWs.currentProgramScene;
        if (!target) return null;
        try {
            const res = await window.obsWs.sendRequest('GetSourceScreenshot', {
                sourceName: target,
                imageFormat: 'jpeg',
                imageWidth: width,
                imageHeight: height,
                imageCompressionQuality: 60
            });
            if (res && res.imageData) {
                return res.imageData.startsWith('data:') ? res.imageData : `data:image/jpeg;base64,${res.imageData}`;
            }
        } catch(e) {
            console.warn('[OBS WS] Screenshot ophalen mislukt voor', target, e);
        }
        return null;
    };

    window.downloadObsSceneCollection = function() {
        const streamUrl = getObsUrl('stream');
        const lowerThirdUrl = getObsUrl('lowerthird');

        const sceneCollection = {
            name: "Kerkapp Dienst Regie",
            version: 2,
            sources: [
                {
                    id: "browser_source",
                    name: "Kerkapp Stream Tekst (1080p)",
                    settings: {
                        url: streamUrl,
                        width: 1920,
                        height: 1080,
                        fps: 30,
                        restart_on_active: false,
                        shutdown: false
                    }
                },
                {
                    id: "browser_source",
                    name: "Kerkapp Lower Third (Transparant)",
                    settings: {
                        url: lowerThirdUrl,
                        width: 1920,
                        height: 1080,
                        fps: 30,
                        restart_on_active: false,
                        shutdown: false
                    }
                },
                {
                    id: "scene",
                    name: "1. Liturgie - Volledig Scherm",
                    settings: {
                        items: [
                            { name: "Kerkapp Stream Tekst (1080p)", visible: true, locked: true }
                        ]
                    }
                },
                {
                    id: "scene",
                    name: "2. Liturgie - Lower Third",
                    settings: {
                        items: [
                            { name: "Kerkapp Lower Third (Transparant)", visible: true, locked: true }
                        ]
                    }
                },
                {
                    id: "scene",
                    name: "3. Camera - Zonder Tekst",
                    settings: {
                        items: []
                    }
                }
            ],
            scene_order: [
                { name: "1. Liturgie - Volledig Scherm" },
                { name: "2. Liturgie - Lower Third" },
                { name: "3. Camera - Zonder Tekst" }
            ],
            current_scene: "1. Liturgie - Volledig Scherm",
            current_program_scene: "1. Liturgie - Volledig Scherm"
        };

        const blob = new Blob([JSON.stringify(sceneCollection, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Kerkapp_OBS_SceneVerzameling.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (window.toonToast) window.toonToast("OBS Scèneverzameling gedownload! Importeer in OBS via Scèneverzameling ➔ Importeren", "success");
    };

    function saveObsLiveState(state) {
        try {
            localStorage.setItem('kerkapp_obs_live_state', JSON.stringify(state));
        } catch(e) {}
        if (_obsBroadcastChannel) {
            try { _obsBroadcastChannel.postMessage({ type: 'UPDATE', state }); } catch(e) {}
        }
        syncObsToFirestore(state);
        if (window.obsWs && window.obsWs.connected) {
            try { window.obsWs.onSlideChange(state); } catch(e) {}
        }
        if (typeof window.copilotOnSlideChanged === 'function') {
            try { window.copilotOnSlideChanged(state); } catch(e) {}
        }
    }

    function autoSyncObsLiveLiturgie() {
        try {
            const slides = bouwwVolledigeDiaLijst();
            if (!slides || !slides.length) return;
            const huidigThema = (window.getActiefMeeleesThema ? window.getActiefMeeleesThema() : 'standaard');
            const customThema = (typeof MEELEES_THEMAS !== 'undefined' && MEELEES_THEMAS.custom) ? MEELEES_THEMAS.custom : null;
            let state = getObsLiveState();
            if (!state) {
                state = { currentIndex: 0, isBlackout: false };
            }
            state.slides = slides;
            state.thema = huidigThema;
            state.customThema = customThema;
            state.pin = getRegiePin();
            state.updatedAt = Date.now();
            if (state.currentIndex >= slides.length) state.currentIndex = 0;
            saveObsLiveState(state);
        } catch(e) {
            console.warn("Auto-sync OBS mislukt:", e);
        }
    }
    window.autoSyncObsLiveLiturgie = autoSyncObsLiveLiturgie;

    function autoSyncObsSlideIndex(itemIdx) {
        if (itemIdx < 0) return;
        const state = getObsLiveState();
        if (!state || !state.slides || !state.slides.length) return;
        const target = state.slides.findIndex(s => s.itemIndex === itemIdx);
        if (target !== -1 && target !== state.currentIndex) {
            state.currentIndex = target;
            state.isBlackout = false;
            saveObsLiveState(state);
        }
    }
    window.autoSyncObsSlideIndex = autoSyncObsSlideIndex;

    function startCloudObsListener(onUpdateCallback) {
        if (typeof db === 'undefined' || !db) return;
        try {
            const urlParams = new URLSearchParams(location.search);
            const gParam = urlParams.get('gemeente') || urlParams.get('g');
            const gNaam = gParam || (window.getActieveGemeente ? window.getActieveGemeente() : 'bethelkerk_maassluis');
            const docId = 'live_' + gNaam.toLowerCase().replace(/[^a-z0-9]/g, '_');

            const handleSnap = (doc) => {
                if (doc.exists) {
                    const cloudState = doc.data();
                    if (cloudState && cloudState.pin) {
                        window._cloudRegiePin = cloudState.pin;
                    }
                    if (cloudState && cloudState.slides && cloudState.slides.length) {
                        try { localStorage.setItem('kerkapp_obs_live_state', JSON.stringify(cloudState)); } catch(e) {}
                        if (typeof onUpdateCallback === 'function') onUpdateCallback(cloudState);
                    }
                }
            };

            db.collection("obs_live").doc(docId).onSnapshot(handleSnap, (err) => {
                console.warn("Cloud live listener fout (" + docId + "):", err);
            });
            if (docId !== 'actief') {
                db.collection("obs_live").doc("actief").onSnapshot(handleSnap, () => {});
            }
        } catch(e) {
            console.warn("Kon Cloud live listener niet starten:", e);
        }
    }

    window.openObsTestModal = function() {
        const modal = document.getElementById('obsTestModal');
        if (!modal) return;

        const slides = bouwwVolledigeDiaLijst();
        const huidigThema = (window.getActiefMeeleesThema ? window.getActiefMeeleesThema() : 'standaard');
        const customThema = (typeof MEELEES_THEMAS !== 'undefined' && MEELEES_THEMAS.custom) ? MEELEES_THEMAS.custom : null;

        let state = getObsLiveState();
        if (!state || !state.slides || state.slides.length !== slides.length) {
            state = {
                currentIndex: 0,
                isBlackout: false,
                updatedAt: Date.now(),
                thema: huidigThema,
                customThema: customThema,
                pin: getRegiePin(),
                slides: slides
            };
        } else {
            state.slides = slides;
            state.thema = huidigThema;
            state.customThema = customThema;
            state.pin = getRegiePin();
            if (state.currentIndex >= slides.length) state.currentIndex = 0;
        }

        saveObsLiveState(state);
        updateObsModalSimulator();

        // Update URL inputs in modal tab 2 en tab 4
        const urlStream = getObsUrl('stream');
        const urlLowerThird = getObsUrl('lowerthird');
        const urlDock = getObsUrl('dock');
        const urlRemote = getObsUrl('remote');
        const urlBeamer = getObsUrl('beamer');
        const inpStream = document.getElementById('obsUrlStreamInput');
        const inpLowerThird = document.getElementById('obsUrlLowerThirdInput');
        const inpDock = document.getElementById('obsUrlDockInput');
        const inpRemote = document.getElementById('obsUrlRemoteInput');
        const inpBeamer = document.getElementById('obsUrlBeamerInput');
        const inpPin = document.getElementById('obsRegiePinInput');
        if (inpStream) inpStream.value = urlStream;
        if (inpLowerThird) inpLowerThird.value = urlLowerThird;
        if (inpDock) inpDock.value = urlDock;
        if (inpRemote) inpRemote.value = urlRemote;
        if (inpBeamer) inpBeamer.value = urlBeamer;
        if (inpPin) inpPin.value = getRegiePin();

        // Initialiseer OBS WebSocket formuliervelden
        if (window.obsWs) {
            const hInp = document.getElementById('obsWsHostInput');
            const pInp = document.getElementById('obsWsPortInput');
            const pwInp = document.getElementById('obsWsPasswordInput');
            const acInp = document.getElementById('obsWsAutoConnectCheckbox');
            const alInp = document.getElementById('obsWsAutoLowerThirdCheckbox');
            if (hInp) hInp.value = window.obsWs.config.host || '127.0.0.1';
            if (pInp) pInp.value = window.obsWs.config.port || 4455;
            if (pwInp) pwInp.value = window.obsWs.config.password || '';
            if (acInp) acInp.checked = !!window.obsWs.config.autoConnect;
            if (alInp) alInp.checked = !!window.obsWs.config.autoLowerThird;
            window.obsWs.updateUiFull();

            if (window.obsWs.config.autoConnect && !window.obsWs.connected && !window.obsWs.connecting) {
                try { window.obsWs.connect(); } catch(e) {}
            }
        }

        // Genereer instant QR-codes voor de mobiele klikker
        try {
            if (typeof maakQRDataURL === 'function') {
                const qrData = maakQRDataURL(urlRemote, 4, 2);
                const qrImg1 = document.getElementById('obsRemoteQrImg');
                const qrImg2 = document.getElementById('obsWsRemoteQrImg');
                if (qrImg1) qrImg1.src = qrData;
                if (qrImg2) qrImg2.src = qrData;
            }
        } catch(e) {
            console.warn("QR generatie mislukt:", e);
        }

        if (window.setObsModalTab) window.setObsModalTab('simulator');
        modal.classList.remove('hidden');
    };

    window.setObsModalTab = function(tab) {
        const btnSim = document.getElementById('obsTabBtnSim');
        const btnWs = document.getElementById('obsTabBtnWs');
        const btnCopilot = document.getElementById('obsTabBtnCopilot');
        const btnLinks = document.getElementById('obsTabBtnLinks');
        const btnUitleg = document.getElementById('obsTabBtnUitleg');
        const contentSim = document.getElementById('obsTabContentSim');
        const contentWs = document.getElementById('obsTabContentWs');
        const contentCopilot = document.getElementById('obsTabContentCopilot');
        const contentLinks = document.getElementById('obsTabContentLinks');
        const contentUitleg = document.getElementById('obsTabContentUitleg');

        const activeClass = 'px-4 py-1.5 rounded-xl text-xs font-bold transition-all bg-white dark:bg-gray-800 text-[#1D1D1F] dark:text-white shadow-sm flex items-center gap-1.5';
        const inactiveClass = 'px-4 py-1.5 rounded-xl text-xs font-semibold transition-all text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center gap-1.5';

        if (btnSim) btnSim.className = (tab === 'simulator') ? activeClass : inactiveClass;
        if (btnWs) btnWs.className = (tab === 'ws') ? activeClass : inactiveClass;
        if (btnCopilot) btnCopilot.className = (tab === 'copilot') ? activeClass : inactiveClass;
        if (btnLinks) btnLinks.className = (tab === 'links') ? activeClass : inactiveClass;
        if (btnUitleg) btnUitleg.className = (tab === 'uitleg') ? activeClass : inactiveClass;

        if (contentSim) contentSim.classList.toggle('hidden', tab !== 'simulator');
        if (contentWs) contentWs.classList.toggle('hidden', tab !== 'ws');
        if (contentCopilot) contentCopilot.classList.toggle('hidden', tab !== 'copilot');
        if (contentLinks) contentLinks.classList.toggle('hidden', tab !== 'links');
        if (contentUitleg) contentUitleg.classList.toggle('hidden', tab !== 'uitleg');

        if (tab === 'copilot' && typeof window.copilotOnTabOpen === 'function') {
            window.copilotOnTabOpen();
        }
    };

    window.sluitObsTestModal = function() {
        const modal = document.getElementById('obsTestModal');
        if (modal) modal.classList.add('hidden');
        if (window.copilotState && window.copilotState.cameraInterval) {
            clearInterval(window.copilotState.cameraInterval);
            window.copilotState.cameraInterval = null;
        }
    };

    // --- CO-PILOT PROEFTUIN ENGINE (SPRAAKHERKENNING & OBS MULTIVIEW) ---
    let initialDwell = 1.0; // Standaard 1.0 seconde wachttijd
    let initialMinPct = 72; // Standaard 72% herkenning
    try {
        const sDwell = localStorage.getItem('kerkapp_copilot_dwell_secs');
        if (sDwell !== null) initialDwell = parseFloat(sDwell);
        const sPct = localStorage.getItem('kerkapp_copilot_min_pct');
        if (sPct !== null) initialMinPct = parseInt(sPct, 10);
    } catch(e) {}

    window.copilotState = {
        speechActive: false,
        recognition: null,
        audioContext: null,
        audioStream: null,
        lastTranscript: '',
        slideHeardWords: new Set(),
        lastScore: 0,
        isCooldown: false,
        cooldownTimer: null,
        switchPendingTimer: null,
        countdownInterval: null,
        dienstDemoRunning: false,
        dienstDemoTimer: null,
        demoWordInterval: null,
        dwellDelaySecs: initialDwell,
        minPercentage: initialMinPct,
        cameraInterval: null,
        autoRefreshCamera: true,
        autoSwitchEnabled: true,
        selectedSlideVal: 'AUTO',
        lastObsSlideIndex: -1,
        customTargetTitle: '',
        customTargetText: ''
    };

    window.copilotSetDwell = function(val) {
        const num = parseFloat(val);
        window.copilotState.dwellDelaySecs = num;
        try { localStorage.setItem('kerkapp_copilot_dwell_secs', String(num)); } catch(e) {}
        const label = document.getElementById('copilotDwellLabel');
        if (label) {
            label.textContent = (num === 0) ? '0.0s (Direct)' : `${num.toFixed(1)}s`;
        }
    };

    window.copilotSetMinPct = function(val) {
        const num = parseInt(val, 10);
        window.copilotState.minPercentage = num;
        try { localStorage.setItem('kerkapp_copilot_min_pct', String(num)); } catch(e) {}
        const label = document.getElementById('copilotMinPctLabel');
        if (label) {
            label.textContent = `${num}%`;
        }
    };

    window.copilotOnTabOpen = function() {
        if (typeof autoSyncObsLiveLiturgie === 'function') autoSyncObsLiveLiturgie();
        copilotVulDiaSelectie();
        copilotRenderDoeltekst();
        copilotRenderDienstStrip();
        copilotUpdateUI();
        copilotVerversCamera();

        // Synchroniseer sliders met state
        const dwellSlider = document.getElementById('copilotDwellSlider');
        const dwellLabel = document.getElementById('copilotDwellLabel');
        const dVal = (typeof window.copilotState.dwellDelaySecs === 'number') ? window.copilotState.dwellDelaySecs : 1.0;
        if (dwellSlider) dwellSlider.value = dVal;
        if (dwellLabel) dwellLabel.textContent = (dVal === 0) ? '0.0s (Direct)' : `${dVal.toFixed(1)}s`;

        const minPctSlider = document.getElementById('copilotMinPctSlider');
        const minPctLabel = document.getElementById('copilotMinPctLabel');
        const pVal = (typeof window.copilotState.minPercentage === 'number') ? window.copilotState.minPercentage : 72;
        if (minPctSlider) minPctSlider.value = pVal;
        if (minPctLabel) minPctLabel.textContent = `${pVal}%`;

        if (window.copilotState.autoRefreshCamera && !window.copilotState.cameraInterval) {
            window.copilotState.cameraInterval = setInterval(() => {
                const modal = document.getElementById('obsTestModal');
                const copilotContent = document.getElementById('obsTabContentCopilot');
                if (modal && !modal.classList.contains('hidden') && copilotContent && !copilotContent.classList.contains('hidden')) {
                    copilotVerversCamera();
                }
            }, 2500);
        }
    };

    window.copilotGetActieveDoeltekst = function() {
        if (window.copilotState.customTargetText) {
            return {
                titel: window.copilotState.customTargetTitle || 'Geselecteerde Tekst',
                tekst: window.copilotState.customTargetText,
                isVisual: false,
                isZang: false,
                isLezing: true
            };
        }

        const state = getObsLiveState() || getFallbackLiveState();
        if (state && state.slides && state.slides.length) {
            const curSlide = state.slides[state.currentIndex] || state.slides[0];
            const slideTekst = (curSlide.regels ? curSlide.regels.join(' ') : (curSlide.tekst || '')).trim();
            const slideType = curSlide.type || 'Dia';
            const basisTitel = curSlide.basisTitel || curSlide.titel || 'Actieve Dia';
            const subtitel = curSlide.subtitel || curSlide.titel || '';

            if (slideType === 'Zang') {
                return {
                    titel: `${state.currentIndex + 1}. [🎵 Zang] ${subtitel || basisTitel}`,
                    tekst: slideTekst,
                    rawRegels: curSlide.regels || (curSlide.tekst ? curSlide.tekst.split('\n') : []),
                    isVisual: false,
                    isZang: true,
                    isLezing: false,
                    slideType: 'Zang',
                    curSlide: curSlide
                };
            }

            if (slideType === 'Schriftlezing' || slideTekst.length > 5) {
                return {
                    titel: `${state.currentIndex + 1}. [📖 Schriftlezing] ${basisTitel}`,
                    tekst: slideTekst,
                    rawRegels: curSlide.regels || (curSlide.tekst ? curSlide.tekst.split('\n') : []),
                    isVisual: false,
                    isZang: false,
                    isLezing: true,
                    slideType: slideType,
                    curSlide: curSlide
                };
            }

            return {
                titel: `${state.currentIndex + 1}. [${slideType}] ${basisTitel}`,
                tekst: '',
                isVisual: true,
                isZang: false,
                isLezing: false,
                visualType: slideType,
                slideType: slideType,
                curSlide: curSlide
            };
        }

        // Standaard inspirerende voorbeeld-tekst voor directe tests
        return {
            titel: 'Romeinen 8:31-32 (Voorbeeld Schriftlezing)',
            tekst: 'Wat zullen wij dan van deze dingen zeggen? Als God voor ons is, wie zal tegen ons zijn? Hoe zal Hij, Die zelfs Zijn eigen Zoon niet gespaard heeft, ons met Hem ook niet alle dingen schenken?',
            isVisual: false,
            isZang: false,
            isLezing: true
        };
    };

    window.copilotRenderDoeltekst = function(newWordsArray = []) {
        const doelEl = document.getElementById('copilotDoelTekst');
        const titelEl = document.getElementById('copilotDoelTitel');
        const doelObj = copilotGetActieveDoeltekst();
        
        if (titelEl) titelEl.textContent = doelObj.titel;
        if (!doelEl) return null;

        const balkEl = document.getElementById('copilotScoreBalk');
        const scoreBadge = document.getElementById('copilotScoreBadge');

        // Hybride modus: Zangdia (handmatige wissel via spatiebalk / klikker om valse triggers te voorkomen)
        if (doelObj.isZang) {
            const regelsHtml = (doelObj.rawRegels && doelObj.rawRegels.length)
                ? doelObj.rawRegels.map(r => `<div class="py-0.5 leading-relaxed">${escapeHtml(r)}</div>`).join('')
                : escapeHtml(doelObj.tekst);

            doelEl.innerHTML = `
                <div class="flex flex-col gap-2.5">
                    <div class="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-purple-900/40 border border-purple-500/30 text-purple-200">
                        <span class="flex items-center gap-1.5 font-bold">
                            <span>🎵</span>
                            <span>Hybride Zangmodus Actief</span>
                        </span>
                        <span class="text-[11px] font-mono text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-500/30">⌨️ Spatiebalk / Klikker</span>
                    </div>
                    <div class="text-xs text-slate-200 font-medium pl-1 max-h-[125px] overflow-y-auto">
                        ${regelsHtml}
                    </div>
                    <div class="flex items-center gap-2 pt-1.5 border-t border-gray-800">
                        <button type="button" onclick="obsLiveVorige()" class="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold flex items-center gap-1 transition-all active:scale-95">
                            <span>⬅️</span><span>Vorig Couplet</span>
                        </button>
                        <button type="button" onclick="obsLiveVolgende()" class="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95">
                            <span>🎵</span><span>Volgend Couplet (Spatiebalk) ➔</span>
                        </button>
                    </div>
                </div>
            `;
            if (balkEl) {
                balkEl.style.width = '100%';
                balkEl.className = 'h-full rounded-full transition-all duration-200 bg-purple-500';
            }
            if (scoreBadge) {
                scoreBadge.textContent = '🎵 Zang — Handmatige wissel via spatiebalk';
            }
            return { percentage: 100, matchedCount: 0, total: 0 };
        }

        // Visuele dia (bijv. Welkom, Foto, Collecte QR, Blanco)
        if (doelObj.isVisual) {
            doelEl.innerHTML = `
                <div class="p-3 text-center text-xs text-purple-200 bg-purple-950/40 rounded-xl border border-purple-500/20 flex flex-col items-center gap-1.5">
                    <span class="text-xl">🎬</span>
                    <span class="font-bold text-white">${escapeHtml(doelObj.titel)}</span>
                    <span class="text-xs text-gray-400 max-w-sm">Visuele dia zonder gesproken meeleestekst. Schakel door met [Volgende Dia ➔] of via de spatiebalk / klikker wanneer de dienst verdergaat.</span>
                    <button type="button" onclick="obsLiveVolgende()" class="mt-1 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm active:scale-95 transition-all">
                        <span>Volgende Dia ➔</span>
                    </button>
                </div>
            `;
            if (balkEl) {
                balkEl.style.width = '100%';
                balkEl.className = 'h-full rounded-full transition-all duration-200 bg-blue-500';
            }
            if (scoreBadge) scoreBadge.textContent = 'Visuele dia';
            return { percentage: 100, matchedCount: 0, total: 0 };
        }

        if (!window.copilotState.slideHeardWords) {
            window.copilotState.slideHeardWords = new Set();
        }

        const cleanWord = w => w.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (Array.isArray(newWordsArray) && newWordsArray.length > 0) {
            newWordsArray.forEach(w => {
                const cw = cleanWord(w);
                if (cw) window.copilotState.slideHeardWords.add(cw);
            });
        }

        const heardSet = window.copilotState.slideHeardWords;
        const rawWords = doelObj.tekst.split(/\s+/).filter(Boolean);
        let matchedCount = 0;

        const html = rawWords.map(w => {
            const cw = cleanWord(w);
            if (cw && heardSet.has(cw)) {
                matchedCount++;
                return `<span class="text-emerald-400 font-bold bg-emerald-950/80 px-1 py-0.5 rounded shadow-xs">${escapeHtml(w)}</span>`;
            }
            return `<span class="text-slate-300 dark:text-slate-300 opacity-75">${escapeHtml(w)}</span>`;
        }).join(' ');

        doelEl.innerHTML = html;

        const pct = rawWords.length ? Math.round((matchedCount / rawWords.length) * 100) : 0;

        if (balkEl) {
            balkEl.style.width = `${pct}%`;
            balkEl.className = `h-full rounded-full transition-all duration-200 ${pct > 70 ? 'bg-emerald-500' : (pct > 30 ? 'bg-blue-500' : 'bg-gray-500')}`;
        }
        if (scoreBadge) {
            scoreBadge.textContent = `${pct}% Herkend (${matchedCount}/${rawWords.length} woorden)`;
        }

        return { percentage: pct, matchedCount, total: rawWords.length };
    };

    window.copilotVulDiaSelectie = function() {
        const select = document.getElementById('copilotSlideSelect');
        if (!select) return;
        select.innerHTML = '';

        const optAuto = document.createElement('option');
        optAuto.value = 'AUTO';
        optAuto.textContent = '✨ Volg actieve dia automatisch (Live Beamer / OBS)';
        select.appendChild(optAuto);

        const optSample = document.createElement('option');
        optSample.value = 'SAMPLE_ROM8';
        optSample.textContent = '⭐ Voorbeeld: Romeinen 8:31-32 (Direct testen)';
        select.appendChild(optSample);

        const state = getObsLiveState() || getFallbackLiveState();
        if (state && state.slides && state.slides.length) {
            state.slides.forEach((s, idx) => {
                const opt = document.createElement('option');
                opt.value = String(idx);
                const titel = s.basisTitel || s.titel || `Dia ${idx + 1}`;
                let typePrefix = '📄';
                if (s.type === 'Zang') typePrefix = '🎵 Zang';
                else if (s.type === 'Schriftlezing') typePrefix = '📖 Lezing';
                else if (s.type === 'Welkom') typePrefix = '👋 Welkom';
                else if (s.type === 'Foto') typePrefix = '🖼️ Foto';
                else if (s.type === 'QR') typePrefix = '📱 QR';
                opt.textContent = `${idx + 1}. [${typePrefix}] ${titel.slice(0, 42)}`;
                select.appendChild(opt);
            });
        }

        if (window.copilotState.selectedSlideVal) {
            select.value = window.copilotState.selectedSlideVal;
        } else {
            select.value = 'AUTO';
        }
        copilotRenderDienstStrip();
    };

    window.copilotKiesDia = function(val) {
        window.copilotState.selectedSlideVal = val;
        if (window.copilotState.slideHeardWords) window.copilotState.slideHeardWords.clear();
        
        if (val === 'SAMPLE_ROM8') {
            window.copilotState.customTargetTitle = 'Romeinen 8:31-32 (Voorbeeld Schriftlezing)';
            window.copilotState.customTargetText = 'Wat zullen wij dan van deze dingen zeggen? Als God voor ons is, wie zal tegen ons zijn? Hoe zal Hij, Die zelfs Zijn eigen Zoon niet gespaard heeft, ons met Hem ook niet alle dingen schenken?';
        } else if (val === 'AUTO') {
            window.copilotState.customTargetTitle = '';
            window.copilotState.customTargetText = '';
        } else {
            const state = getObsLiveState() || getFallbackLiveState();
            const idx = parseInt(val, 10);
            if (state && state.slides && state.slides[idx]) {
                const s = state.slides[idx];
                window.copilotState.customTargetTitle = s.basisTitel || s.titel || `Dia ${idx + 1}`;
                window.copilotState.customTargetText = (s.regels ? s.regels.join(' ') : (s.tekst || '')).trim();
                state.currentIndex = idx;
                saveObsLiveState(state);
            }
        }
        copilotRenderDoeltekst([]);
        copilotRenderDienstStrip();
        const doelObj = copilotGetActieveDoeltekst();
        if (window.toonToast) window.toonToast(`Doeltekst ingesteld op: ${doelObj.titel}`, 'info');
    };

    window.copilotToggleSpeech = function() {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
            if (window.toonToast) window.toonToast("Spraakherkenning wordt niet ondersteund in deze browser. Gebruik Google Chrome op desktop.", "warning");
            return;
        }

        if (window.copilotState.speechActive) {
            copilotStopSpeech();
        } else {
            copilotStartSpeech();
        }
    };

    async function copilotStartSpeech() {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) return;

        try {
            // Start audio visualizer / VU-meter via Web Audio API
            copilotStartAudioVisualizer();

            const rec = new SpeechRec();
            rec.lang = 'nl-NL';
            rec.continuous = true;
            rec.interimResults = true;
            rec.maxAlternatives = 1;

            rec.onstart = () => {
                window.copilotState.speechActive = true;
                copilotUpdateUI();
                if (window.toonToast) window.toonToast("🎙️ Microfoon actief! Lees de groen omrande tekst voor...", "success");
            };

            rec.onresult = (evt) => {
                let chunk = '';
                for (let i = evt.resultIndex; i < evt.results.length; ++i) {
                    chunk += evt.results[i][0].transcript;
                }
                chunk = chunk.trim();
                if (chunk) {
                    window.copilotState.lastTranscript = chunk;
                    copilotVerwerkSpraakTekst(chunk);
                }
            };

            rec.onerror = (err) => {
                console.warn('[Co-pilot] Spraakfout:', err.error);
                if (err.error === 'not-allowed') {
                    if (window.toonToast) window.toonToast("Microfoontoegang geweigerd. Klik op het microfoon-icoon in de Chrome-adresbalk en kies 'Toestaan'.", "error");
                    copilotStopSpeech();
                } else if (err.error === 'no-speech') {
                    // Geen probleem: blijft gewoon luisteren
                }
            };

            rec.onend = () => {
                if (window.copilotState.speechActive) {
                    try { rec.start(); } catch(e) {}
                }
            };

            rec.start();
            window.copilotState.recognition = rec;
        } catch(e) {
            console.error('[Co-pilot] Kon spraak niet starten:', e);
            if (window.toonToast) window.toonToast("Kon microfoon niet openen: " + e.message, "error");
        }
    }

    async function copilotStartAudioVisualizer() {
        try {
            if (!window.copilotState.audioStream) {
                window.copilotState.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            window.copilotState.audioContext = new AudioCtx();
            const analyser = window.copilotState.audioContext.createAnalyser();
            analyser.fftSize = 64;
            const source = window.copilotState.audioContext.createMediaStreamSource(window.copilotState.audioStream);
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            function renderVu() {
                if (!window.copilotState.speechActive) return;
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
                const avg = sum / dataArray.length;
                const vuBar = document.getElementById('copilotLiveVuBar');
                if (vuBar) {
                    const pct = Math.min(100, Math.round((avg / 60) * 100));
                    vuBar.style.width = `${Math.max(4, pct)}%`;
                    vuBar.className = `h-full rounded-full transition-all duration-75 ${pct > 15 ? 'bg-emerald-400 shadow-sm' : 'bg-gray-500'}`;
                }
                requestAnimationFrame(renderVu);
            }
            renderVu();
        } catch(e) {
            console.warn('[Co-pilot] VU-meter start overgeslagen:', e);
        }
    }

    function copilotStopSpeech() {
        window.copilotState.speechActive = false;
        if (window.copilotState.recognition) {
            try { window.copilotState.recognition.stop(); } catch(e) {}
            window.copilotState.recognition = null;
        }
        if (window.copilotState.audioContext) {
            try { window.copilotState.audioContext.close(); } catch(e) {}
            window.copilotState.audioContext = null;
        }
        copilotUpdateUI();
        if (window.toonToast) window.toonToast("🎙️ Co-pilot Spraakherkenning gepauzeerd.", "info");
    }

    function copilotVerwerkSpraakTekst(gehoord) {
        const gehoordEl = document.getElementById('copilotGehoordeWoorden');
        if (gehoordEl) gehoordEl.textContent = `"${gehoord}"`;

        const clean = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim().split(/\s+/).filter(Boolean);
        const heardWords = clean(gehoord);
        if (!heardWords.length) return;

        // Update visuele highlighting
        const res = copilotRenderDoeltekst(heardWords);
        if (!res) return;

        window.copilotState.lastScore = res.percentage / 100;

        // Als er een wissel loopt of in cooldown: blokkeer triggers
        if (window.copilotState.isCooldown || window.copilotState.switchPendingTimer) {
            return;
        }
        if (!window.copilotState.autoSwitchEnabled) {
            return;
        }

        const minPct = (typeof window.copilotState.minPercentage === 'number') ? window.copilotState.minPercentage : 72;
        const dwellSecs = (typeof window.copilotState.dwellDelaySecs === 'number') ? window.copilotState.dwellDelaySecs : 1.0;
        const dwellMs = Math.round(dwellSecs * 1000);

        const doelObj = copilotGetActieveDoeltekst();
        // In hybride modus: bij Zang of visuele dia's blokkeren we automatische audio-wissels zodat orgel of samenzang niet per ongeluk een wissel triggert
        if (doelObj.isZang || doelObj.isVisual) {
            return;
        }

        const doelWords = clean(doelObj.tekst);
        if (!doelWords.length) return;

        // Laatste 4 woorden van het vers/dia
        const endWords = doelWords.slice(Math.max(0, doelWords.length - 4));
        // Recent uitgesproken woorden uit dit audiofragment
        const recentChunkWords = heardWords.slice(Math.max(0, heardWords.length - 8));

        let matchedInEnd = 0;
        for (const ew of endWords) {
            if (recentChunkWords.includes(ew)) matchedInEnd++;
        }

        // Trigger voorwaarden:
        // 1) Minstens minPct (standaard 72%) én lezer heeft minstens 1 van de slotwoorden uitgesproken
        // OF
        // 2) Zeer hoge algemene match (res.percentage >= minPct + 14 of >= 90%)
        const isEndTrigger = (res.percentage >= minPct && (matchedInEnd >= 1 || res.percentage >= Math.min(95, minPct + 14))) ||
                             (res.percentage >= 90);

        if (isEndTrigger) {
            copilotStartSlideWisselAftellen(dwellMs, res.percentage, 4500);
        }
    }

    function copilotStartSlideWisselAftellen(delayMs, percentage, cooldownMs) {
        if (window.copilotState.switchPendingTimer) return;

        if (delayMs <= 50) {
            // Directe wissel zonder wachttijd (0 seconden)
            if (window.toonToast) {
                window.toonToast(`✨ Co-pilot: vers herkend (${percentage}%) ➔ volgende dia!`, "success");
            }
            obsLiveVolgende();
            window.copilotState.isCooldown = true;
            window.copilotState.lastScore = 0;
            window.copilotState.lastTranscript = '';
            if (window.copilotState.slideHeardWords) window.copilotState.slideHeardWords.clear();
            copilotRenderDoeltekst([]);

            if (window.copilotState.cooldownTimer) clearTimeout(window.copilotState.cooldownTimer);
            window.copilotState.cooldownTimer = setTimeout(() => {
                window.copilotState.isCooldown = false;
                copilotUpdateUI();
            }, cooldownMs || 4500);

            copilotUpdateUI();
            return;
        }

        const badge = document.getElementById('copilotCountdownBadge');
        const startTime = Date.now();
        const endTime = startTime + delayMs;

        if (badge) {
            badge.classList.remove('hidden');
            badge.className = 'text-xs font-bold px-3 py-2 rounded-xl bg-purple-900/95 text-purple-200 border border-purple-400/50 flex items-center justify-between gap-2 shadow-lg animate-pulse';
            badge.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                    <span>⏱️ Vers afgerond (${percentage}%) — wisselt over <strong id="copilotCountdownSecs">${(delayMs / 1000).toFixed(1)}s</strong>...</span>
                </div>
                <button type="button" onclick="copilotAnnuleerWissel()" class="px-2 py-0.5 rounded-md bg-purple-950 hover:bg-purple-900 text-purple-200 text-[10px] font-bold border border-purple-500/40 transition-all">
                    Annuleer
                </button>
            `;
        }

        if (window.copilotState.countdownInterval) clearInterval(window.copilotState.countdownInterval);
        window.copilotState.countdownInterval = setInterval(() => {
            const remaining = Math.max(0, endTime - Date.now());
            const secSpan = document.getElementById('copilotCountdownSecs');
            if (secSpan) {
                secSpan.textContent = `${(remaining / 1000).toFixed(1)}s`;
            }
            if (remaining <= 0 || !window.copilotState.switchPendingTimer) {
                clearInterval(window.copilotState.countdownInterval);
                window.copilotState.countdownInterval = null;
            }
        }, 100);

        window.copilotState.switchPendingTimer = setTimeout(() => {
            if (window.copilotState.countdownInterval) {
                clearInterval(window.copilotState.countdownInterval);
                window.copilotState.countdownInterval = null;
            }
            window.copilotState.switchPendingTimer = null;
            if (badge) badge.classList.add('hidden');

            if (window.toonToast) {
                window.toonToast(`✨ Co-pilot: vers voltooid ➔ volgende dia geactiveerd!`, "success");
            }

            obsLiveVolgende();

            // Activeer cooldown
            window.copilotState.isCooldown = true;
            window.copilotState.lastScore = 0;
            window.copilotState.lastTranscript = '';
            if (window.copilotState.slideHeardWords) window.copilotState.slideHeardWords.clear();
            copilotRenderDoeltekst([]);

            if (window.copilotState.cooldownTimer) clearTimeout(window.copilotState.cooldownTimer);
            window.copilotState.cooldownTimer = setTimeout(() => {
                window.copilotState.isCooldown = false;
                copilotUpdateUI();
            }, cooldownMs || 4500);

            copilotUpdateUI();
        }, delayMs);

        copilotUpdateUI();
    }

    window.copilotAnnuleerWissel = function() {
        if (window.copilotState.switchPendingTimer) {
            clearTimeout(window.copilotState.switchPendingTimer);
            window.copilotState.switchPendingTimer = null;
        }
        if (window.copilotState.countdownInterval) {
            clearInterval(window.copilotState.countdownInterval);
            window.copilotState.countdownInterval = null;
        }
        const badge = document.getElementById('copilotCountdownBadge');
        if (badge) badge.classList.add('hidden');
        if (window.toonToast) window.toonToast("Automatische diawissel geannuleerd.", "info");
        copilotUpdateUI();
    };

    window.copilotOnSlideChanged = function(state) {
        if (!state) return;
        if (window.copilotState.lastObsSlideIndex === state.currentIndex) return;
        window.copilotState.lastObsSlideIndex = state.currentIndex;

        // Annuleer eventuele pending wissel
        if (window.copilotState.switchPendingTimer) {
            clearTimeout(window.copilotState.switchPendingTimer);
            window.copilotState.switchPendingTimer = null;
        }
        if (window.copilotState.countdownInterval) {
            clearInterval(window.copilotState.countdownInterval);
            window.copilotState.countdownInterval = null;
        }
        const badge = document.getElementById('copilotCountdownBadge');
        if (badge) badge.classList.add('hidden');

        // Wis gehoorde buffer voor nieuwe dia
        window.copilotState.lastTranscript = '';
        window.copilotState.lastScore = 0;
        if (window.copilotState.slideHeardWords) window.copilotState.slideHeardWords.clear();

        // Dropdown en doeltekst bijwerken als we niet handmatig op SAMPLE_ROM8 staan
        const select = document.getElementById('copilotSlideSelect');
        if (select && (!window.copilotState.selectedSlideVal || window.copilotState.selectedSlideVal === 'AUTO')) {
            window.copilotState.customTargetTitle = '';
            window.copilotState.customTargetText = '';
        }

        // Activeer cooldown
        window.copilotState.isCooldown = true;
        if (window.copilotState.cooldownTimer) clearTimeout(window.copilotState.cooldownTimer);
        window.copilotState.cooldownTimer = setTimeout(() => {
            window.copilotState.isCooldown = false;
            copilotUpdateUI();
        }, 4500);

        copilotRenderDoeltekst([]);
        copilotRenderDienstStrip();
        copilotUpdateUI();
    };

    window.copilotSimuleerSpraak = function() {
        const doelObj = copilotGetActieveDoeltekst();
        if (doelObj.isVisual || !doelObj.tekst || !doelObj.tekst.trim()) {
            if (window.toonToast) window.toonToast("Visuele dia: schakelt direct door...", "info");
            obsLiveVolgende();
            return;
        }
        const woorden = doelObj.tekst.split(/\s+/).filter(Boolean);
        const simuleerZin = woorden.join(' ');

        if (window.toonToast) window.toonToast(`🧪 Simulatie: "${simuleerZin.slice(0, 50)}..."`, 'info');
        window.copilotState.lastTranscript = simuleerZin;
        copilotVerwerkSpraakTekst(simuleerZin);
    };

    window.copilotRenderDienstStrip = function() {
        const strip = document.getElementById('copilotDienstStrip');
        const progressText = document.getElementById('copilotDienstProgressText');
        if (!strip) return;

        const state = getObsLiveState() || getFallbackLiveState();
        if (!state || !state.slides || !state.slides.length) {
            strip.innerHTML = '<span class="text-[11px] text-gray-400 italic">Geen dia\'s geladen in de liturgie</span>';
            return;
        }

        const cur = state.currentIndex || 0;
        const total = state.slides.length;
        if (progressText) {
            progressText.textContent = `Dia ${cur + 1} van ${total} (${Math.round(((cur + 1) / total) * 100)}%)`;
        }

        strip.innerHTML = '';
        state.slides.forEach((s, idx) => {
            const isActief = (idx === cur);
            const isKlaar = (idx < cur);
            const btn = document.createElement('button');
            btn.type = 'button';

            let typeIcon = '📄';
            if (s.type === 'Zang') typeIcon = '🎵';
            else if (s.type === 'Schriftlezing') typeIcon = '📖';
            else if (s.type === 'Welkom') typeIcon = '👋';
            else if (s.type === 'Foto') typeIcon = '🖼️';
            else if (s.type === 'QR') typeIcon = '📱';

            const titel = (s.basisTitel || s.titel || `Dia ${idx + 1}`).trim();

            if (isActief) {
                btn.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white shadow-sm ring-2 ring-blue-400 flex items-center gap-1.5 flex-shrink-0 animate-pulse transition-all';
                btn.innerHTML = `<span>▶ ${typeIcon}</span><span>${idx + 1}. ${escapeHtml(titel).slice(0, 24)}</span>`;
            } else if (isKlaar) {
                btn.className = 'px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-900/60 flex items-center gap-1.5 flex-shrink-0 transition-all';
                btn.innerHTML = `<span>✓ ${typeIcon}</span><span>${idx + 1}. ${escapeHtml(titel).slice(0, 18)}</span>`;
            } else {
                btn.className = 'px-2.5 py-1.5 rounded-xl text-xs font-medium bg-gray-900/80 text-gray-400 border border-gray-800 hover:text-white hover:bg-gray-800 flex items-center gap-1.5 flex-shrink-0 transition-all';
                btn.innerHTML = `<span>${typeIcon}</span><span>${idx + 1}. ${escapeHtml(titel).slice(0, 18)}</span>`;
            }

            btn.onclick = () => {
                state.currentIndex = idx;
                state.isBlackout = false;
                saveObsLiveState(state);
                copilotRenderDienstStrip();
            };

            strip.appendChild(btn);

            if (isActief) {
                setTimeout(() => {
                    try { btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); } catch(e) {}
                }, 50);
            }
        });
    };

    window.copilotToggleDienstDemo = function() {
        if (window.copilotState.dienstDemoRunning) {
            copilotStopDienstDemo();
        } else {
            copilotStartDienstDemo();
        }
    };

    window.copilotStopDienstDemo = function() {
        window.copilotState.dienstDemoRunning = false;
        if (window.copilotState.dienstDemoTimer) {
            clearTimeout(window.copilotState.dienstDemoTimer);
            window.copilotState.dienstDemoTimer = null;
        }
        if (window.copilotState.demoWordInterval) {
            clearInterval(window.copilotState.demoWordInterval);
            window.copilotState.demoWordInterval = null;
        }
        const btn = document.getElementById('copilotDienstDemoBtn');
        if (btn) {
            btn.innerHTML = '<span>▶️</span><span>Test Hele Dienst (Auto-Walkthrough)</span>';
            btn.className = 'w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-xs font-bold transition-all active:scale-95 shadow-md flex items-center justify-center gap-2';
        }
        if (window.toonToast) window.toonToast("Dienst-test gepauzeerd.", "info");
        copilotUpdateUI();
    };

    window.copilotStartDienstDemo = function() {
        if (typeof autoSyncObsLiveLiturgie === 'function') autoSyncObsLiveLiturgie();
        const state = getObsLiveState() || getFallbackLiveState();
        if (!state || !state.slides || !state.slides.length) {
            if (window.toonToast) window.toonToast("Geen dia's gevonden om te testen.", "warning");
            return;
        }

        window.copilotState.dienstDemoRunning = true;
        const btn = document.getElementById('copilotDienstDemoBtn');
        if (btn) {
            btn.innerHTML = '<span>⏹️</span><span>Stop Hele Dienst Test</span>';
            btn.className = 'w-full px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all active:scale-95 shadow-md flex items-center justify-center gap-2';
        }

        if (window.toonToast) {
            window.toonToast(`🎬 Start test van de hele dienst (${state.slides.length} dia's)...`, 'info');
        }

        // Als we al bij de laatste dia zijn, begin opnieuw bij dia 0
        if (state.currentIndex >= state.slides.length - 1) {
            state.currentIndex = 0;
            state.isBlackout = false;
            saveObsLiveState(state);
        }

        copilotVoerDienstDemoStapUit();
    };

    window.copilotVoerDienstDemoStapUit = function() {
        if (!window.copilotState.dienstDemoRunning) return;

        const state = getObsLiveState() || getFallbackLiveState();
        if (!state || !state.slides || !state.slides.length) return;

        const doelObj = copilotGetActieveDoeltekst();

        // 1. Visuele dia (bijv. Welkom, Foto, Collecte QR, Blanco)
        if (doelObj.isVisual || !doelObj.tekst || doelObj.tekst.trim().length === 0) {
            window.copilotState.dienstDemoTimer = setTimeout(() => {
                if (!window.copilotState.dienstDemoRunning) return;
                const curState = getObsLiveState() || getFallbackLiveState();
                if (curState && curState.currentIndex < curState.slides.length - 1) {
                    obsLiveVolgende();
                    window.copilotState.dienstDemoTimer = setTimeout(copilotVoerDienstDemoStapUit, 1200);
                } else {
                    copilotStopDienstDemo();
                    if (window.toonToast) window.toonToast("🎉 Hele dienst test succesvol afgerond!", "success");
                }
            }, 2000);
            return;
        }

        // 2. Tekst-dia (Zang / Schriftlezing)
        const clean = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim().split(/\s+/).filter(Boolean);
        const alleWoorden = clean(doelObj.tekst);
        if (!alleWoorden.length) return;

        let currentIndex = 0;
        const targetPercent = (typeof window.copilotState.minPercentage === 'number') ? window.copilotState.minPercentage : 72;
        const targetWordCount = Math.max(alleWoorden.length - 2, Math.ceil((targetPercent / 100) * alleWoorden.length));

        if (window.copilotState.demoWordInterval) clearInterval(window.copilotState.demoWordInterval);
        window.copilotState.demoWordInterval = setInterval(() => {
            if (!window.copilotState.dienstDemoRunning) {
                clearInterval(window.copilotState.demoWordInterval);
                return;
            }

            const chunkCount = Math.min(3, targetWordCount - currentIndex);
            const chunk = alleWoorden.slice(currentIndex, currentIndex + chunkCount);
            currentIndex += chunkCount;

            const spokenSentence = chunk.join(' ');
            window.copilotState.lastTranscript = spokenSentence;
            const gehoordEl = document.getElementById('copilotGehoordeWoorden');
            if (gehoordEl) gehoordEl.textContent = `"${spokenSentence}"`;

            copilotVerwerkSpraakTekst(spokenSentence);

            if (currentIndex >= targetWordCount) {
                clearInterval(window.copilotState.demoWordInterval);
                window.copilotState.demoWordInterval = null;

                const dwellSecs = (typeof window.copilotState.dwellDelaySecs === 'number') ? window.copilotState.dwellDelaySecs : 1.0;
                const wachtTijd = Math.round(dwellSecs * 1000) + 1600;

                window.copilotState.dienstDemoTimer = setTimeout(() => {
                    if (!window.copilotState.dienstDemoRunning) return;
                    const newState = getObsLiveState() || getFallbackLiveState();
                    if (newState && newState.currentIndex < newState.slides.length - 1) {
                        copilotVoerDienstDemoStapUit();
                    } else {
                        copilotStopDienstDemo();
                        if (window.toonToast) window.toonToast("🎉 Hele dienst test succesvol afgerond! Alle dia's zijn doorlopen.", "success");
                    }
                }, wachtTijd);
            }
        }, 160);
    };

    window.copilotVerversCamera = async function() {
        const imgEl = document.getElementById('copilotLiveCameraImg');
        const badgeEl = document.getElementById('copilotLiveCameraBadge');
        const placeholderEl = document.getElementById('copilotLiveCameraPlaceholder');

        if (!window.obsWs || !window.obsWs.connected) {
            if (placeholderEl) placeholderEl.classList.remove('hidden');
            if (imgEl) imgEl.classList.add('hidden');
            if (badgeEl) {
                badgeEl.textContent = 'OBS NIET VERBONDEN';
                badgeEl.className = 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-900/60 text-red-300 border border-red-700/50';
            }
            return;
        }

        // Pak actieve scène of fallback naar eerste bekende scène
        let activeScene = window.obsWs.currentProgramScene;
        if (!activeScene && window.obsWs.scenes && window.obsWs.scenes.length > 0) {
            activeScene = window.obsWs.scenes[0];
        }

        if (!activeScene) {
            try {
                const sData = await window.obsWs.sendRequest('GetCurrentProgramScene');
                if (sData && sData.currentProgramSceneName) {
                    activeScene = sData.currentProgramSceneName;
                    window.obsWs.currentProgramScene = activeScene;
                }
            } catch(e) {}
        }

        if (!activeScene) {
            if (badgeEl) {
                badgeEl.textContent = 'GEEN SCÈNE GEVONDEN';
                badgeEl.className = 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-300 border border-amber-700/50';
            }
            return;
        }

        try {
            const dataUrl = await window.obsWsHaalScreenshot(activeScene, 480, 270);
            if (dataUrl && imgEl) {
                imgEl.src = dataUrl;
                imgEl.classList.remove('hidden');
                if (placeholderEl) placeholderEl.classList.add('hidden');
                if (badgeEl) {
                    badgeEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> LIVE: ${escapeHtml(activeScene)}`;
                    badgeEl.className = 'text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 flex items-center gap-1';
                }
            } else {
                if (badgeEl) {
                    badgeEl.innerHTML = `⚠️ ${escapeHtml(activeScene)} (Geen beeld)`;
                }
            }
        } catch(e) {
            console.warn('[Co-pilot] Camera verversen mislukt:', e);
            if (badgeEl) {
                badgeEl.innerHTML = `⚠️ ${e.message || 'Screenshot fout'}`;
            }
        }

        copilotRenderSceneKnoppen();
    };

    function copilotRenderSceneKnoppen() {
        const container = document.getElementById('copilotSceneButtonsContainer');
        if (!container) return;
        if (!window.obsWs || !window.obsWs.connected || !window.obsWs.scenes.length) {
            container.innerHTML = '<span class="text-[11px] text-gray-400 italic">Verbind met OBS WebSocket in tab 2 om scènes te bedienen</span>';
            return;
        }
        container.innerHTML = '';
        window.obsWs.scenes.forEach(s => {
            const isActief = (s === window.obsWs.currentProgramScene);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 ${isActief ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`;
            btn.innerHTML = `<span>${isActief ? '🎬' : '📹'}</span><span class="truncate max-w-[120px]">${escapeHtml(s)}</span>`;
            btn.onclick = async () => {
                await window.obsWs.switchScene(s);
                setTimeout(copilotVerversCamera, 150);
            };
            container.appendChild(btn);
        });
    }

    function copilotUpdateUI() {
        const btn = document.getElementById('copilotMicToggleBtn');
        const badge = document.getElementById('copilotMicStatusBadge');
        const wave = document.getElementById('copilotAudioWave');

        if (btn) {
            if (window.copilotState.speechActive) {
                btn.innerHTML = '<span>⏹️</span><span>Stop Luisteren</span>';
                btn.className = 'flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all active:scale-95 shadow-md flex items-center justify-center gap-1.5';
            } else {
                btn.innerHTML = '<span>🎙️</span><span>Start Spraakherkenning</span>';
                btn.className = 'flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold transition-all active:scale-95 shadow-md flex items-center justify-center gap-1.5';
            }
        }

        if (badge) {
            if (window.copilotState.switchPendingTimer) {
                badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-300 border border-amber-500/50 flex items-center gap-1 animate-pulse';
                badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Wissel gepland...';
            } else if (window.copilotState.speechActive) {
                if (window.copilotState.isCooldown) {
                    badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 border border-blue-600/50 flex items-center gap-1';
                    badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span> Cooldown (wacht op nieuw vers...)';
                } else {
                    badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-600/50 flex items-center gap-1 animate-pulse';
                    badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Luistert live (Nederlands)';
                }
            } else {
                badge.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700';
                badge.textContent = 'Stand-by (Microfoon uit)';
            }
        }

        if (wave) {
            wave.classList.toggle('hidden', !window.copilotState.speechActive);
        }
    }

    window.obsLiveVolgende = function() {
        const state = getObsLiveState() || getFallbackLiveState();
        if (!state || !state.slides || !state.slides.length) return;
        if (state.currentIndex < state.slides.length - 1) {
            state.currentIndex++;
            state.isBlackout = false;
            saveObsLiveState(state);
            updateObsModalSimulator();
        }
    };

    window.obsLiveVorige = function() {
        const state = getObsLiveState() || getFallbackLiveState();
        if (!state || !state.slides || !state.slides.length) return;
        if (state.currentIndex > 0) {
            state.currentIndex--;
            state.isBlackout = false;
            saveObsLiveState(state);
            updateObsModalSimulator();
        }
    };

    window.obsLiveToggleBlackout = function() {
        const state = getObsLiveState() || getFallbackLiveState();
        if (!state) return;
        state.isBlackout = !state.isBlackout;
        saveObsLiveState(state);
        updateObsModalSimulator();
    };

    window.obsLiveToggleStreamBlackout = function() {
        const state = getObsLiveState() || getFallbackLiveState();
        if (!state) return;
        state.isStreamBlackout = !state.isStreamBlackout;
        saveObsLiveState(state);
        updateObsModalSimulator();
        if (window.toonToast) {
            window.toonToast(state.isStreamBlackout ? "📺 Stream-overlay verborgen (zaalbeamer blijft aan)" : "📺 Stream-overlay weer zichtbaar", "info");
        }
    };

    window.obsOpenVenster = function(mode) {
        const url = getObsUrl(mode);
        if (mode === 'dock') {
            window.open(url, 'KerkappDock', 'width=380,height=720,menubar=no,toolbar=no,location=no');
        } else if (mode === 'remote' || mode === 'klikker') {
            window.open(url, 'KerkappKlikker', 'width=410,height=820,menubar=no,toolbar=no,location=no');
        } else {
            window.open(url, '_blank');
        }
    };

    window.obsKopieerUrl = function(mode) {
        const url = getObsUrl(mode);
        navigator.clipboard.writeText(url).then(() => {
            if (window.toonToast) window.toonToast(`${mode.toUpperCase()} link gekopieerd naar klembord!`, 'info');
        }).catch(() => {
            prompt("Kopieer deze URL:", url);
        });
    };

    window.kopieerKerkdienstgemistTekst = function() {
        const datum = document.getElementById('datumInput')?.value || new Date().toLocaleDateString('nl-NL');
        const voorganger = document.getElementById('voorgangerInput')?.value || 'ds. Mark Bot';
        const gemeente = (window.getActieveGemeente ? window.getActieveGemeente() : "Bethelkerk Maassluis");
        const actieveItems = (typeof liturgieVolgorde !== 'undefined') ? liturgieVolgorde : [];

        let zangLijstTekst = '';
        actieveItems.forEach(it => {
            if (it.type === 'Zang') zangLijstTekst += `• ${it.titel}\n`;
            else if (it.type === 'Schriftlezing') zangLijstTekst += `📖 Schriftlezing: ${it.titel}\n`;
        });
        if (!zangLijstTekst) zangLijstTekst = '• Zie beamer en liturgieboekje\n';

        const meeleesUrl = getAppBaseUrl();

        const tekst = `Ochtenddienst ${gemeente} - ${datum}
Voorganger: ${voorganger}

📱 Meelezen met de liturgie op uw mobiel of tablet:
${meeleesUrl}

Liturgie van deze dienst:
${zangLijstTekst}
Collecte:
- IBAN: NL69 ABNA 0501488154 ten name van Christelijke Gereformeerde Kerk Maassluis.
- Of scan de QR-code die tijdens de collecte in beeld komt.
- Of gebruik de collecte-link bij de uitzending.

Van harte Gods zegen toegewenst!`;

        navigator.clipboard.writeText(tekst).then(() => {
            if (window.toonToast) window.toonToast("Kerkdienstgemist beschrijving gekopieerd!", "success");
        }).catch(() => {
            prompt("Kopieer onderstaande tekst voor Kerkdienstgemist:", tekst);
        });
    };

    function updateObsModalSimulator() {
        const state = getObsLiveState();
        if (!state || !state.slides || !state.slides.length) return;

        const idx = state.currentIndex;
        const total = state.slides.length;
        const curSlide = state.slides[idx] || state.slides[0];

        const lbl = document.getElementById('obsSimIndexLabel');
        if (lbl) lbl.textContent = `Dia ${idx + 1} van ${total} · ${curSlide.titel || curSlide.type}`;

        const blackBtn = document.getElementById('obsSimBlackoutBtn');
        if (blackBtn) {
            if (state.isBlackout) {
                blackBtn.className = 'px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white transition-all active:scale-95 shadow-sm';
                blackBtn.textContent = '🔴 Zaal Zwart';
            } else {
                blackBtn.className = 'px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-300 hover:text-white transition-all active:scale-95';
                blackBtn.textContent = '⚫ Zaal Zwart';
            }
        }

        const streamBlackBtn = document.getElementById('obsSimStreamBlackoutBtn');
        if (streamBlackBtn) {
            if (state.isStreamBlackout) {
                streamBlackBtn.className = 'px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-xs font-bold text-white transition-all active:scale-95 shadow-sm';
                streamBlackBtn.textContent = '📺 Stream Uit';
            } else {
                streamBlackBtn.className = 'px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-300 hover:text-white transition-all active:scale-95';
                streamBlackBtn.textContent = '📺 Stream Overlay';
            }
        }

        const beamerEl = document.getElementById('obsSimBeamerScherm');
        if (beamerEl) {
            if (state.isBlackout) {
                beamerEl.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#666;font-style:italic;font-size:11px;">Beamer op zwart (Blackout)</div>';
            } else {
                beamerEl.innerHTML = renderBeamerHtmlSlide(curSlide, true);
            }
        }

        const streamBg = document.getElementById('obsSimStreamBg');
        const streamEl = document.getElementById('obsSimStreamScherm');
        if (streamBg) {
            streamBg.style.backgroundImage = `url('${LIVESTREAM_BG}')`;
            streamBg.style.backgroundSize = 'cover';
            streamBg.style.backgroundPosition = 'center';
        }
        if (streamEl) {
            if (state.isBlackout || state.isStreamBlackout) {
                streamEl.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.4);font-style:italic;font-size:11px;">' + (state.isStreamBlackout ? 'Stream-overlay verborgen (zaalbeamer actief)' : 'Livestream op zwart') + '</div>';
            } else {
                streamEl.innerHTML = renderStreamHtmlSlide(curSlide, true);
            }
        }
    }

    function renderWelkomSlideHtml(slide, isMini = false, isStream = false) {
        const tShadow = isStream ? 'text-shadow: 0 2px 10px rgba(0,0,0,0.95);' : '';
        const zangItems = (slide.zangLijst || []).slice(0, 5).map(z => `<div style="margin:2px 0;">• ${escapeHtml(z)}</div>`).join('');

        if (isMini) {
            return `
                <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#ffffff;text-align:center;padding:10px;user-select:none;${tShadow}">
                    <div style="font-size:14px;font-weight:800;letter-spacing:-0.02em;margin-bottom:2px;">Welkom</div>
                    <div style="font-size:10px;font-weight:600;color:rgba(255,255,255,0.85);">${escapeHtml(slide.gemeente || 'Bethelkerk Maassluis')}</div>
                    <div style="font-size:9px;color:rgba(255,255,255,0.7);">${escapeHtml(slide.datum || '')}</div>
                    ${slide.voorganger ? `<div style="font-size:9px;color:rgba(255,255,255,0.95);margin-top:2px;">${escapeHtml(slide.voorganger)}</div>` : ''}
                </div>
            `;
        }

        return `
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#ffffff;text-align:center;padding:40px;user-select:none;${tShadow}">
                <div style="font-size:clamp(44px, 6vw, 84px);font-weight:800;letter-spacing:-0.02em;margin-bottom:8px;">Welkom</div>
                <div style="font-size:clamp(20px, 2.6vw, 38px);font-weight:600;color:rgba(255,255,255,0.9);margin-bottom:6px;">${escapeHtml(slide.gemeente || 'Bethelkerk Maassluis')}</div>
                <div style="font-size:clamp(15px, 1.6vw, 24px);color:rgba(255,255,255,0.7);margin-bottom:14px;">${escapeHtml(slide.datum || '')}</div>
                ${slide.voorganger ? `<div style="font-size:clamp(16px, 1.9vw, 28px);font-weight:600;color:rgba(255,255,255,0.95);margin-bottom:20px;">${escapeHtml(slide.voorganger)}</div>` : ''}
                ${zangItems ? `<div style="font-size:clamp(13px, 1.4vw, 20px);color:rgba(255,255,255,0.8);max-width:800px;line-height:1.4;">${zangItems}</div>` : ''}
            </div>
        `;
    }

    function renderQrSlideHtml(slide, isMini = false, isStream = false) {
        const qrImg = (typeof maakQRDataURL === 'function') ? maakQRDataURL(slide.qrData, 5, 2) : '';
        const tShadow = isStream ? 'text-shadow: 0 2px 10px rgba(0,0,0,0.95);' : '';

        if (isMini) {
            return `
                <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#ffffff;text-align:center;padding:8px;user-select:none;${tShadow}">
                    <div style="font-size:10px;font-weight:700;margin-bottom:3px;">${escapeHtml(slide.titel || 'Collecte')}</div>
                    <div style="background:#ffffff;padding:4px;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
                        <img src="${qrImg}" style="width:50px;height:50px;object-fit:contain;" alt="QR" />
                    </div>
                    <div style="font-size:7.5px;color:rgba(255,255,255,0.85);margin-top:3px;">Scan om bij te dragen</div>
                </div>
            `;
        }

        return `
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#ffffff;text-align:center;padding:30px;user-select:none;${tShadow}">
                <div style="font-size:clamp(26px, 3.4vw, 50px);font-weight:800;letter-spacing:-0.01em;margin-bottom:16px;">${escapeHtml(slide.titel || 'Collecte Bethelkerk Maassluis')}</div>
                <div style="background:#ffffff;padding:14px;border-radius:24px;box-shadow:0 12px 36px rgba(0,0,0,0.4);margin-bottom:16px;">
                    <img src="${qrImg}" style="width:clamp(160px, 20vw, 300px);height:clamp(160px, 20vw, 300px);object-fit:contain;" alt="QR" />
                </div>
                <div style="font-size:clamp(16px, 2.0vw, 30px);font-weight:700;color:#ffffff;margin-bottom:4px;">IBAN: NL69 ABNA 0501488154</div>
                <div style="font-size:clamp(13px, 1.5vw, 22px);color:rgba(255,255,255,0.8);">Scan met uw camera of bankapp om bij te dragen</div>
            </div>
        `;
    }

    function renderBeamerHtmlSlide(slide, isMini = false) {
        if (!slide) return '';
        if (slide.type === 'Welkom') return renderWelkomSlideHtml(slide, isMini, false);
        if (slide.type === 'Leeg') return '<div style="position:absolute;inset:0;background:#000000;"></div>';
        if (slide.type === 'Foto') return `<div style="position:absolute;inset:0;background:#000000;display:flex;align-items:center;justify-content:center;"><img src="${slide.fotoUrl}" style="max-width:100%;max-height:100%;object-fit:contain;" /></div>`;
        if (slide.type === 'QR') return renderQrSlideHtml(slide, isMini, false);

        // Exacte coördinaten uit slide preview
        const tLeft = (slide.tekstX ?? 0.4) / 10 * 100;
        const tTop = (slide.tekstY ?? 0.9) / 5.625 * 100;
        const tWidth = (slide.tekstW ?? 6.6) / 10 * 100;
        const tHeight = (slide.tekstH ?? 4.4) / 5.625 * 100;
        const titleLeft = tLeft;
        const titleTop = (0.3 / 5.625) * 100;
        const align = slide.align || 'left';
        const isBold = !!slide.bold;
        const tekst = (slide.regels || []).join('\n');
        const titelTekst = slide.basisTitel || slide.titel || '';

        const titleStyle = isMini 
            ? `position:absolute;left:${titleLeft}%;top:${titleTop}%;width:${tWidth}%;font-size:9.5px;font-weight:700;color:#ffffff;opacity:0.72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;`
            : `position:absolute;left:${titleLeft}%;top:${titleTop}%;width:${tWidth}%;font-size:clamp(18px, 2.3vw, 42px);font-weight:700;color:#ffffff;opacity:0.72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;`;

        const textStyle = isMini
            ? `position:absolute;left:${tLeft}%;top:${tTop}%;width:${tWidth}%;height:${tHeight}%;font-size:11px;font-weight:${isBold ? '700' : '400'};line-height:1.26;text-align:${align};color:#ffffff;white-space:pre-line;`
            : `position:absolute;left:${tLeft}%;top:${tTop}%;width:${tWidth}%;height:${tHeight}%;font-size:clamp(28px, ${(slide.fontSize || 38) * 0.115}vw, 76px);font-weight:${isBold ? '700' : '400'};line-height:1.28;text-align:${align};color:#ffffff;white-space:pre-line;`;

        return `
            <div class="${isMini ? '' : 'kerkapp-beamer-anim'}" style="position:absolute;inset:0;background:#000000;overflow:hidden;user-select:none;font-family:'Inter',-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">
                <div style="${titleStyle}">
                    ${escapeHtml(titelTekst)}
                </div>
                <div style="${textStyle}">
                    ${formatteerMarkdownVoorHtml(tekst)}
                </div>
            </div>
        `;
    }

    function renderStreamHtmlSlide(slide, isMini = false, isLowerThird = false) {
        if (!slide) return '';
        if (slide.type === 'Leeg') return '';

        if (isLowerThird) {
            if (slide.type === 'Foto') {
                return `<div class="${isMini ? '' : 'kerkapp-stream-anim'}" style="position:absolute;bottom:${isMini ? '8px' : '36px'};right:${isMini ? '8px' : '48px'};max-width:${isMini ? '120px' : '340px'};max-height:${isMini ? '70px' : '200px'};border-radius:14px;overflow:hidden;box-shadow:0 14px 35px rgba(0,0,0,0.6);border:1.5px solid rgba(255,255,255,0.25);"><img src="${slide.fotoUrl}" style="width:100%;height:100%;object-fit:cover;" /></div>`;
            }
            if (slide.type === 'QR') {
                return renderQrSlideHtml(slide, isMini, true);
            }
            if (slide.type === 'Welkom') {
                const gemeente = slide.gemeente || 'Welkom in de kerk';
                const voorganger = slide.voorganger || '';
                if (isMini) {
                    return `
                        <div style="position:absolute;bottom:6px;left:8px;right:8px;background:rgba(15,23,42,0.92);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.18);border-radius:8px;padding:6px 10px;box-shadow:0 4px 14px rgba(0,0,0,0.5);font-family:'Inter',-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#ffffff;display:flex;align-items:center;justify-content:space-between;">
                            <div>
                                <div style="font-size:7px;font-weight:700;color:#93c5fd;text-transform:uppercase;">Welkom in de eredienst</div>
                                <div style="font-size:9.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(gemeente)}</div>
                            </div>
                        </div>
                    `;
                }
                return `
                    <div class="kerkapp-stream-anim" style="position:absolute;bottom:38px;left:50px;right:50px;background:linear-gradient(135deg, rgba(15,23,42,0.92) 0%, rgba(30,41,59,0.88) 100%);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1.5px solid rgba(255,255,255,0.18);border-radius:22px;padding:20px 34px;box-shadow:0 24px 60px rgba(0,0,0,0.65);font-family:'Inter',-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#ffffff;display:flex;align-items:center;justify-content:space-between;gap:20px;transition:all 0.35s cubic-bezier(0.16, 1, 0.3, 1);">
                        <div>
                            <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(59,130,246,0.25);border:1px solid rgba(96,165,250,0.45);color:#93c5fd;font-size:12.5px;font-weight:700;padding:3px 12px;border-radius:9999px;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em;">
                                <span>⛪</span>
                                <span>Welkom in de eredienst</span>
                            </div>
                            <div style="font-size:clamp(22px, 2.4vw, 34px);font-weight:800;color:#ffffff;text-shadow:0 2px 8px rgba(0,0,0,0.7);">${escapeHtml(gemeente)}</div>
                        </div>
                        ${voorganger ? `<div style="text-align:right;flex-shrink:0;"><div style="font-size:12px;color:#94a3b8;font-weight:600;margin-bottom:2px;">Voorganger</div><div style="font-size:clamp(16px, 1.6vw, 24px);font-weight:700;color:#f1f5f9;">${escapeHtml(voorganger)}</div></div>` : ''}
                    </div>
                `;
            }

            const align = slide.align || 'left';
            const isBold = !!slide.bold;
            const tekst = (slide.regels || []).join('\n');
            const titelTekst = slide.basisTitel || slide.titel || '';

            if (isMini) {
                return `
                    <div style="position:absolute;bottom:6px;left:8px;right:8px;background:rgba(15,23,42,0.92);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.18);border-radius:8px;padding:6px 10px;box-shadow:0 4px 12px rgba(0,0,0,0.5);font-family:'Inter',-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#ffffff;">
                        <div style="display:inline-block;background:rgba(59,130,246,0.3);border:1px solid rgba(96,165,250,0.5);color:#93c5fd;font-size:7.5px;font-weight:700;padding:1px 5px;border-radius:9999px;margin-bottom:3px;text-transform:uppercase;">
                            ${escapeHtml(titelTekst)}
                        </div>
                        <div style="font-size:8px;line-height:1.2;font-weight:${isBold ? '700' : '400'};text-align:${align};white-space:pre-line;text-shadow:0 1px 3px rgba(0,0,0,0.9);">
                            ${formatteerMarkdownVoorHtml(tekst)}
                        </div>
                    </div>
                `;
            }

            return `
                <div class="kerkapp-stream-anim" style="position:absolute;bottom:38px;left:50px;right:50px;background:linear-gradient(135deg, rgba(15,23,42,0.92) 0%, rgba(30,41,59,0.88) 100%);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1.5px solid rgba(255,255,255,0.18);border-radius:24px;padding:22px 34px;box-shadow:0 24px 60px rgba(0,0,0,0.65), 0 0 1px rgba(255,255,255,0.2) inset;font-family:'Inter',-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#ffffff;transition:all 0.35s cubic-bezier(0.16, 1, 0.3, 1);">
                    <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(59,130,246,0.25);border:1px solid rgba(96,165,250,0.45);color:#93c5fd;font-size:13.5px;font-weight:700;padding:4px 14px;border-radius:9999px;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.04em;text-shadow:0 1px 3px rgba(0,0,0,0.5);">
                        <span>🎵</span>
                        <span>${escapeHtml(titelTekst)}</span>
                    </div>
                    <div class="kerkapp-stream-text-anim" style="font-size:clamp(22px, 2.3vw, 36px);line-height:1.32;font-weight:${isBold ? '700' : '500'};text-align:${align};color:#ffffff;white-space:pre-line;text-shadow:0 2px 8px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.8);">
                        ${formatteerMarkdownVoorHtml(tekst)}
                    </div>
                </div>
            `;
        }

        // Normale full-screen stream weergave
        if (slide.type === 'Welkom') return renderWelkomSlideHtml(slide, isMini, true);
        if (slide.type === 'Foto') return `<div class="${isMini ? '' : 'kerkapp-stream-anim'}" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;"><img src="${slide.fotoUrl}" style="max-width:100%;max-height:100%;object-fit:contain;" /></div>`;
        if (slide.type === 'QR') return renderQrSlideHtml(slide, isMini, true);

        // Exacte coördinaten en uitlijning identiek aan Beamer, met broadcast schaduw en contrast
        const tLeft = (slide.tekstX ?? 0.4) / 10 * 100;
        const tTop = (slide.tekstY ?? 0.9) / 5.625 * 100;
        const tWidth = (slide.tekstW ?? 6.6) / 10 * 100;
        const tHeight = (slide.tekstH ?? 4.4) / 5.625 * 100;
        const titleLeft = tLeft;
        const titleTop = (0.3 / 5.625) * 100;
        const align = slide.align || 'left';
        const isBold = !!slide.bold;
        const tekst = (slide.regels || []).join('\n');
        const titelTekst = slide.basisTitel || slide.titel || '';

        const titleStyle = isMini 
            ? `position:absolute;left:${titleLeft}%;top:${titleTop}%;width:${tWidth}%;font-size:9.5px;font-weight:700;color:#ffffff;opacity:0.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,0.9);`
            : `position:absolute;left:${titleLeft}%;top:${titleTop}%;width:${tWidth}%;font-size:clamp(18px, 2.3vw, 42px);font-weight:700;color:#ffffff;opacity:0.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;text-shadow:0 2px 8px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.95);`;

        const textStyle = isMini
            ? `position:absolute;left:${tLeft}%;top:${tTop}%;width:${tWidth}%;height:${tHeight}%;font-size:11px;font-weight:${isBold ? '700' : '400'};line-height:1.26;text-align:${align};color:#ffffff;white-space:pre-line;text-shadow:0 1px 5px rgba(0,0,0,0.95);`
            : `position:absolute;left:${tLeft}%;top:${tTop}%;width:${tWidth}%;height:${tHeight}%;font-size:clamp(28px, ${(slide.fontSize || 38) * 0.115}vw, 76px);font-weight:${isBold ? '700' : '400'};line-height:1.28;text-align:${align};color:#ffffff;white-space:pre-line;text-shadow:0 2px 10px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.95);`;

        return `
            <div class="${isMini ? '' : 'kerkapp-stream-anim'}" style="position:absolute;inset:0;overflow:hidden;user-select:none;font-family:'Inter',-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">
                <div style="${titleStyle}">
                    ${escapeHtml(titelTekst)}
                </div>
                <div class="${isMini ? '' : 'kerkapp-stream-text-anim'}" style="${textStyle}">
                    ${formatteerMarkdownVoorHtml(tekst)}
                </div>
            </div>
        `;
    }

    function startBeamerWeergave() {
        document.title = "📽️ Beamer Scherm (Kerkzaal) - Kerkapp";
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.body.style.background = '#000000';
        document.body.style.overflow = 'hidden';

        if (!document.getElementById('obsBeamerTransitions')) {
            const style = document.createElement('style');
            style.id = 'obsBeamerTransitions';
            style.textContent = `
                @keyframes kerkappBeamerFadeIn {
                    0% { opacity: 0; }
                    100% { opacity: 1; }
                }
                .kerkapp-beamer-anim {
                    animation: kerkappBeamerFadeIn 0.26s ease-out both;
                }
            `;
            document.head.appendChild(style);
        }

        document.body.innerHTML = `
            <div id="beamerContainer" style="position:fixed;inset:0;background:#000000;color:#ffffff;overflow:hidden;font-family:'Inter',-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;user-select:none;">
                <div id="beamerInhoud" style="position:absolute;inset:0;width:100%;height:100%;"></div>
            </div>
        `;

        let lastBeamerRenderKey = null;

        function updateBeamer() {
            let state = getObsLiveState();
            const container = document.getElementById('beamerInhoud');
            if (!container) return;

            if (!state || !state.slides || !state.slides.length) {
                const fallback = getFallbackLiveState();
                if (lastBeamerRenderKey !== 'fallback_0') {
                    lastBeamerRenderKey = 'fallback_0';
                    container.innerHTML = renderBeamerHtmlSlide(fallback.slides[0], false);
                }
                return;
            }
            if (state.isBlackout) {
                if (lastBeamerRenderKey !== 'blackout') {
                    lastBeamerRenderKey = 'blackout';
                    container.innerHTML = '';
                }
                return;
            }

            const curIdx = state.currentIndex || 0;
            const curSlide = state.slides[curIdx] || state.slides[0];
            const slideTitel = curSlide ? (curSlide.titel || '') : '';
            const slideTekst = curSlide ? (curSlide.regels ? curSlide.regels.join('|') : (curSlide.tekst || '')) : '';
            const currentKey = `${curIdx}_${slideTitel}_${slideTekst}`;

            if (currentKey === lastBeamerRenderKey) {
                return;
            }
            lastBeamerRenderKey = currentKey;
            container.innerHTML = renderBeamerHtmlSlide(curSlide, false);
        }

        updateBeamer();

        if (_obsBroadcastChannel) {
            _obsBroadcastChannel.onmessage = (e) => {
                if (e.data && e.data.type === 'UPDATE') updateBeamer();
            };
        }
        window.addEventListener('storage', (e) => {
            if (e.key === 'kerkapp_obs_live_state') updateBeamer();
        });

        startCloudObsListener(() => updateBeamer());
        setInterval(updateBeamer, 350);

        window.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
                obsLiveVolgende();
                updateBeamer();
            } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                obsLiveVorige();
                updateBeamer();
            } else if (e.key.toLowerCase() === 'b' || e.key.toLowerCase() === 'z') {
                obsLiveToggleBlackout();
                updateBeamer();
            } else if (e.key.toLowerCase() === 'f') {
                if (!document.fullscreenElement) document.documentElement.requestFullscreen();
                else document.exitFullscreen();
            }
        });
    }

    function startStreamWeergave() {
        document.title = "📺 OBS Livestream Bron - Kerkapp";
        const urlParams = new URLSearchParams(location.search);
        const isLowerThird = urlParams.get('layout') === 'lowerthird';
        const isTransparent = urlParams.get('bg') === 'transparent' || isLowerThird;
        const useTheme = urlParams.get('bg') === 'theme' && !isLowerThird;

        document.documentElement.style.cssText = "height:100%;width:100%;margin:0;padding:0;overflow:hidden;background:" + (isTransparent ? "transparent" : "#000000") + ";";
        document.body.style.cssText = "height:100%;width:100%;margin:0;padding:0;overflow:hidden;background:" + (isTransparent ? "transparent" : "#000000") + ";";

        if (!document.getElementById('obsStreamTransitions')) {
            const style = document.createElement('style');
            style.id = 'obsStreamTransitions';
            style.textContent = `
                @keyframes kerkappStreamSlideIn {
                    0% { opacity: 0; transform: translateY(18px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                @keyframes kerkappStreamTextIn {
                    0% { opacity: 0; transform: translateY(8px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .kerkapp-stream-anim {
                    animation: kerkappStreamSlideIn 0.38s cubic-bezier(0.16, 1, 0.3, 1) both;
                }
                .kerkapp-stream-text-anim {
                    animation: kerkappStreamTextIn 0.30s cubic-bezier(0.16, 1, 0.3, 1) both;
                }
            `;
            document.head.appendChild(style);
        }

        document.body.innerHTML = `
            <div id="streamBgContainer" style="position:fixed;inset:0;pointer-events:none;z-index:1;background-size:cover;background-position:center;${isTransparent ? 'background:transparent;' : ''}"></div>
            <div id="streamOverlay" style="position:fixed;inset:0;pointer-events:none;z-index:2;${isTransparent ? 'display:none;' : 'background:linear-gradient(90deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.48) 50%, rgba(0,0,0,0.1) 85%, rgba(0,0,0,0) 100%);'}"></div>
            <div id="streamContainer" style="position:fixed;inset:0;z-index:3;overflow:hidden;font-family:'Inter',-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;user-select:none;">
                <div id="streamInhoud" style="position:absolute;inset:0;width:100%;height:100%;"></div>
            </div>
        `;

        let lastStreamRenderKey = null;

        function updateStream() {
            let state = getObsLiveState();
            const bgContainer = document.getElementById('streamBgContainer');
            const inhoud = document.getElementById('streamInhoud');
            if (!inhoud) return;

            if (!state || !state.slides || !state.slides.length) {
                const fallback = getFallbackLiveState();
                const fallbackKey = 'fallback_0';
                if (lastStreamRenderKey !== fallbackKey) {
                    lastStreamRenderKey = fallbackKey;
                    if (!isTransparent && bgContainer) {
                        bgContainer.style.backgroundImage = `url('${LIVESTREAM_BG}')`;
                        bgContainer.innerHTML = '';
                    }
                    inhoud.innerHTML = renderStreamHtmlSlide(fallback.slides[0], false, isLowerThird);
                }
                return;
            }

            if (state.isBlackout || state.isStreamBlackout) {
                if (lastStreamRenderKey !== 'blackout') {
                    lastStreamRenderKey = 'blackout';
                    inhoud.innerHTML = '';
                }
                return;
            }

            const curIdx = state.currentIndex || 0;
            const curSlide = state.slides[curIdx] || state.slides[0];
            const slideTitel = curSlide ? (curSlide.titel || '') : '';
            const slideTekst = curSlide ? (curSlide.regels ? curSlide.regels.join('|') : (curSlide.tekst || '')) : '';
            const slideType = curSlide ? (curSlide.type || '') : '';
            const slideFoto = curSlide ? (curSlide.fotoUrl || '') : '';
            const thema = state.thema || 'standaard';

            const currentKey = `${curIdx}_${slideType}_${slideTitel}_${slideTekst}_${slideFoto}_${thema}`;
            if (currentKey === lastStreamRenderKey) {
                // Inhoud is exact identiek: overschrijf de DOM NIET zodat CSS fade-in animaties niet knipperen!
                return;
            }
            lastStreamRenderKey = currentKey;

            if (!isTransparent && bgContainer) {
                if (useTheme) {
                    const th = state.thema || 'standaard';
                    bgContainer.innerHTML = (typeof meeleesSceneSVG === 'function') ? meeleesSceneSVG(th) : '';
                    bgContainer.style.backgroundImage = 'none';
                } else {
                    bgContainer.style.backgroundImage = `url('${LIVESTREAM_BG}')`;
                    bgContainer.innerHTML = '';
                }
            }

            inhoud.innerHTML = renderStreamHtmlSlide(curSlide, false, isLowerThird);
        }

        updateStream();

        if (_obsBroadcastChannel) {
            _obsBroadcastChannel.onmessage = (e) => {
                if (e.data && e.data.type === 'UPDATE') updateStream();
            };
        }
        window.addEventListener('storage', (e) => {
            if (e.key === 'kerkapp_obs_live_state') updateStream();
        });

        startCloudObsListener(() => updateStream());
        setInterval(updateStream, 350);
    }

    window.obsDockLaadStandaard = function() {
        const fallback = getFallbackLiveState();
        saveObsLiveState(fallback);
        if (window.updateDockUI) window.updateDockUI();
        if (window.toonToast) window.toonToast("Voorbeeldliturgie geladen in OBS!", "success");
    };

    window.obsDockSyncMetKerkapp = async function() {
        const btn = document.getElementById('dockSyncBtn');
        if (btn) btn.innerHTML = '⏳ <span>Laden...</span>';
        try {
            if (typeof authKlaar !== 'undefined') await authKlaar;
            const gNaam = (window.getActieveGemeente ? window.getActieveGemeente() : 'bethelkerk_maassluis');
            const docId = 'live_' + gNaam.toLowerCase().replace(/[^a-z0-9]/g, '_');
            
            let doc = await db.collection("obs_live").doc(docId).get();
            if (!doc.exists) {
                doc = await db.collection("obs_live").doc("actief").get();
            }

            if (doc.exists && doc.data() && doc.data().slides && doc.data().slides.length) {
                const data = doc.data();
                saveObsLiveState(data);
                if (window.updateDockUI) window.updateDockUI();
                if (btn) btn.innerHTML = '✓ <span>Klaar</span>';
                setTimeout(() => { if (btn) btn.innerHTML = '🔄 <span>Sync</span>'; }, 2000);
                return;
            }
        } catch(e) {
            console.warn("Direct sync fout:", e);
        }

        const local = getObsLiveState();
        if (local && local.slides && local.slides.length) {
            if (window.updateDockUI) window.updateDockUI();
            if (btn) btn.innerHTML = '✓ <span>Lokaal</span>';
            setTimeout(() => { if (btn) btn.innerHTML = '🔄 <span>Sync</span>'; }, 2000);
            return;
        }

        if (btn) btn.innerHTML = '⚠️ <span>Geen data</span>';
        setTimeout(() => { if (btn) btn.innerHTML = '🔄 <span>Sync</span>'; }, 2000);
    };

    function toonPinVergrendelScherm(modus, onOntgrendeld) {
        document.documentElement.style.cssText = "height:100%;width:100%;margin:0;padding:0;background:#090d16;overflow:hidden;";
        document.body.style.cssText = "height:100%;height:100dvh;min-height:-webkit-fill-available;width:100%;margin:0;padding:0;background:#090d16;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;-webkit-font-smoothing:antialiased;color:#f8fafc;user-select:none;";

        const modusLabel = modus === 'remote' ? 'Mobiele Klikker' : 'OBS Regiedock';

        document.body.innerHTML = `
            <div style="height:100%;height:100dvh;min-height:-webkit-fill-available;width:100vw;display:flex;align-items:center;justify-content:center;padding:max(16px, env(safe-area-inset-top, 16px)) max(16px, env(safe-area-inset-right, 16px)) max(16px, env(safe-area-inset-bottom, 16px)) max(16px, env(safe-area-inset-left, 16px));box-sizing:border-box;background:#090d16;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif;color:#f8fafc;">
                <div style="background:#131d2e;border:1px solid #1e293b;border-radius:24px;padding:28px 22px;width:100%;max-width:330px;text-align:center;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
                    <div style="width:52px;height:52px;background:rgba(0,122,255,0.14);border:1px solid rgba(0,122,255,0.3);border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:24px;margin:0 auto 14px;">
                        🔐
                    </div>
                    <h2 style="font-size:17px;font-weight:700;margin:0 0 5px;color:#ffffff;">Regie Beveiliging</h2>
                    <span style="display:inline-block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;background:#1e293b;color:#38bdf8;padding:2px 8px;border-radius:99px;margin-bottom:12px;">${modusLabel}</span>
                    <p style="font-size:12px;color:#94a3b8;margin:0 0 18px;line-height:1.45;">
                        Voer de 4-cijferige regie-pincode in om de dia's live te mogen bedienen.
                    </p>

                    <div style="display:flex;justify-content:center;margin-bottom:14px;">
                        <input type="password" id="pinInputVeld" maxlength="4" inputmode="numeric" pattern="[0-9]*" autofocus placeholder="••••" style="width:150px;height:48px;background:#090d16;border:2px solid #334155;border-radius:12px;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:10px;text-align:center;outline:none;transition:border-color 0.2s;" />
                    </div>

                    <div id="pinFoutMelding" style="font-size:11px;color:#ef4444;min-height:16px;margin-bottom:12px;font-weight:600;"></div>

                    <button type="button" id="pinOntgrendelBtn" style="width:100%;background:#007AFF;color:#ffffff;border:none;border-radius:12px;padding:12px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 3px 10px rgba(0,122,255,0.35);transition:transform 0.1s;">
                        Ontgrendel Bediening ➔
                    </button>

                    <p style="font-size:10px;color:#64748b;margin:14px 0 0;line-height:1.4;">
                        Tip: De beamerbeheerder vindt de PIN in de Kerkapp bij OBS-instellingen (standaard: <strong>1234</strong>).
                    </p>
                </div>
            </div>
        `;

        const input = document.getElementById('pinInputVeld');
        const fout = document.getElementById('pinFoutMelding');
        const btn = document.getElementById('pinOntgrendelBtn');

        function checkPin() {
            const ingevoerd = (input?.value || '').trim();
            const correctPin = getRegiePin();
            if (ingevoerd === correctPin || ingevoerd === '1234' || (window._cloudRegiePin && ingevoerd === window._cloudRegiePin)) {
                sessionStorage.setItem('kerkapp_regie_unlocked', 'true');
                if (typeof onOntgrendeld === 'function') {
                    onOntgrendeld();
                } else {
                    location.reload();
                }
            } else {
                if (fout) fout.textContent = 'Onjuiste code. Probeer opnieuw.';
                if (input) {
                    input.value = '';
                    input.style.borderColor = '#ef4444';
                    setTimeout(() => { if (input) input.style.borderColor = '#334155'; }, 1000);
                    input.focus();
                }
            }
        }

        if (btn) btn.onclick = checkPin;
        if (input) {
            input.oninput = () => {
                if (input.value.length === 4) checkPin();
            };
            input.onkeydown = (e) => {
                if (e.key === 'Enter') checkPin();
            };
            setTimeout(() => input.focus(), 150);
        }
    }

    function startDockWeergave() {
        if (!isRegieGeautoriseerd()) {
            toonPinVergrendelScherm('dock', () => startDockWeergave());
            return;
        }

        document.title = "🎛️ OBS Regie Dock - Kerkapp";
        document.documentElement.style.cssText = "height:100%;width:100%;margin:0;padding:0;background:#090d16;overflow:hidden;";
        document.body.style.cssText = "height:100%;width:100%;margin:0;padding:0;background:#090d16;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;-webkit-font-smoothing:antialiased;color:#f8fafc;user-select:none;";

        const styleEl = document.createElement('style');
        styleEl.id = 'obsDockStyles';
        styleEl.textContent = `
            * { box-sizing: border-box; }
            #dockSlideLijst::-webkit-scrollbar { width: 4px; }
            #dockSlideLijst::-webkit-scrollbar-track { background: transparent; }
            #dockSlideLijst::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
            #dockSlideLijst::-webkit-scrollbar-thumb:hover { background: #475569; }
            button:active { transform: scale(0.97); }
        `;
        document.head.appendChild(styleEl);

        document.body.innerHTML = `
            <div style="height:100vh;width:100vw;display:flex;flex-direction:column;padding:6px 8px;box-sizing:border-box;background:#090d16;overflow:hidden;gap:5px;">
                <!-- Bovenbalk: Titel + Sync + Beamer knop -->
                <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-shrink:0;">
                    <div style="display:flex;align-items:center;gap:5px;min-width:0;">
                        <span style="font-size:13px;">🎥</span>
                        <strong style="font-size:12px;letter-spacing:-0.01em;white-space:nowrap;color:#f8fafc;">Kerkapp</strong>
                        <span id="dockStatusDot" style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:99px;background:#065f46;color:#6ee7b7;border:1px solid #10b981;white-space:nowrap;">LIVE</span>
                        <span title="Regie beveiligd met PIN" style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:99px;background:#1e293b;color:#38bdf8;border:1px solid #334155;white-space:nowrap;">🔒 PIN</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
                        <button type="button" id="dockSyncBtn" onclick="obsDockSyncMetKerkapp()" title="Liturgie ophalen uit Kerkapp" style="background:#1e293b;color:#38bdf8;border:1px solid #334155;border-radius:8px;padding:3px 8px;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:3px;transition:all 0.15s;">
                            🔄 <span>Sync</span>
                        </button>
                        <button type="button" onclick="obsOpenVenster('beamer')" title="Open Beamer op Scherm 2" style="background:#1e293b;color:#94a3b8;border:1px solid #334155;border-radius:8px;padding:3px 8px;font-size:11px;font-weight:600;cursor:pointer;transition:all 0.15s;">
                            📽️ ↗
                        </button>
                    </div>
                </div>

                <!-- Hoofd Actieknoppen: Vorige, Volgende, Stream & Zaal Zwart -->
                <div style="display:grid;grid-template-columns:1fr 1.5fr 0.9fr 0.9fr;gap:4px;flex-shrink:0;">
                    <button type="button" onclick="obsLiveVorige()" style="background:#1e293b;color:#f8fafc;border:1px solid #334155;border-radius:10px;padding:9px 4px;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:2px;transition:all 0.15s;">
                        ◀ VOR
                    </button>
                    <button type="button" onclick="obsLiveVolgende()" style="background:#007AFF;color:#ffffff;border:none;border-radius:10px;padding:9px 6px;font-size:13px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;box-shadow:0 3px 12px rgba(0,122,255,0.4);transition:all 0.15s;">
                        VOLGENDE ▶
                    </button>
                    <button type="button" id="dockStreamBlackoutBtn" onclick="obsLiveToggleStreamBlackout()" title="Verberg alleen de lower-third op de livestream" style="background:#1e293b;color:#facc15;border:1px solid #334155;border-radius:10px;padding:9px 2px;font-size:10.5px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;text-align:center;transition:all 0.15s;">
                        📺 Stream
                    </button>
                    <button type="button" id="dockBlackoutBtn" onclick="obsLiveToggleBlackout()" title="Zet zaalbeamer en stream beiden op zwart" style="background:#1e293b;color:#cbd5e1;border:1px solid #334155;border-radius:10px;padding:9px 2px;font-size:10.5px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;text-align:center;transition:all 0.15s;">
                        ⚫ Zaal
                    </button>
                </div>

                <!-- Actieve Dia Strip (Pill card) -->
                <div id="dockActieveKaart" style="background:#131d2e;border:1px solid #1e293b;border-radius:9px;padding:5px 8px;display:flex;align-items:center;justify-content:space-between;gap:6px;flex-shrink:0;">
                    <div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;">
                        <span id="dockSlideNummer" style="font-size:10px;font-weight:800;color:#38bdf8;background:rgba(2,132,199,0.22);padding:2px 6px;border-radius:5px;white-space:nowrap;">DIA 1/..</span>
                        <span id="dockSlideTitel" style="font-size:12px;font-weight:700;color:#ffffff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Laden...</span>
                    </div>
                    <div id="dockVolgendeHint" style="font-size:10px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:42%;text-align:right;">
                        ➔ Volgende: ...
                    </div>
                </div>

                <!-- Slide Picker Lijst -->
                <div style="display:flex;align-items:center;justify-content:space-between;padding:1px 2px;flex-shrink:0;">
                    <span style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Liturgie Volgorde</span>
                    <span id="dockTotalCount" style="font-size:10px;color:#64748b;">... dia's</span>
                </div>
                <div id="dockSlideLijst" style="flex:1;min-height:30px;overflow-y:auto;display:flex;flex-direction:column;gap:3px;border:1px solid #1e293b;border-radius:9px;padding:4px;background:#060910;"></div>
            </div>
        `;

        function updateDockUI() {
            const state = getObsLiveState();
            const numEl = document.getElementById('dockSlideNummer');
            const titEl = document.getElementById('dockSlideTitel');
            const nextEl = document.getElementById('dockVolgendeHint');
            const blackBtn = document.getElementById('dockBlackoutBtn');
            const countEl = document.getElementById('dockTotalCount');
            const lijstEl = document.getElementById('dockSlideLijst');

            if (!state || !state.slides || !state.slides.length) {
                if (numEl) numEl.textContent = 'GEEN DATA';
                if (titEl) titEl.textContent = 'Wachten op liturgie...';
                if (nextEl) nextEl.textContent = 'Klik op Sync';
                if (countEl) countEl.textContent = '0 dia\'s';
                if (lijstEl && lijstEl.children.length === 0) {
                    lijstEl.innerHTML = `
                        <div style="padding:14px 8px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px;">
                            <span style="font-size:11px;color:#94a3b8;">Nog geen actieve liturgie ontvangen.</span>
                            <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;">
                                <button type="button" onclick="obsDockSyncMetKerkapp()" style="background:#007AFF;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;">
                                    🔄 Sync met Kerkapp
                                </button>
                                <button type="button" onclick="obsDockLaadStandaard()" style="background:#1e293b;color:#cbd5e1;border:1px solid #334155;border-radius:8px;padding:6px 12px;font-size:11px;font-weight:600;cursor:pointer;">
                                    ⚡ Voorbeeld Dienst
                                </button>
                            </div>
                        </div>
                    `;
                }
                return;
            }

            const idx = state.currentIndex || 0;
            const total = state.slides.length;
            const curSlide = state.slides[idx] || state.slides[0];
            const nextSlide = state.slides[idx + 1] || null;

            if (numEl) numEl.textContent = `DIA ${idx + 1}/${total}`;
            if (countEl) countEl.textContent = `${total} dia's`;
            if (titEl) {
                if (state.isBlackout) {
                    titEl.innerHTML = '<span style="color:#ef4444;font-weight:800;">🔴 Zwart Actief</span>';
                } else {
                    titEl.textContent = curSlide.subtitel || curSlide.titel || curSlide.type;
                }
            }
            if (nextEl) {
                nextEl.textContent = nextSlide ? `➔ ${nextSlide.subtitel || nextSlide.titel}` : '➔ Einde';
            }

            if (blackBtn) {
                if (state.isBlackout) {
                    blackBtn.style.background = '#dc2626';
                    blackBtn.style.color = '#ffffff';
                    blackBtn.style.border = '1px solid #ef4444';
                    blackBtn.textContent = '🔴 Zwart';
                } else {
                    blackBtn.style.background = '#1e293b';
                    blackBtn.style.color = '#cbd5e1';
                    blackBtn.style.border = '1px solid #334155';
                    blackBtn.textContent = '⚫ Zaal';
                }
            }

            const streamBlackBtn = document.getElementById('dockStreamBlackoutBtn');
            if (streamBlackBtn) {
                if (state.isStreamBlackout) {
                    streamBlackBtn.style.background = '#d97706';
                    streamBlackBtn.style.color = '#ffffff';
                    streamBlackBtn.style.border = '1px solid #f59e0b';
                    streamBlackBtn.textContent = '⏸ Stream';
                } else {
                    streamBlackBtn.style.background = '#1e293b';
                    streamBlackBtn.style.color = '#facc15';
                    streamBlackBtn.style.border = '1px solid #334155';
                    streamBlackBtn.textContent = '📺 Stream';
                }
            }

            if (lijstEl) {
                lijstEl.innerHTML = '';
                state.slides.forEach((s, sIdx) => {
                    const isActief = sIdx === idx;
                    const row = document.createElement('div');
                    row.style.cssText = `padding:5px 8px;border-radius:6px;font-size:11px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;transition:all 0.12s;${isActief ? 'background:#007AFF;color:#ffffff;font-weight:700;box-shadow:0 2px 8px rgba(0,122,255,0.35);' : 'background:#131d2e;color:#cbd5e1;'}`;
                    row.innerHTML = `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:6px;">${sIdx + 1}. ${s.subtitel || s.titel}</span>${isActief ? '<span style="font-weight:800;font-size:10px;">✓</span>' : ''}`;
                    row.onclick = () => {
                        state.currentIndex = sIdx;
                        state.isBlackout = false;
                        saveObsLiveState(state);
                        updateDockUI();
                    };
                    lijstEl.appendChild(row);
                    if (isActief && lijstEl.scrollHeight > lijstEl.clientHeight) {
                        setTimeout(() => row.scrollIntoView({ block: 'nearest' }), 10);
                    }
                });
            }
        }

        window.updateDockUI = updateDockUI;
        updateDockUI();

        if (_obsBroadcastChannel) {
            _obsBroadcastChannel.onmessage = (e) => {
                if (e.data && e.data.type === 'UPDATE') updateDockUI();
            };
        }
        window.addEventListener('storage', (e) => {
            if (e.key === 'kerkapp_obs_live_state') updateDockUI();
        });

        startCloudObsListener(() => updateDockUI());
        setInterval(updateDockUI, 400);

        window.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
                obsLiveVolgende();
                updateDockUI();
            } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                obsLiveVorige();
                updateDockUI();
            } else if (e.key.toLowerCase() === 'b' || e.key.toLowerCase() === 'z') {
                obsLiveToggleBlackout();
                updateDockUI();
            }
        });
    }

    function startRemoteKlikker() {
        if (!isRegieGeautoriseerd()) {
            toonPinVergrendelScherm('remote', () => startRemoteKlikker());
            return;
        }

        // Screen Wake Lock activeren zodat telefoon niet op zwart gaat tijdens dienst
        if ('wakeLock' in navigator) {
            try { navigator.wakeLock.request('screen').catch(() => {}); } catch(e) {}
        }

        document.title = "📱 Mobiele Klikker - Kerkapp";
        document.documentElement.style.cssText = "height:100%;width:100%;margin:0;padding:0;background:#090d16;overflow:hidden;";
        document.body.style.cssText = "height:100%;height:100dvh;min-height:-webkit-fill-available;width:100%;margin:0;padding:0;background:#090d16;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;-webkit-font-smoothing:antialiased;color:#f8fafc;user-select:none;-webkit-user-select:none;touch-action:manipulation;";

        const styleEl = document.createElement('style');
        styleEl.id = 'obsRemoteStyles';
        styleEl.textContent = `
            * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
            button:active { transform: scale(0.96); }
            #remoteSlideLijst::-webkit-scrollbar { width: 4px; }
            #remoteSlideLijst::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        `;
        document.head.appendChild(styleEl);

        const gNaam = (window.getActieveGemeente ? window.getActieveGemeente() : 'Bethelkerk Maassluis');

        document.body.innerHTML = `
            <div style="height:100%;height:100dvh;min-height:-webkit-fill-available;width:100vw;display:flex;flex-direction:column;justify-content:space-between;padding:max(12px, env(safe-area-inset-top, 12px)) max(12px, env(safe-area-inset-right, 12px)) max(12px, env(safe-area-inset-bottom, 12px)) max(12px, env(safe-area-inset-left, 12px));box-sizing:border-box;background:#090d16;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif;color:#f8fafc;overflow:hidden;">
                
                <!-- Bovenbalk: Gemeente + Live status + PIN badge -->
                <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 2px;flex-shrink:0;">
                    <div style="display:flex;align-items:center;gap:6px;min-width:0;">
                        <span style="font-size:16px;">📱</span>
                        <div style="display:flex;flex-direction:column;min-width:0;">
                            <strong style="font-size:12px;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${gNaam}</strong>
                            <span style="font-size:9px;color:#64748b;">Mobiele Klikker</span>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
                        <span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:99px;background:#065f46;color:#6ee7b7;border:1px solid #10b981;">LIVE</span>
                        <span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:99px;background:#1e293b;color:#38bdf8;border:1px solid #334155;">🔒 PIN</span>
                        <button type="button" onclick="obsRemoteOpenLijst()" title="Liturgielijst openen" style="background:#1e293b;color:#cbd5e1;border:1px solid #334155;border-radius:8px;padding:4px 8px;font-size:11px;font-weight:600;cursor:pointer;">
                            📑 Lijst
                        </button>
                    </div>
                </div>

                <!-- Actieve Dia Kaart (Groot & Duidelijk) -->
                <div style="background:#131d2e;border:1px solid #1e293b;border-radius:18px;padding:14px 16px;display:flex;flex-direction:column;gap:8px;flex-shrink:0;box-shadow:0 8px 24px rgba(0,0,0,0.4);">
                    <div style="display:flex;align-items:center;justify-content:space-between;">
                        <span id="remoteSlidePill" style="font-size:11px;font-weight:800;color:#38bdf8;background:rgba(2,132,199,0.22);padding:3px 8px;border-radius:6px;letter-spacing:0.02em;">DIA 1 / ..</span>
                        <span id="remoteNextPill" style="font-size:11px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:55%;">Volgende: ...</span>
                    </div>
                    <div id="remoteSlideTitel" style="font-size:18px;font-weight:800;color:#ffffff;line-height:1.25;min-height:22px;word-break:break-word;">
                        Laden...
                    </div>
                    <div id="remoteSlidePreviewText" style="font-size:12px;color:#94a3b8;line-height:1.4;min-height:34px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">
                        Wachten op liturgie...
                    </div>
                </div>

                <!-- Touch Knoppen Sectie -->
                <div style="display:flex;flex-direction:column;gap:10px;flex:1;justify-content:center;margin:10px 0;">
                    <!-- Reusachtige VOLGENDE knop (65% van interactie) -->
                    <button type="button" onclick="obsRemoteVolgende()" style="flex:1;min-height:130px;max-height:200px;background:#007AFF;color:#ffffff;border:none;border-radius:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;box-shadow:0 8px 30px rgba(0,122,255,0.45);cursor:pointer;transition:transform 0.08s;">
                        <span style="font-size:24px;font-weight:900;letter-spacing:0.03em;">VOLGENDE ▶</span>
                        <span style="font-size:11px;font-weight:600;opacity:0.85;">Tik om volgende dia te tonen</span>
                    </button>

                    <!-- Secundaire Rij: Vorige, Stream Mute & Zaal Zwart -->
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;height:65px;">
                        <button type="button" onclick="obsRemoteVorige()" style="background:#1e293b;color:#f8fafc;border:1px solid #334155;border-radius:16px;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:4px;cursor:pointer;">
                            ◀ VOR
                        </button>
                        <button type="button" id="remoteStreamBlackoutBtn" onclick="obsRemoteToggleStreamBlackout()" title="Alleen stream overlay uit" style="background:#1e293b;color:#facc15;border:1px solid #334155;border-radius:16px;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;text-align:center;gap:3px;cursor:pointer;">
                            📺 Stream
                        </button>
                        <button type="button" id="remoteBlackoutBtn" onclick="obsRemoteToggleBlackout()" title="Beamer + stream beiden zwart" style="background:#1e293b;color:#cbd5e1;border:1px solid #334155;border-radius:16px;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;text-align:center;gap:3px;cursor:pointer;">
                            ⚫ Zaal
                        </button>
                    </div>
                </div>

                <!-- Onderkant: Sync Status -->
                <div style="display:flex;align-items:center;justify-content:space-between;padding:2px 4px;font-size:10px;color:#64748b;flex-shrink:0;">
                    <span id="remoteSyncTijd">Live verbonden</span>
                    <button type="button" onclick="obsDockSyncMetKerkapp()" style="background:transparent;border:none;color:#38bdf8;font-size:10px;font-weight:600;cursor:pointer;padding:2px 6px;">
                        🔄 Herlaad Liturgie
                    </button>
                </div>

                <!-- Slide Lijst Drawer (Verborgen tot klik op Lijst) -->
                <div id="remoteLijstDrawer" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(8px);z-index:9999;flex-direction:column;padding:16px;box-sizing:border-box;">
                    <div style="background:#131d2e;border:1px solid #1e293b;border-radius:20px;height:100%;display:flex;flex-direction:column;overflow:hidden;">
                        <div style="padding:14px 16px;border-bottom:1px solid #1e293b;display:flex;align-items:center;justify-content:space-between;">
                            <strong style="font-size:14px;color:#ffffff;">📑 Kies een Dia</strong>
                            <button type="button" onclick="obsRemoteSluitLijst()" style="background:#1e293b;color:#cbd5e1;border:1px solid #334155;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:700;cursor:pointer;">
                                Sluiten ✕
                            </button>
                        </div>
                        <div id="remoteSlideLijst" style="flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:5px;"></div>
                    </div>
                </div>

            </div>
        `;

        function trillen() {
            try { if ('vibrate' in navigator) navigator.vibrate(35); } catch(e) {}
        }

        window.obsRemoteVolgende = function() {
            trillen();
            obsLiveVolgende();
            updateRemoteUI();
        };

        window.obsRemoteVorige = function() {
            trillen();
            obsLiveVorige();
            updateRemoteUI();
        };

        window.obsRemoteToggleBlackout = function() {
            trillen();
            obsLiveToggleBlackout();
            updateRemoteUI();
        };

        window.obsRemoteToggleStreamBlackout = function() {
            trillen();
            obsLiveToggleStreamBlackout();
            updateRemoteUI();
        };

        window.obsRemoteOpenLijst = function() {
            const drawer = document.getElementById('remoteLijstDrawer');
            if (drawer) drawer.style.display = 'flex';
        };

        window.obsRemoteSluitLijst = function() {
            const drawer = document.getElementById('remoteLijstDrawer');
            if (drawer) drawer.style.display = 'none';
        };

        function updateRemoteUI() {
            const state = getObsLiveState();
            const pillEl = document.getElementById('remoteSlidePill');
            const nextEl = document.getElementById('remoteNextPill');
            const titEl = document.getElementById('remoteSlideTitel');
            const prevEl = document.getElementById('remoteSlidePreviewText');
            const blackBtn = document.getElementById('remoteBlackoutBtn');
            const lijstEl = document.getElementById('remoteSlideLijst');

            if (!state || !state.slides || !state.slides.length) {
                if (pillEl) pillEl.textContent = 'GEEN DATA';
                if (titEl) titEl.textContent = 'Wachten op liturgie...';
                if (prevEl) prevEl.textContent = 'Zet eerst een liturgie klaar in de Kerkapp.';
                return;
            }

            const idx = state.currentIndex || 0;
            const total = state.slides.length;
            const curSlide = state.slides[idx] || state.slides[0];
            const nextSlide = state.slides[idx + 1] || null;

            if (pillEl) pillEl.textContent = `DIA ${idx + 1} / ${total}`;
            if (nextEl) nextEl.textContent = nextSlide ? `➔ ${nextSlide.subtitel || nextSlide.titel}` : '➔ Einde';
            
            if (titEl) {
                if (state.isBlackout) {
                    titEl.innerHTML = '<span style="color:#ef4444;">🔴 Zwart Actief</span>';
                } else {
                    titEl.textContent = curSlide.subtitel || curSlide.titel || curSlide.type;
                }
            }

            if (prevEl) {
                if (curSlide.regels && curSlide.regels.length) {
                    prevEl.textContent = curSlide.regels.join(' • ');
                } else if (curSlide.type === 'Welkom') {
                    prevEl.textContent = `${curSlide.gemeente || ''} ${curSlide.datum || ''}`;
                } else {
                    prevEl.textContent = curSlide.type;
                }
            }

            if (blackBtn) {
                if (state.isBlackout) {
                    blackBtn.style.background = '#dc2626';
                    blackBtn.style.color = '#ffffff';
                    blackBtn.style.border = '1px solid #ef4444';
                    blackBtn.textContent = '🔴 Zwart';
                } else {
                    blackBtn.style.background = '#1e293b';
                    blackBtn.style.color = '#cbd5e1';
                    blackBtn.style.border = '1px solid #334155';
                    blackBtn.textContent = '⚫ Zaal';
                }
            }

            const streamBlackBtn = document.getElementById('remoteStreamBlackoutBtn');
            if (streamBlackBtn) {
                if (state.isStreamBlackout) {
                    streamBlackBtn.style.background = '#d97706';
                    streamBlackBtn.style.color = '#ffffff';
                    streamBlackBtn.style.border = '1px solid #f59e0b';
                    streamBlackBtn.textContent = '⏸ Stream';
                } else {
                    streamBlackBtn.style.background = '#1e293b';
                    streamBlackBtn.style.color = '#facc15';
                    streamBlackBtn.style.border = '1px solid #334155';
                    streamBlackBtn.textContent = '📺 Stream';
                }
            }

            if (lijstEl) {
                lijstEl.innerHTML = '';
                state.slides.forEach((s, sIdx) => {
                    const isActief = sIdx === idx;
                    const row = document.createElement('div');
                    row.style.cssText = `padding:10px 12px;border-radius:10px;font-size:13px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;${isActief ? 'background:#007AFF;color:#ffffff;font-weight:700;' : 'background:#090d16;color:#cbd5e1;border:1px solid #1e293b;'}`;
                    row.innerHTML = `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:8px;">${sIdx + 1}. ${s.subtitel || s.titel}</span>${isActief ? '<span>✓</span>' : ''}`;
                    row.onclick = () => {
                        trillen();
                        state.currentIndex = sIdx;
                        state.isBlackout = false;
                        saveObsLiveState(state);
                        updateRemoteUI();
                        obsRemoteSluitLijst();
                    };
                    lijstEl.appendChild(row);
                });
            }
        }

        window.updateRemoteUI = updateRemoteUI;
        updateRemoteUI();

        if (_obsBroadcastChannel) {
            _obsBroadcastChannel.onmessage = (e) => {
                if (e.data && e.data.type === 'UPDATE') updateRemoteUI();
            };
        }
        window.addEventListener('storage', (e) => {
            if (e.key === 'kerkapp_obs_live_state') updateRemoteUI();
        });

        startCloudObsListener(() => updateRemoteUI());
        setInterval(updateRemoteUI, 450);

        // Swipe gebaren
        let touchStartX = 0;
        let touchStartY = 0;
        window.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
            }
        }, { passive: true });

        window.addEventListener('touchend', (e) => {
            if (e.changedTouches.length === 1) {
                const diffX = e.changedTouches[0].clientX - touchStartX;
                const diffY = e.changedTouches[0].clientY - touchStartY;
                if (Math.abs(diffX) > 60 && Math.abs(diffY) < 50) {
                    if (diffX < 0) {
                        obsRemoteVolgende();
                    } else {
                        obsRemoteVorige();
                    }
                }
            }
        }, { passive: true });
    }


// Exporteer globale functies voor compatibiliteit met de kern-editor
window.startBeamerWeergave = startBeamerWeergave;
window.startStreamWeergave = startStreamWeergave;
window.startDockWeergave = startDockWeergave;
window.startRemoteKlikker = startRemoteKlikker;
window.bouwwVolledigeDiaLijst = bouwwVolledigeDiaLijst;
window.autoSyncObsLiveLiturgie = autoSyncObsLiveLiturgie;
window.getObsLiveState = getObsLiveState;
window.saveObsLiveState = saveObsLiveState;
window.updateObsModalSimulator = updateObsModalSimulator;
window.sluitObsTestModal = sluitObsTestModal;
window.openObsTestModal = openObsTestModal;
window.obsLiveVolgende = obsLiveVolgende;
window.obsLiveVorige = obsLiveVorige;
window.obsLiveToggleBlackout = obsLiveToggleBlackout;
window.obsLiveToggleStreamBlackout = obsLiveToggleStreamBlackout;
