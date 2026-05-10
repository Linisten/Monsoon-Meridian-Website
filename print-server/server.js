const express = require('express');
const cors = require('cors');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = 6789;
app.use(cors());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true, parameterLimit: 200000 }));

// ── ESC/POS helpers ────────────────────────────────────────────────────────
const b   = (...bytes) => Buffer.from(bytes);
const str = (txt) => Buffer.from(txt, 'latin1');
const lf  = () => b(0x0A);

const W = 48; // chars wide at 80mm, Font A (576 dots / 12 dots per char)

const padL = (s, n) => { s = String(s); return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length); };
const padR = (s, n) => { s = String(s); return s.length >= n ? s.slice(-n)  : ' '.repeat(n - s.length) + s; };

// ── Receipt builder ────────────────────────────────────────────────────────
function buildReceipt(data, settings = {}) {
  const part1 = [];  // before logo
  const part2 = [];  // after logo, before QR
  const post  = [];  // after QR
  const add1 = (...bs) => bs.forEach(x => part1.push(x));
  const add2 = (...bs) => bs.forEach(x => part2.push(x));
  const addP = (...bs) => bs.forEach(x => post.push(x));

  // PART 1: just init + center (logo goes here)
  add1(
    b(0x1B, 0x40),              // INIT
    b(0x1B, 0x4D, 0x00),        // ESC M 0: Explicitly select standard Font A (12x24)
    b(0x1B, 0x61, 0x01)         // Center align for logo
  );

  // PART 2: all receipt text
  const addr = settings.address || 'Monsoon Meridian, Kottapuram P O Vizhinjam';
  const tel  = settings.phone   || '+918089867482';

  add2(
    lf(),                        // space after logo
    b(0x1B, 0x45, 0x01), str(addr + '\n'), b(0x1B, 0x45, 0x00),
    str('Tel: ' + tel + '\n'),
    b(0x1B, 0x61, 0x00),
    str('='.repeat(W) + '\n'),
  );

  const row = (label, val) => {
    const gap = W - label.length - 2 - val.length;
    add2(str(label + ': ' + (gap > 0 ? ' '.repeat(gap) : '') + val + '\n'));
  };
  row('Invoice',  data.id ? String(data.id).slice(0, 8) : 'N/A');
  row('Date',     data.date || new Date().toLocaleString());
  row('Customer', data.customer_name || 'Walk-in Customer');
  row('Payment',  data.payment_method || 'CASH');
  add2(lf());

  add2(
    str('-'.repeat(W) + '\n'),
    b(0x1B, 0x45, 0x01),
    str(padL('ITEM', 22) + padR('QTY', 5) + padR('RATE', 10) + padR('AMT', 11) + '\n'),
    b(0x1B, 0x45, 0x00),
    str('-'.repeat(W) + '\n'),
  );

  const formatItemName = (name, max = 22) => {
    if (name.length <= max) return name;
    return name.substring(0, max - 10) + "..." + name.slice(-7);
  };

  const items = data.items_json || data.items || [];
  items.forEach(it => {
    const name = formatItemName(it.name || 'Item', 22);
    const qNum = it.qty || 1;
    const qty  = String(qNum);
    const rate = (it.price || it.rate || 0).toFixed(2);
    const amt  = ((it.price || it.rate || 0) * qNum).toFixed(2);
    
    add2(str(padL(name, 22) + padR(qty, 5) + padR(rate, 10) + padR(amt, 11) + '\n'));
  });

  add2(str('.'.repeat(W) + '\n'));

  const addSummaryRow = (label, amount) => {
    if (!amount || amount === '0.00' || amount === 0) return;
    add2(str(padL(label, 37) + padR(amount, 11) + '\n'));
  };

  const gross = (data.subtotal || data.gross_total || data.total_amount || 0).toFixed(2);
  add2(str(padL('Gross Total', 37) + padR('Rs.' + gross, 11) + '\n'));

  addSummaryRow('Discount', data.discount ? '-' + Number(data.discount).toFixed(2) : '0.00');
  
  if (data.tax_amount && data.tax_amount > 0) {
    const taxLabel = data.tax_rate ? `Tax (${data.tax_rate}%)` : 'Tax';
    addSummaryRow(taxLabel, '+' + Number(data.tax_amount).toFixed(2));
  }

  if (data.round_off && data.round_off !== 0) {
    const ro = Number(data.round_off);
    const sign = ro > 0 ? '+' : '';
    addSummaryRow('Round Off', sign + ro.toFixed(2));
  }

  add2(str('-'.repeat(W) + '\n'));

  const DW  = 24; // effective chars width at double-width scale (W/2)
  const tot = (data.total_amount || 0).toFixed(2);
  const tL  = 'NET AMOUNT', tV = 'Rs.' + tot;
  const tGap = DW - tL.length - tV.length;
  add2(
    b(0x1B, 0x45, 0x01), b(0x1D, 0x21, 0x10), // Bold + Double Width ONLY (to ensure single line)
    str(tL + (tGap > 0 ? ' '.repeat(tGap) : '') + tV + '\n'),
    b(0x1D, 0x21, 0x00), b(0x1B, 0x45, 0x00),

    lf(),
    b(0x1B, 0x61, 0x01),
    str('Follow us on Instagram\n'),
  );
  // ← QR injected here ←

  // POST: after QR
  addP(
    b(0x1B, 0x45, 0x01), str('@MONSOONMERIDIAN\n'), b(0x1B, 0x45, 0x00),
    b(0x1B, 0x61, 0x00),
    str('.'.repeat(W) + '\n'),
    b(0x1B, 0x61, 0x01),
    str('*** THANK YOU - VISIT AGAIN ***\n'),
    b(0x1B, 0x61, 0x00),
    lf(),
    b(0x1B, 0x64, 0x05),
    b(0x1D, 0x56, 0x01),
  );

  return {
    part1: Buffer.concat(part1),
    part2: Buffer.concat(part2),
    post:  Buffer.concat(post),
  };
}

