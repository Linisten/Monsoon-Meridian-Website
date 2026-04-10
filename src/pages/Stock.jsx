import React, { useState, useEffect } from 'react';
import { Search, Save, Package, AlertTriangle, Image, Upload, Trash2, Camera, X } from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';
import SearchableSelect from '../components/SearchableSelect';
import { supabase } from '../config/supabaseClient';

const Stock = () => {
  const showStatus = (msg, type = 'success') => {
    setStatus({ msg, type });
    setTimeout(() => setStatus({ msg: '', type: '' }), 3000);
  };

  const [activeTab, setActiveTab] = useState('verification'); // 'verification' or 'master'
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [status, setStatus] = useState({ msg: '', type: '' });
  const [showCamScanner, setShowCamScanner] = useState(false);
  const [camError, setCamError] = useState('');
  
  // Master lists for dropdowns
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [packTypes, setPackTypes] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState('ItemDescription');
  const [verificationDate, setVerificationDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    let buffer = '';
    let timeout;
    const handleGlobalScan = (e) => {
      // Ignore if user is specifically in a search or large textarea
      // But allow if we're basically anywhere else to catch scanner input
      if (e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        if (buffer && buffer.length > 2) { // Barcodes are usually > 2 chars
          fillBarcode(buffer);
          buffer = '';
        }
      } else if (e.key.length === 1) { 
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
  }, [items, activeTab, activeItem]); // Re-bind when state changes to ensure fillBarcode has right context

  const fillBarcode = (code) => {
    if (!code) return;

    if (activeTab === 'master') {
      // In Item Master, simply update the field for the current item
      if (activeItem) {
        setActiveItem(prev => ({ ...prev, code: code }));
        showStatus('Barcode updated in field.');
      } else {
        handleCreateNew();
        setActiveItem(prev => ({ ...prev, code: code }));
        showStatus('New item started with scanned barcode.');
      }
    } else {
      // In Stock Verification, find the item to load it
      const existing = items.find(it => it.code?.toLowerCase() === code.toLowerCase());
      if (existing) {
        setActiveItem(existing);
        showStatus('Item found: ' + existing.name);
      } else {
        showStatus('Item with barcode ' + code + ' not found in master.', 'error');
      }
    }
  };

  const onCamScan = (scanResult) => {
    if (scanResult && scanResult.length > 0) {
      const code = scanResult[0].rawValue;
      fillBarcode(code);
      setShowCamScanner(false);
      setCamError('');
    }
  };


  useEffect(() => {
    fetchItems();
    fetchMasters();
  }, []);

  const fetchMasters = async () => {
    const { data: catData } = await supabase.from('category').select('name').order('name');
    const { data: unitData } = await supabase.from('unit').select('name').order('name');
    const { data: taxData } = await supabase.from('tax').select('name').order('name');
    const { data: packData } = await supabase.from('packtype').select('name').order('name');
    
    if (catData) setCategories(catData);
    if (unitData) setUnits(unitData);
    if (taxData) setTaxes(taxData);
    if (packData) setPackTypes(packData);
  };

  const fetchItems = async (selectId = null) => {
    setLoading(true);
    const { data, error } = await supabase.from('items').select('*').order('name');
    if (!error && data) {
      setItems(data);
      if (selectId) {
        // Only select if the user hasn't already clicked "New Item" (which has no id)
        setActiveItem(prev => {
          if (prev && !prev.id && prev.name === '') return prev; 
          const found = data.find(i => i.id === selectId);
          return found || (data.length > 0 ? data[0] : null);
        });
      } else {
        setActiveItem(prev => (prev ? prev : (data.length > 0 ? data[0] : null)));
      }
    }
    setLoading(false);
  };

  const handleActiveItemChange = (field, value) => {
    if (!activeItem) return;
    setActiveItem({ ...activeItem, [field]: value });
  };

  const saveItem = async () => {
    if (!activeItem || !activeItem.name) return showStatus('Item Name is required!', 'error');
    
    const payload = {
      code: activeItem.code || '',
      name: activeItem.name,
      category: activeItem.category || 'GENERAL',
      unit: activeItem.unit || 'NOS',
      pack: activeItem.pack || 'NOS',
      price: parseFloat(activeItem.price) || 0,
      stock_quantity: parseFloat(activeItem.stock_quantity) || 0,
      mrp: parseFloat(activeItem.mrp) || 0,
      cost_price: parseFloat(activeItem.cost_price) || 0,
      low_stock_alert: parseFloat(activeItem.low_stock_alert) || 5,
      image_url: activeItem.image_url || null,
      tax_category: activeItem.tax_category || '',
      is_active: activeItem.is_active === undefined ? true : activeItem.is_active,
      barcode_type: activeItem.barcode_type || 'SYSTEM GENERATED',
      item_type: activeItem.item_type || 'INVENTORY',
    };

    if (activeItem.id) {
       const { error } = await supabase.from('items').update(payload).eq('id', activeItem.id);
       if (error) {
         showStatus('Update Error: ' + error.message, 'error');
       } else {
         showStatus('Item updated successfully');
         fetchItems(activeItem.id); 
       }
    } else {
       const { data: insertData, error: insertError } = await supabase.from('items').insert([payload]).select();
       if (insertError) {
         showStatus('Insert Error: ' + insertError.message, 'error');
       } else {
         showStatus('Item created successfully');
         const newId = insertData?.[0]?.id;
         fetchItems(newId);
       }
    }
  };

  const deleteItem = async () => {
    if (!activeItem?.id) return;
    if (!window.confirm(`Are you sure you want to delete "${activeItem.name}"? This action cannot be undone.`)) return;

    try {
      const { error } = await supabase.from('items').delete().eq('id', activeItem.id);
      if (error) throw error;
      
      showStatus('Item deleted successfully');
      setSearchTerm(''); // Clear search to see list update
      fetchItems(); // Reload list
    } catch (err) {
      showStatus('Delete Error: ' + err.message, 'error');
    }
  };

  const uploadImage = async (file) => {
    if (!file) return;
    setUploadingImage(true);
    const ext = file.name.split('.').pop();
    const fileName = `item_${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(fileName, file, { upsert: true });
    if (error) {
      alert('Upload failed: ' + error.message + '\n\nMake sure you have created a "product-images" Storage bucket in Supabase (public bucket).');
    } else {
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(data.path);
      handleActiveItemChange('image_url', urlData.publicUrl);
    }
    setUploadingImage(false);
  };

  const handleCreateNew = () => {
    setActiveItem({ 
      name: '', 
      code: '', 
      category: 'GENERAL', 
      unit: 'NOS',
      pack: 'NOS', 
      price: 0, 
      stock_quantity: 0, 
      mrp: 0, 
      cost_price: 0, 
      low_stock_alert: 5, 
      image_url: null,
      tax_category: '',
      is_active: true,
      barcode_type: 'SYSTEM GENERATED',
      item_type: 'INVENTORY'
    });
  };

  return (
    <div style={{ height: 'calc(100vh - 120px)', position: 'relative', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* Tabs Layout */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid var(--c-border)' }}>
        <button 
          onClick={() => setActiveTab('verification')}
          style={{ 
            padding: '0.75rem 1.5rem', 
            fontSize: '1rem', 
            fontWeight: 600, 
            color: activeTab === 'verification' ? 'var(--c-wave)' : 'var(--c-text-secondary)',
            borderBottom: activeTab === 'verification' ? '3px solid var(--c-wave)' : '3px solid transparent',
            marginBottom: '-2px'
          }}
        >
          Stock Verification
        </button>
        <button 
          onClick={() => setActiveTab('master')}
          style={{ 
            padding: '0.75rem 1.5rem', 
            fontSize: '1rem', 
            fontWeight: 600, 
            color: activeTab === 'master' ? 'var(--c-wave)' : 'var(--c-text-secondary)',
            borderBottom: activeTab === 'master' ? '3px solid var(--c-wave)' : '3px solid transparent',
            marginBottom: '-2px'
          }}
        >
          Item Master
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: '1.5rem', minHeight: 0 }}>
        
        {/* LEFT PANE: Contextual Form / Table */}
        <div style={{ flex: '1 1 55%', display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
          
          {status.msg && (
        <div style={{
          position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)',
          padding: '0.5rem 1.5rem', borderRadius: '20px', backgroundColor: status.type === 'error' ? '#fee2e2' : '#f0fdf4',
          color: status.type === 'error' ? '#ef4444' : '#10b981', border: '1px solid currentColor',
          fontSize: '0.85rem', fontWeight: 600, zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          {status.msg}
        </div>
      )}
      {activeTab === 'verification' ? (
            <>
              {/* Verification Header */}
              <div className="card" style={{ padding: '1rem', display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--c-text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Verification No</label>
                  <input type="text" placeholder="Auto-generated" disabled style={{ padding: '0.5rem', fontSize: '0.85rem', backgroundColor: 'var(--c-bg)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--c-text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Verification Date</label>
                  <input 
                    type="date" 
                    value={verificationDate} 
                    onChange={e => setVerificationDate(e.target.value)}
                    style={{ padding: '0.5rem', fontSize: '0.85rem' }} 
                  />
                </div>
              </div>

              {/* Verification Table */}
              <div className="card" style={{ flex: 1, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ backgroundColor: 'var(--c-wave)', color: 'white', padding: '0.75rem 1rem', display: 'grid', gridTemplateColumns: '40px 36px 60px 2fr 60px 80px 80px', fontWeight: 600, fontSize: '0.8rem', alignItems: 'center' }}>
                  <div>Sl No</div><div>Img</div><div>Item</div><div>Item Description</div><div>Unit</div><div style={{textAlign:'right'}}>Avail Stock</div><div style={{textAlign:'right'}}>Veri Stock</div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {activeItem && (
                    <div style={{ padding: '0.75rem 1rem', display: 'grid', gridTemplateColumns: '40px 36px 60px 2fr 60px 80px 80px', fontSize: '0.85rem', borderBottom: '1px solid var(--c-border)', backgroundColor: 'var(--c-bg)', alignItems: 'center' }}>
                      <div style={{color:'var(--c-text-secondary)'}}>1</div>
                      <div style={{ width: 28, height: 28, borderRadius: 6, overflow: 'hidden', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {activeItem.image_url ? <img src={activeItem.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Image size={14} color="#94a3b8" />}
                      </div>
                      <div style={{fontWeight:600}}>{activeItem.code}</div>
                      <div style={{color:'var(--c-olive-dark)'}}>{activeItem.name}</div>
                      <div>{activeItem.unit || activeItem.pack}</div>
                      <div style={{textAlign:'right', color:'var(--c-danger)'}}>{(activeItem.stock_quantity || 0).toFixed(3)}</div>
                      <div style={{textAlign:'right'}}>
                        <input type="number" defaultValue="10.000" style={{ width: '70px', padding: '0.2rem', textAlign: 'right', fontSize: '0.8rem' }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Item Master Form */}
              <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--c-border)', paddingBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--c-olive)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Package size={20} /> Item Details
                  </h3>
                  <div style={{display: 'flex', gap: '1rem'}}>
                    <button onClick={handleCreateNew} className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--c-wave)', color: 'var(--c-wave)', borderRadius: '4px' }}>
                      New Item
                    </button>
                    {activeItem?.id && (
                      <button 
                        onClick={deleteItem} 
                        className="btn-danger" 
                        style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fee2e2', border: '1px solid #f87171', color: '#b91c1c' }}
                      >
                        <Trash2 size={16} /> Delete
                      </button>
                    )}
                    <button onClick={saveItem} className="btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Save size={16} /> Save Item
                    </button>
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--c-text-secondary)' }}>Item Code / Barcode</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input type="text" value={activeItem?.code || ''} onChange={e => handleActiveItemChange('code', e.target.value)} style={{ padding: '0.5rem', fontSize: '0.85rem', flex: 1 }} />
                      <button onClick={() => setShowCamScanner(true)} title="Scan via Camera" style={{ width: 38, height: 38, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-brand)' }}>
                        <Camera size={18} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--c-text-secondary)' }}>Item Description</label>
                    <input type="text" value={activeItem?.name || ''} onChange={e => handleActiveItemChange('name', e.target.value)} style={{ padding: '0.5rem', fontSize: '0.85rem' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--c-text-secondary)' }}>Item Category *</label>
                    <SearchableSelect 
                      options={categories.map(c => c.name)}
                      value={activeItem?.category || ''}
                      onChange={val => handleActiveItemChange('category', val)}
                      placeholder="Type or select..."
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--c-text-secondary)' }}>Unit *</label>
                    <SearchableSelect 
                      options={units.map(u => u.name)}
                      value={activeItem?.unit || ''}
                      onChange={val => handleActiveItemChange('unit', val)}
                      placeholder="Type or select Unit..."
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--c-text-secondary)' }}>Pack Type</label>
                    <SearchableSelect 
                      options={packTypes.map(p => p.name)}
                      value={activeItem?.pack || ''}
                      onChange={val => handleActiveItemChange('pack', val)}
                      placeholder="Type or select Pack..."
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--c-text-secondary)' }}>Tax Category *</label>
                    <SearchableSelect 
                      options={taxes.map(t => t.name)}
                      value={activeItem?.tax_category || ''}
                      onChange={val => handleActiveItemChange('tax_category', val)}
                      placeholder="Type or select Tax..."
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--c-text-secondary)' }}>Item Cost</label>
                    <input type="number" step="0.01" value={activeItem?.cost_price || 0} onChange={e => handleActiveItemChange('cost_price', e.target.value)} style={{ padding: '0.5rem', fontSize: '0.85rem', textAlign: 'right' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--c-text-secondary)' }}>MRP</label>
                    <input type="number" step="0.01" value={activeItem?.mrp || 0} onChange={e => handleActiveItemChange('mrp', e.target.value)} style={{ padding: '0.5rem', fontSize: '0.85rem', textAlign: 'right' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--c-text-secondary)' }}>Selling Price</label>
                    <input type="number" step="0.01" value={activeItem?.price || 0} onChange={e => handleActiveItemChange('price', e.target.value)} style={{ padding: '0.5rem', fontSize: '0.85rem', textAlign: 'right' }} />
                  </div>
                </div>


                {/* ─── IMAGE UPLOAD ─────────────────────────────── */}
                <div style={{ marginTop: '0.5rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--c-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.5rem' }}>
                    <Image size={14} /> Product Image
                  </label>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {/* Preview */}
                    <div style={{ width: 90, height: 90, borderRadius: 10, border: '2px dashed var(--c-border)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
                      {activeItem?.image_url
                        ? <img src={activeItem.image_url} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <Image size={28} color="#cbd5e1" />
                      }
                    </div>
                    {/* Upload button */}
                    <div style={{ flex: 1 }}>
                      <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'var(--c-wave)', color: 'white', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600, opacity: uploadingImage ? 0.6 : 1 }}>
                        <Upload size={14} />
                        {uploadingImage ? 'Uploading...' : 'Choose Image'}
                        <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploadingImage} onChange={e => uploadImage(e.target.files?.[0])} />
                      </label>
                      {activeItem?.image_url && (
                        <button onClick={() => handleActiveItemChange('image_url', null)} style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--c-danger)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Remove</button>
                      )}
                      <p style={{ fontSize: '0.72rem', color: 'var(--c-text-secondary)', marginTop: '0.35rem' }}>PNG, JPG, WEBP. Image will appear on POS cards.</p>
                    </div>
                  </div>
                </div>

              </div>
            </>
          )}

        </div>

        {/* RIGHT PANE: Item List (Shared) */}
        <div style={{ flex: '1 1 45%', display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
          <div className="card" style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <select 
                value={searchType} 
                onChange={e => setSearchType(e.target.value)} 
                style={{ padding: '0.5rem', fontSize: '0.85rem', flex: 1 }}
              >
                <option value="ItemDescription">ItemDescription</option>
                <option value="ItemCode">ItemCode</option>
                <option value="ItemCategory">ItemCategory</option>
              </select>
              <div style={{ position: 'relative', flex: 2 }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--c-wave)' }} />
                <input 
                  type="text" 
                  placeholder="Search..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ padding: '0.5rem 0.5rem 0.5rem 2rem', fontSize: '0.85rem', width: '100%' }} 
                />
              </div>
            </div>
            <div style={{ flex: 1, border: '1px solid var(--c-border)', overflowY: 'auto' }}>
              <div style={{ backgroundColor: 'var(--c-olive)', color: 'white', display: 'grid', gridTemplateColumns: '32px 50px 2fr 1.5fr 50px 70px', padding: '0.5rem', fontSize: '0.75rem', fontWeight: 600, position: 'sticky', top: 0, alignItems: 'center' }}>
                <div>Pic</div><div>Code</div><div>Description</div><div>Category</div><div>Unit</div><div style={{textAlign:'right'}}>Stock</div>
              </div>
              {loading && <div style={{padding: '1rem', color: 'var(--c-text-secondary)', fontSize: '0.8rem'}}>Loading items...</div>}
              {!loading && items.length === 0 && <div style={{padding: '1rem', color: 'var(--c-text-secondary)', fontSize: '0.8rem'}}>No data found. Ensure tables are created in Supabase.</div>}
              {!loading && items
                .filter(it => {
                  const s = (searchTerm || '').toLowerCase();
                  if (!s) return true;
                  if (searchType === 'ItemDescription') return (it.name || '').toLowerCase().includes(s);
                  if (searchType === 'ItemCode') return (it.code || '').toLowerCase().includes(s);
                  if (searchType === 'ItemCategory') return (it.category || '').toLowerCase().includes(s);
                  return true;
                })
                .map((item) => {
                const isLow = (item.stock_quantity || 0) <= (item.low_stock_alert || 5);
                return (
                  <div 
                    key={item.id} 
                    onClick={() => setActiveItem(item)}
                    style={{ 
                      display: 'grid', gridTemplateColumns: '32px 50px 2fr 1.5fr 50px 70px', padding: '0.6rem 0.5rem', fontSize: '0.8rem', borderBottom: '1px solid var(--c-border)', cursor: 'pointer', alignItems: 'center',
                      backgroundColor: activeItem && activeItem.id === item.id ? '#dbeafe' : isLow ? '#fff7ed' : 'transparent',
                    }}
                  >
                    <div style={{ width: 24, height: 24, borderRadius: 4, overflow: 'hidden', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {item.image_url ? <img src={item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Image size={12} color="#94a3b8" />}
                    </div>
                    <div style={{fontWeight:600}}>{item.code}</div>
                    <div>{item.name}</div>
                    <div style={{color:'var(--c-text-secondary)'}}>{item.category}</div>
                    <div>{item.unit || item.pack}</div>
                    <div style={{textAlign:'right', display:'flex', alignItems:'center', justifyContent:'flex-end', gap:'4px', color: isLow ? 'var(--c-danger)' : 'inherit', fontWeight: isLow ? 700 : 400}}>
                      {isLow && <AlertTriangle size={12} />}
                      {(item.stock_quantity || 0).toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>

      </div>
      
      {/* ─── OVERLAY: Camera Barcode Scanner ───────────────────────────── */}
      {showCamScanner && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(248,250,252,0.92)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', padding: '3.5rem', boxShadow: 'var(--shadow-lg)', width: 440 }}>
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
                  if (err?.name === 'NotAllowedError') msg += 'Please allow camera permissions.';
                  else if (err?.name === 'NotFoundError') msg += 'No camera found.';
                  else msg += err?.message || 'Error.';
                  setCamError(msg);
                }}
                constraints={{ facingMode: 'environment' }}
                scanDelay={300}
                formats={['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf']}
                styles={{ container: { width: '100%', height: '100%' } }}
                components={{
                  audio: false,
                  torch: true,
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

export default Stock;
