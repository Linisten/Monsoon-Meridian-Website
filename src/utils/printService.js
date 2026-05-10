/**
 * printService.js
 * ─────────────────────────────────────────────────────────────────
 * Frontend helper that sends receipt data to the local print server.
 * The print server (print-server/server.js) must be running on port 6789.
 *
 * Usage:
 *   import { printReceipt, printLabels, checkPrintServer } from './printService';
 *   await printReceipt(transaction, systemSettings);
 *   await printLabels(['base64image...'], copies);
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
// Helper to convert logo to ESC/POS bits in the browser
async function getLogoBits(url, maxWidth = 384) {
    console.log("[PRINT] → Attempting to process logo from:", url);
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > maxWidth) { h = Math.round(h * (maxWidth / w)); w = maxWidth; }
                const widthInBytes = Math.ceil(w / 8);
                canvas.width = widthInBytes * 8; 
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, w, h);
                const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                const bits = new Uint8Array(widthInBytes * h);
                let hasPixels = false;
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < canvas.width; x++) {
                        const i = (y * canvas.width + x) * 4;
                        const avg = (data[i] + data[i+1] + data[i+2]) / 3;
                        if (avg < 240) { // Extremely aggressive threshold (anything non-white is black)
                            const byteIdx = y * widthInBytes + Math.floor(x / 8);
                            bits[byteIdx] |= (0x80 >> (x % 8));
                            hasPixels = true;
                        }
                    }
                }
                if (!hasPixels) {
                    console.warn("[PRINT] → Logo processing resulted in an empty image (all white).");
                    resolve(null); return;
                }
                // Use ESC * 33 (24-dot double density) - THE MOST COMPATIBLE COMMAND
                const result = [];
                result.push(0x1B, 0x61, 0x01); // Center
                
                // Diagnostic: Force first 24 rows to be solid black
                for (let i = 0; i < (widthInBytes * 24); i++) bits[i] = 0xFF;

                for (let y = 0; y < h; y += 24) {
                    const nL = w % 256;
                    const nH = Math.floor(w / 256);
                    result.push(0x1B, 0x2A, 33, nL, nH); // ESC * m=33
                    
                    for (let x = 0; x < w; x++) {
                        for (let bRow = 0; bRow < 3; bRow++) {
                            let byte = 0;
                            for (let b = 0; b < 8; b++) {
                                const currY = y + (bRow * 8) + b;
                                if (currY < h) {
                                    const i = (currY * widthInBytes) + Math.floor(x / 8);
                                    const bit = (bits[i] & (0x80 >> (x % 8)));
                                    if (bit) byte |= (0x80 >> b);
                                }
                            }
                            result.push(byte);
                        }
                    }
                    result.push(0x1B, 0x4A, 24); // Feed 24 dots (important!)
                }
                
                result.push(0x0A);
                const full = new Uint8Array(result);
                let binary = '';
                for (let i = 0; i < full.byteLength; i++) binary += String.fromCharCode(full[i]);
                const base64 = window.btoa(binary);
                console.log("[PRINT] → Logo (ESC * 33) processed! Size:", base64.length);
                resolve(base64);
            } catch (e) {
                console.error("[PRINT] → Logo processing error (canvas):", e);
                resolve(null);
            }
        };
        img.onerror = (e) => {
            console.error("[PRINT] → Failed to load logo image file:", url, e);
            resolve(null);
        };
        img.src = url;
    });
}

export async function printReceipt(tx, settings = {}, printerName = null, logoUrl = '/logo.jpg') {
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
    
    // Re-enable browser processing for localhost
    let logoBase64 = await getLogoBits(logoUrl, 384);
    if (!logoBase64 && logoUrl !== '/logo.jpg') {
        logoBase64 = await getLogoBits('/logo.jpg', 384);
    }

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
      printerName: printerName || s.thermal_printer_name || null,
      logoBits: logoBase64
    };

    const res = await fetch(`${PRINT_SERVER}/print`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(10000), // increased timeout for logo processing
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      return { success: false, error: data.error || 'Print server error' };
    }

    return { success: true, jobId: data.jobId, printer: data.printer };

  } catch (err) {
    console.error('[PRINT] → Connection failed:', err);
    alert('Print Server not reachable! Ensure "npm run dev" is running on your printing computer.');
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return { success: false, error: 'Print server timeout' };
    }
    return { success: false, error: err.message };
  }
}

/**
 * Send label images to the local server for batch printing.
 * @param {string[]} images - Array of Base64 image strings (each representing a row of labels)
 * @param {number} [copies=1] - Number of times to print the entire batch
 */
export async function printLabels(images, copies = 1) {
  try {
    const res = await fetch(`${PRINT_SERVER}/print-labels`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ images, copies }),
      signal:  AbortSignal.timeout(15000),
    });

    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Print server error');
    return { success: true, printer: data.printer };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