// ── Label builder (Image-based for 2-up labels) ──────────────────────────────
async function buildLabelJob(images, copies = 1) {
  const chunks = [];
  
  // INIT
  chunks.push(b(0x1B, 0x40));
  
  // We'll return an array of images for the PS1 script to process
  // because bit-image conversion is already implemented in pos_print.ps1
  return chunks;
}

// ── Print via external PS1 script ──────────────────────────────────────────
async function printLabels(labelImages, copies = 1, printerName) {
  const ps1File  = path.resolve(__dirname, 'pos_print.ps1');
  const tempDir  = os.tmpdir();
  
  // Save images to temp files
  const filePaths = labelImages.map((base64, i) => {
    const filePath = path.join(tempDir, `mm_label_${Date.now()}_${i}.jpg`);
    const buffer = Buffer.from(base64.split(',')[1], 'base64');
    fs.writeFileSync(filePath, buffer);
    return filePath;
  });

  // Prepare chunks (Init + Images + Cut)
  // For simplicity, we'll reuse the Logo logic in pos_print.ps1 by sending multiple jobs or modifying ps1
  // Actually, let's modify pos_print.ps1 to handle multiple images in one JSON
  
  const jsonFile = path.join(tempDir, `mm_labels_${Date.now()}.json`);
  fs.writeFileSync(jsonFile, JSON.stringify({
    labelFiles: filePaths,
    copies: parseInt(copies),
    printer: printerName,
    cut: true
  }));

  return new Promise((resolve) => {
    const proc = spawn('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1File, jsonFile
    ]);
    proc.on('close', code => {
      filePaths.forEach(p => { try { fs.unlinkSync(p); } catch {} });
      try { fs.unlinkSync(jsonFile); } catch {}
      resolve();
    });
  });
}

