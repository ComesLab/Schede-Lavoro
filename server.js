'use strict';

/**
 * server.js — Demo Magazzino Marina (storage in-memory, reset ogni 10 min)
 * =========================================================================
 * Nessuna dipendenza esterna: no Google Sheets, no SQL Server, no Drive, no Vision.
 * Tutti i dati vivono in RAM e vengono ripristinati allo stato iniziale ogni 10 minuti.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');

const https = require('https');
const { getInitialData } = require('./mock-data');

const app = express();
const PORT = process.env.PORT || 3000;

// ════════════════════════════════════════════════
//  TELEGRAM NOTIFICATION
// ════════════════════════════════════════════════

const TG_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function sendTelegramNotify(text) {
    if (!TG_BOT_TOKEN || !TG_CHAT_ID) return;
    const data = JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: 'HTML' });
    const req = https.request({
        hostname: 'api.telegram.org',
        path: `/bot${TG_BOT_TOKEN}/sendMessage`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    });
    req.on('error', () => {});
    req.end(data);
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ════════════════════════════════════════════════
//  IN-MEMORY STORE + AUTO-RESET
// ════════════════════════════════════════════════

const RESET_INTERVAL_MS = 10 * 60 * 1000; // 10 minuti
let lastReset = Date.now();
let store = getInitialData();
let schedaCounter = 4; // prossimo ID (3 schede demo già presenti)

function checkReset() {
    if (Date.now() - lastReset > RESET_INTERVAL_MS) {
        store = getInitialData();
        lastReset = Date.now();
        schedaCounter = 4;
        console.log('🔄 Demo reset — dati ripristinati');
    }
}

function secondsUntilReset() {
    const elapsed = Date.now() - lastReset;
    return Math.max(0, Math.ceil((RESET_INTERVAL_MS - elapsed) / 1000));
}

// Middleware: auto-reset + header countdown
app.use((req, res, next) => {
    checkReset();
    res.set('X-Demo-Reset-In', String(secondsUntilReset()));
    next();
});

// Middleware: Telegram notification su pagine monitorate
const MONITORED_PAGES = ['/', '/index.html', '/meccanico', '/meccanico.html'];
app.use((req, res, next) => {
    if (req.method === 'GET' && MONITORED_PAGES.includes(req.path.toLowerCase())) {
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'N/A';
        const ua = req.headers['user-agent'] || 'N/A';
        const page = req.path === '/' || req.path === '/index.html' ? '📦 Magazzino Ricambi' : '🔧 Schede Lavoro';
        const ts = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' });
        const msg = `🔔 <b>Accesso Demo Marina</b>\n📍 IP: <code>${ip}</code>\n📄 Pagina: ${page}\n🕐 ${ts}\n📱 ${ua.substring(0, 100)}`;
        sendTelegramNotify(msg);
    }
    next();
});

// ════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════

function now() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function todayStr() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function addMovement(m) {
    store.movements.unshift({
        Data: now(),
        Codice: m.Codice || '',
        Descrizione: m.Descrizione || '',
        Causale: m.Causale || '',
        Carico: m.Carico || 0,
        Scarico: m.Scarico || 0,
        Note: m.Note || '',
        Utente: 'DEMO',
    });
}

function getLowStock() {
    return store.parts
        .filter(p => {
            const sm = parseInt(p.ScortaMinima) || 0;
            const g = parseFloat(p.Giacenza) || 0;
            return sm > 0 && g < sm;
        })
        .map(p => ({
            ...p,
            Mancanti: (parseInt(p.ScortaMinima) || 0) - (parseFloat(p.Giacenza) || 0),
        }));
}

function adjustStock(code, newQty, note) {
    const part = store.parts.find(p => p.Codice === code);
    if (!part) return { action: 'not_found' };
    const old = parseFloat(part.Giacenza) || 0;
    const target = parseFloat(newQty);
    const diff = target - old;
    if (diff === 0) return { action: 'none', diff: 0 };

    part.Giacenza = target;
    addMovement({
        Codice: code,
        Descrizione: part.Descrizione,
        Causale: diff > 0 ? 'WCRE' : 'WSCR',
        Carico: diff > 0 ? diff : 0,
        Scarico: diff < 0 ? Math.abs(diff) : 0,
        Note: note || 'Rettifica giacenza',
    });
    return { action: diff > 0 ? 'carico' : 'scarico', diff: Math.abs(diff), nuovaGiacenza: target };
}

function decrementStock(code, qty, note) {
    const part = store.parts.find(p => p.Codice === code);
    if (!part) throw new Error(`Articolo ${code} non trovato`);
    const old = parseFloat(part.Giacenza) || 0;
    const nuova = Math.max(0, old - qty);
    part.Giacenza = nuova;
    addMovement({
        Codice: code,
        Descrizione: part.Descrizione,
        Causale: 'WSCR',
        Carico: 0,
        Scarico: qty,
        Note: note || '',
    });
    return { nuovaGiacenza: nuova };
}

function processFotos(fotoArray) {
    if (!fotoArray || !fotoArray.length) return [];
    return fotoArray.map(f => {
        const dataUrl = `data:${f.mimeType || 'image/jpeg'};base64,${f.base64Data}`;
        return { url: dataUrl, thumb: dataUrl };
    });
}

// ════════════════════════════════════════════════
//  API ENDPOINTS
// ════════════════════════════════════════════════

// ── Health ──
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        version: '1.0.0-demo',
        storage: 'In-Memory (demo)',
        sync: 'Demo mode — nessun DB esterno',
        sheets: 'connected',
        demo: true,
        resetIn: secondsUntilReset(),
        ts: new Date().toISOString(),
    });
});

// ── Ricambi CRUD ──

app.get('/api/parts', (req, res) => {
    const q = req.query.q;
    let parts = store.parts;
    if (q) {
        const ql = q.toLowerCase();
        parts = parts.filter(p =>
            (p.Codice || '').toLowerCase().includes(ql) ||
            (p.Descrizione || '').toLowerCase().includes(ql)
        );
    }
    res.json(parts);
});

app.get('/api/parts/:code', (req, res) => {
    const part = store.parts.find(p => p.Codice === req.params.code);
    if (!part) return res.status(404).json({ error: 'Non trovato' });
    res.json(part);
});

app.post('/api/parts', (req, res) => {
    const data = req.body;
    if (!data.Codice) {
        data.Codice = 'DEMO-' + String(Date.now()).slice(-6);
    }
    if (store.parts.find(p => p.Codice === data.Codice)) {
        return res.status(400).json({ error: `Codice ${data.Codice} già esistente` });
    }

    const part = {
        Codice: data.Codice,
        Descrizione: data.Descrizione || '',
        Categoria: data.Categoria || '',
        UM: data.UM || 'pezzo',
        PrezzoVendita: parseFloat(data.PrezzoVendita) || 0,
        PrezzoAcquisto: parseFloat(data.PrezzoAcquisto) || 0,
        CodiceIVA: data.CodiceIVA || '9',
        Giacenza: 0,
        ScortaMinima: parseInt(data.ScortaMinima) || 0,
        Settore: data.Settore || '',
        Scaffale: data.Scaffale || '',
        Ripiano: data.Ripiano || '',
        Posizione: data.Posizione || '',
        Barcode: data.Barcode || '',
    };
    store.parts.push(part);

    const initialQty = parseFloat(data.Giacenza) || 0;
    if (initialQty > 0) {
        part.Giacenza = initialQty;
        addMovement({
            Codice: part.Codice,
            Descrizione: part.Descrizione,
            Causale: 'WCRI',
            Carico: initialQty,
            Scarico: 0,
            Note: 'Giacenza iniziale',
        });
    }

    res.status(201).json(part);
});

app.put('/api/parts/:code', (req, res) => {
    const part = store.parts.find(p => p.Codice === req.params.code);
    if (!part) return res.status(404).json({ error: 'Non trovato' });
    const data = req.body;
    for (const key of ['Descrizione', 'Categoria', 'UM', 'PrezzoVendita', 'PrezzoAcquisto', 'CodiceIVA', 'ScortaMinima', 'Settore', 'Scaffale', 'Ripiano', 'Posizione', 'Barcode']) {
        if (data[key] !== undefined) part[key] = data[key];
    }
    res.json(part);
});

app.delete('/api/parts/:code', (req, res) => {
    const idx = store.parts.findIndex(p => p.Codice === req.params.code);
    if (idx === -1) return res.status(404).json({ error: 'Non trovato' });
    store.parts.splice(idx, 1);
    res.json({ message: 'Eliminato', code: req.params.code });
});

// ── Giacenza (rettifica) ──
app.post('/api/parts/:code/adjust-stock', (req, res) => {
    const { newQty, note } = req.body;
    if (newQty === undefined || newQty < 0) return res.status(400).json({ error: 'Quantità non valida' });
    const result = adjustStock(req.params.code, parseFloat(newQty), note);
    if (result.action === 'not_found') return res.status(404).json({ error: 'Non trovato' });
    res.json(result);
});

// ── SottoScorta ──
app.get('/api/low-stock', (req, res) => {
    res.json(getLowStock());
});

// ── Movimenti ──
app.get('/api/movements', (req, res) => {
    res.json(store.movements);
});

// ── Stats ──
app.get('/api/stats', (req, res) => {
    const parts = store.parts;
    const inStock = parts.filter(p => (parseFloat(p.Giacenza) || 0) > 0).length;
    const qta = parts.reduce((s, p) => s + (parseFloat(p.Giacenza) || 0), 0);
    const val = parts.reduce((s, p) => s + (parseFloat(p.Giacenza) || 0) * (parseFloat(p.PrezzoVendita) || 0), 0);
    const low = getLowStock().length;
    res.json({ articoliInStock: inStock, qtaTotale: qta, valoreVendita: val, sottoScorta: low });
});

// ════════════════════════════════════════════════
//  SCHEDE LAVORO
// ════════════════════════════════════════════════

app.get('/api/schede', (req, res) => {
    let schede = store.schede;
    const { barca, stato } = req.query;
    if (barca) {
        const norm = barca.toLowerCase().trim();
        schede = schede.filter(s => (s.Barca || '').toLowerCase().includes(norm));
    }
    if (stato) schede = schede.filter(s => s.Stato === stato.toUpperCase());
    schede.sort((a, b) => {
        const da = a._CreatoIl || a.Data || '';
        const db = b._CreatoIl || b.Data || '';
        return db.localeCompare(da);
    });
    res.json(schede);
});

app.get('/api/schede/:id', (req, res) => {
    const scheda = store.schede.find(s => s.ID === req.params.id);
    if (!scheda) return res.status(404).json({ error: 'Scheda non trovata' });
    res.json(scheda);
});

app.post('/api/schede', (req, res) => {
    try {
        const { barca, meccanico, descrizione, ricambi, foto } = req.body;
        if (!barca) return res.status(400).json({ error: 'Nome barca obbligatorio' });

        const fotoResults = processFotos(foto);

        const id = `SL-${new Date().getFullYear()}-${String(schedaCounter++).padStart(4, '0')}`;
        const ricambiStr = Array.isArray(ricambi)
            ? ricambi.map(r => `${r.codice || '?'}×${r.quantita || 1} ${r.descrizione || ''}`.trim()).join(' | ')
            : '';

        const scheda = {
            ID: id,
            Barca: barca,
            Meccanico: meccanico || 'Non specificato',
            Descrizione: descrizione || '',
            Data: todayStr(),
            Stato: 'APERTA',
            Ricambi: ricambiStr,
            FotoURLs: fotoResults.map(f => f.url).join(' | '),
            FotoThumbs: fotoResults.map(f => f.thumb).join(' | '),
            _CreatoIl: new Date().toISOString(),
        };
        store.schede.push(scheda);

        // Scarico automatico ricambi
        const stockResults = [];
        if (Array.isArray(ricambi)) {
            for (const r of ricambi) {
                if (typeof r !== 'object' || !r.codice) continue;
                const qty = parseFloat(r.quantita) || 1;
                const nota = `Scheda ${id} — ${barca}`;
                try {
                    const result = decrementStock(r.codice, qty, nota);
                    stockResults.push({ codice: r.codice, descrizione: r.descrizione, scaricato: qty, nuovaGiacenza: result.nuovaGiacenza, status: 'ok' });
                } catch (e) {
                    stockResults.push({ codice: r.codice, descrizione: r.descrizione, scaricato: 0, status: 'errore', errore: e.message });
                }
            }
        }

        res.status(201).json({ ...scheda, stockResults });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.patch('/api/schede/:id', (req, res) => {
    try {
        const scheda = store.schede.find(s => s.ID === req.params.id);
        if (!scheda) return res.status(404).json({ error: 'Scheda non trovata' });

        const { descrizione, ricambi, ricambiCompleti, foto, fotoRimosse, stato } = req.body;

        // Cambio stato
        if (stato) {
            const valid = ['APERTA', 'COMPLETATA', 'ARCHIVIATA'];
            if (!valid.includes(stato)) return res.status(400).json({ error: `Stato non valido. Valori: ${valid.join(', ')}` });
            if (!descrizione && !ricambi && !ricambiCompleti && !foto && !fotoRimosse) {
                scheda.Stato = stato;
                return res.json(scheda);
            }
        }

        if (scheda.Stato === 'ARCHIVIATA' && !stato) {
            return res.status(400).json({ error: 'Scheda archiviata, non modificabile. Riaprila prima.' });
        }

        let fotoCaricate = 0;
        let fotoEliminate = 0;
        const fotoDeleteResults = [];
        const stockResults = [];
        const stockRestored = [];

        // 1. Descrizione
        if (descrizione !== undefined) scheda.Descrizione = descrizione;

        // 2. Nuove foto
        if (foto && foto.length > 0) {
            const fotoResults = processFotos(foto);
            const curUrls = scheda.FotoURLs ? scheda.FotoURLs.split(' | ').filter(Boolean) : [];
            const curThumbs = scheda.FotoThumbs ? scheda.FotoThumbs.split(' | ').filter(Boolean) : [];
            fotoResults.forEach(f => { curUrls.push(f.url); curThumbs.push(f.thumb); });
            scheda.FotoURLs = curUrls.join(' | ');
            scheda.FotoThumbs = curThumbs.join(' | ');
            fotoCaricate = fotoResults.length;
        }

        // 2b. Rimozione foto
        if (fotoRimosse && Array.isArray(fotoRimosse) && fotoRimosse.length > 0) {
            const urlsToRemove = new Set(fotoRimosse.map(f => f.url));
            const curUrls = (scheda.FotoURLs || '').split(' | ').filter(Boolean);
            const curThumbs = (scheda.FotoThumbs || '').split(' | ').filter(Boolean);
            const keptUrls = [], keptThumbs = [];
            for (let i = 0; i < curUrls.length; i++) {
                if (!urlsToRemove.has(curUrls[i])) {
                    keptUrls.push(curUrls[i]);
                    if (curThumbs[i]) keptThumbs.push(curThumbs[i]);
                } else {
                    fotoEliminate++;
                    fotoDeleteResults.push({ url: curUrls[i], deleted: true });
                }
            }
            scheda.FotoURLs = keptUrls.join(' | ');
            scheda.FotoThumbs = keptThumbs.join(' | ');
        }

        // 3. Gestione ricambi
        if (ricambiCompleti && Array.isArray(ricambiCompleti)) {
            // Parse ricambi attuali
            const oldEntries = (scheda.Ricambi || '').split(' | ').filter(Boolean);
            const oldMap = {};
            for (const entry of oldEntries) {
                const m = entry.match(/^([^×]+)×(\d+)\s*(.*)$/);
                if (m && m[1] !== '?') {
                    const code = m[1].trim().toUpperCase();
                    oldMap[code] = (oldMap[code] || 0) + (parseInt(m[2]) || 1);
                }
            }

            const newMap = {};
            for (const r of ricambiCompleti) {
                if (r.codice) {
                    const code = r.codice.toUpperCase();
                    newMap[code] = (newMap[code] || 0) + (parseFloat(r.quantita) || 1);
                }
            }

            // Ripristino stock per ricambi rimossi/diminuiti
            for (const [code, oldQty] of Object.entries(oldMap)) {
                const newQty = newMap[code] || 0;
                const diff = oldQty - newQty;
                if (diff > 0) {
                    const nota = `Scheda ${scheda.ID} (ripristino) — ${scheda.Barca}`;
                    try {
                        const part = store.parts.find(p => p.Codice.toUpperCase() === code);
                        if (part) {
                            const currentStock = parseFloat(part.Giacenza) || 0;
                            const restored = currentStock + diff;
                            adjustStock(part.Codice, restored, nota);
                            stockRestored.push({ codice: code, ripristinato: diff, nuovaGiacenza: restored, status: 'ok' });
                        }
                    } catch (e) {
                        stockRestored.push({ codice: code, ripristinato: 0, status: 'errore', errore: e.message });
                    }
                }
            }

            // Scarico per ricambi nuovi/aumentati
            for (const [code, newQty] of Object.entries(newMap)) {
                const oldQty = oldMap[code] || 0;
                const diff = newQty - oldQty;
                if (diff > 0) {
                    const nota = `Scheda ${scheda.ID} (modifica) — ${scheda.Barca}`;
                    try {
                        const part = store.parts.find(p => p.Codice.toUpperCase() === code);
                        if (part) {
                            const result = decrementStock(part.Codice, diff, nota);
                            stockResults.push({ codice: code, scaricato: diff, nuovaGiacenza: result.nuovaGiacenza, status: 'ok' });
                        }
                    } catch (e) {
                        stockResults.push({ codice: code, scaricato: 0, status: 'errore', errore: e.message });
                    }
                }
            }

            scheda.Ricambi = ricambiCompleti.map(r =>
                `${r.codice || '?'}×${r.quantita || 1} ${r.descrizione || ''}`.trim()
            ).join(' | ');

        } else if (ricambi && ricambi.length) {
            // Append classico
            const existing = scheda.Ricambi ? scheda.Ricambi.split(' | ').filter(Boolean) : [];
            const newEntries = ricambi.map(r => `${r.codice || '?'}×${r.quantita || 1} ${r.descrizione || ''}`.trim());
            scheda.Ricambi = [...existing, ...newEntries].join(' | ');

            for (const r of ricambi) {
                if (!r.codice) continue;
                const qty = parseFloat(r.quantita) || 1;
                const nota = `Scheda ${scheda.ID} (modifica) — ${scheda.Barca}`;
                try {
                    const result = decrementStock(r.codice, qty, nota);
                    stockResults.push({ codice: r.codice, descrizione: r.descrizione, scaricato: qty, nuovaGiacenza: result.nuovaGiacenza, status: 'ok' });
                } catch (e) {
                    stockResults.push({ codice: r.codice, descrizione: r.descrizione, scaricato: 0, status: 'errore', errore: e.message });
                }
            }
        }

        // 4. Stato
        if (stato && stato !== scheda.Stato) scheda.Stato = stato;

        res.json({ ...scheda, stockResults, stockRestored, fotoCaricate, fotoEliminate, fotoDeleteResults });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/schede/:id/foto', (req, res) => {
    const scheda = store.schede.find(s => s.ID === req.params.id);
    if (!scheda) return res.status(404).json({ error: 'Scheda non trovata' });

    const { foto } = req.body;
    if (!foto || !foto.length) return res.status(400).json({ error: 'Nessuna foto' });

    const fotoResults = processFotos(foto);
    const curUrls = scheda.FotoURLs ? scheda.FotoURLs.split(' | ').filter(Boolean) : [];
    const curThumbs = scheda.FotoThumbs ? scheda.FotoThumbs.split(' | ').filter(Boolean) : [];
    fotoResults.forEach(f => { curUrls.push(f.url); curThumbs.push(f.thumb); });
    scheda.FotoURLs = curUrls.join(' | ');
    scheda.FotoThumbs = curThumbs.join(' | ');

    res.json(scheda);
});

// ── Stampa scheda (HTML per print) ──
app.get('/api/schede/:id/print', (req, res) => {
    const scheda = store.schede.find(s => s.ID === req.params.id);
    if (!scheda) return res.status(404).json({ error: 'Scheda non trovata' });

    const ricambi = (scheda.Ricambi || '').split(' | ').filter(Boolean);
    const fotoThumbs = (scheda.FotoThumbs || '').split(' | ').filter(Boolean);
    const fotoUrls = (scheda.FotoURLs || '').split(' | ').filter(Boolean);

    const ricambiRows = ricambi.map(r => {
        const m = r.match(/^([^×]+)×(\d+)\s*(.*)$/);
        if (m) return `<tr><td>${esc(m[1])}</td><td style="text-align:center">${m[2]}</td><td>${esc(m[3])}</td></tr>`;
        return `<tr><td>—</td><td>1</td><td>${esc(r)}</td></tr>`;
    }).join('');

    const fotoHtml = fotoThumbs.map((t, i) =>
        `<img src="${esc(fotoUrls[i] || t)}" style="width:180px;height:180px;object-fit:cover;border-radius:6px;border:1px solid #ddd;" onerror="this.style.display='none'">`
    ).join(' ');

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>Scheda Lavoro ${esc(scheda.ID)}</title>
<style>
    @page { size: A4; margin: 18mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #222; font-size: 11pt; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1a365d; padding-bottom: 12px; margin-bottom: 16px; }
    .header h1 { font-size: 18pt; color: #1a365d; }
    .header .meta { text-align: right; font-size: 9pt; color: #555; }
    .section { margin-bottom: 14px; }
    .section h2 { font-size: 11pt; color: #1a365d; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid #cbd5e0; padding-bottom: 4px; margin-bottom: 8px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px 20px; }
    .info-item label { font-size: 8pt; color: #888; text-transform: uppercase; letter-spacing: 0.04em; display: block; }
    .info-item span { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; font-size: 10pt; }
    th { background: #edf2f7; color: #1a365d; text-align: left; padding: 6px 10px; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.04em; }
    td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
    .foto-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
    .footer { margin-top: 30px; display: flex; justify-content: space-between; font-size: 9pt; color: #888; border-top: 1px solid #cbd5e0; padding-top: 8px; }
    .firma { margin-top: 40px; display: flex; justify-content: space-between; }
    .firma-box { width: 45%; border-top: 1px solid #222; padding-top: 4px; font-size: 9pt; color: #555; }
    .demo-banner { background: #fff3cd; color: #856404; text-align: center; padding: 6px; font-size: 9pt; font-weight: 600; border-bottom: 1px solid #ffc107; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body onload="window.print()">
    <div class="demo-banner">DEMO — Versione dimostrativa</div>
    <div class="header">
        <div>
            <div style="font-size:28pt">⚓</div>
            <h1>Scheda Lavoro</h1>
            <div style="font-size:9pt;color:#555;margin-top:2px;">Marina Rodi Garganico — Demo</div>
        </div>
        <div class="meta">
            <strong style="font-size:12pt;color:#1a365d">${esc(scheda.ID)}</strong><br>
            ${esc(scheda.Data)}<br>
            Stato: <strong>${esc(scheda.Stato)}</strong>
        </div>
    </div>
    <div class="section">
        <h2>Informazioni</h2>
        <div class="info-grid">
            <div class="info-item"><label>Barca</label><span>${esc(scheda.Barca)}</span></div>
            <div class="info-item"><label>Responsabile Lavoro</label><span>${esc(scheda.Meccanico || '—')}</span></div>
            <div class="info-item"><label>Data</label><span>${esc(scheda.Data)}</span></div>
        </div>
        ${scheda.Descrizione ? `<div style="margin-top:8px"><label style="font-size:8pt;color:#888;text-transform:uppercase">Descrizione</label><p style="margin-top:2px">${esc(scheda.Descrizione)}</p></div>` : ''}
    </div>
    ${ricambi.length ? `<div class="section">
        <h2>Ricambi Sostituiti (${ricambi.length})</h2>
        <table><thead><tr><th>Codice</th><th style="text-align:center">Qtà</th><th>Descrizione</th></tr></thead><tbody>${ricambiRows}</tbody></table>
    </div>` : ''}
    ${fotoThumbs.length ? `<div class="section">
        <h2>Foto (${fotoThumbs.length})</h2>
        <div class="foto-grid">${fotoHtml}</div>
    </div>` : ''}
    <div class="firma">
        <div class="firma-box">Firma Responsabile Lavoro</div>
        <div class="firma-box">Firma Capo Cantiere</div>
    </div>
    <div class="footer">
        <span>Marina Rodi Garganico — Magazzino Ricambi (DEMO)</span>
        <span>Stampato il ${new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}</span>
    </div>
</body>
</html>`;

    res.type('html').send(html);
});

// ── Lista barche (autocomplete) ──
app.get('/api/barche', (req, res) => {
    const barche = [...new Set(store.schede.map(s => s.Barca).filter(Boolean))].sort();
    res.json(barche);
});

// ── Pagina meccanico ──
app.get('/meccanico', (req, res) => res.sendFile(path.join(__dirname, 'public', 'meccanico.html')));

// ── SPA fallback ──
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ════════════════════════════════════════════════
//  STARTUP
// ════════════════════════════════════════════════

if (process.env.VERCEL) {
    module.exports = app;
} else {
    app.listen(PORT, () => {
        console.log(`
╔═══════════════════════════════════════════════════════╗
║  Magazzino Marina — DEMO                              ║
║  Storage: In-Memory (reset ogni 10 min)               ║
║  Vision:  Disabilitato                                ║
║  Local:   http://localhost:${PORT}                       ║
╚═══════════════════════════════════════════════════════╝`);
    });
}
