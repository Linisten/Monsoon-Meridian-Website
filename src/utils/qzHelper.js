import qz from 'qz-tray';

/**
 * Singleton Helper for QZ Tray Hardware Operations
 */
class QZHelper {
  constructor() {
    this.isConnected = false;
    this.connectionPromise = null;
  }

  /**
   * Connect to QZ Tray WebSocket
   */
  async connect() {
    if (this.isConnected) return true;
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = qz.websocket.connect()
      .then(() => {
        this.isConnected = true;
        this.connectionPromise = null;
        console.log('QZ Tray Connected');
        return true;
      })
      .catch((err) => {
        this.isConnected = false;
        this.connectionPromise = null;
        console.error('QZ Tray Connection Failed:', err);
        throw err;
      });

    return this.connectionPromise;
  }

  /**
   * List all available system printers
   */
  async findPrinters() {
    await this.connect();
    return qz.printers.find();
  }

  /**
   * Print raw ESC/POS commands to a named printer
   */
  async print(printerName, commands) {
    if (!printerName) throw new Error('No printer name specified');
    await this.connect();

    const config = qz.configs.create(printerName);
    
    // Commands should be an array of base64 strings or hex strings or raw strings
    // But for ESC/POS, we usually send an array of objects or a single raw string
    return qz.print(config, [
      {
        type: 'raw',
        format: 'command',
        flavor: 'escpos',
        data: commands
      }
    ]);
  }

  /**
   * Standard ESC/POS Command Utilities
   */
  static Commands = {
    INIT: '\x1B\x40',
    ALIGN_LEFT: '\x1B\x61\x00',
    ALIGN_CENTER: '\x1B\x61\x01',
    ALIGN_RIGHT: '\x1B\x61\x02',
    TEXT_NORMAL: '\x1B\x21\x00',
    TEXT_BOLD: '\x1B\x45\x01',
    TEXT_NORMAL_WEIGHT: '\x1B\x45\x00',
    TEXT_DOUBLE_SIZE: '\x1B\x21\x30',
    CUT: '\x1D\x56\x01',
    LINE_FEED: '\x0A',
    DASHED_LINE: '--------------------------------\x0A', // 32 chars (58mm)
    DASHED_LINE_80: '------------------------------------------------\x0A', // 48 chars (80mm)
  };

  /**
   * Helper to generate ESC/POS QR Code commands
   */
  static getQRCodeCommands(url) {
    if (!url) return '';
    const length = url.length + 3;
    const pL = String.fromCharCode(length % 256);
    const pH = String.fromCharCode(Math.floor(length / 256));
    
    return [
      '\x1D\x28\x6B\x04\x00\x31\x41\x32\x00', // Model 2
      '\x1D\x28\x6B\x03\x00\x31\x43\x06',     // Dot size (6 looks good on both)
      '\x1D\x28\x6B\x03\x00\x31\x45\x30',     // Error correction (L)
      '\x1D\x28\x6B' + pL + pH + '\x31\x50\x30' + url, // Store data
      '\x1D\x28\x6B\x03\x00\x31\x51\x30',     // Print
    ].join('');
  }

  /**
   * Build a receipt command string from transaction data
   */
  static buildReceiptCommands(tx, settings) {
    const C = QZHelper.Commands;
    let data = '';

    // Initialize
    data += C.INIT;

    // Header (Centered)
    data += C.ALIGN_CENTER;
    data += C.TEXT_DOUBLE_SIZE + (settings?.company_name || 'MONSOON') + C.LINE_FEED;
    data += C.TEXT_NORMAL;
    if (settings?.address) data += settings.address + C.LINE_FEED;
    if (settings?.phone) data += 'Tel: ' + settings.phone + C.LINE_FEED;
    if (settings?.gst_no) data += 'GSTIN: ' + settings.gst_no + C.LINE_FEED;
    data += C.DASHED_LINE;

    // Meta Info (Left aligned)
    data += C.ALIGN_LEFT;
    data += 'Invoice: '  + (tx.id?.substring(0, 8) || 'NA') + C.LINE_FEED;
    data += 'Date:    '  + (tx.date?.split(',')[0] || new Date().toLocaleDateString()) + C.LINE_FEED;
    data += 'Customer: ' + (tx.customer_name || 'Walk-in') + C.LINE_FEED;
    data += 'Payment:  ' + (tx.payment_method || 'CASH') + C.LINE_FEED;
    data += C.DASHED_LINE;

    // Table Header
    // 32 chars: Item(14) Qty(6) Amt(12)
    data += 'Item           Qty      Amt\x0A';
    data += C.DASHED_LINE;

    // Items
    tx.items_json?.forEach(it => {
      const name = (it.name || '').substring(0, 14).padEnd(14);
      const qty  = String(it.qty || 0).padStart(5);
      const amt  = ( (it.price || it.rate || 0) * (it.qty || 0) ).toFixed(2).padStart(11);
      data += `${name} ${qty} ${amt}\x0A`;
    });

    data += C.DASHED_LINE;

    // Calculations
    const netAmount     = tx.total_amount || 0;
    const taxPercent    = tx.tax_percent ?? 0;
    const discountAmt   = tx.discount_amount || 0;
    const grossTotal    = tx.gross_total || netAmount;
    const afterDiscount = grossTotal - discountAmt;
    const taxAmt        = afterDiscount * (taxPercent / 100);
    const beforeRound   = afterDiscount + taxAmt;
    const roundOff      = netAmount - beforeRound;

    // Totals (Right aligned)
    data += C.ALIGN_RIGHT;
    data += 'Gross Total: Rs.' + grossTotal.toFixed(2) + C.LINE_FEED;
    if (discountAmt > 0) data += 'Discount: -Rs.' + discountAmt.toFixed(2) + C.LINE_FEED;
    
    if (taxPercent > 0) {
      data += `CGST (${(taxPercent/2).toFixed(1)}%): Rs.` + (taxAmt/2).toFixed(2) + C.LINE_FEED;
      data += `SGST (${(taxPercent/2).toFixed(1)}%): Rs.` + (taxAmt/2).toFixed(2) + C.LINE_FEED;
    }

    if (Math.abs(roundOff) > 0.001) {
      data += 'Round Off: ' + (roundOff >= 0 ? '+' : '') + roundOff.toFixed(2) + C.LINE_FEED;
    }
    
    data += C.TEXT_DOUBLE_SIZE + C.TEXT_BOLD;
    data += 'NET TOTAL: Rs.' + netAmount.toFixed(2) + C.LINE_FEED;
    data += C.TEXT_NORMAL + C.TEXT_NORMAL_WEIGHT;

    // Footer (Centered)
    data += C.ALIGN_CENTER + C.LINE_FEED;
    
    // Instagram QR
    const instagramUrl = 'https://www.instagram.com/monsoonmeridian/';
    data += QZHelper.getQRCodeCommands(instagramUrl);
    data += 'Follow us: @monsoonmeridian' + C.LINE_FEED;
    
    data += C.TEXT_BOLD + 'THANK YOU - VISIT AGAIN' + C.TEXT_NORMAL_WEIGHT + C.LINE_FEED;

    // Feed paper so text clears the cutter
    data += C.LINE_FEED + C.LINE_FEED + C.LINE_FEED + C.LINE_FEED;

    // Cut
    data += C.CUT;

    return data;
  }

}

export default new QZHelper();
