/**
 * printService.js
 * ─────────────────────────────────────────────────────────────────
 * Frontend helper that sends receipt data to the local print server.
 * The print server (print-server/server.js) must be running on port 6789.
 *
 * Usage:
 *   import { printReceipt, checkPrintServer } from './printService';
 *   await printReceipt(transaction, systemSettings);
 */

const PRINT_SERVER = 'http://localhost:6789';

/**
 * Ping the local print server.
 * Returns { online: true, printers: [...] } or { online: false, error }
 */
export async function checkPrintServer() {
  try {
    const res = await fetch(`${PRINT_SERVER}/health`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) throw new Error('Server returned ' + res.status);
    const data = await res.json();
    return { online: true, printers: data.printers || [] };
  } catch (err) {
    return { online: false, error: err.message };
  }
}

/**
 * Get the list of printers from the local server.
 */
export async function getAvailablePrinters() {
  try {
    const res = await fetch(`${PRINT_SERVER}/printers`, { signal: AbortSignal.timeout(2000) });
    const data = await res.json();
    return data.printers || [];
  } catch {
    return [];
  }
}

/**
 * Send a print job to the local server.
 *
 * @param {object} tx        – The transaction object from Supabase / state
 * @param {object} settings  – Shop settings (company_name, address, phone, gst_no)
 * @param {string} [printerName] – Optional: override the default printer name
 * @returns {{ success: boolean, error?: string, jobId?: number }}
 */
export async function printReceipt(tx, settings = {}, printerName = null) {
  try {
    const gross = tx.gross_total ?? tx.total_amount ?? 0;
    const discount = tx.discount_amount ?? 0;
    const afterDisc = Math.max(0, gross - discount);
    const taxRate = tx.tax_percent || 0;
    const taxVal = afterDisc * (taxRate / 100);
    const beforeRound = afterDisc + taxVal;
    const net = tx.total_amount ?? Math.round(beforeRound);
    const roundOff = net - beforeRound;

    const s = settings || {};
    const payload = {
      receipt: {
        id:             tx.id,
        date:           tx.date || new Date().toLocaleString(),
        customer_name:  tx.customer_name || 'Walk-in',
        payment_method: tx.payment_method || '',
        items_json:     tx.items_json || [],
        subtotal:       gross,
        discount:       discount,
        tax_rate:       taxRate,
        tax_amount:     taxVal,
        round_off:      roundOff,
        total_amount:   net,
      },
      settings: {
        company_name: s.company_name || 'MONSOON MERIDIAN',
        address:      s.address || '',
        phone:        s.phone || '',
        gst_no:       s.gst_no || '',
      },
      printerName: printerName || null,
    };

    const res = await fetch(`${PRINT_SERVER}/print`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(8000),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      return { success: false, error: data.error || 'Print server error' };
    }

    return { success: true, jobId: data.jobId, printer: data.printer };

  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return { success: false, error: 'Print server timeout' };
    }
    return { success: false, error: err.message };
  }
}
