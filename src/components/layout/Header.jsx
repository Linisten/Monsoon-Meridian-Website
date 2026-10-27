import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Bell, Search, X, AlertTriangle, Package, ExternalLink, Menu
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../context/AuthContext';

const Header = ({ onMenuClick }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  /* search state */
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef(null);

  /* notifications state (Inventory & Stock Alerts) */
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifRef = useRef(null);

  const getPageTitle = () => {
    const paths = [
      { label: 'Dashboard Overview', path: '/' },
      { label: 'Point of Sale (POS)', path: '/sales' },
      { label: 'Purchase Entry', path: '/purchase' },
      { label: 'Stock Verification', path: '/stock' },
      { label: 'Business Reports', path: '/reports' },
      { label: 'Staff & User Management', path: '/users' },
      { label: 'User Activities Stream', path: '/activities' },
      { label: 'System Settings', path: '/settings' },
      { label: 'Customers', path: '/master/customer' },
      { label: 'Suppliers', path: '/master/supplier' },
      { label: 'Taxes', path: '/master/tax' },
      { label: 'Marketing Hub', path: '/marketing' },
      { label: 'Barcode Print Studio', path: '/barcode' },
    ];
    const match = paths.find(p => p.path === location.pathname)
      || paths.find(p => p.path !== '/' && location.pathname.startsWith(p.path));
    return match ? match.label : 'Monsoon Meridian';
  };

  /* ── Global search (Live Data Only) ── */
  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);

    // 1. Pages/Modules matches
    const pages = [
      { label: 'Dashboard', path: '/', keywords: 'home main overview' },
      { label: 'Point of Sale (POS)', path: '/sales', keywords: 'sell billing invoice checkout cart' },
      { label: 'Purchase Entry', path: '/purchase', keywords: 'buy supplier bill procurement' },
      { label: 'Stock Verification', path: '/stock', keywords: 'inventory items master count audit' },
      { label: 'Business Reports', path: '/reports', keywords: 'analytics sales purchase history export' },
      { label: 'Staff & User Management', path: '/users', keywords: 'users employees credentials passwords staff' },
      { label: 'User Activities Stream', path: '/activities', keywords: 'actions unethical audit logs tracking' },
      { label: 'Marketing Dashboard', path: '/marketing', keywords: 'campaigns ads promotion whatsapp' },
      { label: 'Barcode Print Studio', path: '/barcode', keywords: 'labels stickers thermal 2-up' },
      { label: 'System Settings', path: '/settings', keywords: 'config preference profile printer' },
      { label: 'Customers Master', path: '/master/customer', keywords: 'clients people' },
      { label: 'Suppliers Master', path: '/master/supplier', keywords: 'vendors distributors' },
      { label: 'Tax Master', path: '/master/tax', keywords: 'gst vat' },
    ];
    
    const pageMatches = pages.filter(p => 
      p.label.toLowerCase().includes(q.toLowerCase()) || 
      p.keywords.toLowerCase().includes(q.toLowerCase())
    ).map(p => ({
      type: 'page',
      label: p.label,
      sub: `Navigate to ${p.label}`,
      path: p.path,
    }));

    // 2. Item matches from Supabase
    let itemHits = [];
    if (supabase) {
      try {
        const { data: items } = await supabase
          .from('items')
          .select('id, name, code, category, stock_quantity, low_stock_alert')
          .or(`name.ilike.%${q}%,code.ilike.%${q}%,category.ilike.%${q}%`)
          .limit(10);

        itemHits = (items || []).map(item => ({
          type: 'item',
          label: item.name,
          sub: `${item.code || '—'} · ${item.category || ''}`,
          stock: item.stock_quantity,
          low: (item.stock_quantity || 0) <= (item.low_stock_alert || 5),
          path: '/stock',
        }));
      } catch (err) {
        console.warn('Search query error:', err);
      }
    }

    setResults([...pageMatches, ...itemHits]);
    setSearching(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 280);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  /* ── Notifications: Inventory & Stock Alerts ── */
  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const oneMonthFromNow = new Date(today);
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
    const oneMonthStr = oneMonthFromNow.toISOString().split('T')[0];

    try {
      if (supabase) {
        const [expRes, lowRes] = await Promise.all([
          supabase
            .from('items')
            .select('id, name, code, stock_quantity, low_stock_alert, expiry_date')
            .not('expiry_date', 'is', null)
            .neq('expiry_date', '')
            .lte('expiry_date', oneMonthStr)
            .order('expiry_date', { ascending: true }),
          supabase
            .from('items')
            .select('id, name, code, stock_quantity, low_stock_alert, expiry_date')
            .lte('stock_quantity', 5)
            .order('stock_quantity', { ascending: true })
            .limit(50)
        ]);

        const expItems = expRes?.data || [];
        const lowItems = lowRes?.data || [];

        const expiryNotifs = expItems.map(item => {
          const expDate = new Date(item.expiry_date + 'T00:00:00');
          const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const isExpired = diffDays < 0;
          const isToday = diffDays === 0;

          let subText = '';
          if (isExpired) {
            subText = `Expired ${Math.abs(diffDays)}d ago (${item.expiry_date})`;
          } else if (isToday) {
            subText = `Expiring TODAY (${item.expiry_date})`;
          } else {
            subText = `Expiring in ${diffDays} day${diffDays === 1 ? '' : 's'} (${item.expiry_date})`;
          }

          return {
            id: `${item.id}-exp`,
            itemId: item.id,
            title: item.name,
            sub: subText,
            code: item.code,
            expiry_date: item.expiry_date,
            diffDays,
            type: isExpired ? 'expired' : 'expiry',
            urgency: isExpired ? 'critical' : (diffDays <= 7 ? 'high' : 'medium')
          };
        });

        const lowNotifs = lowItems
          .filter(item => (item.stock_quantity || 0) <= (item.low_stock_alert || 5))
          .map(item => ({
            id: `${item.id}-qty`,
            itemId: item.id,
            title: item.name,
            sub: `Stock Low: ${(item.stock_quantity || 0).toFixed(0)} units remaining`,
            code: item.code,
            type: 'low_stock',
            urgency: (item.stock_quantity || 0) <= 0 ? 'critical' : 'medium'
          }));

        setNotifications([...expiryNotifs, ...lowNotifs]);
      }
    } catch (err) {
      console.warn('Error fetching notifications:', err);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  // Fetch notifications on mount and refresh periodically
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  /* Close dropdowns on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearchSelect = (item) => {
    navigate(item.path);
    setQuery('');
    setResults([]);
    setSearchOpen(false);
  };

  const toggleNotif = () => {
    if (!notifOpen) fetchNotifications();
    setNotifOpen(v => !v);
  };

  return (
    <header style={{
      height: '68px',
      backgroundColor: 'var(--c-bg-card)',
      borderBottom: '1px solid var(--c-border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 1.25rem 0 2rem',
      position: 'sticky',
      top: 0,
      zIndex: 40,
      gap: '1rem',
    }}>
      {/* Mobile Hamburger */}
      <button 
        onClick={onMenuClick}
        className="mobile-only"
        style={{
          padding: '8px',
          marginLeft: '-1rem',
          color: 'var(--c-text-primary)',
          cursor: 'pointer',
          background: 'none',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Menu size={24} />
      </button>

      {/* Page title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
        <h1 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 800, color: 'var(--c-text-primary)', whiteSpace: 'nowrap' }}>
          {getPageTitle()}
        </h1>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* ── Search ── */}
      <div ref={searchRef} style={{ position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{
            position: 'absolute', left: '10px', top: '50%',
            transform: 'translateY(-50%)', color: 'var(--c-text-secondary)', pointerEvents: 'none'
          }} />
          <input
            id="global-search"
            type="text"
            placeholder="Search items, users, pages…"
            autoComplete="off"
            value={query}
            onFocus={() => setSearchOpen(true)}
            onChange={e => { setQuery(e.target.value); setSearchOpen(true); }}
            style={{
              paddingLeft: '2.2rem',
              paddingRight: query ? '2rem' : '0.75rem',
              paddingTop: '0.45rem',
              paddingBottom: '0.45rem',
              borderRadius: '99px',
              border: `1.5px solid ${searchOpen ? 'var(--c-wave)' : 'var(--c-border)'}`,
              backgroundColor: 'var(--c-bg)',
              width: '260px',
              fontSize: '0.85rem',
              fontWeight: 500,
              outline: 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              boxShadow: searchOpen ? '0 0 0 3px rgba(37,99,235,0.12)' : 'none',
            }}
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); }}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-secondary)', padding: '2px', lineHeight: 0 }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Search dropdown */}
        {searchOpen && (query || results.length > 0) && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            width: '320px',
            background: 'white',
            border: '1px solid var(--c-border)',
            borderRadius: '0.75rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            overflow: 'hidden',
            zIndex: 100,
          }}>
            {searching && (
              <div style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--c-text-secondary)' }}>
                Searching…
              </div>
            )}

            {!searching && results.length === 0 && query && (
              <div style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--c-text-secondary)' }}>
                No results for "{query}"
              </div>
            )}

            {!searching && results.length > 0 && (
              <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                {results.some(r => r.type === 'page') && (
                  <>
                    <div style={{ padding: '0.4rem 1rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--c-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', background: 'var(--c-bg)' }}>
                      Workstation Pages
                    </div>
                    {results.filter(r => r.type === 'page').map((r, i) => (
                      <button key={`page-${i}`} onClick={() => handleSearchSelect(r)} style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem',
                        padding: '0.6rem 1rem', background: 'none', border: 'none', cursor: 'pointer',
                        textAlign: 'left', transition: 'background 0.1s', borderBottom: '1px solid var(--c-border)'
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        <ExternalLink size={14} color="var(--c-wave)" style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--c-text-primary)' }}>{r.label}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--c-text-secondary)' }}>{r.sub}</div>
                        </div>
                      </button>
                    ))}
                  </>
                )}

                {results.some(r => r.type === 'item') && (
                  <>
                    <div style={{ padding: '0.4rem 1rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--c-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', background: 'var(--c-bg)' }}>
                      Products
                    </div>
                    {results.filter(r => r.type === 'item').map((r, i) => (
                      <button key={`item-${i}`} onClick={() => handleSearchSelect(r)} style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem',
                        padding: '0.6rem 1rem', background: 'none', border: 'none', cursor: 'pointer',
                        textAlign: 'left', transition: 'background 0.1s', borderBottom: '1px solid var(--c-border)'
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        <Package size={14} color={r.low ? 'var(--c-danger)' : 'var(--c-olive)'} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--c-text-primary)' }}>{r.label}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--c-text-secondary)' }}>{r.sub}</div>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Notification Bell with Activities Stream ── */}
      <div ref={notifRef} style={{ position: 'relative' }}>
        <button
          id="notif-bell-btn"
          onClick={toggleNotif}
          title="Inventory & Stock Alerts"
          style={{
            position: 'relative', 
            padding: '8px',
            color: notifOpen ? 'var(--c-wave)' : 'var(--c-text-secondary)',
            background: notifOpen ? 'var(--c-bg)' : 'none',
            border: 'none', 
            borderRadius: '10px', 
            cursor: 'pointer',
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg)'}
          onMouseLeave={e => { if (!notifOpen) e.currentTarget.style.background = 'none'; }}
        >
          <Bell size={20} />

          {/* Badge indicator */}
          {notifications.length > 0 && (
            <span style={{
              position: 'absolute', top: '2px', right: '2px',
              minWidth: '18px', height: '18px',
              backgroundColor: 'var(--c-wave)', 
              color: 'white',
              borderRadius: '99px', border: '2px solid white',
              fontSize: '0.65rem', fontWeight: 900,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, padding: '0 3px',
            }}>
              {notifications.length > 9 ? '9+' : notifications.length}
            </span>
          )}
        </button>

        {/* Notification panel */}
        {notifOpen && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 'min(400px, calc(100vw - 32px))',
            background: 'white',
            border: '1.5px solid var(--c-border)',
            borderRadius: '1rem',
            boxShadow: '0 15px 35px -5px rgba(0,0,0,0.2)',
            overflow: 'hidden',
            zIndex: 100,
          }}>
            {/* Header */}
            <div style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--c-border)',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Package size={17} color="var(--c-wave)" />
                <span>Inventory & Stock Alerts ({notifications.length})</span>
              </span>
              <button onClick={() => setNotifOpen(false)}
                style={{ color: 'var(--c-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', lineHeight: 0 }}>
                <X size={16} />
              </button>
            </div>

            {/* Notification Body: Inventory & Expiry Alerts */}
            <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--c-text-secondary)' }}>
                  <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>✅</div>
                  <div style={{ fontWeight: 700, color: 'var(--c-text-primary)' }}>All items in stock & fresh!</div>
                  <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>No low stock or expiry warnings found.</div>
                </div>
              ) : (
                notifications.map((n) => {
                  const isExp = n.type === 'expiry' || n.type === 'expired';
                  const iconBg = n.type === 'expired' ? '#fee2e2' : (n.type === 'expiry' ? '#ffedd5' : '#f0fdf4');
                  const iconColor = n.type === 'expired' ? '#dc2626' : (n.type === 'expiry' ? '#ea580c' : 'var(--c-olive)');

                  return (
                    <button
                      key={n.id}
                      onClick={() => {
                        const targetFilter = n.type === 'expired' ? 'EXPIRED' : (n.type === 'expiry' ? 'EXPIRING' : 'LOW');
                        navigate('/stock', { state: { filter: targetFilter, search: n.title } });
                        setNotifOpen(false);
                      }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                        padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer',
                        textAlign: 'left', borderBottom: '1px solid var(--c-border)',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '8px',
                        background: iconBg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        {n.type === 'expired' ? <AlertTriangle size={16} color={iconColor} /> : <Package size={16} color={iconColor} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--c-text-primary)' }}>
                            {n.title}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.73rem', color: isExp ? iconColor : 'var(--c-wave)', marginTop: '2px', fontWeight: 600 }}>
                          {n.sub}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div style={{
              borderTop: '1px solid var(--c-border)',
              padding: '0.75rem 1rem',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <button
                onClick={() => { navigate('/stock'); setNotifOpen(false); }}
                style={{ fontSize: '0.78rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 800 }}
              >
                Stock Verification →
              </button>
              <button
                onClick={() => { fetchNotifications(); }}
                style={{ fontSize: '0.75rem', color: 'var(--c-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                Refresh
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
