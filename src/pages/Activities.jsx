import React, { useState, useEffect } from 'react';
import { 
  Activity, Calendar, Filter, AlertTriangle, ShoppingCart, 
  ShoppingBag, Search, Clock, Users, ArrowUpRight, X, RefreshCw, Trash2
} from 'lucide-react';
import { getActivities, deleteActivity, clearActivities, ACTIVITY_COLORS, ACTIVITY_LABELS } from '../utils/activityService';
import { getAllUsers } from '../utils/userService';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useNavigate } from 'react-router-dom';

const formatKeyName = (key) => {
  const map = {
    invoice_id: 'Invoice ID',
    bill_no: 'Bill No',
    amount: 'Total Amount',
    total_amount: 'Total Amount',
    customer_name: 'Customer',
    supplier: 'Supplier',
    payment_method: 'Payment Method',
    payment_mode: 'Payment Mode',
    items_count: 'Number of Items',
    item_name: 'Product Name',
    item_id: 'Product ID',
    allocated_qty: 'Allocated Quantity',
    stock_qty: 'Stock Quantity',
    target_shop: 'Destination Shop',
    target_user_id: 'Shop Account ID',
    price: 'Unit Price'
  };
  if (map[key]) return map[key];
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const formatValue = (key, val) => {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'number') {
    if (key.toLowerCase().includes('amount') || key === 'amount' || key === 'price') {
      return `₹${val.toFixed(2)}`;
    }
    return val.toString();
  }
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

const Activities = () => {
  const { isAdmin } = useAuth();
  const { confirm, alert } = useConfirm();
  const navigate = useNavigate();

  const [activities, setActivities] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUserFilter, setSelectedUserFilter] = useState('ALL');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailModalItem, setDetailModalItem] = useState(null);

  const loadData = async () => {
    setLoading(true);
    const [acts, userList] = await Promise.all([
      getActivities({
        userId: selectedUserFilter,
        startDate: startDate,
        endDate: endDate,
        type: categoryFilter
      }),
      getAllUsers()
    ]);
    setActivities(acts);
    setUsers(userList);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [selectedUserFilter, startDate, endDate, categoryFilter]);

  // Real-time listener
  useEffect(() => {
    const handleActivity = () => {
      loadData();
    };
    window.addEventListener('mm_activity_logged', handleActivity);
    return () => window.removeEventListener('mm_activity_logged', handleActivity);
  }, [selectedUserFilter, startDate, endDate, categoryFilter]);

  if (!isAdmin) {
    return (
      <div className="card" style={{ padding: '3rem', textAlign: 'center', maxWidth: 500, margin: '4rem auto' }}>
        <AlertTriangle size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.5rem', color: '#0f172a' }}>Admin Only</h2>
        <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Staff members do not have access to the activities monitoring system.</p>
        <button onClick={() => navigate('/')} className="btn-primary" style={{ margin: '0 auto' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const filtered = activities.filter(a => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      a.action_title?.toLowerCase().includes(term) ||
      a.description?.toLowerCase().includes(term) ||
      a.user_name?.toLowerCase().includes(term)
    );
  });

  const unethicalCount = activities.filter(a => a.is_unethical || a.action_type === 'UNETHICAL').length;
  const salesCount = activities.filter(a => a.action_type === 'SALE').length;
  const purchaseCount = activities.filter(a => a.action_type === 'PURCHASE').length;

  const handleDeleteActivity = async (id, title, e) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;

    const confirmed = await confirm({
      title: 'Delete Notification?',
      message: `Are you sure you want to delete "${title || 'this notification'}"? This cannot be undone.`,
      confirmText: 'Yes, Delete',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (confirmed) {
      await deleteActivity(id);
      setActivities(prev => prev.filter(a => a.id !== id));
      if (detailModalItem?.id === id) setDetailModalItem(null);
      await alert('Notification deleted successfully', 'success');
    }
  };

  const handleClearAllActivities = async () => {
    if (!isAdmin) return;
    const count = activities.length;
    if (count === 0) return;

    const confirmed = await confirm({
      title: 'Delete All Notifications?',
      message: `Are you sure you want to permanently delete all ${count} notifications? This cannot be undone.`,
      confirmText: 'Yes, Delete All',
      cancelText: 'Cancel',
      type: 'danger'
    });

    if (confirmed) {
      await clearActivities();
      setActivities([]);
      if (detailModalItem) {
        setDetailModalItem(null);
      }
      await alert('All notifications deleted successfully', 'success');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '3rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
            Live User Activities & Audit Trail
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>
            Real-time tracking of staff sales, purchases, stock checks, and unethical action alerts.
          </p>
        </div>

        {isAdmin && activities.length > 0 && (
          <button
            onClick={handleClearAllActivities}
            title="Delete all notifications"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.25rem',
              borderRadius: '10px',
              border: '1.5px solid #fecaca',
              background: '#fff1f2',
              color: '#e11d48',
              fontSize: '0.85rem',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#ffe4e6';
              e.currentTarget.style.borderColor = '#fda4af';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#fff1f2';
              e.currentTarget.style.borderColor = '#fecaca';
            }}
          >
            <Trash2 size={16} /> Delete All
          </button>
        )}
      </div>

      {/* KPI Highlights */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '5px solid #ef4444', background: unethicalCount > 0 ? '#fff5f5' : 'white' }}>
          <div style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 800, textTransform: 'uppercase' }}>Unethical Actions (Red)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#dc2626', marginTop: 4 }}>{unethicalCount}</div>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '5px solid #10b981', background: '#f6fbf8' }}>
          <div style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 800, textTransform: 'uppercase' }}>Sales Actions (Green)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#166534', marginTop: 4 }}>{salesCount}</div>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '5px solid #3b82f6', background: '#f8faff' }}>
          <div style={{ fontSize: '0.78rem', color: '#1e40af', fontWeight: 800, textTransform: 'uppercase' }}>Purchases Actions (Blue)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e40af', marginTop: 4 }}>{purchaseCount}</div>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '5px solid #0f172a' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Total Actions Logged</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', marginTop: 4 }}>{activities.length}</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Row 1: Search & Inline Date Range Filter & User Select */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1, minWidth: 280 }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: 240, maxWidth: '100%' }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input 
                type="text" 
                placeholder="Search activity description..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '0.55rem 0.75rem 0.55rem 2.2rem', borderRadius: 8, border: '1.5px solid var(--c-border)', fontSize: '0.85rem' }}
              />
            </div>

            {/* Date Range Filter (Inline near Search Bar, No Refresh Button) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#f8fafc', padding: '0.2rem 0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  padding: '0.45rem 0.65rem',
                  borderRadius: '6px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#0f172a',
                  background: 'white',
                  outline: 'none',
                  width: 140
                }}
              />
              <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 700 }}>
                to
              </span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  padding: '0.45rem 0.65rem',
                  borderRadius: '6px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#0f172a',
                  background: 'white',
                  outline: 'none',
                  width: 140
                }}
              />
            </div>
          </div>

          {/* User Select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={16} color="#64748b" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>Filter by User:</span>
            <select 
              value={selectedUserFilter}
              onChange={e => setSelectedUserFilter(e.target.value)}
              style={{ padding: '0.55rem 1rem', borderRadius: 8, border: '1.5px solid var(--c-border)', fontSize: '0.85rem', fontWeight: 600 }}
            >
              <option value="ALL">All Staff Members ({users.length})</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Categories */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
            <Filter size={15} color="#64748b" />
            {[
              { key: 'ALL',       label: 'All', color: '#475569' },
              { key: 'UNETHICAL', label: '🔴 Unethical (Red)', color: '#ef4444' },
              { key: 'PURCHASE',  label: '🔵 Purchases (Blue)', color: '#3b82f6' },
              { key: 'SALE',      label: '🟢 Sales (Green)', color: '#10b981' },
              { key: 'STOCK',     label: 'Stock Ver.', color: '#f59e0b' },
              { key: 'REPORT',    label: 'Reports', color: '#8b5cf6' },
            ].map(cat => (
              <button
                key={cat.key}
                onClick={() => setCategoryFilter(cat.key)}
                style={{
                  padding: '0.3rem 0.65rem',
                  borderRadius: 999,
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  border: `1.5px solid ${categoryFilter === cat.key ? cat.color : '#e2e8f0'}`,
                  background: categoryFilter === cat.key ? cat.color : '#f8fafc',
                  color: categoryFilter === cat.key ? 'white' : '#475569',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

        </div>

      {/* Activity Cards Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {loading ? (
          <div className="card" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.5rem' }} />
            <div>Loading live activities...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <h4>No activity logs match your filter criteria</h4>
          </div>
        ) : (
          filtered.map(act => {
            const isUnethical = act.is_unethical || act.action_type === 'UNETHICAL';
            const isSale = act.action_type === 'SALE';
            const isPurchase = act.action_type === 'PURCHASE';

            let cardBorder = ACTIVITY_COLORS[act.action_type] || '#64748b';
            let badgeBg = '#f1f5f9';
            let badgeColor = '#475569';
            let cardBg = 'white';

            if (isUnethical) {
              cardBorder = '#ef4444';
              badgeBg = '#fee2e2';
              badgeColor = '#dc2626';
              cardBg = '#fff9f9';
            } else if (isPurchase) {
              cardBorder = '#3b82f6';
              badgeBg = '#dbeafe';
              badgeColor = '#1d4ed8';
              cardBg = '#f8faff';
            } else if (isSale) {
              cardBorder = '#10b981';
              badgeBg = '#dcfce7';
              badgeColor = '#15803d';
              cardBg = '#fafffc';
            }

            return (
              <div 
                key={act.id}
                onClick={() => setDetailModalItem(act)}
                className="card"
                style={{
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.25rem',
                  borderLeft: `6px solid ${cardBorder}`,
                  background: cardBg,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 15px rgba(0,0,0,0.06)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
              >
                {/* Icon */}
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: badgeBg,
                  color: badgeColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {isUnethical ? <AlertTriangle size={22} /> : (isPurchase ? <ShoppingBag size={22} /> : (isSale ? <ShoppingCart size={22} /> : <Activity size={22} />))}
                </div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: isUnethical ? '#dc2626' : '#0f172a' }}>
                      {act.action_title}
                    </h4>
                    <span style={{
                      padding: '0.15rem 0.5rem',
                      borderRadius: 999,
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      background: badgeBg,
                      color: badgeColor
                    }}>
                      {isUnethical ? 'UNETHICAL NOTIFICATION' : act.action_type}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                      by <strong style={{ color: '#0f172a' }}>{act.user_name}</strong> ({act.user_role})
                    </span>
                  </div>
                  <p style={{ margin: '3px 0 0', color: '#475569', fontSize: '0.85rem' }}>
                    {act.description}
                  </p>
                </div>

                {/* Timestamp */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} /> {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, {new Date(act.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal detail */}
      {detailModalItem && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999, padding: '1rem', backdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 540, padding: '2rem', borderRadius: '20px', background: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <span style={{
                  padding: '0.2rem 0.6rem',
                  borderRadius: 999,
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  background: detailModalItem.is_unethical ? '#fee2e2' : '#dbeafe',
                  color: detailModalItem.is_unethical ? '#dc2626' : '#1d4ed8'
                }}>
                  {detailModalItem.is_unethical ? '⚠️ UNETHICAL ALERT' : detailModalItem.action_type}
                </span>
                <h3 style={{ margin: '0.5rem 0 0', fontSize: '1.3rem', fontWeight: 900, color: '#0f172a' }}>
                  {detailModalItem.action_title}
                </h3>
              </div>
              <button onClick={() => setDetailModalItem(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', fontSize: '0.9rem', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 800, color: '#334155', marginBottom: '0.3rem', fontSize: '0.8rem', textTransform: 'uppercase' }}>Description:</div>
              <div style={{ color: '#0f172a', lineHeight: 1.5, fontWeight: 600 }}>{detailModalItem.description}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.75rem', background: '#f1f5f9', borderRadius: 8 }}>
                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Staff Member</div>
                <div style={{ fontWeight: 800, color: '#0f172a' }}>{detailModalItem.user_name} ({detailModalItem.user_role})</div>
              </div>
              <div style={{ padding: '0.75rem', background: '#f1f5f9', borderRadius: 8 }}>
                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Timestamp</div>
                <div style={{ fontWeight: 800, color: '#0f172a' }}>{new Date(detailModalItem.created_at).toLocaleString()}</div>
              </div>
            </div>

            {/* Action Specifics in points & sentences */}
            {detailModalItem.metadata && Object.keys(detailModalItem.metadata).length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                  Activity Points & Details:
                </div>
                <div style={{
                  background: '#f8fafc',
                  padding: '1rem 1.25rem',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem'
                }}>
                  {Object.entries(detailModalItem.metadata).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.88rem' }}>
                      <span style={{ color: '#2563eb', fontSize: '1rem', lineHeight: '1.2' }}>•</span>
                      <span style={{ color: '#64748b', fontWeight: 700, minWidth: '140px' }}>
                        {formatKeyName(k)}:
                      </span>
                      <span style={{ fontWeight: 800, color: '#0f172a', wordBreak: 'break-word', flex: 1 }}>
                        {formatValue(k, v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', gap: '1rem' }}>
              {isAdmin && (
                <button
                  onClick={() => handleDeleteActivity(detailModalItem.id, detailModalItem.action_title)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '10px',
                    border: '1.5px solid #fecaca',
                    background: '#fff1f2',
                    color: '#e11d48',
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#ffe4e6';
                    e.currentTarget.style.borderColor = '#fda4af';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#fff1f2';
                    e.currentTarget.style.borderColor = '#fecaca';
                  }}
                >
                  <Trash2 size={16} /> Delete Notification
                </button>
              )}
              <button onClick={() => setDetailModalItem(null)} className="btn-primary" style={{ padding: '0.65rem 1.5rem', marginLeft: 'auto' }}>
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Activities;
