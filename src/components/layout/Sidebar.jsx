import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, ShoppingBag, ClipboardList, TrendingUp, Settings, Users, FileText, LogOut, Megaphone, Barcode } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { logout } = useAuth();
  const navigate = useNavigate();

  // Handle click on mobile
  const handleItemClick = () => {
    if (window.innerWidth <= 1024) onClose();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/', label: 'Overview', icon: <LayoutDashboard size={20} /> },
    { path: '/sales', label: 'Sales (POS)', icon: <ShoppingCart size={20} /> },
    { path: '/purchase', label: 'Purchase', icon: <ShoppingBag size={20} /> },
    { path: '/stock', label: 'Stock Ver.', icon: <ClipboardList size={20} /> },
    { path: '/reports', label: 'Reports', icon: <TrendingUp size={20} /> },
    { path: '/master/customer', label: 'Customers', icon: <Users size={20} /> },
    { path: '/master/tax', label: 'Taxes', icon: <FileText size={20} /> },
    { path: '/marketing', label: 'Marketing', icon: <Megaphone size={20} /> },
    { path: '/barcode', label: 'Barcode Print', icon: <Barcode size={20} /> },
    { path: '/settings', label: 'Settings', icon: <Settings size={20} /> },
  ];

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

  // Mobile overrides using a clever trick: we check window width OR use CSS classes
  // But for simple React, we can just use the prop and let CSS handle the 'display' if we want.
  // Actually, let's use a class to hide/show on mobile.
  
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
      <div style={{ padding: '2rem 1.5rem', display: 'flex', justifyContent: 'center' }}>
        <img 
          src="/logo.jpg" 
          alt="Monsoon Meridian Logo" 
          style={{ width: '100%', maxWidth: '200px', height: 'auto', objectFit: 'contain' }} 
        />
      </div>

      <nav style={{ flex: 1, padding: '0 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
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
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                color: isActive ? 'white' : 'var(--c-text-secondary)',
                backgroundColor: isActive ? 'var(--c-olive)' : 'transparent',
                fontWeight: isActive ? 500 : 400,
                transition: 'var(--transition)',
                textDecoration: 'none',
              }}
            >
              {item.icon}
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div style={{ marginTop: 'auto', padding: '1rem 0.5rem 0', borderTop: '1px solid var(--c-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{
            width: '32px', height: '32px',
            backgroundColor: 'var(--c-wave-light)',
            color: 'var(--c-wave)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 600, fontSize: '0.85rem', flexShrink: 0
          }}>
            A
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--c-text-primary)', whiteSpace: 'nowrap' }}>Admin User</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--c-text-secondary)' }}>Online</span>
          </div>
        </div>
        <button
          id="sidebar-logout-btn"
          onClick={handleLogout}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.65rem 1rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--c-border)',
            backgroundColor: 'transparent',
            color: 'var(--c-danger)',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            transition: 'var(--transition)',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fee2e2'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <LogOut size={16} /> Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
