import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Minus, X, CreditCard, Banknote, Smartphone, ScanLine, CheckCircle, Printer, XCircle, Search, Camera, Trash2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { supabase } from '../config/supabaseClient';
import { setScannerHandler, clearScannerHandler } from '../utils/keyboardManager';
import { useConfirm } from '../context/ConfirmContext';
import UpiPaymentModal from '../components/UpiPaymentModal';
import SearchableSelect from '../components/SearchableSelect';
import { printReceipt } from '../utils/printService';
import ThermalReceipt from '../components/ThermalReceipt';
import logoUrl from '../assets/logo.jpg';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../utils/activityService';
import { getUserStock, addUserStock } from '../utils/stockService';

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

  const formatItemName = (name) => {
    const max = 22; // matches print server limit for single line
    if (name.length <= max) return name;
    // Truncate in middle, preserve last 7 chars (for weights etc)
    return name.substring(0, max - 10) + "..." + name.slice(-7);
  };



// ── Main Sales Component ─────────────────────────────────────────────────────
const Sales = () => {
  const { user } = useAuth();
  const [cart,             setCart]             = useState(() => JSON.parse(sessionStorage.getItem('sales_cart') || '[]'));
  const [items,            setItems]            = useState([]);
  const [activeCategory,   setActiveCategory]   = useState('ALL');
  const [receivedAmount,   setReceivedAmount]   = useState(() => sessionStorage.getItem('sales_receivedAmount') || '');
  const [paymentOverlay,   setPaymentOverlay]   = useState(null);
  const [showUpi,          setShowUpi]          = useState(false);
  const [showReceipt,      setShowReceipt]      = useState(false);
  const [showCamScanner,   setShowCamScanner]   = useState(false);
  const [camError,         setCamError]         = useState('');
  const [lastTransaction,  setLastTransaction]  = useState(null);
  const [taxPercent,       setTaxPercent]       = useState(() => Number(sessionStorage.getItem('sales_taxPercent') || '0'));
  const [discount,         setDiscount]         = useState(() => sessionStorage.getItem('sales_discount') || '');
  const [barcodeInput,     setBarcodeInput]     = useState('');
  const [itemSearch,       setItemSearch]       = useState('');
  const [customers,        setCustomers]        = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(() => sessionStorage.getItem('sales_selectedCustomer') || 'Walk-in Customer');
  const [categories,       setCategories]       = useState(['ALL']);
  const [stockWarning,     setStockWarning]     = useState(null);

  // Split payment mode & values
  const [paymentMode,      setPaymentMode]      = useState('CASH'); // 'CASH' | 'SPLIT'
  const [splitCash,        setSplitCash]        = useState('');
  const [splitGpay,        setSplitGpay]        = useState('');
  const [showSplitUpi,     setShowSplitUpi]     = useState(false);

  const [sysSettings,      setSysSettings]      = useState({});

  useEffect(() => {
    sessionStorage.setItem('sales_cart', JSON.stringify(cart));
    sessionStorage.setItem('sales_receivedAmount', receivedAmount);
    sessionStorage.setItem('sales_taxPercent', taxPercent.toString());
    sessionStorage.setItem('sales_discount', discount);
    sessionStorage.setItem('sales_selectedCustomer', selectedCustomer);
  }, [cart, receivedAmount, taxPercent, discount, selectedCustomer]);

  const handleClearSales = async () => {
    const isConfirmed = await confirm({
      title: 'Clear Sales Data',
      message: 'Are you sure you want to clear the cart and all entered sales data?',
      confirmText: 'Yes, Clear',
      cancelText: 'Cancel'
    });
    if (!isConfirmed) return;
    
    setCart([]);
    setReceivedAmount('');
    setTaxPercent(0);
    setDiscount('');
    setSelectedCustomer('Walk-in Customer');
    setPaymentMode('CASH');
    setSplitCash('');
    setSplitGpay('');
  };
  const [isProcessing,     setIsProcessing]     = useState(false);
  const [isPrinting,       setIsPrinting]       = useState(false);
  const { confirm, alert } = useConfirm();
  const barcodeInputRef = useRef(null);

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
    if (!error && data) {
      const isStaff = user && user.role !== 'Admin';
      const mapped = data.map(it => ({
        ...it,
        stock_quantity: isStaff ? getUserStock(user.id, it.id, 0) : it.stock_quantity
      }));
      setItems(mapped);
    }
  };

  const addToCart = useCallback((item) => {
    const inCart = cart.find(c => c.id === item.id);
    const currentQty = inCart ? inCart.qty : 0;

    // Safety: Treat any negative stock in DB as 0 for this check
    const availableStock = Math.max(0, item.stock_quantity);

    if (currentQty + 1 > availableStock) {
      setStockWarning(item.name);
      setTimeout(() => setStockWarning(null), 2000);
      return;
    }

    setCart(prev => {
      const hit = prev.find(c => c.id === item.id);
      return hit 
        ? prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c) 
        : [...prev, { ...item, qty: 1 }];
    });
  }, [cart, items]); // Re-bind when cart or items change to ensure fresh validation context
  const updateQty = useCallback((id, d) => {
    if (d > 0) {
      const inCart = cart.find(c => c.id === id);
      const original = items.find(it => it.id === id);
      const availableStock = Math.max(0, original?.stock_quantity || 0);
      
      if (inCart && original && inCart.qty + d > availableStock) {
        setStockWarning(original.name);
        setTimeout(() => setStockWarning(null), 2000);
        return;
      }
    }
    setCart(prev => prev.map(c => c.id === id ? ({ ...c, qty: Math.max(0, c.qty + d), manual_amount: undefined }) : c).filter(c => c.qty > 0));
  }, [cart, items]);
  const removeItem     = (id)      => setCart(prev => prev.filter(c => c.id !== id));
  const updateAmount = useCallback((id, val) => {
    const inCart = cart.find(c => c.id === id);
    if (!inCart) return;

    const rate = inCart.price || 0;
    const newAmt = parseFloat(val) || 0;
    const newQty = rate > 0 ? parseFloat((newAmt / rate).toFixed(4)) : inCart.qty;

    const original = items.find(it => it.id === id);
    const availableStock = Math.max(0, original?.stock_quantity || 0);
    
    if (original && newQty > availableStock) {
      setStockWarning(original.name);
      setTimeout(() => setStockWarning(null), 2000);
      return;
    }

    setCart(prev => prev.map(c => c.id === id ? { ...c, qty: newQty, manual_amount: val } : c));
  }, [cart, items]);

  const totalAmount    = cart.reduce((s, c) => s + (c.price || 0) * c.qty, 0);
  const discountAmount = parseFloat(discount) || 0;
  const afterDiscount  = Math.max(0, totalAmount - discountAmount);
  const taxAmount      = afterDiscount * (taxPercent / 100);
  const beforeRound    = afterDiscount + taxAmount;
  const roundOff       = Math.round(beforeRound) - beforeRound; // e.g. +0.40 or -0.60
  const netAmount      = Math.round(beforeRound);
  const change         = receivedAmount ? parseFloat(receivedAmount) - netAmount : 0;

  // ── Persist sale to Supabase ─────────────────────────────────────────────
  const persistSale = async (method, razorpayData = {}) => {
    if (isProcessing) return;
    setIsProcessing(true);

    const payload = {
      total_amount:    netAmount,
      tax_percent:     taxPercent,
      payment_method:  method,
      items_json:      cart,
      customer_name:   selectedCustomer,
      gross_total:     totalAmount,
      discount_amount: discountAmount,
      user_id:         user?.id,
      user_name:       user?.name || user?.username,
      ...razorpayData,
    };
    let { data, error } = await supabase.from('sales').insert([payload]).select();
    if (error && (error.code === 'PGRST204' || error.message?.includes('user_id'))) {
      delete payload.user_id;
      delete payload.user_name;
      const fallbackRes = await supabase.from('sales').insert([payload]).select();
      data = fallbackRes.data;
      error = fallbackRes.error;
    }
    if (error) {
      console.error('Supabase insert error:', error);
      setPaymentOverlay('error:' + (error.message || 'Unknown error'));
      setIsProcessing(false);
      return;
    }

    // --- DECREMENT INVENTORY (SHOP SPECIFIC) ---
    if (user && user.role !== 'Admin') {
      const stockUpdates = cart.map(item => 
        addUserStock({
          userId: user.id,
          itemId: item.id,
          quantityChange: -item.qty,
          itemName: item.name
        })
      );
      await Promise.all(stockUpdates);
    } else {
      const stockUpdates = cart.map(item => 
        supabase.rpc('handle_stock_update', { 
          item_id: item.id, 
          quantity_change: -item.qty 
        })
      );
      await Promise.all(stockUpdates);
    }
    // ------------------------------------------

    setIsProcessing(false);
    setPaymentOverlay('success');
    await new Promise(r => setTimeout(r, 800));
    setPaymentOverlay(null);
    setPaymentMode('CASH');
    setSplitCash('');
    setSplitGpay('');
    
    const invoiceId = data?.[0]?.id || `INV-${Date.now()}`;

    // Log green Sales action to Admin activity stream
    logActivity({
      type: 'SALE',
      color: '#10b981', // GREEN
      title: `Sale Completed #${String(invoiceId).substring(0, 8)}`,
      description: `User "${user?.name || 'Staff'}" billed ${cart.length} item(s) for ₹${netAmount.toFixed(2)} to ${selectedCustomer} via ${method}.`,
      metadata: {
        invoice_id: invoiceId,
        amount: netAmount,
        customer_name: selectedCustomer,
        payment_method: method,
        items_count: cart.length
      }
    });

    setLastTransaction({ ...payload, id: invoiceId, date: new Date().toLocaleString() });
    setShowReceipt(true);
  };

  const processBarcode = useCallback((code) => {
    if (!code) return;
    const item = items.find(it => (it.code || '').toLowerCase() === code.toLowerCase());
    if (item) {
      addToCart(item);
      setBarcodeInput('');
      // Maintain focus on search bar if it was focused
      setTimeout(() => barcodeInputRef.current?.focus(), 0);
      return true;
    } else {
      alert('Product Not Found: ' + code, 'error');
      setBarcodeInput('');
      setTimeout(() => barcodeInputRef.current?.focus(), 0);
      return false;
    }
  }, [items, addToCart]);

  const handleBarcodeScan = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processBarcode(e.target.value.trim()); // Use direct value
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

  const scannerBuffer = useRef('');
  const scannerTimeout = useRef(null);
  const scannerLogicRef = useRef(null);

  useEffect(() => {
    scannerLogicRef.current = processBarcode;
    setScannerHandler(processBarcode);
    return () => clearScannerHandler();
  }, [processBarcode]);


  // ── CASH ─────────────────────────────────────────────────────────────────
  const handleCash = () => {
    if (!cart.length) return alert('Cart is empty!', 'error');
    if (paymentMode === 'SPLIT') {
      setPaymentMode('CASH');
      return;
    }
    persistSale('CASH');
  };

  // ── CASH / GPAY SPLIT ────────────────────────────────────────────────────
  const handleSelectSplit = () => {
    if (!cart.length) return alert('Cart is empty!', 'error');
    setPaymentMode('SPLIT');
    if (!splitCash && !splitGpay) {
      setSplitCash('');
      setSplitGpay(netAmount.toString());
    }
  };

  const handleSplitCashChange = (e) => {
    const val = e.target.value;
    if (val === '') {
      setSplitCash('');
      setSplitGpay(netAmount.toString());
      return;
    }
    const num = parseFloat(val);
    if (isNaN(num)) {
      setSplitCash('');
      setSplitGpay(netAmount.toString());
      return;
    }
    const safeCash = Math.max(0, Math.min(netAmount, num));
    const safeGpay = Math.max(0, Math.round((netAmount - safeCash) * 100) / 100);
    setSplitCash(val);
    setSplitGpay(safeGpay.toString());
  };

  const handleSplitGpayChange = (e) => {
    const val = e.target.value;
    if (val === '') {
      setSplitGpay('');
      setSplitCash(netAmount.toString());
      return;
    }
    const num = parseFloat(val);
    if (isNaN(num)) {
      setSplitGpay('');
      setSplitCash(netAmount.toString());
      return;
    }
    const safeGpay = Math.max(0, Math.min(netAmount, num));
    const safeCash = Math.max(0, Math.round((netAmount - safeGpay) * 100) / 100);
    setSplitGpay(val);
    setSplitCash(safeCash.toString());
  };

  const handlePresetSplit = (cashPortion) => {
    const safeCash = Math.max(0, Math.min(netAmount, Math.round(cashPortion)));
    const safeGpay = Math.max(0, netAmount - safeCash);
    setSplitCash(safeCash.toString());
    setSplitGpay(safeGpay.toString());
  };

  const handleConfirmSplitSale = () => {
    if (!cart.length) return alert('Cart is empty!', 'error');
    const cashVal = parseFloat(splitCash) || 0;
    const gpayVal = parseFloat(splitGpay) || 0;
    const sum = Math.round((cashVal + gpayVal) * 100) / 100;

    if (Math.abs(sum - netAmount) > 0.5) {
      return alert(`Split total (₹${sum}) must equal the total bill of ₹${netAmount}!`, 'error');
    }

    const method = `CASH/GPAY (Cash: ₹${cashVal}, GPay: ₹${gpayVal})`;
    persistSale(method);
  };

  // Sync split amounts when netAmount changes while in SPLIT mode
  useEffect(() => {
    if (paymentMode === 'SPLIT') {
      const cashNum = parseFloat(splitCash);
      if (!isNaN(cashNum)) {
        const safeCash = Math.max(0, Math.min(netAmount, cashNum));
        const safeGpay = Math.max(0, Math.round((netAmount - safeCash) * 100) / 100);
        setSplitGpay(safeGpay.toString());
      } else {
        setSplitGpay(netAmount.toString());
      }
    }
  }, [netAmount, paymentMode]);

  // ── UPI / GPay (Manual QR) ───────────────────────────────────────────────
  const handleGpay = () => {
    if (!cart.length) return alert('Cart is empty!', 'error');
    setShowUpi(true);
  };

  const confirmUpi = () => {
    setShowUpi(false);
    persistSale('UPI/GPAY_MANUAL');
  };

  // ── Thermal Direct Print (via local Node.js print server) ───────────────
  const handleDirectPrint = async () => {
    if (!lastTransaction || isPrinting) return;
    setIsPrinting(true);

    try {
      const result = await printReceipt(lastTransaction, sysSettings, null, logoUrl);
      if (!result.success) {
        // Fallback: browser print dialog if server is not running
        console.warn('Print server error, falling back to browser print:', result.error);
        window.print();
      }
    } catch (err) {
      console.warn('Print failed, falling back to browser print:', err);
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  // ── UI ───────────────────────────────────────────────────────────────────
  return (
    <div className="sales-container" style={{ height: 'calc(100vh - 120px)', display: 'flex', gap: '1.5rem', position: 'relative' }}>
      <style>{`
        .payment-grid {
          display: grid !important;
          grid-template-columns: repeat(3, 1fr) !important;
          gap: 0.5rem !important;
        }
        .payment-grid button {
          padding: 0.75rem 0.25rem !important;
          font-size: 0.9rem !important;
          flex-shrink: 1 !important;
          min-width: 0 !important;
        }
        @media (max-width: 1024px) {
          .sales-container {
            flex-direction: column !important;
            height: auto !important;
            overflow-y: auto !important;
            padding-bottom: 5rem;
          }
          .cart-section {
            flex: none !important;
            width: 100% !important;
            height: 600px !important;
          }
          .items-section {
            flex: none !important;
            width: 100% !important;
          }
          .cart-header {
            flex-direction: column !important;
            gap: 1rem !important;
          }
          .cart-table-header div:nth-child(2),
          .cart-table-header div:nth-child(3),
          .cart-table-row div:nth-child(2),
          .cart-table-row div:nth-child(3) {
            display: none !important;
          }
          .payment-grid {
            grid-template-columns: 1fr 1fr !important;
          }
          .calculator-card {
            flex-direction: column !important;
            text-align: center !important;
          }
          .calculator-card div:last-child {
            text-align: center !important;
          }
        }
        @media (max-width: 600px) {
          .payment-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* ─── LEFT: Cart ───────────────────────────────────────────────────── */}
      <div className="cart-section" style={{ flex: '1 1 65%', display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>

        {/* Header */}
        <div className="card cart-header" style={{ padding: '1.25rem', display: 'flex', gap: '1.5rem' }}>
          <div style={{ flex: 1, minWidth: 150 }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--c-text-secondary)', display: 'block' }}>Scan Barcode</label>
              <button 
                onClick={handleClearSales}
                style={{ fontSize: '0.8rem', color: 'var(--c-danger)', border: '1px solid var(--c-danger)', borderRadius: '6px', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', fontWeight: 600 }}
              >
                <Trash2 size={14} /> Clear
              </button>
            </div>
            <div style={{ position: 'relative', display: 'flex', gap: '0.5rem' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <ScanLine size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-secondary)' }} />
                <input 
                  ref={barcodeInputRef}
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
          <div className="cart-table-header" style={{ backgroundColor: '#f1f5f9', padding: '0.75rem 1rem', display: 'flex', fontWeight: 700, fontSize: '0.85rem', borderBottom: '1px solid var(--c-border)', alignItems: 'center' }}>
            <div style={{ width: 36 }}>#</div>
            <div style={{ width: 44 }}>Pic</div>

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
              const rate = it.price || 0;
              return (
                <div key={it.id} className="cart-table-row" style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid var(--c-border)', fontSize: '0.95rem' }}>
                  <div style={{ width: 36, color: 'var(--c-text-secondary)' }}>{idx + 1}</div>
                  <div style={{ width: 44 }}>
                    {it.image_url ? <img src={it.image_url} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} /> : <div style={{ width: 32, height: 32, borderRadius: 4, background: '#e2e8f0' }} />}
                  </div>

                  <div style={{ flex: 1, fontWeight: 600 }}>{formatItemName(it.name)}</div>
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
          <div style={{ 
            flex: 1, 
            textAlign: 'right', 
            backgroundColor: '#2e1065', 
            margin: '-1.5rem', 
            marginLeft: '0', 
            padding: '1.5rem 2rem', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center',
            color: 'white'
          }}>
            <div style={{ fontSize: '1rem', color: '#c4b5fd', fontWeight: 800, letterSpacing: '0.05em' }}>NET AMOUNT</div>
            <div style={{ fontSize: '3.2rem', fontWeight: 900, lineHeight: 1 }}>₹{Math.round(netAmount)}</div>
          </div>
        </div>
      </div>

      {/* ─── RIGHT: Item Grid & Payments ──────────────────────────────────── */}
      <div className="items-section" style={{ flex: '1 1 35%', display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>

        {/* Actual Payment Buttons */}
        <div className="card payment-grid" style={{ padding: '1.25rem' }}>
          <button 
            type="button"
            onClick={handleCash} 
            disabled={isProcessing} 
            className="btn-primary" 
            style={{ 
              flex: 1, 
              justifyContent: 'center', 
              gap: '0.5rem', 
              display: 'flex', 
              alignItems: 'center', 
              backgroundColor: isProcessing ? '#94a3b8' : 'var(--c-success)',
              border: paymentMode === 'CASH' ? '2px solid #15803d' : 'none',
              boxShadow: paymentMode === 'CASH' ? '0 0 0 3px rgba(34,197,94,0.3)' : 'none',
              fontWeight: 800
            }}
          >
            <Banknote size={22} /> {isProcessing ? 'Saving...' : 'Cash'}
          </button>
          <button 
            type="button"
            onClick={handleSelectSplit} 
            disabled={isProcessing} 
            className="btn-primary" 
            style={{ 
              flex: 1, 
              justifyContent: 'center', 
              gap: '0.35rem', 
              display: 'flex', 
              alignItems: 'center', 
              backgroundColor: isProcessing ? '#94a3b8' : (paymentMode === 'SPLIT' ? '#1d4ed8' : '#2563eb'),
              border: paymentMode === 'SPLIT' ? '2px solid #60a5fa' : 'none',
              boxShadow: paymentMode === 'SPLIT' ? '0 0 0 3px rgba(37,99,235,0.35)' : 'none',
              fontWeight: 800
            }}
          >
            <Banknote size={17} />/<Smartphone size={17} /> {isProcessing ? 'Saving...' : 'Cash/GPay'}
          </button>
          <button 
            type="button"
            onClick={handleGpay} 
            disabled={isProcessing} 
            className="btn-primary" 
            style={{ 
              flex: 1, 
              justifyContent: 'center', 
              gap: '0.5rem', 
              display: 'flex', 
              alignItems: 'center', 
              backgroundColor: isProcessing ? '#94a3b8' : '#6366f1',
              fontWeight: 800
            }}
          >
            <Smartphone size={22} /> {isProcessing ? 'Saving...' : 'GPay/UPI'}
          </button>
        </div>

        {/* Change calculator / Custom Cash+GPay Split Payment Section */}
        {paymentMode === 'SPLIT' ? (
          <div className="card" style={{ 
            padding: '1.25rem', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.85rem',
            border: '2px solid #3b82f6',
            backgroundColor: '#f8fafc',
            boxShadow: '0 4px 14px rgba(37,99,235,0.08)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ 
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 22, height: 22, borderRadius: '50%', background: '#2563eb', color: 'white', fontSize: '0.75rem', fontWeight: 900 
                }}>₹</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--c-text-primary)' }}>
                  Custom Split (Bill: ₹{netAmount})
                </span>
              </div>
              <button 
                type="button"
                onClick={() => setPaymentMode('CASH')}
                style={{ fontSize: '0.75rem', color: 'var(--c-text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Cancel Split
              </button>
            </div>

            {/* Two-way Inputs for Cash & GPay */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ 
                background: 'white', padding: '0.65rem 0.85rem', borderRadius: 8, border: '1.5px solid #22c55e',
                display: 'flex', flexDirection: 'column', gap: '0.2rem' 
              }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Banknote size={14} /> Cash (₹)
                </label>
                <input 
                  type="number"
                  value={splitCash}
                  onChange={handleSplitCashChange}
                  placeholder="0.00"
                  min="0"
                  max={netAmount}
                  autoFocus
                  style={{ 
                    fontSize: '1.25rem', fontWeight: 800, width: '100%', 
                    color: '#166534', border: 'none', outline: 'none', background: 'transparent', padding: 0
                  }}
                />
              </div>

              <div style={{ 
                background: 'white', padding: '0.65rem 0.85rem', borderRadius: 8, border: '1.5px solid #6366f1',
                display: 'flex', flexDirection: 'column', gap: '0.2rem' 
              }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#4338ca', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Smartphone size={14} /> GPay (₹)
                </label>
                <input 
                  type="number"
                  value={splitGpay}
                  onChange={handleSplitGpayChange}
                  placeholder="0.00"
                  min="0"
                  max={netAmount}
                  style={{ 
                    fontSize: '1.25rem', fontWeight: 800, width: '100%', 
                    color: '#4338ca', border: 'none', outline: 'none', background: 'transparent', padding: 0
                  }}
                />
              </div>
            </div>

            {/* Quick split chips */}
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--c-text-secondary)', fontWeight: 600 }}>Quick:</span>
              <button 
                type="button"
                onClick={() => handlePresetSplit(Math.round(netAmount / 2))}
                style={{ padding: '2px 8px', fontSize: '0.75rem', borderRadius: 4, border: '1px solid var(--c-border)', background: 'white', cursor: 'pointer', fontWeight: 600 }}
              >
                50 / 50
              </button>
              <button 
                type="button"
                onClick={() => handlePresetSplit(0)}
                style={{ padding: '2px 8px', fontSize: '0.75rem', borderRadius: 4, border: '1px solid var(--c-border)', background: 'white', cursor: 'pointer', fontWeight: 600 }}
              >
                All GPay
              </button>
              <button 
                type="button"
                onClick={() => handlePresetSplit(netAmount)}
                style={{ padding: '2px 8px', fontSize: '0.75rem', borderRadius: 4, border: '1px solid var(--c-border)', background: 'white', cursor: 'pointer', fontWeight: 600 }}
              >
                All Cash
              </button>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {Number(splitGpay) > 0 && (
                <button 
                  type="button"
                  onClick={() => setShowSplitUpi(true)}
                  className="btn-secondary"
                  style={{ padding: '0.65rem 0.85rem', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: '#4338ca', borderColor: '#c7d2fe', background: 'white' }}
                  title="Show UPI QR Code for GPay portion"
                >
                  <Smartphone size={16} /> QR (₹{splitGpay})
                </button>
              )}
              <button 
                type="button"
                onClick={handleConfirmSplitSale}
                disabled={isProcessing || !cart.length}
                className="btn-primary"
                style={{ 
                  flex: 1, 
                  justifyContent: 'center', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  padding: '0.65rem 1rem',
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  backgroundColor: isProcessing ? '#94a3b8' : '#2563eb' 
                }}
              >
                <CheckCircle size={18} /> {isProcessing ? 'Saving...' : `Confirm Sale (₹${Number(splitCash) || 0} + ₹${Number(splitGpay) || 0})`}
              </button>
            </div>
          </div>
        ) : (
          <div className="card calculator-card" style={{ padding: '1.25rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem', fontWeight: 700 }}>Cash Received</label>
              <input type="number" value={receivedAmount} onChange={e => setReceivedAmount(e.target.value)} placeholder="0.00" style={{ fontSize: '1.3rem', fontWeight: 700 }} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--c-text-secondary)', fontWeight: 700 }}>CHANGE</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: change >= 0 ? 'var(--c-success)' : 'var(--c-danger)' }}>₹{change >= 0 ? change.toFixed(2) : '0.00'}</div>
            </div>
          </div>
        )}

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
              const price  = it.price || 0;
              const stock  = it.stock_quantity ?? null;
              const isLow  = stock !== null && stock <= (it.low_stock_alert || 5);
              const isOutOfStock = stock !== null && stock <= 0;

              return (
                <div key={it.id} onClick={() => addToCart(it)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                    position: 'relative',
                    transition: 'transform 0.15s ease',
                    opacity: isOutOfStock ? 0.8 : 1
                  }}
                  onMouseEnter={e => { if (!isOutOfStock) e.currentTarget.style.transform = 'translateY(-3px)'; }}
                  onMouseLeave={e => { if (!isOutOfStock) e.currentTarget.style.transform = 'none'; }}
                >
                  {/* Top Image Box */}
                  <div style={{
                    backgroundColor: pastel.bg,
                    borderRadius: '26px',
                    height: '145px',
                    position: 'relative',
                    marginBottom: '0.75rem',
                    filter: isOutOfStock ? 'grayscale(1)' : 'none'
                  }}>
                    {/* Image layer (with overflow hidden to match border radius) */}
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '26px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {it.image_url ? (
                         <img src={it.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                         <span style={{color: '#ffffff', fontWeight: 800, fontSize: '1.2rem', opacity: 0.8}}>{it.category.substring(0,3)}</span>
                      )}
                    </div>

                    {/* Out of Stock Overlay */}
                    {isOutOfStock && (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(0,0,0,0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 4,
                        borderRadius: '26px'
                      }}>
                        <div style={{
                          backgroundColor: 'rgba(255,255,255,0.9)',
                          color: '#000',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontWeight: 900,
                          fontSize: '0.75rem',
                          textAlign: 'center',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}>
                          STOCK NOT AVAILABLE
                        </div>
                      </div>
                    )}

                    {/* Plus button at top left creating the cutout illusion */}
                    {!isOutOfStock && (
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
                    )}
                  </div>

                  {/* Bottom Info Area */}
                  <div style={{ padding: '0 0.2rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 500, color: '#18181b', lineHeight: 1.2, textAlign: 'left', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {formatItemName(it.name)}
                    </span>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <span style={{ fontSize: '0.8rem', color: isLow ? '#ef4444' : 'var(--c-text-secondary)', fontWeight: isLow ? 700 : 500 }}>
                        {(it.unit || it.pack) === 'NOS' ? '1 nos' : (it.unit || it.pack || '1 nos')} {isLow && <span style={{color: '#ef4444'}}>⚠</span>}
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

      {/* ─── OVERLAY: Stock Warning ───────────────────── */}
      {stockWarning && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', background: 'white', border: '4px solid var(--c-danger)', borderRadius: 24, textAlign: 'center' }}>
            <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'var(--c-danger)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <XCircle size={60} />
            </div>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--c-danger)', margin: 0 }}>OUT OF STOCK!</h2>
            <p style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{stockWarning} is currently unavailable.</p>
          </div>
        </div>
      )}

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

      {/* ─── OVERLAY: Premium UPI Payment Modal (Full) ─────────────────── */}
      {showUpi && (
        <UpiPaymentModal
          upiId={sysSettings?.upi_id || import.meta.env.VITE_UPI_ID || 'monsoonmeridian@upi'}
          payeeName={sysSettings?.company_name || import.meta.env.VITE_UPI_PAYEE_NAME || 'Monsoon Meridian'}
          amount={netAmount}
          onConfirm={confirmUpi}
          onCancel={() => setShowUpi(false)}
        />
      )}

      {/* ─── OVERLAY: Split UPI Payment Modal (for GPay portion) ─────────── */}
      {showSplitUpi && (
        <UpiPaymentModal
          upiId={sysSettings?.upi_id || import.meta.env.VITE_UPI_ID || 'monsoonmeridian@upi'}
          payeeName={sysSettings?.company_name || import.meta.env.VITE_UPI_PAYEE_NAME || 'Monsoon Meridian'}
          amount={parseFloat(splitGpay) || 0}
          onConfirm={() => {
            setShowSplitUpi(false);
            handleConfirmSplitSale();
          }}
          onCancel={() => setShowSplitUpi(false)}
        />
      )}

      {/* ─── OVERLAY: Thermal Receipt ────────────────────────────────────── */}
      {showReceipt && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.92)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', maxWidth: '100%', padding: '2rem 0' }}>
            <div style={{ flexShrink: 0 }}>
              <ThermalReceipt tx={lastTransaction} settings={sysSettings} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '2rem' }}>
              <button onClick={handleDirectPrint} disabled={isPrinting} className="btn-primary" style={{ padding: '1.25rem 2rem', fontSize: '1.1rem', gap: '0.75rem', display: 'flex', alignItems: 'center', backgroundColor: isPrinting ? '#94a3b8' : 'var(--c-wave)' }}>
                <Printer size={24} /> {isPrinting ? 'Printing...' : 'Print Receipt'}
              </button>

              <button onClick={() => { setShowReceipt(false); setCart([]); setReceivedAmount(''); setDiscount(''); setPaymentMode('CASH'); setSplitCash(''); setSplitGpay(''); }}
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
