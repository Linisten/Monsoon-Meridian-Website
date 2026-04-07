import React, { useState, useEffect } from 'react';
import { Plus, Minus, X, CreditCard, Banknote, Smartphone, ScanLine, CheckCircle, Printer, XCircle, Search, Camera } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { supabase } from '../config/supabaseClient';
import UpiPaymentModal from '../components/UpiPaymentModal';
import SearchableSelect from '../components/SearchableSelect';
import qzHelper from '../utils/qzHelper';

// Category pastel palettes: [background, text, border-accent]
const ITEM_COLORS = {
  SPICES:     '#b45309',
  CHOCOLATES: '#7c3aed',
  TEA:        '#065f46',
  COFFEE:     '#78350f',
  NUTS:       '#92400e',
};

const ITEM_PASTEL = {
  SPICES:     { bg: '#FFE8A1', text: '#333333', border: '#F4B400' }, // Yellow
  TEA:        { bg: '#DAF581', text: '#333333', border: '#A2E025' }, // Green
  CHOCOLATES: { bg: '#FFAEA5', text: '#333333', border: '#FF6B5E' }, // Pink/Red
  NUTS:       { bg: '#FFCCA5', text: '#333333', border: '#FF954F' }, // Orange
  COFFEE:     { bg: '#E2D5F8', text: '#333333', border: '#B388FF' }, // Purple
};

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve(true);
    const s = Object.assign(document.createElement('script'), { src, onload: () => resolve(true), onerror: () => reject(new Error('Script load failed')) });
    document.body.appendChild(s);
  });

// ── Thermal Receipt (print-safe) ─────────────────────────────────────────────
const INSTAGRAM_HANDLE = 'monsoonmeridian';
const INSTAGRAM_URL    = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;

