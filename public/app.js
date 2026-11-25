/**
 * app.js — Frontend Magazzino Marina
 * ====================================
 * Comunicazione con API → Google Sheets (storage primario)
 * LAN auto-detect per accesso da qualsiasi dispositivo.
 */

const API = `${location.origin}/api`;
let allParts = [];
let currentTab = 'parts';
let editingCode = null;       // null = nuovo, string = modifica
let sortCol = null, sortAsc = true;

// ════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
    await loadStats();
    await loadParts();
    checkHealth();
});

async function api(path, opts = {}) {
    const res = await fetch(`${API}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Errore API');
    }
    return res.json();
}

// ════════════════════════════════════════════════
//  DATA LOADING
// ════════════════════════════════════════════════

async function loadParts() {
    setStatus('Caricamento ricambi...');
    try {
        allParts = await api('/parts');
        renderParts(allParts);
        setStatus(`${allParts.length} ricambi caricati`, allParts.length);
    } catch (e) {
        setStatus(`Errore: ${e.message}`, 0);
    }
}

async function loadStats() {
    try {
        const s = await api('/stats');
        $('#kpi-instock').textContent = fmt(s.articoliInStock);
        $('#kpi-qty').textContent = fmt(s.qtaTotale);
        $('#kpi-val').textContent = `€ ${fmtMoney(s.valoreVendita)}`;
        $('#kpi-low').textContent = fmt(s.sottoScorta);
        // Color
        const lowEl = $('#kpi-low');
        if (s.sottoScorta > 0) lowEl.style.color = 'var(--danger)';
        else lowEl.style.color = 'var(--success)';
    } catch (e) { console.warn('Stats error:', e); }
}

async function checkHealth() {
    try {
        const h = await api('/health');
        const badge = $('#sync-status');
        badge.textContent = 'Demo Mode';
        badge.className = 'badge badge-ok';
        if (h.resetIn !== undefined) startDemoCountdown(h.resetIn);
    } catch (e) {
        $('#sync-status').textContent = 'Demo Mode';
        $('#sync-status').className = 'badge badge-ok';
    }
}

let _demoTimer = null;
function startDemoCountdown(secondsLeft) {
    if (_demoTimer) clearInterval(_demoTimer);
    let remaining = Math.max(0, Math.floor(secondsLeft));
    const el = document.getElementById('demo-countdown');
    if (!el) return;
    function tick() {
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        el.textContent = `${m}:${String(s).padStart(2,'0')}`;
        if (remaining <= 0) { clearInterval(_demoTimer); location.reload(); }
        remaining--;
    }
    tick();
    _demoTimer = setInterval(tick, 1000);
}

// ════════════════════════════════════════════════
//  RENDER
// ════════════════════════════════════════════════

const PARTS_COLS = [
    { key: 'Codice', label: 'Codice', cls: 'cell-code cell-click' },
    { key: 'Descrizione', label: 'Descrizione' },
    { key: 'Categoria', label: 'Categoria', cls: 'cell-dim' },
    { key: 'UM', label: 'UM', cls: 'cell-dim' },
    { key: 'PrezzoVendita', label: 'Prz.Vendita', cls: 'cell-num', fmt: v => fmtMoney(v) },
    { key: 'Giacenza', label: 'Giacenza', cls: 'cell-num', fmt: v => fmtQty(v) },
    { key: 'ScortaMinima', label: 'Scorta Min', cls: 'cell-num', fmt: v => v > 0 ? fmtQty(v) : '' },
    { key: 'Settore', label: 'Settore', cls: 'cell-dim' },
    { key: 'Scaffale', label: 'Scaffale', cls: 'cell-dim' },
];

const LOWSTOCK_COLS = [
    { key: 'Codice', label: 'Codice', cls: 'cell-code' },
    { key: 'Descrizione', label: 'Descrizione' },
    { key: 'Categoria', label: 'Categoria', cls: 'cell-dim' },
    { key: 'Giacenza', label: 'Giacenza', cls: 'cell-num cell-low', fmt: v => fmtQty(v) },
    { key: 'ScortaMinima', label: 'Scorta Min', cls: 'cell-num', fmt: v => fmtQty(v) },
    { key: 'Mancanti', label: 'Mancanti', cls: 'cell-num cell-low', fmt: v => fmtQty(v) },
    { key: 'PrezzoVendita', label: 'Prezzo', cls: 'cell-num', fmt: v => fmtMoney(v) },
];

const MOVEMENTS_COLS = [
    { key: 'Data', label: 'Data' },
    { key: 'Codice', label: 'Codice', cls: 'cell-code' },
    { key: 'Descrizione', label: 'Descrizione' },
    { key: 'Causale', label: 'Causale', cls: 'cell-dim' },
    { key: 'Carico', label: 'Carico', cls: 'cell-num cell-ok', fmt: v => v > 0 ? `+${fmtQty(v)}` : '' },
    { key: 'Scarico', label: 'Scarico', cls: 'cell-num cell-low', fmt: v => v > 0 ? `-${fmtQty(v)}` : '' },
    { key: 'Note', label: 'Note', cls: 'cell-dim' },
    { key: 'Utente', label: 'Utente', cls: 'cell-dim' },
];

function renderTable(rows, cols, opts = {}) {
    const thead = $('#table-head');
    const tbody = $('#table-body');
    const empty = $('#table-empty');

    thead.innerHTML = '<tr>' + cols.map(c =>
        `<th onclick="sortTable('${c.key}')">${c.label}${sortCol === c.key ? (sortAsc ? ' ▲' : ' ▼') : ''}</th>`
    ).join('') + '</tr>';

    if (!rows.length) {
        tbody.innerHTML = '';
        empty.style.display = 'flex';
        return;
    }
    empty.style.display = 'none';

    // Sort
    if (sortCol) {
        rows = [...rows].sort((a, b) => {
            let va = a[sortCol] ?? '', vb = b[sortCol] ?? '';
            if (typeof va === 'number' || !isNaN(parseFloat(va))) {
                va = parseFloat(va) || 0; vb = parseFloat(vb) || 0;
            } else { va = String(va).toLowerCase(); vb = String(vb).toLowerCase(); }
            return (va < vb ? -1 : va > vb ? 1 : 0) * (sortAsc ? 1 : -1);
        });
    }

    tbody.innerHTML = rows.map(row => {
        const giac = parseFloat(row.Giacenza) || 0;
        const sm = parseInt(row.ScortaMinima) || 0;
        const isLow = sm > 0 && giac < sm;
        const rowCls = isLow && currentTab === 'parts' ? ' class="row-low"' : '';
        const click = opts.clickable ? ` onclick="openEditPartModal('${row.Codice}')"` : '';

        return `<tr${rowCls}${click}>${cols.map(c => {
            let val = row[c.key] ?? '';
            if (c.fmt) val = c.fmt(val);
            return `<td class="${c.cls || ''}">${esc(String(val))}</td>`;
        }).join('')}</tr>`;
    }).join('');
}

function renderParts(parts) {
    renderTable(parts, PARTS_COLS, { clickable: true });
    $('#row-count').textContent = `${parts.length} righe`;
}

function sortTable(col) {
    if (sortCol === col) sortAsc = !sortAsc;
    else { sortCol = col; sortAsc = true; }
    onSearch($('#search-input').value);
}

// ════════════════════════════════════════════════
//  TABS
// ════════════════════════════════════════════════

async function switchTab(tab, btn) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    sortCol = null; sortAsc = true;

    if (tab === 'parts') {
        await loadParts();
    } else if (tab === 'lowstock') {
        setStatus('Caricamento sotto scorta...');
        try {
            const items = await api('/low-stock');
            renderTable(items, LOWSTOCK_COLS);
            setStatus(`${items.length} articoli sotto scorta`, items.length);
        } catch (e) { setStatus(`Errore: ${e.message}`); }
    } else if (tab === 'movements') {
        setStatus('Caricamento movimenti...');
        try {
            const mov = await api('/movements');
            renderTable(mov, MOVEMENTS_COLS);
            setStatus(`${mov.length} movimenti`, mov.length);
        } catch (e) { setStatus(`Errore: ${e.message}`); }
    }
}

// ════════════════════════════════════════════════
//  SEARCH (live, da 2 caratteri)
// ════════════════════════════════════════════════

function onSearch(q) {
    q = q.trim().toLowerCase();
    if (currentTab !== 'parts') return;
    if (q.length < 2 && q.length > 0) { renderParts(allParts); return; }
    if (!q) { renderParts(allParts); return; }
    const filtered = allParts.filter(p =>
        (p.Codice || '').toLowerCase().includes(q) ||
        (p.Descrizione || '').toLowerCase().includes(q) ||
        (p.Categoria || '').toLowerCase().includes(q)
    );
    renderParts(filtered);
    setStatus(`${filtered.length} risultati per "${q}"`, filtered.length);
}

// ════════════════════════════════════════════════
//  MODALS — Crea / Modifica
// ════════════════════════════════════════════════

function openNewPartModal() {
    editingCode = null;
    $('#modal-title').textContent = '➕ Nuovo Ricambio';
    $('#f-code').readOnly = false;
    $('#f-code').value = '';
    $('#f-desc').value = '';
    $('#f-um').value = 'pezzo';
    $('#f-pv').value = '0';
    $('#f-pa').value = '0';
    $('#f-iva').value = '9';
    $('#f-giac').value = '0';
    $('#f-sm').value = '0';
    $('#f-note').value = '';
    $('#f-settore').value = '';
    $('#f-scaffale').value = '';
    $('#f-ripiano').value = '';
    $('#f-posizione').value = '';
    $('#f-barcode').value = '';
    $('#btn-delete').style.display = 'none';
    $('#part-modal').showModal();
}

function openEditPartModal(code) {
    const part = allParts.find(p => p.Codice === code);
    if (!part) return;

    editingCode = code;
    $('#modal-title').textContent = `✏️ ${code}`;
    $('#f-code').value = code;
    $('#f-code').readOnly = true;
    $('#f-desc').value = part.Descrizione || '';
    $('#f-um').value = part.UM || 'pezzo';
    $('#f-pv').value = parseFloat(part.PrezzoVendita) || 0;
    $('#f-pa').value = parseFloat(part.PrezzoAcquisto) || 0;
    $('#f-iva').value = part.CodiceIVA || '9';
    $('#f-giac').value = parseFloat(part.Giacenza) || 0;
    $('#f-sm').value = parseInt(part.ScortaMinima) || 0;
    $('#f-note').value = '';
    $('#f-settore').value = part.Settore || '';
    $('#f-scaffale').value = part.Scaffale || '';
    $('#f-ripiano').value = part.Ripiano || '';
    $('#f-posizione').value = part.Posizione || '';
    $('#f-barcode').value = part.Barcode || '';
    $('#btn-delete').style.display = 'inline-flex';
    $('#part-modal').showModal();
}

function closeModal() { $('#part-modal').close(); }

async function savePart(e) {
    e.preventDefault();
    const form = $('#part-form');
    const data = {
        Codice: $('#f-code').value.trim().toUpperCase(),
        Descrizione: $('#f-desc').value.trim(),
        UM: $('#f-um').value.trim() || 'pezzo',
        PrezzoVendita: parseFloat($('#f-pv').value) || 0,
        PrezzoAcquisto: parseFloat($('#f-pa').value) || 0,
        CodiceIVA: $('#f-iva').value.trim(),
        ScortaMinima: parseInt($('#f-sm').value) || 0,
        Settore: $('#f-settore').value.trim(),
        Scaffale: $('#f-scaffale').value.trim(),
        Ripiano: $('#f-ripiano').value.trim(),
        Posizione: $('#f-posizione').value.trim(),
        Barcode: $('#f-barcode').value.trim(),
    };

    const newGiac = parseFloat($('#f-giac').value) || 0;
    const note = $('#f-note').value.trim();

    try {
        if (editingCode) {
            // Aggiorna articolo
            await api(`/parts/${editingCode}`, { method: 'PUT', body: data });

            // Rettifica giacenza se cambiata
            const oldGiac = parseFloat(allParts.find(p => p.Codice === editingCode)?.Giacenza) || 0;
            if (newGiac !== oldGiac) {
                await api(`/parts/${editingCode}/adjust-stock`, {
                    method: 'POST', body: { newQty: newGiac, note }
                });
            }
            setStatus(`✅ ${editingCode} aggiornato`);
        } else {
            // Crea articolo (giacenza iniziale gestita dal server)
            data.Giacenza = newGiac;
            await api('/parts', { method: 'POST', body: data });
            setStatus(`✅ ${data.Codice} creato`);
        }
        closeModal();
        await loadParts();
        await loadStats();
    } catch (e) {
        alert(`Errore: ${e.message}`);
    }
}

async function deletePart() {
    if (!editingCode) return;
    if (!confirm(`Eliminare ${editingCode}?\nL'operazione non è reversibile.`)) return;
    try {
        await api(`/parts/${editingCode}`, { method: 'DELETE' });
        setStatus(`🗑️ ${editingCode} eliminato`);
        closeModal();
        await loadParts();
        await loadStats();
    } catch (e) { alert(`Errore: ${e.message}`); }
}

// ════════════════════════════════════════════════
//  SOTTO SCORTA MODAL (doppio clic card)
// ════════════════════════════════════════════════

async function showLowStock() {
    const modal = $('#lowstock-modal');
    const content = $('#lowstock-content');
    try {
        const items = await api('/low-stock');
        if (!items.length) {
            content.innerHTML = '<p style="padding:20px;color:var(--success)">✅ Tutti gli articoli sono in stock.</p>';
        } else {
            let html = '<table><thead><tr>';
            LOWSTOCK_COLS.forEach(c => { html += `<th>${c.label}</th>`; });
            html += '</tr></thead><tbody>';
            items.forEach(item => {
                html += '<tr class="row-low">';
                LOWSTOCK_COLS.forEach(c => {
                    let v = item[c.key] ?? '';
                    if (c.fmt) v = c.fmt(v);
                    html += `<td class="${c.cls || ''}">${esc(String(v))}</td>`;
                });
                html += '</tr>';
            });
            html += '</tbody></table>';
            html += `<p style="padding:12px;color:var(--text-dim);font-size:.82rem">📊 ${items.length} articoli — ${items.reduce((s,i) => s + (parseInt(i.Mancanti)||0), 0)} pezzi mancanti</p>`;
            content.innerHTML = html;
        }
        modal.showModal();
    } catch (e) { alert('Errore: ' + e.message); }
}


// ════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════

function $(sel) { return document.querySelector(sel); }
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function fmt(n) { return Number(n || 0).toLocaleString('it-IT'); }
function fmtMoney(v) { return Number(v || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtQty(v) { const n = parseFloat(v) || 0; return n % 1 === 0 ? n.toLocaleString('it-IT') : n.toLocaleString('it-IT', { maximumFractionDigits: 2 }); }

function setStatus(text, count) {
    $('#status-text').textContent = text;
    if (count !== undefined) $('#row-count').textContent = `${count} righe`;
}


// ════════════════════════════════════════════════════════════
//  BARCODE SCANNER — BarcodeDetector API nativa
//  ────────────────────────────────────────────────────────
//  Zero dipendenze esterne. Usa la Shape Detection API
//  del browser (Chrome 83+, Edge 83+, Opera 69+, Samsung).
//
//  Flusso:
//  1. Verifica supporto BarcodeDetector
//  2. Apre camera posteriore (facingMode: environment)
//  3. Scansiona ~8 frame/sec via requestAnimationFrame
//  4. Al rilevamento: vibra, mostra risultato, cerca in inventario
//  5. Conferma → popola campo Barcode nel modal + auto-fill
//
//  Espone su window:
//    openBarcodeScanner(targetInputId)
//    closeBarcodeScanner()
// ════════════════════════════════════════════════════════════

(function () {
    'use strict';

    // ── Riferimenti DOM ──
    const overlay      = document.getElementById('scannerOverlay');
    const errorPanel   = document.getElementById('scannerError');
    const errorMsg     = document.getElementById('scannerErrorMsg');
    const videoArea    = document.getElementById('scannerVideoArea');
    const video        = document.getElementById('scannerVideo');
    const frame        = document.getElementById('scannerFrame');
    const scanLine     = document.getElementById('scannerLine');
    const statusEl     = document.getElementById('scannerStatus');
    const resultEl     = document.getElementById('scannerResult');
    const codeValueEl  = document.getElementById('scannerCodeValue');
    const codeIconEl   = document.getElementById('scannerCodeIcon');
    const codeFormatEl = document.getElementById('scannerCodeFormat');
    const matchEl      = document.getElementById('scannerMatch');
    const matchDescEl  = document.getElementById('scannerMatchDesc');
    const matchStockEl = document.getElementById('scannerMatchStock');
    const noMatchEl    = document.getElementById('scannerNoMatch');
    const closeBtn     = document.getElementById('scannerCloseBtn');
    const confirmBtn   = document.getElementById('scannerConfirmBtn');
    const retryBtn     = document.getElementById('scannerRetryBtn');
    // OCR elements
    const ocrBtn       = document.getElementById('scannerOcrBtn');
    const ocrStatus    = document.getElementById('scannerOcrStatus');
    const ocrList      = document.getElementById('scannerOcrList');

    // ── State ──
    let detector       = null;    // BarcodeDetector instance
    let stream         = null;    // MediaStream dalla camera
    let scanning       = false;   // Loop di scansione attivo
    let lastScanTime   = 0;       // Timestamp ultimo frame analizzato
    let rafId          = null;    // requestAnimationFrame handle
    let targetInputId  = null;    // ID dell'input Barcode da popolare
    let lastDetected   = '';      // Ultimo codice rilevato (anti-duplicato)
    let selectedOcrCode = '';     // Part number selezionato dall'OCR
    let parentDialog   = null;    // <dialog> da riaprire dopo lo scanner (top-layer fix)

    // Formati barcode supportati (i più comuni nel settore ricambi/nautica)
    const BARCODE_FORMATS = [
        'qr_code', 'ean_13', 'ean_8', 'code_128',
        'code_39', 'upc_a', 'upc_e', 'itf'
    ];

    // Etichette human-readable per i formati
    const FORMAT_LABELS = {
        qr_code: 'QR Code', ean_13: 'EAN-13', ean_8: 'EAN-8',
        code_128: 'Code 128', code_39: 'Code 39',
        upc_a: 'UPC-A', upc_e: 'UPC-E', itf: 'ITF',
    };

    // Intervallo minimo tra scansioni (ms) → ~8 fps
    const SCAN_INTERVAL_MS = 125;


    // ═══════════════════════════════════════════════
    //  INIT — Verifica supporto + polyfill fallback
    // ═══════════════════════════════════════════════

    // URL del polyfill — caricato SOLO se il browser non ha BarcodeDetector nativo.
    // barcode-detector v2.x: ~45KB gzipped, implementa la stessa interfaccia W3C.
    // Usa ZXing-WASM internamente per decodifica multi-formato.
    const POLYFILL_URL = 'https://fastly.jsdelivr.net/npm/barcode-detector@2/dist/es/pure.min.js';

    /**
     * Carica il polyfill da CDN come ES module dinamico.
     * Viene chiamato solo quando il browser non espone BarcodeDetector nativo.
     * Il polyfill registra window.BarcodeDetector con la stessa API del browser.
     * @returns {Promise<boolean>} true se il polyfill è stato caricato con successo
     */
    async function loadPolyfill() {
        try {
            statusEl.querySelector('.dot-pulse + *') &&
                (statusEl.lastChild.textContent = ' Caricamento scanner…');

            const module = await import(POLYFILL_URL);

            // Il modulo esporta la classe BarcodeDetector come default
            const Detector = module.default || module.BarcodeDetector;
            if (!Detector) throw new Error('Export BarcodeDetector non trovato nel polyfill');

            window.BarcodeDetector = Detector;
            console.log('📦 BarcodeDetector polyfill caricato da CDN (~45KB)');
            return true;
        } catch (e) {
            console.warn('⚠️ Polyfill non caricabile:', e);
            return false;
        }
    }

    /**
     * Verifica la disponibilità della BarcodeDetector API.
     * Strategia a 2 livelli:
     *   1. Prova l'API nativa del browser (Chrome Android, Edge)
     *   2. Se non c'è, carica il polyfill da CDN (funziona ovunque)
     * @returns {Promise<boolean>}
     */
    async function checkSupport() {

        // ── Livello 1: API nativa ──
        if (!('BarcodeDetector' in window)) {
            console.log('ℹ️ BarcodeDetector nativo non disponibile — carico polyfill…');

            // ── Livello 2: Polyfill da CDN ──
            const loaded = await loadPolyfill();
            if (!loaded) {
                errorMsg.textContent =
                    'Impossibile caricare lo scanner. Verifica la connessione internet ' +
                    'oppure usa Chrome su Android dove la scansione è nativa.';
                return false;
            }
        }

        try {
            // getSupportedFormats() ritorna i formati che il detector può decodificare
            const supported = await BarcodeDetector.getSupportedFormats();
            // Intersezione tra i nostri formati desiderati e quelli supportati
            const available = BARCODE_FORMATS.filter(f => supported.includes(f));

            if (!available.length) {
                errorMsg.textContent = 'Nessun formato barcode supportato dal detector.';
                return false;
            }

            // Crea il detector con solo i formati effettivamente supportati
            detector = new BarcodeDetector({ formats: available });
            const isNative = !POLYFILL_URL || detector.constructor.name !== 'BarcodeDetector' ? 'polyfill' : 'nativo';
            console.log(`✅ BarcodeDetector (${isNative}): ${available.length} formati — ${available.join(', ')}`);
            return true;
        } catch (e) {
            console.warn('⚠️ BarcodeDetector init error:', e);
            return false;
        }
    }


    // ═══════════════════════════════════════════════
    //  CAMERA — Apertura e chiusura stream
    // ═══════════════════════════════════════════════

    /**
     * Avvia la fotocamera posteriore.
     * facingMode: "environment" forza la camera dietro sullo smartphone.
     * Su desktop usa la webcam disponibile come fallback.
     */
    async function startCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' },
                    // Risoluzione ragionevole — non serve 4K per leggere barcode
                    width:  { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            });
            video.srcObject = stream;

            // Attendi che il video sia effettivamente pronto
            await new Promise((resolve) => {
                video.onloadedmetadata = () => {
                    video.play();
                    resolve();
                };
            });

            return true;
        } catch (e) {
            console.error('❌ Camera:', e);
            if (e.name === 'NotAllowedError') {
                errorMsg.textContent = 'Permesso fotocamera negato. Consenti l\'accesso nelle impostazioni del browser.';
            } else if (e.name === 'NotFoundError') {
                errorMsg.textContent = 'Nessuna fotocamera trovata sul dispositivo.';
            } else {
                errorMsg.textContent = `Errore fotocamera: ${e.message}`;
            }
            return false;
        }
    }

    /** Ferma tutti i track della camera e rilascia risorse. */
    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
            stream = null;
        }
        video.srcObject = null;
    }


    // ═══════════════════════════════════════════════
    //  SCAN LOOP — Scansione throttled via rAF
    // ═══════════════════════════════════════════════

    /**
     * Ciclo di scansione ad alta efficienza.
     *
     * PERCHÉ requestAnimationFrame + throttle manuale:
     * - rAF si sincronizza con il refresh del display (~60fps)
     * - Ma decodificare ogni frame (16ms) sovraccaricherebbe la CPU mobile
     * - Il throttle a SCAN_INTERVAL_MS (~125ms → 8fps) è il compromesso
     *   ottimale tra reattività e consumo batteria
     *
     * detector.detect(video) analizza il frame corrente del <video>
     * e restituisce un array di { rawValue, format, boundingBox, ... }
     */
    function startScanLoop() {
        scanning = true;
        lastDetected = '';

        function tick(timestamp) {
            if (!scanning) return;

            // Throttle: salta il frame se è passato meno di SCAN_INTERVAL_MS
            if (timestamp - lastScanTime >= SCAN_INTERVAL_MS) {
                lastScanTime = timestamp;

                // detect() è asincrono — non blocca il rAF successivo
                detector.detect(video).then(barcodes => {
                    if (!scanning) return;

                    if (barcodes.length > 0) {
                        const bc = barcodes[0];

                        // Anti-duplicato: ignora se è lo stesso codice appena letto
                        if (bc.rawValue === lastDetected) return;

                        lastDetected = bc.rawValue;
                        onBarcodeDetected(bc.rawValue, bc.format);
                        return; // Stop loop — riprende solo con "Scansiona ancora"
                    }
                }).catch(err => {
                    // detect() può fallire se il video non è pronto
                    // (es. tab in background) — ignora silenziosamente
                    if (err.name !== 'InvalidStateError') {
                        console.warn('⚠️ detect():', err.message);
                    }
                });
            }

            rafId = requestAnimationFrame(tick);
        }

        rafId = requestAnimationFrame(tick);
    }

    /** Ferma il loop di scansione. */
    function stopScanLoop() {
        scanning = false;
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    }


    // ═══════════════════════════════════════════════
    //  DETECTION — Codice trovato!
    // ═══════════════════════════════════════════════

    /**
     * Callback quando un barcode viene rilevato con successo.
     * 1. Ferma la scansione (no letture doppie)
     * 2. Feedback tattile (vibrazione 100ms)
     * 3. Flash visivo: mirino diventa verde
     * 4. Mostra risultato + cerca corrispondenza in inventario
     */
    function onBarcodeDetected(rawValue, format) {
        // 1. Ferma scansione
        stopScanLoop();

        // 2. Feedback tattile
        if ('vibrate' in navigator) {
            navigator.vibrate(100);
        }

        // 3. Flash visivo
        frame.classList.add('success');
        scanLine.classList.add('paused');

        // 4. Aggiorna UI
        statusEl.style.display = 'none';
        resultEl.classList.add('visible');
        codeValueEl.textContent = rawValue;
        codeFormatEl.textContent = FORMAT_LABELS[format] || format;

        // 5. Cerca corrispondenza nell'inventario
        //    allParts è la variabile globale definita in app.js
        matchEl.classList.remove('visible');
        noMatchEl.classList.remove('visible');

        if (typeof allParts !== 'undefined' && Array.isArray(allParts)) {
            const norm = rawValue.toUpperCase().trim();
            const match = allParts.find(p =>
                (p.Barcode || '').toUpperCase().trim() === norm ||
                (p.Codice || '').toUpperCase().trim() === norm
            );

            if (match) {
                matchDescEl.textContent = `${match.Codice} — ${match.Descrizione}`;
                matchStockEl.textContent = `Giacenza: ${match.Giacenza || 0} ${match.UM || 'PZ'}`;
                matchEl.classList.add('visible');
            } else {
                noMatchEl.classList.add('visible');
            }
        }

        console.log(`📷 Barcode rilevato: ${rawValue} (${format})`);
    }


    // ═══════════════════════════════════════════════
    //  OPEN / CLOSE — Gestione overlay
    // ═══════════════════════════════════════════════

    /**
     * Apre lo scanner barcode fullscreen.
     * Se l'input target è dentro un <dialog> aperto come modal, il dialog
     * viene chiuso temporaneamente perché il suo "top layer" copre qualunque
     * z-index della pagina, incluso lo scanner overlay. Verrà riaperto da
     * closeScanner() preservando il contenuto del form.
     *
     * @param {string} inputId - ID dell'elemento <input> da popolare col codice
     */
    async function openScanner(inputId) {
        targetInputId = inputId || null;

        // ── Fix top-layer: chiudi dialog parent se l'input target è dentro un <dialog> aperto ──
        parentDialog = null;
        if (targetInputId) {
            const input = document.getElementById(targetInputId);
            if (input) {
                const dlg = input.closest('dialog');
                if (dlg && dlg.open) {
                    parentDialog = dlg;
                    dlg.close();
                }
            }
        }

        // Reset UI
        resetUI();
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Verifica supporto API
        const supported = await checkSupport();

        if (!supported) {
            errorPanel.classList.add('visible');
            videoArea.style.display = 'none';
            return;
        }

        // Avvia camera
        errorPanel.classList.remove('visible');
        videoArea.style.display = 'flex';

        const cameraOk = await startCamera();
        if (!cameraOk) {
            errorPanel.classList.add('visible');
            videoArea.style.display = 'none';
            return;
        }

        // Avvia loop di scansione
        startScanLoop();
    }

    /** Chiude lo scanner, rilascia camera e riapre il dialog parent se c'era. */
    function closeScanner() {
        stopScanLoop();
        stopCamera();
        overlay.classList.remove('active');
        document.body.style.overflow = '';

        // ── Riapri il <dialog> parent (contiene già i nuovi valori scritti dal confirmBtn) ──
        if (parentDialog) {
            const dlg = parentDialog;
            parentDialog = null;
            try {
                dlg.showModal();
            } catch (_) {
                // showModal lancia se il dialog è già aperto o non è in DOM: fallback non-modal
                try { dlg.show(); } catch (_2) { /* nothing to do */ }
            }
            // Restituisci il focus all'input appena popolato (UX continua)
            if (targetInputId) {
                const input = document.getElementById(targetInputId);
                if (input) setTimeout(() => input.focus(), 80);
            }
        }
    }

    /** Reset dello stato UI al valore iniziale. */
    function resetUI() {
        errorPanel.classList.remove('visible');
        resultEl.classList.remove('visible');
        matchEl.classList.remove('visible');
        noMatchEl.classList.remove('visible');
        frame.classList.remove('success');
        scanLine.classList.remove('paused');
        statusEl.style.display = 'flex';
        codeValueEl.textContent = '—';
        codeFormatEl.textContent = '—';
        codeIconEl.textContent = '✅';
        // Reset OCR state
        ocrBtn.classList.remove('hidden');
        ocrStatus.classList.remove('visible');
        ocrList.classList.remove('visible');
        ocrList.innerHTML = '';
        selectedOcrCode = '';
    }


    // ═══════════════════════════════════════════════
    //  OCR — Lettura Part Number via Gemini
    // ═══════════════════════════════════════════════

    /**
     * Cattura il frame corrente del video come immagine JPEG base64.
     * Usa un canvas offscreen per convertire il frame — non crea elementi DOM visibili.
     * @returns {string} data URL base64 del frame catturato
     */
    function captureVideoFrame() {
        const canvas = document.createElement('canvas');
        // Usa la risoluzione reale del video per massima qualità OCR
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // JPEG 85% — buon compromesso tra qualità OCR e dimensione upload
        return canvas.toDataURL('image/jpeg', 0.85);
    }

    /**
     * Invia il frame catturato al backend per OCR via Gemini Flash.
     * Il backend estrae part number, codici OEM, numeri seriali dal testo visibile.
     * @param {string} base64Image - data URL del frame (image/jpeg;base64,...)
     * @returns {Promise<string[]>} array di codici/part number trovati
     */
    async function sendToOCR(base64Image) {
        // Rimuovi il prefisso data:image/jpeg;base64, per inviare solo il payload
        const payload = base64Image.replace(/^data:image\/\w+;base64,/, '');

        const res = await fetch(`${API}/scanner/ocr`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: payload }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error || 'Errore OCR');
        }

        const data = await res.json();
        return data.codes || [];
    }

    /**
     * Gestisce il click su "📝 Leggi Part Number":
     * 1. Ferma la scansione barcode
     * 2. Cattura il frame corrente
     * 3. Invia al backend per OCR
     * 4. Mostra i risultati come lista selezionabile
     */
    async function handleOcrScan() {
        // Ferma scansione barcode
        stopScanLoop();
        scanLine.classList.add('paused');

        // UI: mostra stato OCR, nascondi bottone e status barcode
        ocrBtn.classList.add('hidden');
        statusEl.style.display = 'none';
        ocrStatus.classList.add('visible');

        try {
            // Cattura frame
            const frameBase64 = captureVideoFrame();

            // Invia a Gemini per OCR
            const codes = await sendToOCR(frameBase64);

            // Nascondi stato OCR
            ocrStatus.classList.remove('visible');

            if (!codes.length) {
                // Nessun codice trovato — mostra risultato vuoto e riprendi
                frame.classList.add('success');
                resultEl.classList.add('visible');
                codeIconEl.textContent = '⚠️';
                codeValueEl.textContent = 'Nessun codice trovato';
                codeFormatEl.textContent = 'OCR';
                noMatchEl.classList.add('visible');
                noMatchEl.textContent = '⚠ Prova a inquadrare meglio il part number e riprova.';
                return;
            }

            if (codes.length === 1) {
                // Un solo codice → mostra come risultato diretto (come barcode)
                showOcrResult(codes[0]);
            } else {
                // Più codici → mostra lista selezionabile
                showOcrResultList(codes);
            }

        } catch (e) {
            console.error('❌ OCR:', e);
            ocrStatus.classList.remove('visible');
            frame.classList.add('success');
            resultEl.classList.add('visible');
            codeIconEl.textContent = '❌';
            codeValueEl.textContent = e.message;
            codeFormatEl.textContent = 'ERRORE';
        }
    }

    /**
     * Mostra un singolo risultato OCR (come se fosse un barcode).
     * Cerca anche nel magazzino per match.
     */
    function showOcrResult(code) {
        frame.classList.add('success');
        resultEl.classList.add('visible');
        codeIconEl.textContent = '📝';
        codeValueEl.textContent = code;
        codeFormatEl.textContent = 'OCR';

        // Cerca match in inventario
        matchEl.classList.remove('visible');
        noMatchEl.classList.remove('visible');

        if (typeof allParts !== 'undefined' && Array.isArray(allParts)) {
            const norm = code.toUpperCase().trim();
            const match = allParts.find(p =>
                (p.Barcode || '').toUpperCase().trim() === norm ||
                (p.Codice || '').toUpperCase().trim() === norm ||
                // Match parziale: il part number potrebbe essere nella descrizione
                (p.Descrizione || '').toUpperCase().includes(norm)
            );

            if (match) {
                matchDescEl.textContent = `${match.Codice} — ${match.Descrizione}`;
                matchStockEl.textContent = `Giacenza: ${match.Giacenza || 0} ${match.UM || 'PZ'}`;
                matchEl.classList.add('visible');
            } else {
                noMatchEl.classList.add('visible');
                noMatchEl.textContent = '⚠ Codice non presente in magazzino — verrà inserito come nuovo.';
            }
        }

        if ('vibrate' in navigator) navigator.vibrate(100);
        console.log(`📝 OCR rilevato: ${code}`);
    }

    /**
     * Mostra una lista di part number trovati dall'OCR.
     * L'utente clicca quello che vuole usare.
     */
    function showOcrResultList(codes) {
        frame.classList.add('success');
        scanLine.classList.add('paused');
        statusEl.style.display = 'none';
        resultEl.classList.add('visible');
        codeIconEl.textContent = '📝';
        codeValueEl.textContent = `${codes.length} codici trovati`;
        codeFormatEl.textContent = 'OCR';

        // Popola lista selezionabile
        ocrList.innerHTML = codes.map(code => {
            // Cerca match per ogni codice
            let badge = 'testo';
            if (typeof allParts !== 'undefined') {
                const norm = code.toUpperCase().trim();
                const found = allParts.find(p =>
                    (p.Barcode || '').toUpperCase().trim() === norm ||
                    (p.Codice || '').toUpperCase().trim() === norm ||
                    (p.Descrizione || '').toUpperCase().includes(norm)
                );
                if (found) badge = '📦 magazzino';
            }
            return `<div class="scanner-ocr-item" data-code="${code.replace(/"/g, '&quot;')}">
                <span class="ocr-code">${code}</span>
                <span class="ocr-badge">${badge}</span>
            </div>`;
        }).join('');

        ocrList.classList.add('visible');

        // Click su un item → seleziona e mostra come risultato singolo
        ocrList.querySelectorAll('.scanner-ocr-item').forEach(item => {
            item.addEventListener('click', () => {
                const code = item.dataset.code;
                ocrList.classList.remove('visible');
                selectedOcrCode = code;
                showOcrResult(code);
            });
        });

        if ('vibrate' in navigator) navigator.vibrate(100);
    }


    // ═══════════════════════════════════════════════
    //  AUTO-FILL — Popola il form dal match inventario
    // ═══════════════════════════════════════════════

    /**
     * Se il barcode corrisponde a un articolo esistente,
     * auto-compila i campi del modal per velocizzare l'inserimento.
     * Mappa: ID input nel form → campo dell'oggetto ricambio.
     */
    function autoFillFromMatch(match) {
        const fieldMap = {
            'f-code':    match.Codice,
            'f-desc':    match.Descrizione,
            'f-um':      match.UM,
            'f-pv':      match.PrezzoVendita,
            'f-pa':      match.PrezzoAcquisto,
            'f-iva':     match.CodiceIVA,
            'f-sm':      match.ScortaMinima,
            'f-settore': match.Settore,
            'f-scaffale':match.Scaffale,
            'f-ripiano': match.Ripiano,
            'f-posizione':match.Posizione,
            'f-barcode': match.Barcode,
        };

        for (const [id, value] of Object.entries(fieldMap)) {
            const el = document.getElementById(id);
            if (el && value !== undefined && value !== null && value !== '') {
                el.value = value;
                el.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }

        console.log(`✅ Auto-fill da match: ${match.Codice} — ${match.Descrizione}`);
    }


    // ═══════════════════════════════════════════════
    //  EVENT LISTENERS
    // ═══════════════════════════════════════════════

    // Chiudi scanner
    closeBtn.addEventListener('click', closeScanner);

    // OCR: cattura frame → Gemini estrae part number
    ocrBtn.addEventListener('click', handleOcrScan);

    // Conferma: usa il codice scansionato/letto → popola campo Barcode
    confirmBtn.addEventListener('click', () => {
        const code = codeValueEl.textContent;
        if (code && code !== '—') {
            // Popola l'input Barcode nel modal
            if (targetInputId) {
                const input = document.getElementById(targetInputId);
                if (input) {
                    input.value = code;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }

            // Se c'è un match inventario, popola anche gli altri campi
            if (matchEl.classList.contains('visible') && typeof allParts !== 'undefined') {
                const norm = code.toUpperCase().trim();
                const match = allParts.find(p =>
                    (p.Barcode || '').toUpperCase().trim() === norm ||
                    (p.Codice || '').toUpperCase().trim() === norm
                );
                if (match) {
                    autoFillFromMatch(match);
                }
            }
        }

        closeScanner();
    });

    // Scansiona ancora: reset e riprendi
    retryBtn.addEventListener('click', () => {
        resetUI();
        startScanLoop();
    });

    // ESC per chiudere (funziona anche su desktop per test)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
            closeScanner();
        }
    });


    // ═══════════════════════════════════════════════
    //  ESPONI SU WINDOW
    // ═══════════════════════════════════════════════

    window.openBarcodeScanner  = openScanner;
    window.closeBarcodeScanner = closeScanner;

    console.log('📷 Barcode Scanner inizializzato');

})();
