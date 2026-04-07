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
    DASHED_LINE: '--------------------------------\x0A', // 32 chars for 58mm, 48 for 80mm
    DOUBLE_DASHED_LINE: '================================\x0A',
  };

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
    data += (settings?.address || '') + C.LINE_FEED;
    data += 'Tel: ' + (settings?.phone || '') + C.LINE_FEED;
    if (settings?.gst_no) data += 'GSTIN: ' + settings.gst_no + C.LINE_FEED;
    data += C.DASHED_LINE;

    // Meta Info (Left aligned)
    data += C.ALIGN_LEFT;
    data += 'Invoice: ' + (tx.id?.substring(0, 8) || 'NA') + C.LINE_FEED;
    data += 'Date: ' + (tx.date || new Date().toLocaleString()) + C.LINE_FEED;
    data += 'Customer: ' + (tx.customer_name || 'Walk-in') + C.LINE_FEED;
    data += 'Payment: ' + (tx.payment_method || 'CASH') + C.LINE_FEED;
    data += C.DASHED_LINE;

    // Table Header
    data += 'Item           Qty     Amt\x0A';
    data += C.DASHED_LINE;

    // Items
    tx.items_json?.forEach(it => {
      const name = (it.name || '').substring(0, 14).padEnd(14);
      const qty = String(it.qty || 0).padStart(5);
      const amt = ( (it.price || 0) * (it.qty || 0) ).toFixed(2).padStart(10);
      data += `${name} ${qty} ${amt}\x0A`;
    });

    data += C.DASHED_LINE;

    // Totals (Right aligned)
    data += C.ALIGN_RIGHT;
    data += 'Gross Total: Rs.' + (tx.gross_total || 0).toFixed(2) + C.LINE_FEED;
    if (tx.discount_amount > 0) data += 'Discount: -Rs.' + tx.discount_amount.toFixed(2) + C.LINE_FEED;
    if (tx.tax_percent > 0) data += `Tax (${tx.tax_percent}%): Rs.` + (tx.total_amount - (tx.gross_total - tx.discount_amount)).toFixed(2) + C.LINE_FEED;
    
    data += C.TEXT_BOLD;
    data += 'NET TOTAL: Rs.' + (tx.total_amount || 0).toFixed(2) + C.LINE_FEED;
    data += C.TEXT_NORMAL_WEIGHT;
    data += C.LINE_FEED;

    // Footer (Centered)
    data += C.ALIGN_CENTER;
    data += 'Follow us: @monsoonmeridian\x0A';
    data += 'THANK YOU - VISIT AGAIN\x0A';
    data += C.LINE_FEED + C.LINE_FEED;

    // Cut
    data += C.CUT;

    return data;
  }
}

export default new QZHelper();