const ThermalReceipt = ({ tx, settings }) => {
  if (!tx) return null;
  const netAmount     = tx.total_amount || 0;
  const taxPercent    = tx.tax_percent ?? 0;
  const discountAmt   = tx.discount_amount || 0;
  const grossTotal    = tx.gross_total || netAmount; // raw cart total before discount
  const afterDiscount = grossTotal - discountAmt;
  const taxAmt        = afterDiscount * (taxPercent / 100);
  const beforeRound   = afterDiscount + taxAmt;
  const roundOff      = netAmount - beforeRound; // stored netAmount is already rounded

  return (
    <div id="thermal-receipt" style={{ backgroundColor: 'white', padding: '1.5rem', width: '360px', fontFamily: 'monospace', fontSize: '13px', color: '#000', lineHeight: 1.5 }}>
      {/* ── Header ── */}
      <div style={{ textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: '1rem', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>{settings?.company_name || 'MONSOON MERIDIAN'}</h2>
        <p style={{ margin: '4px 0' }}>{settings?.address || '123 Premium Arcade, Business Bay'}</p>
        <p style={{ margin: '0' }}>Tel: {settings?.phone || '+91 9876543210'} | GSTIN: {settings?.gst_no || '32AABCU9603R1ZX'}</p>
      </div>

      {/* ── Meta ── */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>Invoice:</b><span>{tx.id}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>Date:</b><span>{tx.date}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>Customer:</b><span>{tx.customer_name || 'Walk-in'}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>Payment:</b><span>{tx.payment_method}</span></div>
      </div>

      {/* ── Items ── */}
      <div style={{ borderBottom: '1px dashed #000', paddingBottom: '4px', marginBottom: '4px', display: 'grid', gridTemplateColumns: '1fr 40px 70px', fontWeight: 700 }}>
        <span>Item</span><span style={{ textAlign: 'center' }}>Qty</span><span style={{ textAlign: 'right' }}>Amt</span>
      </div>
      {tx.items_json?.map((it, i) => {
        const rate = it.price || it.rate || 0;
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 40px 70px', margin: '3px 0' }}>
            <span>{it.name}</span>
            <span style={{ textAlign: 'center' }}>{it.qty}</span>
            <span style={{ textAlign: 'right' }}>{(rate * it.qty).toFixed(2)}</span>
          </div>
        );
      })}

      {/* ── Totals ── */}
      <div style={{ borderTop: '1px dashed #000', marginTop: '8px', paddingTop: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Gross Total</span><span>₹{grossTotal.toFixed(2)}</span></div>
        {discountAmt > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Discount</span><span>-₹{discountAmt.toFixed(2)}</span></div>
        )}
        {taxPercent > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tax ({taxPercent}%)</span><span>₹{taxAmt.toFixed(2)}</span></div>
        )}
        {Math.abs(roundOff) > 0.001 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Round Off</span><span>{roundOff >= 0 ? '+' : ''}{roundOff.toFixed(2)}</span></div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.1rem', borderTop: '2px solid #000', marginTop: '6px', paddingTop: '6px' }}>
          <span>NET TOTAL</span><span>₹{netAmount.toFixed(2)}</span>
        </div>
      </div>

      {/* ── Instagram QR ── */}
      <div style={{
        marginTop: '1rem',
        borderRadius: '12px',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
        padding: '1px',
      }}>
        <div style={{
          background: 'white',
          borderRadius: '11px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          {/* Mini Instagram wordmark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="ig" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#f09433"/>
                  <stop offset="25%" stopColor="#e6683c"/>
                  <stop offset="50%" stopColor="#dc2743"/>
                  <stop offset="75%" stopColor="#cc2366"/>
                  <stop offset="100%" stopColor="#bc1888"/>
                </linearGradient>
              </defs>
              <rect x="2" y="2" width="20" height="20" rx="6" ry="6" stroke="url(#ig)" strokeWidth="2" fill="none"/>
              <circle cx="12" cy="12" r="4" stroke="url(#ig)" strokeWidth="2" fill="none"/>
              <circle cx="17.5" cy="6.5" r="1.2" fill="url(#ig)"/>
            </svg>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#444', fontFamily: 'monospace', letterSpacing: '0.02em' }}>Follow us on Instagram</span>
          </div>

          {/* QR Code */}
          <QRCodeSVG
            value={INSTAGRAM_URL}
            size={140}
            level="M"
            includeMargin={false}
            fgColor="#000000"
          />

          {/* Handle */}
          <div style={{
            fontSize: '13px',
            fontWeight: 900,
            letterSpacing: '0.08em',
            background: 'linear-gradient(90deg, #f09433, #dc2743, #bc1888)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontFamily: 'monospace',
          }}>
            @{INSTAGRAM_HANDLE.toUpperCase()}
          </div>
        </div>
      </div>

      {/* ── Thank You ── */}
      <div style={{ textAlign: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px dashed #000' }}>
        <p style={{ margin: 0, fontWeight: 700, letterSpacing: '0.06em', fontSize: '13px' }}>*** THANK YOU — VISIT AGAIN ***</p>
      </div>

    </div>
  );
};

// ── Main Sales Component ─────────────────────────────────────────────────────
const Sales = () => {
  const [cart,             setCart]             = useState([]);
  const [items,            setItems]            = useState([]);
  const [activeCategory,   setActiveCategory]   = useState('ALL');
  const [receivedAmount,   setReceivedAmount]   = useState('');
  const [paymentOverlay,   setPaymentOverlay]   = useState(null);
  const [showUpi,          setShowUpi]          = useState(false);
  const [showReceipt,      setShowReceipt]      = useState(false);
  const [showCamScanner,   setShowCamScanner]   = useState(false);
  const [camError,         setCamError]         = useState('');
  const [lastTransaction,  setLastTransaction]  = useState(null);
  const [taxPercent,       setTaxPercent]       = useState(0);
  const [discount,         setDiscount]         = useState('');
  const [barcodeInput,     setBarcodeInput]     = useState('');
  const [itemSearch,       setItemSearch]       = useState('');
  const [customers,        setCustomers]        = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('Walk-in Customer');
  const [categories,       setCategories]       = useState(['ALL']);

  const [sysSettings,      setSysSettings]      = useState(null);

  useEffect(() => { fetchItems(); fetchSettings(); fetchCustomers(); fetchCategories(); }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from('category').select('name').order('name');
    if (data) setCategories(['ALL', ...data.map(c => c.name)]);
  };

  const fetchCustomers = async () => {
    const { data, error } = await supabase.from('customer').select('name').order('name');
    if (!error && data) setCustomers(data);
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from('settings').select('*').limit(1).single();
    if (data) setSysSettings(data);
  };

  const fetchItems = async () => {
    const { data, error } = await supabase.from('items').select('*').order('name');
    if (!error && data) setItems(data);
  };

  const addToCart = (item) => {
    setCart(prev => {
      const hit = prev.find(c => c.id === item.id);
      return hit ? prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c) : [...prev, { ...item, qty: 1 }];
    });
  };
  const updateQty      = (id, d)   => setCart(prev => prev.map(c => c.id === id ? ({ ...c, qty: Math.max(0, c.qty + d), manual_amount: undefined }) : c).filter(c => c.qty > 0));
  const removeItem     = (id)      => setCart(prev => prev.filter(c => c.id !== id));
  const updateAmount   = (id, val) => setCart(prev => prev.map(c => {
    if (c.id !== id) return c;
    const rate = c.price || c.rate || 0;
    const newAmt = parseFloat(val) || 0;
    const newQty = rate > 0 ? parseFloat((newAmt / rate).toFixed(4)) : c.qty;
    return { ...c, qty: newQty, manual_amount: val };
  }));

  const totalAmount    = cart.reduce((s, c) => s + (c.price || c.rate || 0) * c.qty, 0);
  const discountAmount = parseFloat(discount) || 0;
  const afterDiscount  = Math.max(0, totalAmount - discountAmount);
  const taxAmount      = afterDiscount * (taxPercent / 100);
  const beforeRound    = afterDiscount + taxAmount;
  const roundOff       = Math.round(beforeRound) - beforeRound; // e.g. +0.40 or -0.60
  const netAmount      = Math.round(beforeRound);
  const change         = receivedAmount ? parseFloat(receivedAmount) - netAmount : 0;

  // ── Persist sale to Supabase ─────────────────────────────────────────────
  const persistSale = async (method, razorpayData = {}) => {
    const payload = {
      total_amount:    netAmount,
      tax_percent:     taxPercent,
      payment_method:  method,
      items_json:      cart,
      customer_name:   selectedCustomer,
      gross_total:     totalAmount,
      discount_amount: discountAmount,
      ...razorpayData,
    };
    const { data, error } = await supabase.from('sales').insert([payload]).select();
    if (error) {
      console.error('Supabase insert error:', error);
      setPaymentOverlay('error:' + (error.message || 'Unknown error'));
      return;
    }

    // --- DECREMENT INVENTORY (ATOMIC) ---
    const stockUpdates = cart.map(item => 
      supabase.rpc('handle_stock_update', { 
        item_id: item.id, 
        quantity_change: -item.qty 
      })
    );
    await Promise.all(stockUpdates);
    // ------------------------------------

    setPaymentOverlay('success');
    await new Promise(r => setTimeout(r, 800));
    setPaymentOverlay(null);
    setLastTransaction({ ...payload, id: data?.[0]?.id || `INV-${Date.now()}`, date: new Date().toLocaleString() });
    setShowReceipt(true);
  };

  const processBarcode = (code) => {
    if (!code) return;
    const item = items.find(it => it.code.toLowerCase() === code.toLowerCase());
    if (item) {
      addToCart(item);
      setBarcodeInput('');
      return true;
    } else {
      alert('Product Not Found: ' + code);
      setBarcodeInput('');
      return false;
    }
  };

  const handleBarcodeScan = (e) => {
    if (e.key === 'Enter') {
      processBarcode(barcodeInput.trim());
    }
  };

  const onCamScan = (scanResult) => {
    if (scanResult && scanResult.length > 0) {
      const code = scanResult[0].rawValue;
      if (processBarcode(code)) {
        setShowCamScanner(false);
        setCamError('');
      }
    }
  };

  useEffect(() => {
    let buffer = '';
    let timeout;
    const handleGlobalScan = (e) => {
      // Ignore if user is actively typing in another text input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.key === 'Enter') {
        if (buffer) {
          processBarcode(buffer);
          buffer = '';
        }
      } else if (e.key.length === 1) { // normal character
        buffer += e.key;
        clearTimeout(timeout);
        // Scanners type fast; clear buffer if inactive for 100ms
        timeout = setTimeout(() => { buffer = ''; }, 100);
      }
    };

    window.addEventListener('keydown', handleGlobalScan);
    return () => {
      window.removeEventListener('keydown', handleGlobalScan);
      clearTimeout(timeout);
    };
  }, [items]); // Re-bind when items load

  // ── CASH ─────────────────────────────────────────────────────────────────
  const handleCash = () => {
    if (!cart.length) return alert('Cart is empty!');
    persistSale('CASH');
  };

  // ── UPI / GPay (Manual QR) ───────────────────────────────────────────────
  const handleGpay = () => {
    if (!cart.length) return alert('Cart is empty!');
    setShowUpi(true);
  };

  const confirmUpi = () => {
    setShowUpi(false);
    persistSale('UPI/GPAY_MANUAL');
  };

  // ── Manual Card ──────────────────────────────────────────────────────────
  const handleCard = () => {
    if (!cart.length) return alert('Cart is empty!');
    if (!confirm('Record this as a Card payment?')) return;
    persistSale('CARD_MANUAL');
  };

  // ── Thermal Direct Print ──────────────────────────────────────────────
  const handleDirectPrint = async () => {
    if (!lastTransaction) return;
    const printer = sysSettings?.thermal_printer_name;

    if (!printer) {
      alert('No thermal printer selected! Please select one in Settings.');
      window.print(); // Fallback
      return;
    }

    try {
      const cmds = qzHelper.constructor.buildReceiptCommands(lastTransaction, sysSettings);
      await qzHelper.print(printer, cmds);
    } catch (err) {
      console.error('Direct print failed:', err);
      alert('Direct print failed: ' + err.message + '\n\nFalling back to browser print.');
      window.print();
    }
  };

  // ── UI ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', gap: '1.5rem', position: 'relative' }}>

      {/* ─── LEFT: Cart ───────────────────────────────────────────────────── */}
      <div style={{ flex: '1 1 65%', display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>

        {/* Header */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', gap: '1.5rem' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--c-text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Customer Name / Phone</label>
            <SearchableSelect 
              options={['Walk-in Customer', ...customers.map(c => c.name)]}
              value={selectedCustomer}
              onChange={val => setSelectedCustomer(val)}
              placeholder="Search or enter new..."
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--c-text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Bill Date</label>
            <input type="date" defaultValue={new Date().toISOString().split('T')[0]} />
          </div>
          <div style={{ flex: 2 }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--c-text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Scan Barcode</label>
            <div style={{ position: 'relative', display: 'flex', gap: '0.5rem' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <ScanLine size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-secondary)' }} />
                <input 
                  type="text" 
                  placeholder="Scan barcode..." 
                  value={barcodeInput}
                  onChange={e => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeScan}
                  style={{ paddingLeft: '2.25rem', width: '100%' }} 
                />
              </div>
              <button onClick={() => setShowCamScanner(true)} title="Use Camera Scanner" style={{ width: 42, height: 42, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-brand)' }}>
                <Camera size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Cart table */}
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
          <div style={{ backgroundColor: '#f1f5f9', padding: '0.75rem 1rem', display: 'flex', fontWeight: 700, fontSize: '0.85rem', borderBottom: '1px solid var(--c-border)', alignItems: 'center' }}>
            <div style={{ width: 36 }}>#</div>
            <div style={{ width: 44 }}>Pic</div>
            <div style={{ width: 76 }}>Code</div>
            <div style={{ flex: 1 }}>Item</div>
            <div style={{ width: 120, textAlign: 'center' }}>Qty</div>
            <div style={{ width: 90, textAlign: 'right' }}>Rate</div>
            <div style={{ width: 110, textAlign: 'right' }}>Amount</div>
            <div style={{ width: 44 }} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {!cart.length ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-secondary)', fontSize: '1.1rem' }}>
                Cart is empty — tap items on the right to add them.
              </div>
            ) : cart.map((it, idx) => {
              const rate = it.price || it.rate || 0;
              return (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid var(--c-border)', fontSize: '0.95rem' }}>
                  <div style={{ width: 36, color: 'var(--c-text-secondary)' }}>{idx + 1}</div>
                  <div style={{ width: 44 }}>
                    {it.image_url ? <img src={it.image_url} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} /> : <div style={{ width: 32, height: 32, borderRadius: 4, background: '#e2e8f0' }} />}
                  </div>
                  <div style={{ width: 76, fontWeight: 600 }}>{it.code}</div>
                  <div style={{ flex: 1, fontWeight: 600 }}>{it.name}</div>
                  <div style={{ width: 120, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
                    <button onClick={() => updateQty(it.id, -1)} style={{ width: 28, height: 28, borderRadius: 6, background: '#f1f5f9', border: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={14} /></button>
                    <span style={{ width: 28, textAlign: 'center', fontWeight: 700 }}>{it.qty}</span>
                    <button onClick={() => updateQty(it.id, 1)} style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--c-success)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={14} /></button>
                  </div>
                  <div style={{ width: 90, textAlign: 'right' }}>₹{rate.toFixed(2)}</div>
                  <div style={{ width: 110, textAlign: 'right', fontWeight: 700 }}>
                    <input
                      type="number"
                      value={it.manual_amount !== undefined ? it.manual_amount : (rate * it.qty).toFixed(2)}
                      onChange={e => updateAmount(it.id, e.target.value)}
                      onBlur={() => setCart(prev => prev.map(c => c.id === it.id ? { ...c, manual_amount: undefined } : c))}
                      onFocus={e => e.target.select()}
                      style={{ width: 90, textAlign: 'right', fontWeight: 700, border: '1px solid var(--c-border)', borderRadius: 4, padding: '2px 4px', fontSize: '0.95rem' }}
                    />
                  </div>
                  <div style={{ width: 44, display: 'flex', justifyContent: 'center' }}>
                    <button onClick={() => removeItem(it.id)} style={{ color: 'var(--c-danger)' }}><X size={18} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary footer */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', gap: '2rem', borderTop: '4px solid var(--c-wave)' }}>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Gross:</span><b>₹{totalAmount.toFixed(2)}</b></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Discount (₹):</span>
              <input
                type="number"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                onFocus={e => e.target.select()}
                placeholder="0.00"
                min="0"
                style={{ width: 80, padding: '2px 4px', fontSize: '0.9rem', textAlign: 'right', border: '1px solid var(--c-border)', borderRadius: 4 }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                Tax: <input type="number" value={taxPercent} onChange={e => setTaxPercent(Number(e.target.value) || 0)} style={{ width: 46, padding: '2px 4px', fontSize: '0.9rem', textAlign: 'center', border: '1px solid var(--c-border)', borderRadius: 4 }} /> %
              </span>
              <span>₹{taxAmount.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Round off:</span>
              <span style={{ color: roundOff >= 0 ? 'var(--c-success)' : 'var(--c-danger)' }}>
                {roundOff >= 0 ? '+' : ''}{roundOff.toFixed(2)}
              </span>
            </div>
          </div>
          <div style={{ width: 2, background: 'var(--c-border)' }} />
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontSize: '1rem', color: 'var(--c-text-secondary)', fontWeight: 700 }}>NET AMOUNT DUE</div>
            <div style={{ fontSize: '3rem', fontWeight: 900, lineHeight: 1, color: 'var(--c-text-primary)' }}>₹{netAmount.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* ─── RIGHT: Item Grid & Payments ──────────────────────────────────── */}
      <div style={{ flex: '1 1 35%', display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>

        {/* Actual Payment Buttons */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', gap: '0.75rem' }}>
          <button onClick={handleCash} className="btn-primary" style={{ flex: 1, justifyContent: 'center', gap: '0.5rem', display: 'flex', alignItems: 'center', backgroundColor: 'var(--c-success)' }}>
            <Banknote size={22} /> Cash
          </button>
          <button onClick={handleCard} className="btn-primary" style={{ flex: 1, justifyContent: 'center', gap: '0.5rem', display: 'flex', alignItems: 'center', backgroundColor: '#2563eb' }}>
            <CreditCard size={22} /> Card
          </button>
          <button onClick={handleGpay} className="btn-primary" style={{ flex: 1, justifyContent: 'center', gap: '0.5rem', display: 'flex', alignItems: 'center', backgroundColor: '#6366f1' }}>
            <Smartphone size={22} /> GPay/UPI
          </button>
        </div>

        {/* Change calculator */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem', fontWeight: 700 }}>Cash Received</label>
            <input type="number" value={receivedAmount} onChange={e => setReceivedAmount(e.target.value)} placeholder="0.00" style={{ fontSize: '1.3rem', fontWeight: 700 }} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--c-text-secondary)', fontWeight: 700 }}>CHANGE</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: change >= 0 ? 'var(--c-success)' : 'var(--c-danger)' }}>₹{change >= 0 ? change.toFixed(2) : '0.00'}</div>
          </div>
        </div>

        {/* Search bar */}
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-secondary)' }} />
          <input
            type="text"
            placeholder="Search items..."
            value={itemSearch}
            onChange={e => setItemSearch(e.target.value)}
            style={{ paddingLeft: '2.2rem', width: '100%', fontSize: '0.85rem', padding: '0.5rem 0.5rem 0.5rem 2.2rem' }}
          />
        </div>

        {/* Category strips — dynamic from Master Category */}
        <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {categories.map(cat => (
            <button 
              key={cat} 
              onClick={() => setActiveCategory(cat)} 
              style={{
                padding: '0.45rem 1rem', whiteSpace: 'nowrap', borderRadius: 999,
                fontWeight: 700, fontSize: '0.8rem',
                background: activeCategory === cat ? 'var(--c-text-primary)' : 'var(--c-bg-card)',
                color: activeCategory === cat ? 'white' : 'var(--c-text-secondary)',
                border: `1px solid ${activeCategory === cat ? 'transparent' : 'var(--c-border)'}`,
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.15s ease'
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Items grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: '2rem 1.5rem', alignContent: 'start', background: '#FDFCF7', borderRadius: 12, border: '1px solid var(--c-border)' }}>
          {!items.length && <div style={{ gridColumn: '1/-1', color: '#64748b', padding: '2rem', textAlign: 'center', fontSize: '0.9rem' }}>No items yet — add them via Stock module.</div>}
          {items
            .filter(it => (activeCategory === 'ALL' || it.category === activeCategory))
            .filter(it => !itemSearch || it.name?.toLowerCase().includes(itemSearch.toLowerCase()) || it.code?.toLowerCase().includes(itemSearch.toLowerCase()))
            .map(it => {
              const pastel = ITEM_PASTEL[it.category] || { bg: '#E2E8F0', text: '#334155', border: '#94A3B8' };
              const price  = it.price || it.rate || 0;
              const stock  = it.stock_quantity ?? null;
              const isLow  = stock !== null && stock <= (it.low_stock_alert || 5);
              return (
                <div key={it.id} onClick={() => addToCart(it)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'transform 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
                >
                  {/* Top Image Box */}
                  <div style={{
                    backgroundColor: pastel.bg,
                    borderRadius: '26px',
                    height: '145px',
                    position: 'relative',
                    marginBottom: '0.75rem',
                  }}>
                    {/* Image layer (with overflow hidden to match border radius) */}
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '26px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {it.image_url ? (
                         <img src={it.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                         <span style={{color: '#ffffff', fontWeight: 800, fontSize: '1.2rem', opacity: 0.8}}>{it.category.substring(0,3)}</span>
                      )}
                    </div>

                    {/* Plus button at top left creating the cutout illusion */}
                    <div style={{
                      position: 'absolute',
                      top: -4,
                      left: -4,
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      backgroundColor: pastel.border,
                      boxShadow: '0 0 0 6px #FDFCF7', // Exact match to container bg masks the corner
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      fontSize: '1.2rem',
                      lineHeight: 1,
                      zIndex: 2,
                    }}>+</div>
                  </div>

                  {/* Bottom Info Area */}
                  <div style={{ padding: '0 0.2rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 500, color: '#18181b', lineHeight: 1.2, textAlign: 'left', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {it.name}
                    </span>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <span style={{ fontSize: '0.8rem', color: isLow ? '#ef4444' : 'var(--c-text-secondary)', fontWeight: isLow ? 700 : 500 }}>
                        {(it.unit || it.pack) === 'NOS' ? '1 pc' : (it.unit || it.pack || '1 pc')} {isLow && <span style={{color: '#ef4444'}}>⚠</span>}
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#000', backgroundColor: '#FFD300', padding: '0.2rem 0.6rem', borderRadius: '1rem' }}>
                        ₹{price.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* ─── OVERLAY: Status ──────────────────────────── */}
      {paymentOverlay === 'success' && (
        <div style={overlayStyle()}>
          <div className="card" style={overlayCardStyle()}>
            <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'var(--c-success)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={60} />
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--c-success)' }}>Approved!</h2>
          </div>
        </div>
      )}

      {paymentOverlay?.startsWith('error') && (
        <div style={overlayStyle()}>
          <div className="card" style={overlayCardStyle()}>
            <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'var(--c-danger)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <XCircle size={60} />
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--c-danger)' }}>Saving Failed</h2>
            <p style={{ color: 'var(--c-danger)', fontWeight: 600, background: '#fee2e2', padding: '0.75rem', borderRadius: 8, wordBreak: 'break-all' }}>
              {paymentOverlay.split('error:')[1]}
            </p>
            <button onClick={() => setPaymentOverlay(null)} className="btn-secondary">Close & Retry</button>
          </div>
        </div>
      )}

      {/* ─── OVERLAY: Premium UPI Payment Modal ──────────────────────────── */}
      {showUpi && (
        <UpiPaymentModal
          upiId={sysSettings?.upi_id || import.meta.env.VITE_UPI_ID || 'monsoonmeridian@upi'}
          payeeName={sysSettings?.company_name || import.meta.env.VITE_UPI_PAYEE_NAME || 'Monsoon Meridian'}
          amount={netAmount}
          onConfirm={confirmUpi}
          onCancel={() => setShowUpi(false)}
        />
      )}

      {/* ─── OVERLAY: Thermal Receipt ────────────────────────────────────── */}
      {showReceipt && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
            <ThermalReceipt tx={lastTransaction} settings={sysSettings} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
               <button onClick={handleDirectPrint} className="btn-primary" style={{ padding: '1.25rem 2rem', fontSize: '1.1rem', gap: '0.75rem', display: 'flex', alignItems: 'center' }}>
                <Printer size={24} /> Print Receipt
              </button>
              <button onClick={() => { setShowReceipt(false); setCart([]); setReceivedAmount(''); setDiscount(''); }}
                style={{ padding: '1.25rem 2rem', fontSize: '1.1rem', border: '2px solid rgba(255,255,255,0.35)', color: 'white', borderRadius: 8, fontWeight: 700, background: 'transparent', cursor: 'pointer' }}>
                Close & New Sale
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ─── OVERLAY: Camera Barcode Scanner ───────────────────────────── */}
      {showCamScanner && (
        <div style={overlayStyle()}>
          <div className="card" style={{ ...overlayCardStyle(), padding: '2rem', width: 450 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', width: '100%' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={20} /> Camera Scanner
              </h2>
              <button onClick={() => { setShowCamScanner(false); setCamError(''); }} style={{ color: 'var(--c-text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            
            <div style={{ borderRadius: 12, overflow: 'hidden', background: '#000', aspectRatio: '1/1', width: '100%', position: 'relative' }}>
              <Scanner
                onScan={onCamScan}
                onError={(err) => {
                  console.error('Scanner err:', err);
                  let msg = 'Could not start camera. ';
                  if (err?.name === 'NotAllowedError') msg += 'Please allow camera permissions in your browser settings.';
                  else if (err?.name === 'NotFoundError') msg += 'No camera found on this device.';
                  else if (err?.name === 'NotReadableError') msg += 'Camera is already in use by another application.';
                  else msg += err?.message || 'Unknown camera error.';
                  setCamError(msg);
                }}
                constraints={{ 
                  facingMode: 'environment',
                  aspectRatio: { ideal: 1 } 
                }}
                scanDelay={300}
                formats={['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf']}
                styles={{ container: { width: '100%', height: '100%' } }}
                components={{
                  audio: false,
                  torch: true,
                  count: false,
                  onOff: true,
                  finder: true,
                }}
              />
              {camError && (
                <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', right: '1rem', background: 'var(--c-danger)', color: 'white', fontWeight: 700, padding: '0.75rem', borderRadius: 8, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 10 }}>
                  {camError}
                </div>
              )}
            </div>
            
            <p style={{ textAlign: 'center', color: 'var(--c-text-secondary)', fontSize: '0.9rem', marginTop: '1.5rem', marginBottom: 0 }}>
              Point your camera at a product barcode to scan it automatically.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Style helpers ────────────────────────────────────────────────────────────
const overlayStyle = () => ({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(248,250,252,0.92)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12 });
const overlayCardStyle = () => ({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', padding: '3.5rem', boxShadow: 'var(--shadow-lg)', width: 440 });

export default Sales;
