import { Bell, Search, X, AlertTriangle, Package, ExternalLink, Menu, Printer } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabaseClient';
import { checkPrintServer } from '../../utils/printService';

const Header = ({ onMenuClick }) => {
  const location = useLocation();
  const navigate = useNavigate();

  /* search state */
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef(null);

  /* notifications state */
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifRef = useRef(null);

  /* printer status state */
  const [printerOnline, setPrinterOnline] = useState(false);
  const [checkingPrinter, setCheckingPrinter] = useState(false);

  const checkPrinter = useCallback(async () => {
    setCheckingPrinter(true);
    const status = await checkPrintServer();
    setPrinterOnline(status.online);
    setCheckingPrinter(false);
  }, []);

  const wakeUpPrinter = () => {
    // Opening the local health endpoint in a small popup "wakes up" the browser's 
    // permission to talk to the local network (127.0.0.1) from an HTTPS origin.
    const win = window.open('http://127.0.0.1:6789/health', 'printer_fix', 'width=100,height=100,top=100,left=100');
    if (win) {
      setTimeout(() => {
        win.close(); 
        checkPrinter();
      }, 1000);
    } else {
      alert("Popup blocked! Please allow popups for this site or open http://127.0.0.1:6789/health manually once.");
    }
  };

  useEffect(() => {
    checkPrinter();
    const interval = setInterval(checkPrinter, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, [checkPrinter]);

  const getPageTitle = () => {
    const paths = [
      { label: 'Dashboard', path: '/' },
      { label: 'Point of Sale (POS)', path: '/sales' },
      { label: 'Purchase Entry', path: '/purchase' },
      { label: 'Stock Verification', path: '/stock' },
      { label: 'Business Reports', path: '/reports' },
      { label: 'System Settings', path: '/settings' },
      { label: 'Customers', path: '/master/customer' },
      { label: 'Suppliers', path: '/master/supplier' },
      { label: 'Taxes', path: '/master/tax' },
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
      { label: 'Dashboard', path: '/', keywords: 'home main' },
      { label: 'Point of Sale (POS)', path: '/sales', keywords: 'sell billing invoice' },
      { label: 'Purchase Entry', path: '/purchase', keywords: 'buy supplier bill' },
      { label: 'Stock Verification', path: '/stock', keywords: 'inventory items master' },
      { label: 'Business Reports', path: '/reports', keywords: 'analytics sales purchase history' },
      { label: 'Marketing Dashboard', path: '/marketing', keywords: 'campaigns ads promotion' },
      { label: 'System Settings', path: '/settings', keywords: 'config preference profile' },
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
    const { data: items } = await supabase
      .from('items')
      .select('id, name, code, category, stock_quantity, low_stock_alert')
      .or(`name.ilike.%${q}%,code.ilike.%${q}%,category.ilike.%${q}%`)
      .limit(10);

    const itemHits = (items || []).map(item => ({
      type: 'item',
      label: item.name,
      sub: `${item.code || '—'} · ${item.category || ''}`,
      stock: item.stock_quantity,
      low: (item.stock_quantity || 0) <= (item.low_stock_alert || 5),
      path: '/stock',
    }));

    setResults([...pageMatches, ...itemHits]);
    setSearching(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 280);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  /* ── Notifications: low-stock items ── */
  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    const { data } = await supabase
      .from('items')
      .select('id, name, code, stock_quantity, low_stock_alert')
      .order('stock_quantity', { ascending: true })
      .limit(20);

    const lowStock = (data || []).filter(
      item => (item.stock_quantity || 0) <= (item.low_stock_alert || 5)
    );

    setNotifications(lowStock.map(item => ({
      id: item.id,
      title: item.name,
      sub: `Stock: ${(item.stock_quantity || 0).toFixed(2)} (Alert at ${item.low_stock_alert || 5})`,
      code: item.code,
      type: 'low_stock',
    })));
    setNotifLoading(false);
  }, []);

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
      padding: '0 1rem 0 2rem',
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
      <h1 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 600, color: 'var(--c-text-primary)', flexShrink: 0, whiteSpace: 'nowrap' }}>
        {getPageTitle()}
      </h1>

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
            placeholder="Search items, pages…"
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
              width: '240px',
              fontSize: '0.85rem',
              fontWeight: 400,
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
            right: 0,
            width: '340px',
            background: 'white',
            border: '1px solid var(--c-border)',
            borderRadius: '0.75rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            overflow: 'hidden',
            zIndex: 100,
          }}>
            {searching && (
              <div style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--c-text-secondary)' }}>Searching…</div>
            )}
            {!searching && results.length === 0 && query && (
              <div style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'var(--c-text-secondary)' }}>No results for "<strong>{query}</strong>"</div>
            )}
            {!searching && results.length > 0 && (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {results.some(r => r.type === 'page') && (
                  <>
                    <div style={{ padding: '0.4rem 1rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--c-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', background: 'var(--c-bg)' }}>
                      Pages
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
                      Items
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
                        {r.low && (
                          <span style={{ fontSize: '0.7rem', background: '#fee2e2', color: 'var(--c-danger)', padding: '2px 6px', borderRadius: '99px', fontWeight: 700, flexShrink: 0 }}>
                            Low
                          </span>
                        )}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Printer Status ── */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={printerOnline ? checkPrinter : wakeUpPrinter}
          title={printerOnline ? "Printer: Online" : "Printer: Offline (Click to fix)"}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--c-border)',
            background: printerOnline ? '#f0fdf4' : '#fef2f2',
            color: printerOnline ? '#166534' : '#991b1b',
            cursor: 'pointer', transition: 'all 0.2s',
            fontSize: '0.75rem', fontWeight: 700
          }}
        >
          <Printer size={16} />
          <span style={{ 
            width: 8, height: 8, borderRadius: '50%', 
            background: printerOnline ? '#22c55e' : '#ef4444',
            boxShadow: printerOnline ? '0 0 8px #22c55e' : 'none'
          }} />
          {!printerOnline && <span className="desktop-only">Connect Printer</span>}
        </button>
      </div>

      {/* ── Notification Bell ── */}
      <div ref={notifRef} style={{ position: 'relative' }}>
        <button
          id="notif-bell-btn"
          onClick={toggleNotif}
          style={{
            position: 'relative', padding: '6px',
            color: notifOpen ? 'var(--c-wave)' : 'var(--c-text-secondary)',
            background: notifOpen ? 'var(--c-bg)' : 'none',
            border: 'none', borderRadius: '8px', cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg)'}
          onMouseLeave={e => { if (!notifOpen) e.currentTarget.style.background = 'none'; }}
        >
          <Bell size={20} />
          {notifications.length > 0 && (
            <span style={{
              position: 'absolute', top: '2px', right: '2px',
              minWidth: '16px', height: '16px',
              backgroundColor: 'var(--c-danger)', color: 'white',
              borderRadius: '99px', border: '2px solid white',
              fontSize: '0.6rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, padding: '0 2px',
            }}>
              {notifications.length > 9 ? '9+' : notifications.length}
            </span>
          )}
        </button>

        {/* Notification panel */}
        {notifOpen && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: '320px',
            background: 'white',
            border: '1px solid var(--c-border)',
            borderRadius: '0.75rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            overflow: 'hidden',
            zIndex: 100,
          }}>
            {/* Header */}
            <div style={{
              padding: '0.85rem 1rem',
              borderBottom: '1px solid var(--c-border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--c-bg)',
            }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--c-text-primary)' }}>
                Notifications
              </span>
              <button onClick={() => setNotifOpen(false)}
                style={{ color: 'var(--c-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', lineHeight: 0 }}>
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
              {notifLoading && (
                <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.82rem', color: 'var(--c-text-secondary)' }}>
                  Loading…
                </div>
              )}
              {!notifLoading && notifications.length === 0 && (
                <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.82rem', color: 'var(--c-text-secondary)' }}>
                  ✅ All stock levels are fine
                </div>
              )}
              {!notifLoading && notifications.length > 0 && (
                <>
                  <div style={{ padding: '0.5rem 1rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--c-danger)', textTransform: 'uppercase', letterSpacing: '0.07em', background: '#fff5f5' }}>
                    ⚠ Low Stock Alerts ({notifications.length})
                  </div>
                  {notifications.map((n, i) => (
                    <button
                      key={n.id}
                      onClick={() => { navigate('/stock'); setNotifOpen(false); }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                        padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer',
                        textAlign: 'left', borderBottom: i < notifications.length - 1 ? '1px solid var(--c-border)' : 'none',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#fff5f5'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '8px',
                        background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        <AlertTriangle size={16} color="var(--c-danger)" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--c-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--c-danger)', marginTop: '2px' }}>{n.sub}</div>
                        {n.code && <div style={{ fontSize: '0.68rem', color: 'var(--c-text-secondary)' }}>Code: {n.code}</div>}
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1px solid var(--c-border)', padding: '0.6rem 1rem', background: 'var(--c-bg)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { fetchNotifications(); }}
                style={{ fontSize: '0.75rem', color: 'var(--c-wave)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
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
