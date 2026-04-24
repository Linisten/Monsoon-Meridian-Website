import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Save, XCircle, Plus, CheckCircle } from 'lucide-react';
import { supabase } from '../config/supabaseClient';
import SearchableSelect from '../components/SearchableSelect';
import { setScannerHandler, clearScannerHandler } from '../utils/keyboardManager';

const Purchase = () => {
  const [billItems, setBillItems] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState('ABC AGENCIES(Rs)');
  const [activeItem, setActiveItem] = useState(null);
  const [purQty, setPurQty] = useState(1);
  const [purRate, setPurRate] = useState(0);
  const [purExpiry, setPurExpiry] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [billNo, setBillNo] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [referenceNo, setReferenceNo] = useState('');
  const [taxType, setTaxType] = useState('Included Tax');
  const [activeSubTab, setActiveSubTab] = useState('items'); // 'items', 'charges', 'details'
  const [otherCharges, setOtherCharges] = useState([{ name: 'Freight', amount: 0 }, { name: 'Labor', amount: 0 }]);
  const [notes, setNotes] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const navigate = useNavigate();
  const searchInputRef = useRef(null);
  const scannerBuffer = useRef('');
  const scannerTimeout = useRef(null);
  const scannerLogicRef = useRef(null);

  const formatItemName = (name) => {
    const max = 22; // consistent with bill layout
    if (!name) return 'Item';
    if (name.length <= max) return name;
    return name.substring(0, max - 10) + "..." + name.slice(-7);
  };

  // ── SCANNER LOGIC ───────────────────────────────────────────────────────
  const processBarcode = useCallback((code) => {
    if (!code) return;
    const item = items.find(it => it.code?.toLowerCase() === code.toLowerCase());
    if (item) {
      setActiveItem(item);
      setPurRate(item.rate || 0);
      setPurQty(1);
      setSearchInput('');
      return true;
    }
    return false;
  }, [items]);

  useEffect(() => {
    scannerLogicRef.current = processBarcode;
    setScannerHandler(processBarcode);
    return () => clearScannerHandler();
  }, [processBarcode]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // F4 Focus Logic (Page specific)
      if (e.key === 'F4') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  useEffect(() => {
    fetchItems();
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    const { data, error } = await supabase.from('supplier').select('name').order('name');
    if (!error && data) setSuppliers(data);
  };

  const fetchItems = async () => {
    const { data, error } = await supabase.from('items').select('*').order('name');
    if (!error && data) setItems(data);
  };

  const addItemToBill = () => {
    if (!activeItem) return;
    
    // Workflow logic: Match existing items in bill to avoid duplicates
    const existingItemIndex = billItems.findIndex(it => it.id === activeItem.id);
    if (existingItemIndex !== -1) {
      const nextItems = [...billItems];
      const existing = { ...nextItems[existingItemIndex] };
      existing.qty += purQty;
      // Recalculate if rate changed or keep consistent
      existing.rate = purRate; 
      existing.amount = existing.qty * existing.rate;
      nextItems[existingItemIndex] = existing;
      setBillItems(nextItems);
    } else {
      const newItem = {
        ...activeItem,
        qty: purQty,
        rate: purRate,
        expiry: purExpiry,
        amount: purQty * purRate
      };
      setBillItems([...billItems, newItem]);
    }
    setActiveItem(null);
    setPurExpiry('');
    // refocus search bar for next item
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const handleBarcodeScan = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = e.target.value.trim(); // Use direct value to avoid state race condition
      if (!code) return;
      const item = items.find(it => (it.code || '').toLowerCase() === code.toLowerCase());
      if (item) {
        setActiveItem(item);
        setPurRate(item.rate || 0);
        setPurQty(1);
        setSearchInput('');
      } else {
        alert('Item not found: ' + code);
      }
    }
  };

  const removeBillItem = (index) => {
    setBillItems(billItems.filter((_, i) => i !== index));
  };

  const savePurchase = async () => {
    if (billItems.length === 0) return alert('No items to purchase');
    
    // Save purchase record with full items payload
    const { error: purchaseError } = await supabase.from('purchases').insert({
      supplier: selectedSupplier,
      total_amount: grandTotal,
      bill_no: billNo,
      bill_date: billDate,
      payment_mode: paymentMode,
      reference_no: referenceNo,
      tax_type: taxType,
      items_json: billItems,
      other_charges: otherCharges.filter(c => (parseFloat(c.amount) || 0) > 0),
      notes: notes
    });
    if (purchaseError) return alert('Error saving purchase: ' + purchaseError.message);

    // Step 5: Auto-update stock_quantity and expiry_date
    const stockUpdates = billItems.map(item => {
      const updates = [
        supabase.rpc('handle_stock_update', { 
          item_id: item.id, 
          quantity_change: item.qty 
        })
      ];
      
      // If expiry was provided, update it in the items master record
      if (item.expiry) {
        updates.push(
          supabase.from('items')
            .update({ expiry_date: item.expiry })
            .eq('id', item.id)
        );
      }
      return Promise.all(updates);
    });
    
    await Promise.all(stockUpdates);

    alert(`Purchase saved! Stock and Expiry dates updated for ${billItems.length} item(s).`);
    setBillItems([]);
    setBillNo('');
    setReferenceNo('');
    fetchItems(); // refresh item list to show updated stock
  };

  const itemsTotal = billItems.reduce((sum, item) => sum + item.amount, 0);
  const chargesTotal = otherCharges.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
  const grandTotal = itemsTotal + chargesTotal;
  
  const filteredItems = items.filter(it => 
    (it.name || '').toLowerCase().includes(searchInput.toLowerCase()) || 
    (it.code || '').toLowerCase().includes(searchInput.toLowerCase()) ||
    (it.category || '').toLowerCase().includes(searchInput.toLowerCase())
  );

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', gap: '1.5rem' }}>
      
      {/* LEFT: Purchase Bill Setup */}
      <div style={{ flex: '1 1 55%', display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
        
        {/* Bill Metadata Grid */}
        <div className="card" style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem', color: 'var(--c-text-secondary)' }}>Bill No</label>
            <input type="text" placeholder="Auto-No" value={billNo} onChange={(e) => setBillNo(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.85rem' }} />
          </div>
          <div>
             <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem', color: 'var(--c-text-secondary)' }}>Bill Date</label>
             <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.85rem' }} />
          </div>
          <div>
             <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem', color: 'var(--c-text-secondary)' }}>Payment Mode</label>
             <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.85rem' }}>
                <option value="Cash">Cash</option>
                <option value="Credit">Credit</option>
              </select>
          </div>
          <div style={{ gridColumn: 'span 2' }}>
             <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem', color: 'var(--c-text-secondary)' }}>Supplier</label>
             <div style={{ display: 'flex', gap: '0.25rem' }}>
               <div style={{ display: 'flex', gap: '0.25rem', width: '100%' }}>
                 <SearchableSelect 
                   options={suppliers.map(s => s.name)}
                   value={selectedSupplier}
                   onChange={val => setSelectedSupplier(val)}
                   placeholder="Search or Select Supplier..."
                 />
               </div>
               <button 
                  onClick={() => navigate('/master/supplier')}
                  className="btn-primary" 
                  title="Add New Supplier"
                  style={{ padding: '0.4rem 0.75rem', backgroundColor: 'var(--c-wave)' }}
                >
                  +
                </button>
             </div>
          </div>
          <div>
             <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem', color: 'var(--c-text-secondary)' }}>Reference No</label>
             <input type="text" placeholder="A15782" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.85rem' }} />
          </div>
          <div>
             <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem', color: 'var(--c-text-secondary)' }}>Bill Tax Type</label>
             <select value={taxType} onChange={(e) => setTaxType(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.85rem' }}>
                <option value="Included Tax">Included Tax</option>
                <option value="Excluded Tax">Excluded Tax</option>
              </select>
          </div>
        </div>

        {/* Tab Header (Mock) */}
        {/* Tab Header - Correct Workflow Implementation */}
        <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem' }}>
          {[
            { id: 'items', label: 'Purchase Item' },
            { id: 'charges', label: 'Other Charges' },
            { id: 'details', label: 'Other Details' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              style={{ 
                padding: '0.5rem 1.25rem', 
                backgroundColor: activeSubTab === tab.id ? 'var(--c-olive)' : 'var(--c-bg-card)', 
                border: '1px solid var(--c-border)', 
                borderBottom: 'none', 
                borderRadius: '8px 8px 0 0', 
                fontSize: '0.8rem', 
                fontWeight: 600, 
                color: activeSubTab === tab.id ? 'white' : 'var(--c-text-secondary)',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Added Items Table */}
        <div className="card" style={{ flex: 1, borderTopLeftRadius: 0, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {activeSubTab === 'items' && (
            <div style={{ backgroundColor: 'var(--c-olive)', color: 'white', padding: '0.75rem 1rem', display: 'grid', gridTemplateColumns: '40px 60px 2fr 80px 60px 60px 80px 80px 80px 40px', fontWeight: 600, fontSize: '0.75rem', position: 'sticky', top: 0, zIndex: 10 }}>
              <div>SL</div><div>Item</div><div>Item Description</div><div>Expiry</div><div>Unit/Pack</div><div style={{textAlign:'right'}}>PQty</div><div style={{textAlign:'right'}}>MRP</div><div style={{textAlign:'right'}}>Rate</div><div style={{textAlign:'right'}}>Amount</div><div></div>
            </div>
          )}
          
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {activeSubTab === 'items' && (
              <>
                {billItems.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--c-text-secondary)' }}>No items added yet. Select an item from the right panel to begin.</div>
                ) : (
                  billItems.map((item, index) => (
                    <div key={index} style={{ padding: '0.5rem 1.0rem', display: 'grid', gridTemplateColumns: '40px 60px 2fr 80px 60px 60px 80px 80px 80px 40px', fontSize: '0.8rem', borderBottom: '1px solid var(--c-border)' }}>
                      <div style={{color:'var(--c-text-secondary)'}}>{index + 1}</div>
                      <div style={{fontWeight:600}}>{item.code}</div>
                      <div style={{color:'var(--c-olive-dark)'}}>{formatItemName(item.name)}</div>
                      <div style={{fontSize: '0.7rem'}}>{item.expiry || '--'}</div>
                      <div>{item.unit || item.pack}</div>
                      <div style={{textAlign:'right', fontWeight:600}}>{item.qty}</div>
                      <div style={{textAlign:'right'}}>{(item.mrp || 0).toFixed(2)}</div>
                      <div style={{textAlign:'right'}}>{(item.rate || 0).toFixed(2)}</div>
                      <div style={{textAlign:'right', fontWeight:600}}>{(item.amount || 0).toFixed(2)}</div>
                      <div style={{display:'flex', justifyContent:'flex-end'}}><button onClick={() => removeBillItem(index)} style={{color:'var(--c-danger)'}}><XCircle size={14}/></button></div>
                    </div>
                  ))
                )}
              </>
            )}

            {activeSubTab === 'charges' && (
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--c-olive-dark)', marginBottom: '0.5rem', fontWeight: 700 }}>Additional Bill Charges</h4>
                {otherCharges.map((charge, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <input 
                      type="text" value={charge.name} placeholder="Charge Name (e.g. Freight)" 
                      onChange={e => {
                        const next = [...otherCharges];
                        next[idx].name = e.target.value;
                        setOtherCharges(next);
                      }}
                      style={{ flex: 2, padding: '0.5rem', fontSize: '0.85rem' }} 
                    />
                    <input 
                      type="number" value={charge.amount} placeholder="0.00" 
                      onChange={e => {
                        const next = [...otherCharges];
                        next[idx].amount = e.target.value;
                        setOtherCharges(next);
                      }}
                      style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem', textAlign: 'right' }} 
                    />
                  </div>
                ))}
                <button onClick={() => setOtherCharges([...otherCharges, { name: '', amount: 0 }])} style={{ color: 'var(--c-wave)', fontSize: '0.8rem', width: 'fit-content', fontWeight: 600 }}>+ Add Another Charge</button>
              </div>
            )}

            {activeSubTab === 'details' && (
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--c-olive-dark)' }}>Internal Purchase Notes & Details</label>
                <textarea 
                  value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="e.g., Damaged boxes checked, Payment due in 15 days, reference transport receipts..." 
                  style={{ width: '100%', height: '150px', padding: '1rem', fontSize: '0.9rem', border: '1px solid var(--c-border)', borderRadius: '8px' }}
                />
              </div>
            )}
          </div>
          </div>
        </div>

      {/* RIGHT: Item Search & Addition Panel */}
      <div style={{ flex: '1 1 45%', display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
        
        <div className="card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '2px solid var(--c-danger)', backgroundColor: 'var(--c-bg)' }}>
          <h3 style={{ margin:0, color: 'var(--c-danger)', fontSize: '1.2rem', fontWeight: 700 }}>GRAND TOTAL</h3>
          <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--c-danger)' }}>{grandTotal.toFixed(2)}</span>
        </div>

        <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, overflow: 'hidden' }}>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
             <div style={{ position: 'relative', flex: 1 }}>
               <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--c-wave)' }} />
               <input 
                 ref={searchInputRef}
                 type="text" 
                 placeholder="Search or Scan Barcode..." 
                 value={searchInput}
                 onChange={e => setSearchInput(e.target.value)}
                 onKeyDown={handleBarcodeScan}
                 style={{ padding: '0.5rem 0.5rem 0.5rem 2.5rem', width: '100%', fontSize: '0.85rem' }} 
               />
             </div>
          </div>

          <div style={{ flex: 1, border: '1px solid var(--c-border)', overflowY: 'auto' }}>
            <div style={{ backgroundColor: 'var(--c-olive)', color: 'white', display: 'grid', gridTemplateColumns: '50px 2fr 1.5fr 60px 80px', padding: '0.5rem', fontSize: '0.75rem', fontWeight: 600, position: 'sticky', top: 0 }}>
              <div>Code</div><div>Item Description</div><div>Category</div><div>Unit/Pack</div><div>MRP</div>
            </div>
            {filteredItems.length === 0 && <div style={{padding: '1rem', color: 'var(--c-text-secondary)', fontSize: '0.8rem'}}>No matching items found.</div>}
            {filteredItems.map((item) => (
              <div 
                key={item.id} 
                onClick={() => { setActiveItem(item); setPurRate(item.rate || 0); }}
                style={{ 
                  display: 'grid', gridTemplateColumns: '50px 2fr 1.5fr 60px 80px', padding: '0.5rem', fontSize: '0.75rem', borderBottom: '1px solid var(--c-border)', cursor: 'pointer',
                  backgroundColor: activeItem && activeItem.id === item.id ? 'var(--c-wave-light)' : 'transparent',
                  color: activeItem && activeItem.id === item.id ? 'var(--c-olive-dark)' : 'inherit'
                }}
              >
                <div style={{fontWeight:600}}>{item.code}</div>
                <div>{formatItemName(item.name)}</div>
                <div style={{color:'var(--c-text-secondary)'}}>{item.category}</div>
                <div>{item.unit || item.pack}</div>
                <div>{item.mrp ? item.mrp.toFixed(2) : '0.00'}</div>
              </div>
            ))}
          </div>

          <div style={{ padding: '1rem', backgroundColor: 'var(--c-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--c-border)' }}>
            <h4 style={{ fontSize: '0.8rem', color: 'var(--c-text-secondary)', marginBottom: '0.5rem' }}>Add Item to Bill (Barcode/Item Code F4)</h4>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input type="text" value={activeItem?.code || ''} readOnly style={{ flex: 1, padding: '0.4rem', fontSize: '0.85rem' }} />
              <input type="text" value={activeItem?.name || ''} readOnly style={{ flex: 3, padding: '0.4rem', fontSize: '0.85rem' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.7rem' }}>Quantity</label>
                <input type="number" value={purQty} onChange={(e) => setPurQty(Number(e.target.value))} style={{ padding: '0.4rem', fontSize: '0.85rem' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.7rem' }}>Rate</label>
                <input type="number" value={purRate} onChange={(e) => setPurRate(Number(e.target.value))} style={{ padding: '0.4rem', fontSize: '0.85rem' }} />
              </div>
              <div style={{ flex: 1.5 }}>
                <label style={{ fontSize: '0.7rem' }}>Expiry Date</label>
                <input type="date" value={purExpiry} onChange={(e) => setPurExpiry(e.target.value)} style={{ padding: '0.4rem', fontSize: '0.85rem' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button onClick={addItemToBill} className="btn-primary" style={{ padding: '0.4rem 1rem', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                  <Plus size={16} /> Add 
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', marginTop: '1rem', justifyContent: 'flex-end' }}>
               <button onClick={savePurchase} className="btn-primary" style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--c-success)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                 <CheckCircle size={18} /> Process Purchase
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Purchase;
