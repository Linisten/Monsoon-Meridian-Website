import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, ShoppingCart, ShoppingBag, ClipboardList, 
  TrendingUp, Settings, Users, FileText, LogOut, Megaphone, 
  Barcode, UserCog, Activity, Shield
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getActivities } from '../../utils/activityService';
import logoUrl from '../../assets/logo.jpg';

const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [activityCount, setActivityCount] = useState(0);

  // Fetch and listen for live activity notification count
  useEffect(() => {
    let isMounted = true;
    const updateCount = async () => {
      try {
        const acts = await getActivities({ timeframe: 'ALL' });
        if (isMounted) {
          setActivityCount(acts.length);
        }
      } catch {
        // quiet fallback
      }
    };

    updateCount();
    window.addEventListener('mm_activity_logged', updateCount);
    const interval = setInterval(updateCount, 15000);
    return () => {
      isMounted = false;
      window.removeEventListener('mm_activity_logged', updateCount);
      clearInterval(interval);
    };
  }, []);

  // Handle click on mobile
  const handleItemClick = () => {
    if (window.innerWidth <= 1024) onClose();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Base navigation items available to regular staff users
  const baseNavItems = [
    { path: '/', label: 'Overview', icon: <LayoutDashboard size={20} /> },
    { path: '/sales', label: 'Sales (POS)', icon: <ShoppingCart size={20} /> },
    { path: '/purchase', label: 'Purchase', icon: <ShoppingBag size={20} /> },
    { path: '/stock', label: 'Stock Ver.', icon: <ClipboardList size={20} /> },
    { path: '/reports', label: 'Reports', icon: <TrendingUp size={20} /> },
    { path: '/master/customer', label: 'Customers', icon: <Users size={20} /> },
    { path: '/barcode', label: 'Barcode Print', icon: <Barcode size={20} /> },
    { path: '/settings', label: 'Settings', icon: <Settings size={20} /> },
  ];

  // Admin exclusive navigation items (Taxes, Marketing, Users, Activities)
  const adminNavItems = [
    { path: '/master/tax', label: 'Taxes', icon: <FileText size={20} />, badge: 'Admin' },
    { path: '/marketing', label: 'Marketing', icon: <Megaphone size={20} />, badge: 'Admin' },
    { path: '/users', label: 'Users', icon: <UserCog size={20} />, badge: 'Admin' },
    { 
      path: '/activities', 
      label: 'Activities', 
      icon: <Activity size={20} />, 
      badge: activityCount.toString(),
      isCountBadge: true
    },
  ];

  const navItems = isAdmin 
    ? [...baseNavItems, ...adminNavItems] 
    : baseNavItems;

  const sidebarStyle = {
    width: '260px',
    height: '100%',
    backgroundColor: 'var(--c-bg-card)',
    borderRight: '1px solid var(--c-border)',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 'var(--shadow-md)',
    zIndex: 100,
    transition: 'transform 0.3s ease',
  };

  return (
    <aside 
      style={sidebarStyle} 
      className={`sidebar-container ${isOpen ? 'open' : ''}`}
    >
      <style>{`
        @media (max-width: 1024px) {
          .sidebar-container {
            position: fixed !important;
            left: 0;
            top: 0;
            bottom: 0;
            transform: translateX(-100%);
          }
          .sidebar-container.open {
            transform: translateX(0);
          }
        }
      `}</style>
      
      {/* Brand Section with Logo */}
      <div style={{ padding: '1.5rem 1.25rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <img 
          src={logoUrl} 
          alt="Monsoon Meridian Logo" 
          style={{ width: '100%', maxWidth: '180px', height: 'auto', objectFit: 'contain' }} 
        />
      </div>

      <nav style={{ flex: 1, padding: '0 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', overflowY: 'auto' }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={handleItemClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.7rem 1rem',
                borderRadius: 'var(--radius-md)',
                color: isActive ? 'white' : 'var(--c-text-secondary)',
                backgroundColor: isActive ? 'var(--c-olive)' : 'transparent',
                fontWeight: isActive ? 600 : 500,
                transition: 'var(--transition)',
                textDecoration: 'none',
                position: 'relative'
              }}
            >
              {item.icon}
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge !== undefined && item.badge !== null && item.badge !== '' && (
                <span style={{
                  padding: item.isCountBadge ? '1px 8px' : '1px 6px',
                  borderRadius: item.isCountBadge ? '999px' : '4px',
                  fontSize: item.isCountBadge ? '0.72rem' : '0.65rem',
                  fontWeight: 800,
                  background: isActive ? 'rgba(255,255,255,0.25)' : '#eff6ff',
                  color: isActive ? 'white' : '#2563eb',
                  minWidth: item.isCountBadge ? '22px' : 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1.2
                }}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Info + Logout */}
      <div style={{ marginTop: 'auto', padding: '1rem 0.75rem 0.75rem', borderTop: '1px solid var(--c-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{
            width: '36px', height: '36px',
            backgroundColor: isAdmin ? '#10b981' : '#2563eb',
            color: 'white',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '0.95rem', flexShrink: 0,
            boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
          }}>
            {(user?.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--c-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name || 'Staff User'}
            </span>
            <span style={{ fontSize: '0.72rem', color: isAdmin ? '#059669' : '#2563eb', fontWeight: 700, textTransform: 'uppercase' }}>
              {user?.role || 'Staff'}
            </span>
          </div>
        </div>
        <button
          id="sidebar-logout-btn"
          onClick={handleLogout}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
            padding: '0.65rem 1rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid #fee2e2',
            backgroundColor: '#fff1f2',
            color: 'var(--c-danger)',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'var(--transition)',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fee2e2'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#fff1f2'; }}
        >
          <LogOut size={16} /> Logout Workstation
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
