'use strict';

/**
 * mock-data.js — Dati demo realistici per il magazzino ricambi marina
 * Ogni chiamata a getInitialData() restituisce una copia fresca (deep clone).
 */

function getInitialData() {
    const parts = [
        // ── Filtri ──
        { Codice: 'VP-3840525', Descrizione: 'Filtro olio Volvo Penta D2-40', Categoria: 'Filtri', UM: 'pezzo', PrezzoVendita: 28.50, PrezzoAcquisto: 18.20, CodiceIVA: '9', Giacenza: 8, ScortaMinima: 3, Settore: 'A', Scaffale: '1', Ripiano: '2', Posizione: 'A1-2', Barcode: '7312300384052' },
        { Codice: 'VP-21364359', Descrizione: 'Filtro carburante Volvo Penta', Categoria: 'Filtri', UM: 'pezzo', PrezzoVendita: 34.00, PrezzoAcquisto: 22.10, CodiceIVA: '9', Giacenza: 5, ScortaMinima: 3, Settore: 'A', Scaffale: '1', Ripiano: '3', Posizione: 'A1-3', Barcode: '7312302136435' },
        { Codice: 'YM-129470-55703', Descrizione: 'Filtro olio Yanmar 3JH', Categoria: 'Filtri', UM: 'pezzo', PrezzoVendita: 22.00, PrezzoAcquisto: 14.50, CodiceIVA: '9', Giacenza: 2, ScortaMinima: 3, Settore: 'A', Scaffale: '1', Ripiano: '4', Posizione: 'A1-4', Barcode: '' },
        { Codice: 'YM-129004-55601', Descrizione: 'Filtro carburante Yanmar serie JH', Categoria: 'Filtri', UM: 'pezzo', PrezzoVendita: 18.90, PrezzoAcquisto: 12.00, CodiceIVA: '9', Giacenza: 1, ScortaMinima: 2, Settore: 'A', Scaffale: '1', Ripiano: '5', Posizione: 'A1-5', Barcode: '' },
        { Codice: 'VP-3862228', Descrizione: 'Filtro aria Volvo Penta 2000 serie', Categoria: 'Filtri', UM: 'pezzo', PrezzoVendita: 42.00, PrezzoAcquisto: 28.00, CodiceIVA: '9', Giacenza: 4, ScortaMinima: 2, Settore: 'A', Scaffale: '2', Ripiano: '1', Posizione: 'A2-1', Barcode: '' },

        // ── Zinchi / Anodi ──
        { Codice: 'VP-3858399', Descrizione: 'Anodo zinco asse Volvo 25mm', Categoria: 'Zinchi/Anodi', UM: 'pezzo', PrezzoVendita: 12.50, PrezzoAcquisto: 7.80, CodiceIVA: '9', Giacenza: 15, ScortaMinima: 5, Settore: 'B', Scaffale: '1', Ripiano: '1', Posizione: 'B1-1', Barcode: '' },
        { Codice: 'VP-3588745', Descrizione: 'Anodo zinco piede SX/DP', Categoria: 'Zinchi/Anodi', UM: 'pezzo', PrezzoVendita: 35.00, PrezzoAcquisto: 22.50, CodiceIVA: '9', Giacenza: 6, ScortaMinima: 3, Settore: 'B', Scaffale: '1', Ripiano: '2', Posizione: 'B1-2', Barcode: '' },
        { Codice: 'ZN-TIMONE-30', Descrizione: 'Anodo zinco timone ovale 300g', Categoria: 'Zinchi/Anodi', UM: 'pezzo', PrezzoVendita: 8.50, PrezzoAcquisto: 5.20, CodiceIVA: '9', Giacenza: 20, ScortaMinima: 8, Settore: 'B', Scaffale: '1', Ripiano: '3', Posizione: 'B1-3', Barcode: '' },

        // ── Giranti ──
        { Codice: 'VP-21951346', Descrizione: 'Girante pompa acqua Volvo D1/D2', Categoria: 'Giranti', UM: 'pezzo', PrezzoVendita: 45.00, PrezzoAcquisto: 29.00, CodiceIVA: '9', Giacenza: 3, ScortaMinima: 2, Settore: 'C', Scaffale: '1', Ripiano: '1', Posizione: 'C1-1', Barcode: '' },
        { Codice: 'YM-128990-42200', Descrizione: 'Girante pompa acqua mare Yanmar', Categoria: 'Giranti', UM: 'pezzo', PrezzoVendita: 38.00, PrezzoAcquisto: 24.50, CodiceIVA: '9', Giacenza: 1, ScortaMinima: 2, Settore: 'C', Scaffale: '1', Ripiano: '2', Posizione: 'C1-2', Barcode: '' },
        { Codice: 'JB-1210-0001', Descrizione: 'Girante Johnson F5B tipo universale', Categoria: 'Giranti', UM: 'pezzo', PrezzoVendita: 28.00, PrezzoAcquisto: 17.50, CodiceIVA: '9', Giacenza: 4, ScortaMinima: 2, Settore: 'C', Scaffale: '1', Ripiano: '3', Posizione: 'C1-3', Barcode: '' },

        // ── Cinghie ──
        { Codice: 'VP-966938', Descrizione: 'Cinghia alternatore Volvo D2-40', Categoria: 'Cinghie', UM: 'pezzo', PrezzoVendita: 19.50, PrezzoAcquisto: 12.00, CodiceIVA: '9', Giacenza: 3, ScortaMinima: 2, Settore: 'C', Scaffale: '2', Ripiano: '1', Posizione: 'C2-1', Barcode: '' },
        { Codice: 'YM-25132-003600', Descrizione: 'Cinghia distribuzione Yanmar 3JH', Categoria: 'Cinghie', UM: 'pezzo', PrezzoVendita: 32.00, PrezzoAcquisto: 20.50, CodiceIVA: '9', Giacenza: 0, ScortaMinima: 1, Settore: 'C', Scaffale: '2', Ripiano: '2', Posizione: 'C2-2', Barcode: '' },

        // ── Guarnizioni ──
        { Codice: 'VP-3583786', Descrizione: 'Kit guarnizioni testata Volvo D2', Categoria: 'Guarnizioni', UM: 'kit', PrezzoVendita: 185.00, PrezzoAcquisto: 120.00, CodiceIVA: '9', Giacenza: 1, ScortaMinima: 1, Settore: 'D', Scaffale: '1', Ripiano: '1', Posizione: 'D1-1', Barcode: '' },
        { Codice: 'VP-22023653', Descrizione: 'O-ring coperchio valvole Volvo', Categoria: 'Guarnizioni', UM: 'pezzo', PrezzoVendita: 9.80, PrezzoAcquisto: 6.00, CodiceIVA: '9', Giacenza: 6, ScortaMinima: 3, Settore: 'D', Scaffale: '1', Ripiano: '2', Posizione: 'D1-2', Barcode: '' },
        { Codice: 'GN-SCARICO-45', Descrizione: 'Guarnizione scarico gomito 45mm', Categoria: 'Guarnizioni', UM: 'pezzo', PrezzoVendita: 7.50, PrezzoAcquisto: 4.20, CodiceIVA: '9', Giacenza: 10, ScortaMinima: 4, Settore: 'D', Scaffale: '1', Ripiano: '3', Posizione: 'D1-3', Barcode: '' },

        // ── Elettrica ──
        { Codice: 'EL-FUS-30A', Descrizione: 'Fusibile a lama 30A (conf. 10 pz)', Categoria: 'Elettrica', UM: 'conf', PrezzoVendita: 5.50, PrezzoAcquisto: 3.00, CodiceIVA: '9', Giacenza: 12, ScortaMinima: 5, Settore: 'E', Scaffale: '1', Ripiano: '1', Posizione: 'E1-1', Barcode: '' },
        { Codice: 'EL-INT-BIL12', Descrizione: 'Interruttore pompa sentina 12V auto', Categoria: 'Elettrica', UM: 'pezzo', PrezzoVendita: 24.00, PrezzoAcquisto: 15.50, CodiceIVA: '9', Giacenza: 3, ScortaMinima: 2, Settore: 'E', Scaffale: '1', Ripiano: '2', Posizione: 'E1-2', Barcode: '' },
        { Codice: 'EL-LAMP-NAV', Descrizione: 'Lampadina LED navigazione BAY15D', Categoria: 'Elettrica', UM: 'pezzo', PrezzoVendita: 14.00, PrezzoAcquisto: 8.50, CodiceIVA: '9', Giacenza: 8, ScortaMinima: 4, Settore: 'E', Scaffale: '1', Ripiano: '3', Posizione: 'E1-3', Barcode: '' },

        // ── Chimici ──
        { Codice: 'CH-SIKA291-WH', Descrizione: 'Sikaflex 291i bianco 300ml', Categoria: 'Chimici', UM: 'pezzo', PrezzoVendita: 18.50, PrezzoAcquisto: 11.80, CodiceIVA: '9', Giacenza: 4, ScortaMinima: 3, Settore: 'F', Scaffale: '1', Ripiano: '1', Posizione: 'F1-1', Barcode: '' },
        { Codice: 'CH-5200-WH', Descrizione: '3M 5200 sigillante marino bianco 295ml', Categoria: 'Chimici', UM: 'pezzo', PrezzoVendita: 22.00, PrezzoAcquisto: 14.50, CodiceIVA: '9', Giacenza: 2, ScortaMinima: 2, Settore: 'F', Scaffale: '1', Ripiano: '2', Posizione: 'F1-2', Barcode: '' },
        { Codice: 'CH-ANTIVEG-BL', Descrizione: 'Antivegetativa autolevigante blu 750ml', Categoria: 'Chimici', UM: 'pezzo', PrezzoVendita: 42.00, PrezzoAcquisto: 28.00, CodiceIVA: '9', Giacenza: 6, ScortaMinima: 3, Settore: 'F', Scaffale: '2', Ripiano: '1', Posizione: 'F2-1', Barcode: '' },

        // ── Idraulica ──
        { Codice: 'ID-TUBO-16MM', Descrizione: 'Tubo acqua marina rinforzato 16mm (al metro)', Categoria: 'Idraulica', UM: 'metro', PrezzoVendita: 8.00, PrezzoAcquisto: 4.80, CodiceIVA: '9', Giacenza: 25, ScortaMinima: 10, Settore: 'G', Scaffale: '1', Ripiano: '1', Posizione: 'G1-1', Barcode: '' },
        { Codice: 'ID-RACC-Y25', Descrizione: 'Raccordo a Y 25mm ottone marino', Categoria: 'Idraulica', UM: 'pezzo', PrezzoVendita: 15.50, PrezzoAcquisto: 9.80, CodiceIVA: '9', Giacenza: 5, ScortaMinima: 3, Settore: 'G', Scaffale: '1', Ripiano: '2', Posizione: 'G1-2', Barcode: '' },
        { Codice: 'ID-PASSASC-25', Descrizione: 'Passascafo bronzo 25mm con valvola', Categoria: 'Idraulica', UM: 'pezzo', PrezzoVendita: 48.00, PrezzoAcquisto: 32.00, CodiceIVA: '9', Giacenza: 2, ScortaMinima: 2, Settore: 'G', Scaffale: '1', Ripiano: '3', Posizione: 'G1-3', Barcode: '' },
    ];

    const now = new Date();
    const fmt = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    const daysAgo = n => { const d = new Date(now); d.setDate(d.getDate() - n); return d; };

    const movements = [
        { Data: fmt(daysAgo(1)), Codice: 'VP-3840525', Descrizione: 'Filtro olio Volvo Penta D2-40', Causale: 'WCRI', Carico: 10, Scarico: 0, Note: 'Riordino mensile', Utente: 'ADMIN' },
        { Data: fmt(daysAgo(1)), Codice: 'VP-21364359', Descrizione: 'Filtro carburante Volvo Penta', Causale: 'WCRI', Carico: 5, Scarico: 0, Note: 'Riordino mensile', Utente: 'ADMIN' },
        { Data: fmt(daysAgo(2)), Codice: 'VP-3840525', Descrizione: 'Filtro olio Volvo Penta D2-40', Causale: 'WSCR', Carico: 0, Scarico: 2, Note: 'Scheda SL-2024-0001 — Libeccio III', Utente: 'MECCANICO' },
        { Data: fmt(daysAgo(2)), Codice: 'VP-21951346', Descrizione: 'Girante pompa acqua Volvo D1/D2', Causale: 'WSCR', Carico: 0, Scarico: 1, Note: 'Scheda SL-2024-0001 — Libeccio III', Utente: 'MECCANICO' },
        { Data: fmt(daysAgo(3)), Codice: 'ZN-TIMONE-30', Descrizione: 'Anodo zinco timone ovale 300g', Causale: 'WSCR', Carico: 0, Scarico: 4, Note: 'Scheda SL-2024-0002 — Mistral', Utente: 'MECCANICO' },
        { Data: fmt(daysAgo(3)), Codice: 'VP-3588745', Descrizione: 'Anodo zinco piede SX/DP', Causale: 'WSCR', Carico: 0, Scarico: 2, Note: 'Scheda SL-2024-0002 — Mistral', Utente: 'MECCANICO' },
        { Data: fmt(daysAgo(4)), Codice: 'CH-SIKA291-WH', Descrizione: 'Sikaflex 291i bianco 300ml', Causale: 'WSCR', Carico: 0, Scarico: 1, Note: 'Sigillatura oblò prua', Utente: 'MECCANICO' },
        { Data: fmt(daysAgo(5)), Codice: 'EL-FUS-30A', Descrizione: 'Fusibile a lama 30A (conf. 10 pz)', Causale: 'WCRI', Carico: 10, Scarico: 0, Note: 'Scorta elettrica', Utente: 'ADMIN' },
        { Data: fmt(daysAgo(6)), Codice: 'ID-TUBO-16MM', Descrizione: 'Tubo acqua marina rinforzato 16mm (al metro)', Causale: 'WCRI', Carico: 30, Scarico: 0, Note: 'Arrivo fornitore', Utente: 'ADMIN' },
        { Data: fmt(daysAgo(7)), Codice: 'VP-3583786', Descrizione: 'Kit guarnizioni testata Volvo D2', Causale: 'WCRI', Carico: 2, Scarico: 0, Note: 'Ordine speciale cliente', Utente: 'ADMIN' },
    ];

    const fmtDate = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;

    const schede = [
        {
            ID: 'SL-2024-0001',
            Barca: 'Libeccio III',
            Meccanico: 'Marco Ferrante',
            Descrizione: 'Tagliando motore 500 ore — sostituzione filtro olio, filtro gasolio, girante pompa acqua mare. Controllo cinghia alternatore.',
            Data: fmtDate(daysAgo(2)),
            Stato: 'APERTA',
            Ricambi: 'VP-3840525×2 Filtro olio Volvo Penta D2-40 | VP-21364359×1 Filtro carburante Volvo Penta | VP-21951346×1 Girante pompa acqua Volvo D1/D2',
            FotoURLs: '',
            FotoThumbs: '',
            _CreatoIl: daysAgo(2).toISOString(),
        },
        {
            ID: 'SL-2024-0002',
            Barca: 'Mistral',
            Meccanico: 'Antonio Greco',
            Descrizione: 'Sostituzione zinchi carena e piede poppiero. Controllo stato anodi e passascafo.',
            Data: fmtDate(daysAgo(3)),
            Stato: 'COMPLETATA',
            Ricambi: 'ZN-TIMONE-30×4 Anodo zinco timone ovale 300g | VP-3588745×2 Anodo zinco piede SX/DP',
            FotoURLs: '',
            FotoThumbs: '',
            _CreatoIl: daysAgo(3).toISOString(),
        },
        {
            ID: 'SL-2024-0003',
            Barca: 'Vento di Mare',
            Meccanico: 'Marco Ferrante',
            Descrizione: 'Rimessaggio invernale — lavaggio motore, cambio olio, sostituzione girante, antigelo circuito chiuso.',
            Data: fmtDate(daysAgo(15)),
            Stato: 'ARCHIVIATA',
            Ricambi: 'YM-129470-55703×1 Filtro olio Yanmar 3JH | YM-128990-42200×1 Girante pompa acqua mare Yanmar',
            FotoURLs: '',
            FotoThumbs: '',
            _CreatoIl: daysAgo(15).toISOString(),
        },
    ];

    return {
        parts: JSON.parse(JSON.stringify(parts)),
        movements: JSON.parse(JSON.stringify(movements)),
        schede: JSON.parse(JSON.stringify(schede)),
    };
}

module.exports = { getInitialData };
