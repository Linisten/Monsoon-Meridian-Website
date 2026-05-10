import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Package, AlertTriangle, Clock, IndianRupee, 
  Plus, Search, Edit3, Trash2, Camera, X, Save, 
  ChevronRight, Barcode, Filter
} from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { supabase } from '../config/supabaseClient';
import { setScannerHandler, clearScannerHandler } from '../utils/keyboardManager';
import { useConfirm } from '../context/ConfirmContext';

const Stock = () => {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [taxes, setTaxes] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, LOW, EXPIRED
  const [activeItem, setActiveItem] = useState(null); // Used for the Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showCamScanner, setShowCamScanner] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const { confirm, alert } = useConfirm();

  useEffect(() => {
    fetchData();
    fetchDropdowns();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('items').select('*').order('name');
    if (!error && data) setItems(data);
    setLoading(false);
  };

  const fetchDropdowns = async () => {
    const [cats, uns, txs] = await Promise.all([
      supabase.from('category').select('name').order('name'),
      supabase.from('unit').select('name').order('name'),
      supabase.from('tax').select('name, rate_percent').order('name')
    ]);
    if (cats.data) setCategories(cats.data.map(c => c.name));
    if (uns.data) setUnits(uns.data.map(u => u.name));
    if (txs.data) setTaxes(txs.data);
  };

  // ─── FILTERED DATA FOR STATS ──────────────────────────────────────────
  const filteredForStats = items
    .filter(it => (selectedCategory === 'ALL' || it.category === selectedCategory))
    .filter(it => !searchTerm || it.name.toLowerCase().includes(searchTerm.toLowerCase()) || it.code?.toLowerCase().includes(searchTerm.toLowerCase()));

  const stats = {
    totalCount: filteredForStats.length,
    lowStock: filteredForStats.filter(it => it.stock_quantity > 0 && it.stock_quantity <= (it.low_stock_alert || 5)).length,
    outOfStock: filteredForStats.filter(it => it.stock_quantity <= 0).length,
    expired: filteredForStats.filter(it => it.expiry_date && new Date(it.expiry_date) < new Date()).length
  };

  // ─── HANDLERS ──────────────────────────────────────────────────────────
  const openEditModal = (item = null) => {
    if (item) {
      setActiveItem({ ...item });
    } else {
      setActiveItem({
        name: '', code: '', category: categories[0] || 'GENERAL', 
        unit: units[0] || 'NOS', tax: taxes[0]?.name || 'GST 0%', 
        cost_price: 0, price: 0, mrp: 0, stock_quantity: 0, 
        low_stock_alert: 5, expiry_date: '', image_url: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!activeItem.name) return alert('Item Name is required', 'error');
    setIsSaving(true);
    
    const payload = { ...activeItem };
    let error;

    if (payload.id) {
      ({ error } = await supabase.from('items').update(payload).eq('id', payload.id));
    } else {
      ({ error } = await supabase.from('items').insert([payload]));
    }

    setIsSaving(false);
    if (error) {
      alert('Error saving: ' + error.message, 'error');
    } else {
      await alert('Item saved successfully!', 'success');
      setIsModalOpen(false);
      fetchData();
    }
  };

  const handleDelete = async (id, name) => {
    const isConfirmed = await confirm({
      title: 'Delete Item?',
      message: `Are you sure you want to delete "${name}"? This cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete Item'
    });

    if (isConfirmed) {
      const { error } = await supabase.from('items').delete().eq('id', id);
      if (error) {
        alert('Error deleting: ' + error.message, 'error');
      } else {
        await alert('Item deleted successfully', 'success');
        fetchData();
      }
    }
  };

  const uploadImage = async (file) => {
    if (!file) return;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const { data, error } = await supabase.storage.from('product-images').upload(fileName, file);
    
    if (error) {
      alert('Upload failed: ' + error.message, 'error');
    } else {
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(data.path);
      setActiveItem(prev => ({ ...prev, image_url: urlData.publicUrl }));
    }
  };

  // ─── UI COMPONENTS ──────────────────────────────────────────────────────
  const StatCard = ({ title, value, icon: Icon, color, isActive, onClick }) => (
    <div 
      onClick={onClick}
      className="card" 
      style={{ 
        flex: 1, 
        padding: '1.5rem', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '1.5rem', 
        borderLeft: `6px solid ${color}`,
        cursor: 'pointer',
        transform: isActive ? 'translateY(-5px)' : 'none',
        boxShadow: isActive ? '0 10px 20px -5px rgba(0,0,0,0.1)' : 'var(--shadow-sm)',
        transition: 'all 0.2s',
        backgroundColor: isActive ? '#f8fafc' : 'white',
        border: isActive ? `2px solid ${color}40` : '1px solid var(--c-border)'
      }}
    >
      <div style={{ backgroundColor: `${color}15`, color: color, padding: '1rem', borderRadius: '16px' }}>
        <Icon size={32} />
      </div>
      <div>
        <div style={{ fontSize: '0.85rem', color: 'var(--c-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
        <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--c-text-primary)' }}>{Math.round(value).toLocaleString()}</div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '2rem' }}>
      
      {/* ─── STATS ROW ─── */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <StatCard 
          title="Total Products" 
          value={stats.totalCount} 
          icon={Package} 
          color="#3b82f6" 
          isActive={statusFilter === 'ALL'}
          onClick={() => setStatusFilter('ALL')}
        />
        <StatCard 
          title="Low Stock Items" 
          value={stats.lowStock} 
          icon={AlertTriangle} 
          color="#f59e0b" 
          isActive={statusFilter === 'LOW'}
          onClick={() => setStatusFilter('LOW')}
        />
        <StatCard 
          title="Out of Stock" 
          value={stats.outOfStock} 
          icon={X} 
          color="#64748b" 
          isActive={statusFilter === 'OUT_OF_STOCK'}
          onClick={() => setStatusFilter('OUT_OF_STOCK')}
        />
        <StatCard 
          title="Expired Items" 
          value={stats.expired} 
          icon={Clock} 
          color="#ef4444" 
          isActive={statusFilter === 'EXPIRED'}
          onClick={() => setStatusFilter('EXPIRED')}
        />
      </div>

      {/* ─── LIST SECTION ─── */}
      <div className="card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        
        {/* Category Pill Strip */}
        <div style={{ padding: '1.25rem 1.5rem 0.5rem', display: 'flex', gap: '0.6rem', overflowX: 'auto', scrollbarWidth: 'none', borderBottom: '1px solid #f1f5f9' }}>
          {['ALL', ...categories].map(cat => (
            <button 
              key={cat} 
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '999px',
                fontSize: '0.8rem',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
                backgroundColor: selectedCategory === cat ? 'var(--c-text-primary)' : '#f1f5f9',
                color: selectedCategory === cat ? 'white' : '#64748b',
                border: 'none',
                cursor: 'pointer',
                boxShadow: selectedCategory === cat ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--c-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fcfcfc', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '1rem', flex: 1, minWidth: '300px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-secondary)' }} />
              <input 
                type="text" 
                placeholder="Search by name, code or category..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '2.75rem', width: '100%', borderRadius: '12px' }}
              />
            </div>

            {(selectedCategory !== 'ALL' || statusFilter !== 'ALL') && (
              <button 
                onClick={() => { setSelectedCategory('ALL'); setStatusFilter('ALL'); }}
                style={{ 
                  fontSize: '0.8rem', 
                  fontWeight: 700, 
                  color: '#b91c1c', 
                  background: '#fef2f2', 
                  border: '1px solid #fecaca', 
                  borderRadius: '10px',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#fee2e2';
                  e.currentTarget.style.borderColor = '#fca5a5';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#fef2f2';
                  e.currentTarget.style.borderColor = '#fecaca';
                }}
              >
                <X size={14} /> Clear Filters
              </button>
            )}
          </div>
          
          <button onClick={() => openEditModal()} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.5rem', borderRadius: '12px' }}>
            <Plus size={20} /> Add New Product
          </button>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--c-border)' }}>
              <tr>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.85rem', fontWeight: 800, color: 'var(--c-text-secondary)', width: '80px' }}>PIC</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.85rem', fontWeight: 800, color: 'var(--c-text-secondary)' }}>PRODUCT DETAILS</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.85rem', fontWeight: 800, color: 'var(--c-text-secondary)' }}>CATEGORY</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.85rem', fontWeight: 800, color: 'var(--c-text-secondary)', textAlign: 'center' }}>STOCK</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.85rem', fontWeight: 800, color: 'var(--c-text-secondary)', textAlign: 'right' }}>MRP</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.85rem', fontWeight: 800, color: 'var(--c-text-secondary)', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ padding: '4rem', textAlign: 'center', color: 'var(--c-text-secondary)' }}>Loading inventory data...</td></tr>
              ) : items
                .filter(it => (selectedCategory === 'ALL' || it.category === selectedCategory))
                .filter(it => {
                  if (statusFilter === 'LOW') return it.stock_quantity > 0 && it.stock_quantity <= (it.low_stock_alert || 5);
                  if (statusFilter === 'OUT_OF_STOCK') return it.stock_quantity <= 0;
                  if (statusFilter === 'EXPIRED') return it.expiry_date && new Date(it.expiry_date) < new Date();
                  return true;
                })
                .filter(it => !searchTerm || it.name.toLowerCase().includes(searchTerm.toLowerCase()) || it.code?.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((it) => {
                  const isLow = it.stock_quantity <= (it.low_stock_alert || 5);
                  const isExpired = it.expiry_date && new Date(it.expiry_date) < new Date();
                  
                  return (
                    <tr key={it.id} style={{ borderBottom: '1px solid var(--c-border)', transition: 'background 0.2s', backgroundColor: isExpired ? '#fff1f2' : (isLow ? '#fffbeb' : 'transparent') }}>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        {it.image_url ? (
                          <img src={it.image_url} alt="" style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover', border: '1px solid var(--c-border)' }} />
                        ) : (
                          <div style={{ width: '48px', height: '48px', borderRadius: '10px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                            <Package size={20} />
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--c-text-primary)', fontSize: '1rem' }}>{it.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--c-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '2px' }}>
                          <Barcode size={12} /> {it.code || 'NO CODE'} • {it.unit || 'NOS'}
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <span style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', backgroundColor: '#f1f5f9', fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                          {it.category}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: isLow || isExpired ? '#ef4444' : '#10b981' }}>
                          {Math.round(it.stock_quantity)}
                        </div>
                        {it.expiry_date && (
                          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: isExpired ? '#ef4444' : '#64748b', marginTop: '2px' }}>
                            Exp: {it.expiry_date}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontWeight: 800, fontSize: '1rem' }}>
                        ₹{Math.round(it.mrp)}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button onClick={() => openEditModal(it)} className="btn-secondary" style={{ padding: '0.5rem', borderRadius: '10px', color: 'var(--c-brand)' }} title="Edit">
                            <Edit3 size={18} />
                          </button>
                          <button onClick={() => handleDelete(it.id, it.name)} className="btn-secondary" style={{ padding: '0.5rem', borderRadius: '10px', color: 'var(--c-danger)' }} title="Delete">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          {items.length === 0 && !loading && (
            <div style={{ padding: '5rem', textAlign: 'center', color: 'var(--c-text-secondary)' }}>
              <Package size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
              <div>No products found. Start by adding a new product.</div>
            </div>
          )}
        </div>
      </div>

      {/* ─── EDIT MODAL ─── */}
      {isModalOpen && activeItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', position: 'relative', animation: 'slideUp 0.3s ease-out' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--c-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10 }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900 }}>{activeItem.id ? 'Edit Product' : 'Add New Product'}</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ color: 'var(--c-text-secondary)', padding: '0.5rem' }}><X size={24} /></button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '2rem', display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '2.5rem' }}>
              
              {/* Left Column: Image & Basic */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: '24px', backgroundColor: '#f8fafc', border: '2px dashed var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', marginBottom: '1rem' }}>
                    {activeItem.image_url ? (
                      <img src={activeItem.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                        <Camera size={48} style={{ marginBottom: '0.5rem' }} />
                        <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>Click to Upload</div>
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={e => uploadImage(e.target.files[0])}
                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                    />
                  </div>
                  <button onClick={() => setShowCamScanner(!showCamScanner)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 700, padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--c-border)', background: 'white' }}>
                    <Barcode size={18} /> {showCamScanner ? 'Close Scanner' : 'Scan Barcode'}
                  </button>
                </div>

                {showCamScanner && (
                  <div style={{ borderRadius: '16px', overflow: 'hidden', height: '200px' }}>
                    <Scanner onScan={(res) => {
                      if (res?.[0]) {
                        setActiveItem(prev => ({ ...prev, code: res[0].rawValue }));
                        setShowCamScanner(false);
                      }
                    }} />
                  </div>
                )}

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--c-text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Barcode / Product Code</label>
                  <input type="text" value={activeItem.code} onChange={e => setActiveItem({...activeItem, code: e.target.value})} placeholder="Scan or enter code" />
                </div>
              </div>

              {/* Right Column: Form Fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--c-text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Product Name *</label>
                  <input type="text" value={activeItem.name} onChange={e => setActiveItem({...activeItem, name: e.target.value})} placeholder="Enter product name" style={{ fontSize: '1.1rem', fontWeight: 600 }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--c-text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Category</label>
                    <select value={activeItem.category} onChange={e => setActiveItem({...activeItem, category: e.target.value})}>
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--c-text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Unit / Pack</label>
                    <select value={activeItem.unit} onChange={e => setActiveItem({...activeItem, unit: e.target.value})}>
                      {units.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--c-text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Cost Price</label>
                    <input type="number" value={activeItem.cost_price} onChange={e => setActiveItem({...activeItem, cost_price: parseFloat(e.target.value)})} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--c-text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Selling Price</label>
                    <input type="number" value={activeItem.price} onChange={e => setActiveItem({...activeItem, price: parseFloat(e.target.value)})} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--c-text-secondary)', display: 'block', marginBottom: '0.5rem' }}>MRP</label>
                    <input type="number" value={activeItem.mrp} onChange={e => setActiveItem({...activeItem, mrp: parseFloat(e.target.value)})} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--c-text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Low Stock Alert</label>
                    <input type="number" value={activeItem.low_stock_alert} onChange={e => setActiveItem({...activeItem, low_stock_alert: parseFloat(e.target.value)})} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--c-text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Expiry Date</label>
                    <input type="date" value={activeItem.expiry_date} onChange={e => setActiveItem({...activeItem, expiry_date: e.target.value})} />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid var(--c-border)', display: 'flex', gap: '1rem', backgroundColor: '#f8fafc', position: 'sticky', bottom: 0 }}>
              <button onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--c-border)', background: 'white', fontWeight: 700 }}>Cancel</button>
              <button onClick={handleSave} disabled={isSaving} className="btn-primary" style={{ flex: 2, padding: '0.85rem', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                <Save size={20} /> {isSaving ? 'Saving Product...' : 'Save Product Details'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        table tr:hover {
          background-color: #f1f5f9;
        }
      `}</style>
    </div>
  );
};

export default Stock;