// ── Print via external PS1 script ──────────────────────────────────────────
async function printReceipt(data, settings, printerName) {
  // Find logo: check common paths relative to server.js
  const searchPaths = [
    path.resolve(__dirname, '..', 'dist', 'logo.jpg'),
    path.resolve(__dirname, '..', 'public', 'logo.jpg'),
    path.resolve(__dirname, '..', 'src', 'assets', 'logo.jpg'),
    path.resolve(__dirname, 'logo.jpg'), // if logo is in the same folder as server.js
    path.join(process.cwd(), 'public', 'logo.jpg'),
    path.join(process.cwd(), 'dist', 'logo.jpg'),
  ];
  
  let logoPath = searchPaths.find(p => fs.existsSync(p));
  
  if (logoPath) {
    console.log(`[LOGO] → Found at: ${logoPath}`);
  } else {
    console.warn(`[LOGO] → NOT FOUND in any searched path.`);
    // Fallback to srcLogo path just to have a string
    logoPath = searchPaths[2]; 
  }

  
  const { part1, part2, post } = buildReceipt(data, settings);

  const jsonFile = path.join(os.tmpdir(), `mm_${Date.now()}.json`);
  const ps1File  = path.resolve(__dirname, 'pos_print.ps1');

  fs.writeFileSync(jsonFile, JSON.stringify({
    part1:   part1.toString('base64'),
    part2:   part2.toString('base64'),
    post:    post.toString('base64'),
    qr:      'https://instagram.com/monsoonmeridian',
    logo:    logoPath,
    printer: printerName,
  }));

  return new Promise((resolve) => {
    const proc = spawn('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1File, jsonFile
    ]);
    proc.stdout.on('data', d => console.log('[PS]', d.toString().trim()));
    proc.stderr.on('data', d => console.error('[PS ERR]', d.toString().trim()));
    proc.on('close', code => {
      console.log(`[PS] done, code=${code}`);
      try { fs.unlinkSync(jsonFile); } catch {}
    });
    setTimeout(resolve, 800);
  });
}

// ── Printers ────────────────────────────────────────────────────────────────
function getPrinters() {
  try {
    const out = execSync('wmic printer get name,default /format:list', { timeout: 5000 }).toString();
    const list = [];
    let cur = {};
    for (const line of out.split('\n')) {
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim();
      if (key === 'Default') cur.isDefault = val === 'TRUE';
      if (key === 'Name') { cur.name = val; if (val) { list.push(cur); } cur = {}; }
    }
    return list;
  } catch { return []; }
}

// ── Routes ───────────────────────────────────────────────────────────────────
app.post('/print', async (req, res) => {
  console.log(`[HTTP] → Incoming print request for ID: ${req.body?.receipt?.id}`);
  try {
    const { receipt, settings } = req.body;
    const printers = getPrinters();
    const target = printers.find(p => p.isDefault)?.name || printers[0]?.name;
    if (!target) return res.status(500).json({ error: 'No printer found' });
    console.log(`[PRINT] → ${target}`);
    await printReceipt(receipt, settings || {}, target);
    res.json({ success: true, printer: target });
  } catch (err) {
    console.error('[PRINT ERR]', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/print-labels', async (req, res) => {
  console.log(`[HTTP] → Incoming label print request (${req.body?.images?.length} rows)`);
  try {
    const { images, copies } = req.body;
    if (!images || !images.length) return res.status(400).json({ error: 'No images provided' });

    const printers = getPrinters();
    const target = printers.find(p => p.isDefault)?.name || printers[0]?.name;
    if (!target) return res.status(500).json({ error: 'No printer found' });

    await printLabels(images, copies || 1, target);
    res.json({ success: true, printer: target });
  } catch (err) {
    console.error('[LABEL PRINT ERR]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => {
  const printers = getPrinters();
  res.json({ status: 'ok', printers: printers.map(p => `${p.name}${p.isDefault ? ' (default)' : ''}`) });
});

app.listen(PORT, '0.0.0.0', () => {
  const printers = getPrinters();
  console.log(`\n🖨️  Monsoon Meridian Print Server → http://localhost:${PORT}`);
  console.log(`   Accepting connections on all interfaces (0.0.0.0)`);
  console.log(`   Default printer: ${printers.find(p => p.isDefault)?.name || 'none'}\n`);
});

// Prevent server from crashing on unexpected errors
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL ERROR] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL ERROR] Unhandled Rejection at:', promise, 'reason:', reason);
});
