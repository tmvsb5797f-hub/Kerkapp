/**
 * Liturgie Assistent Pro — Adaptive Device Engine
 * -------------------------------------------------------------
 * Biedt een ultieme, op maat gesneden ervaring voor:
 *  1. iPhone (Compact Touch, 1-screen viewport, Virtual Keyboard sync, Bottom Sheets)
 *  2. iPad (Split-View, Stage Manager, iPadOS popovers, Apple Pencil/Trackpad hybrid)
 *  3. MacBook / Desktop (Widescreen 2/3-koloms, Cmd+K Spotlight, drag & drop, shortcuts)
 * -------------------------------------------------------------
 */

(function () {
  'use strict';

  // --- 1. STATE & EVENT MANAGEMENT ---
  const listeners = {
    change: new Set(),
    keyboard: new Set()
  };

  const state = {
    type: 'desktop',        // 'phone' | 'tablet' | 'desktop'
    os: 'other',            // 'ios' | 'ipados' | 'macos' | 'windows' | 'android' | 'other'
    input: 'pointer',       // 'touch' | 'pointer' | 'hybrid'
    columns: 1,             // 1 (Mobiel) | 2 (iPad Split-View) | 3 (Desktop Widescreen Studio)
    userColumnPref: null,   // null (auto) | 2 | 3
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      aspectRatio: window.innerWidth / (window.innerHeight || 1),
      isLandscape: window.innerWidth > window.innerHeight
    },
    keyboard: {
      isOpen: false,
      height: 0
    },
    isStageManager: false,
    initialized: false
  };

  // --- 2. DETECTIE FUNCTIES ---
  function detectOS() {
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    const maxTouch = navigator.maxTouchPoints || 0;

    // iPadOS geeft vaak 'Macintosh' als user agent, maar heeft maxTouchPoints > 1
    const isIPad = /iPad/i.test(ua) || (platform === 'MacIntel' && maxTouch > 1);
    if (isIPad) return 'ipados';

    if (/iPhone|iPod/i.test(ua)) return 'ios';
    if (/Macintosh|Mac OS X/i.test(ua) && maxTouch <= 1) return 'macos';
    if (/Windows/i.test(ua)) return 'windows';
    if (/Android/i.test(ua)) return 'android';
    if (/Linux/i.test(ua)) return 'linux';
    return 'other';
  }

  function detectInput() {
    const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
    const hasPointer = window.matchMedia ? window.matchMedia('(pointer: fine)').matches : true;

    if (hasTouch && hasPointer) return 'hybrid';
    if (hasTouch) return 'touch';
    return 'pointer';
  }

  function detectDeviceType(os, input, width, height) {
    const minDim = Math.min(width, height);

    // iPhone of compacte mobiel
    if (os === 'ios') return 'phone';

    if (os === 'ipados') {
      // Op iPad kan Stage Manager een venster verkleinen tot een telefoonsmalle kolom
      if (width < 640) return 'phone';
      return 'tablet';
    }

    if (os === 'android') {
      if (minDim < 600 || width < 768) return 'phone';
      return 'tablet';
    }

    // Desktop/Laptop: macOS, Windows, Linux
    if (os === 'macos' || os === 'windows' || os === 'linux') {
      if (width < 640) return 'phone';
      if (width < 1024) return 'tablet';
      return 'desktop';
    }

    // Fallback
    if (width < 768 || (input === 'touch' && minDim < 600)) return 'phone';
    if (width < 1180) return 'tablet';
    return 'desktop';
  }

  function detectColumns(type, width) {
    if (type === 'phone' || width < 768) return 1;

    // Respecteer handmatige voorkeur van de gebruiker als het scherm breed genoeg is (>= 980px)
    if (state.userColumnPref === 2) return 2;
    if (state.userColumnPref === 3 && width >= 980) return 3;

    // Automatische adaptieve kolomkeuze:
    // - iPad / Split-View (768px - 1239px): 2 kolommen (Links: Invoer, Rechts: Live Preview + Volgorde)
    // - MacBook / Widescreen Desktop (>= 1240px): 3 kolommen (Links: Invoer, Midden: Volgorde, Rechts: Live Preview)
    if (width >= 1240 && type === 'desktop') return 3;
    return 2;
  }

  function updateLayoutButtonsUI() {
    const btn2 = document.getElementById('layoutBtn2Cols');
    const btn3 = document.getElementById('layoutBtn3Cols');
    if (!btn2 || !btn3) return;

    const activeCls = 'px-2 py-1 rounded-md text-[11px] font-bold bg-[#007AFF] text-white shadow-2xs transition-all flex items-center gap-1 cursor-pointer active:scale-95';
    const inactiveCls = 'px-2 py-1 rounded-md text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:text-[#007AFF] dark:hover:text-white transition-all flex items-center gap-1 cursor-pointer active:scale-95';

    btn2.className = (state.columns === 2) ? activeCls : inactiveCls;
    btn3.className = (state.columns === 3) ? activeCls : inactiveCls;
  }

  function setLayoutColumns(cols) {
    if (cols === 2 || cols === 3) {
      state.userColumnPref = cols;
      try { localStorage.setItem('liturgieLayoutColumns', String(cols)); } catch (e) {}
    } else {
      state.userColumnPref = null;
      try { localStorage.removeItem('liturgieLayoutColumns'); } catch (e) {}
    }
    state.columns = detectColumns(state.type, state.viewport.width);
    applyToDOM();
    if (typeof window.tekenSlidePreview === 'function') {
      requestAnimationFrame(() => setTimeout(() => window.tekenSlidePreview(), 40));
    }
    if (typeof window.toonToast === 'function') {
      window.toonToast(
        state.columns === 3
          ? '🖥️ 3-Koloms Studio Layout actief (Invoer · Volgorde · Live Preview)'
          : '📱 2-Koloms Split-View actief (Invoer · Live Preview + Volgorde)',
        'info'
      );
    }
  }

  function toggleLayoutColumns() {
    if (state.viewport.width < 768) return;
    const nextCols = state.columns === 3 ? 2 : 3;
    setLayoutColumns(nextCols);
  }

  // --- 3. DOM & CSS SYNCHRONISATIE ---
  function applyToDOM() {
    const root = document.documentElement;

    root.setAttribute('data-device', state.type);
    root.setAttribute('data-os', state.os);
    root.setAttribute('data-input', state.input);
    root.setAttribute('data-cols', String(state.columns));
    root.setAttribute('data-orientation', state.viewport.isLandscape ? 'landscape' : 'portrait');

    root.classList.remove('engine-phone', 'engine-tablet', 'engine-desktop');
    root.classList.add(`engine-${state.type}`);

    root.classList.remove('layout-cols-1', 'layout-cols-2', 'layout-cols-3');
    root.classList.add(`layout-cols-${state.columns}`);

    root.classList.remove('os-ios', 'os-ipados', 'os-macos', 'os-windows', 'os-android');
    root.classList.add(`os-${state.os}`);

    root.classList.toggle('has-touch', state.input === 'touch' || state.input === 'hybrid');
    root.classList.toggle('has-pointer', state.input === 'pointer' || state.input === 'hybrid');

    root.style.setProperty('--engine-device-type', `"${state.type}"`);
    root.style.setProperty('--engine-cols', String(state.columns));
    root.style.setProperty('--engine-vw', `${state.viewport.width}px`);
    root.style.setProperty('--engine-vh', `${state.viewport.height}px`);

    updateLayoutButtonsUI();
  }

  // --- 4. VIRTUAL KEYBOARD SYNC (iOS / Android) ---
  function setupVirtualKeyboardWatcher() {
    if (!window.visualViewport) return;

    const onViewportChange = () => {
      const currentHeight = window.visualViewport.height;
      const heightDiff = window.innerHeight - currentHeight;

      const isInputFocused = document.activeElement && 
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable);
      
      const keyboardOpen = isInputFocused && heightDiff > 140;

      if (keyboardOpen !== state.keyboard.isOpen || (keyboardOpen && Math.abs(heightDiff - state.keyboard.height) > 10)) {
        state.keyboard.isOpen = keyboardOpen;
        state.keyboard.height = keyboardOpen ? heightDiff : 0;

        document.documentElement.classList.toggle('keyboard-open', keyboardOpen);
        document.documentElement.style.setProperty('--keyboard-height', `${state.keyboard.height}px`);

        if (keyboardOpen && document.activeElement) {
          setTimeout(() => {
            if (document.activeElement && typeof document.activeElement.scrollIntoView === 'function') {
              document.activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 80);
        }

        listeners.keyboard.forEach(fn => {
          try { fn({ ...state.keyboard }); } catch (e) { console.warn('[DeviceEngine] keyboard listener error:', e); }
        });
      }
    };

    window.visualViewport.addEventListener('resize', onViewportChange);
    window.visualViewport.addEventListener('scroll', onViewportChange);
  }

  // --- 5. RESIZE & STAGE MANAGER WATCHER ---
  let resizeTimeout = null;
  function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const newType = detectDeviceType(state.os, state.input, width, height);
      const newCols = detectColumns(newType, width);

      const typeChanged = newType !== state.type || newCols !== state.columns;
      const isLandscape = width > height;

      state.viewport = {
        width,
        height,
        aspectRatio: width / (height || 1),
        isLandscape
      };

      if (state.os === 'ipados') {
        const screenMax = Math.max(window.screen.width, window.screen.height);
        state.isStageManager = (width < screenMax * 0.95);
        document.documentElement.classList.toggle('ipados-stage-manager', state.isStageManager);
      }

      state.type = newType;
      state.columns = newCols;
      applyToDOM();

      if (typeChanged) {
        console.log(`[DeviceEngine] 🔄 Schakel naar: ${state.type.toUpperCase()} (${state.columns} kolommen, OS: ${state.os}, ${width}x${height})`);
        if (typeof window.tekenSlidePreview === 'function') {
          requestAnimationFrame(() => window.tekenSlidePreview());
        }
        listeners.change.forEach(fn => {
          try { fn({ ...state }); } catch (e) { console.warn('[DeviceEngine] change listener error:', e); }
        });
      }
    }, 60);
  }

  // --- 6. HAPTIC FEEDBACK (iPhone / Android) ---
  function haptic(type = 'light') {
    if (typeof navigator.vibrate === 'function') {
      try {
        switch (type) {
          case 'selection': navigator.vibrate(8); break;
          case 'light': navigator.vibrate(12); break;
          case 'medium': navigator.vibrate(22); break;
          case 'heavy': navigator.vibrate(35); break;
          case 'success': navigator.vibrate([10, 30, 20]); break;
          case 'warning': navigator.vibrate([25, 40, 25]); break;
          default: navigator.vibrate(15);
        }
      } catch (e) {}
    }
  }

  // --- 7. COMMAND PALETTE & SHORTCUTS (MacBook / Desktop) ---
  const DEFAULT_COMMANDS = [
    { id: 'export_pptx', title: 'Exporteer naar PowerPoint (.pptx)', category: 'Acties', icon: '📥', shortcut: '⌘↵', action: () => window.maakPowerPoint?.() },
    { id: 'save_liturgy', title: 'Liturgie handmatig opslaan in archief', category: 'Acties', icon: '💾', shortcut: '⌘S', action: () => window.slaLiturgieOp?.() },
    { id: 'toggle_cols', title: 'Wissel tussen 2-koloms Split-View en 3-koloms Studio Layout', category: 'Weergave', icon: '🖥️', shortcut: '⌘\\', action: () => toggleLayoutColumns() },
    { id: 'welcome_slide', title: 'Live Welkomstdia bekijken op preview-scherm', category: 'Weergave', icon: '👋', shortcut: '', action: () => window.selecteerWelkomstdiaPreview?.() },
    { id: 'new_song', title: 'Nieuw lied toevoegen aan database', category: 'Liederen', icon: '➕', shortcut: '', action: () => window.openLiedEditor?.('') },
    { id: 'library', title: 'Liederen Bibliotheek & Beheer openen', category: 'Liederen', icon: '📚', shortcut: '', action: () => window.openLiederenBeheerModal?.() },
    { id: 'preflight', title: 'Kwaliteitscontrole uitvoeren (Preflight)', category: 'Controle', icon: '🛡️', shortcut: '', action: () => window.openPreflightModal?.() },
    { id: 'settings', title: 'Info, Instellingen & OBS Live openen', category: 'Beamer', icon: '⚙️', shortcut: '', action: () => window.openInfoModal?.() },
    { id: 'tour', title: 'Interactieve Rondleiding starten', category: 'Hulp', icon: '🧭', shortcut: '', action: () => window.startUitleg?.() },
    { id: 'church', title: 'Wissel van kerkelijke gemeente / beamer-thema', category: 'Gemeente', icon: '⛪', shortcut: '', action: () => window.openGemeenteModal?.() },
    { id: 'meelees', title: 'Meelees-link & QR-code delen', category: 'Delen', icon: '📱', shortcut: '', action: () => window.toonDeelModal?.() },
    { id: 'tikkie', title: 'Week-Tikkie QR instellen of bewerken', category: 'Collecte', icon: '💳', shortcut: '', action: () => window.openTikkieModal?.() }
  ];

  let selectedCommandIndex = 0;
  let filteredCommands = [];

  function renderCommandResults(query = '') {
    const listEl = document.getElementById('commandPaletteResults');
    if (!listEl) return;

    const q = query.trim().toLowerCase();

    // 1. Zoek door acties
    let actions = DEFAULT_COMMANDS.filter(cmd => 
      !q || cmd.title.toLowerCase().includes(q) || cmd.category.toLowerCase().includes(q)
    );

    // 2. Als gebruiker een lied zoekt (bijv. 'psalm 23', 'wk 15', 'oth 314')
    let songMatches = [];
    let songList = [];
    if (typeof window.bouwZoekLijst === 'function') {
      try { songList = window.bouwZoekLijst(); } catch (e) {}
    } else if (window.liederenDatabase) {
      songList = Object.keys(window.liederenDatabase);
    }

    if (q.length >= 2 && Array.isArray(songList) && songList.length > 0) {
      const matchedTitles = songList.filter(t => t.toLowerCase().includes(q)).slice(0, 8);
      songMatches = matchedTitles.map(titel => ({
        id: `song_${titel}`,
        title: titel,
        category: 'Database Liederen',
        icon: '🎵',
        shortcut: '↵ Selecteer',
        action: () => {
          if (typeof window.handleLiedSelectie === 'function') {
            window.handleLiedSelectie(titel);
          } else {
            const inp = document.getElementById('liedInput');
            if (inp) {
              inp.value = titel;
              inp.focus();
            }
          }
        }
      }));
    }

    // 3. Als gebruiker een bijbeltekst zoekt (bijv. 'Genesis 1:1-5' of 'Joh 3:16')
    let bibleMatches = [];
    const bibleRegex = /^([1-3]?\s*[a-zA-Z\u00C0-\u017E]+)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/i;
    if (bibleRegex.test(q)) {
      bibleMatches.push({
        id: `bible_${q}`,
        title: `Bijbeltekst opvragen: ${query.trim()}`,
        category: 'Bijbel (HSV)',
        icon: '📖',
        shortcut: '↵ Ophalen',
        action: () => {
          const inp = document.getElementById('bijbelInput');
          if (inp) {
            inp.value = query.trim();
            if (typeof window.haalBijbelTekstOp === 'function') {
              window.haalBijbelTekstOp(query.trim());
            }
          }
        }
      });
    }

    filteredCommands = [...bibleMatches, ...actions, ...songMatches];
    selectedCommandIndex = Math.min(selectedCommandIndex, Math.max(0, filteredCommands.length - 1));

    if (filteredCommands.length === 0) {
      listEl.innerHTML = `
        <div class="p-6 text-center text-gray-400 dark:text-gray-500 text-xs">
          Geen commando's of liederen gevonden voor "<strong>${escapeHtml(query)}</strong>"
        </div>`;
      return;
    }

    let html = '';
    let currentCategory = '';

    filteredCommands.forEach((cmd, idx) => {
      if (cmd.category !== currentCategory) {
        currentCategory = cmd.category;
        html += `<div class="px-3 pt-3 pb-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">${currentCategory}</div>`;
      }

      const isSelected = idx === selectedCommandIndex;
      const activeClass = isSelected 
        ? 'bg-[#007AFF] text-white shadow-xs' 
        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10';

      html += `
        <div class="command-palette-item px-3 py-2.5 rounded-xl cursor-pointer flex items-center justify-between text-xs transition-all ${activeClass}" 
             data-index="${idx}" 
             onclick="window.DeviceEngine.executeCommandIndex(${idx})">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="text-base shrink-0">${cmd.icon}</span>
            <span class="font-medium truncate">${escapeHtml(cmd.title)}</span>
          </div>
          ${cmd.shortcut ? `<span class="text-[10px] font-mono px-1.5 py-0.5 rounded-md ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-500'} shrink-0">${cmd.shortcut}</span>` : ''}
        </div>`;
    });

    listEl.innerHTML = html;

    const selectedItem = listEl.querySelector(`.command-palette-item[data-index="${selectedCommandIndex}"]`);
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest' });
    }
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  function setupDesktopShortcuts() {
    window.addEventListener('keydown', (e) => {
      const isMac = state.os === 'macos';
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Cmd+K of Ctrl+K: Open Spotlight Command Palette
      if (cmdOrCtrl && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        window.DeviceEngine.toggleCommandPalette();
        return;
      }

      // Toetsenbord-navigatie binnen Command Palette
      const cp = document.getElementById('desktopCommandPalette');
      if (cp && !cp.classList.contains('hidden')) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (filteredCommands.length > 0) {
            selectedCommandIndex = (selectedCommandIndex + 1) % filteredCommands.length;
            renderCommandResults(document.getElementById('commandPaletteInput')?.value || '');
          }
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (filteredCommands.length > 0) {
            selectedCommandIndex = (selectedCommandIndex - 1 + filteredCommands.length) % filteredCommands.length;
            renderCommandResults(document.getElementById('commandPaletteInput')?.value || '');
          }
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          window.DeviceEngine.executeCommandIndex(selectedCommandIndex);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          window.DeviceEngine.toggleCommandPalette(false);
          return;
        }
      }

      // Cmd+S of Ctrl+S: Sla liturgie op
      if (cmdOrCtrl && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (typeof window.slaLiturgieOp === 'function') {
          window.slaLiturgieOp();
        } else if (typeof window.bewaarLiturgie === 'function') {
          window.bewaarLiturgie();
        }
        return;
      }

      // Cmd+\ of Ctrl+\: Wissel tussen 2-koloms en 3-koloms layout
      if (cmdOrCtrl && e.key === '\\') {
        e.preventDefault();
        toggleLayoutColumns();
        return;
      }

      // Cmd+Enter of Ctrl+Enter: Exporteer PowerPoint
      if (cmdOrCtrl && e.key === 'Enter') {
        const isEditing = document.getElementById('controleModal') && !document.getElementById('controleModal').classList.contains('hidden');
        if (!isEditing && typeof window.maakPowerPoint === 'function') {
          e.preventDefault();
          window.maakPowerPoint();
        }
        return;
      }

      // Pijltje Links / Rechts: Blader door sub-dia's op het Live Dia-Canvas als er geen invoerveld actief is
      if (!cmdOrCtrl && !e.altKey && !e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const tag = (document.activeElement?.tagName || '').toUpperCase();
        const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable;
        const openModal = document.querySelector('.modal-backdrop-safe:not(.hidden)');
        const cmdOpen = document.getElementById('desktopCommandPalette') && !document.getElementById('desktopCommandPalette').classList.contains('hidden');
        if (!isInput && !openModal && !cmdOpen && typeof window.navigeerSlide === 'function') {
          e.preventDefault();
          window.navigeerSlide(e.key === 'ArrowRight' ? 1 : -1);
        }
      }
    });

    // Desktop Drag-and-Drop Handler voor .pptx en .txt bestanden
    let dragCounter = 0;
    window.addEventListener('dragenter', (e) => {
      if (state.type !== 'desktop') return;
      dragCounter++;
      const overlay = document.getElementById('desktopDropOverlay');
      if (overlay) overlay.classList.remove('hidden');
    });

    window.addEventListener('dragleave', (e) => {
      if (state.type !== 'desktop') return;
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        const overlay = document.getElementById('desktopDropOverlay');
        if (overlay) overlay.classList.add('hidden');
      }
    });

    window.addEventListener('dragover', (e) => {
      if (state.type === 'desktop') e.preventDefault();
    });

    window.addEventListener('drop', (e) => {
      if (state.type !== 'desktop') return;
      e.preventDefault();
      dragCounter = 0;
      const overlay = document.getElementById('desktopDropOverlay');
      if (overlay) overlay.classList.add('hidden');

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        if (typeof window.verwerkArchiefBestanden === 'function') {
          window.verwerkArchiefBestanden(files);
        } else if (typeof window.toonToast === 'function') {
          window.toonToast(`Bestand '${files[0].name}' ontvangen!`, 'info');
        }
      }
    });
  }

  // --- 8. INITIALISATIE ---
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    try {
      const savedCols = parseInt(localStorage.getItem('liturgieLayoutColumns'), 10);
      if (savedCols === 2 || savedCols === 3) state.userColumnPref = savedCols;
    } catch (e) {}

    state.os = detectOS();
    state.input = detectInput();
    state.viewport.width = window.innerWidth;
    state.viewport.height = window.innerHeight;
    state.viewport.aspectRatio = window.innerWidth / (window.innerHeight || 1);
    state.viewport.isLandscape = window.innerWidth > window.innerHeight;
    state.type = detectDeviceType(state.os, state.input, state.viewport.width, state.viewport.height);
    state.columns = detectColumns(state.type, state.viewport.width);

    applyToDOM();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', updateLayoutButtonsUI, { once: true });
    }
    setupVirtualKeyboardWatcher();
    setupDesktopShortcuts();

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });

    console.log(`[DeviceEngine] 🚀 Actief: ${state.type.toUpperCase()} (${state.columns} kolommen) | OS: ${state.os} | Input: ${state.input} | Resolutie: ${state.viewport.width}x${state.viewport.height}`);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // --- 9. PUBLIC API ---
  window.DeviceEngine = {
    get current() { return { ...state }; },
    get type() { return state.type; },
    get os() { return state.os; },
    get input() { return state.input; },
    get columns() { return state.columns; },
    get isPhone() { return state.type === 'phone'; },
    get isTablet() { return state.type === 'tablet'; },
    get isDesktop() { return state.type === 'desktop'; },
    get isApple() { return state.os === 'ios' || state.os === 'ipados' || state.os === 'macos'; },

    haptic,
    setLayoutColumns,
    toggleLayoutColumns,
    updateLayoutButtonsUI,
    renderCommandResults,

    on(event, callback) {
      if (listeners[event] && typeof callback === 'function') {
        listeners[event].add(callback);
      }
    },

    off(event, callback) {
      if (listeners[event]) {
        listeners[event].delete(callback);
      }
    },

    toggleCommandPalette(forceState) {
      const cp = document.getElementById('desktopCommandPalette');
      if (!cp) return;

      const shouldOpen = typeof forceState === 'boolean' ? forceState : cp.classList.contains('hidden');
      if (shouldOpen) {
        cp.classList.remove('hidden');
        if (window.lockBodyScroll) window.lockBodyScroll(true, 'commandPalette');
        const inp = document.getElementById('commandPaletteInput');
        if (inp) {
          inp.value = '';
          selectedCommandIndex = 0;
          setTimeout(() => inp.focus(), 60);
        }
        renderCommandResults('');
      } else {
        cp.classList.add('hidden');
        if (window.lockBodyScroll) window.lockBodyScroll(false, 'commandPalette');
      }
    },

    executeCommandIndex(idx) {
      if (filteredCommands[idx] && typeof filteredCommands[idx].action === 'function') {
        const cmd = filteredCommands[idx];
        window.DeviceEngine.toggleCommandPalette(false);
        setTimeout(() => cmd.action(), 80);
      }
    }
  };

})();
