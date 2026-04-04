import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MonitorSmartphone, ShoppingCart, ClipboardCheck, 
  FileText, BarChart2, PieChart, Activity, FileSpreadsheet,
  Building, Store, Users, Truck, Receipt, Ruler, Package, Tags, Box,
  Calendar, Settings, UserCog, Briefcase, TrendingUp, IndianRupee,
  Bell, Info, ArrowUpCircle
} from 'lucide-react';
import { supabase } from '../config/supabaseClient';

const CURRENT_APP_VERSION = '1.0.0';

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalSales: 0,
    totalPurchases: 0,
    grossProfit: 0,
    stockValue: 0
  });
  const [updateInfo, setUpdateInfo] = useState(null);
  const [loading, setStatusLoading] = useState(true);

  useEffect(() => {
    fetchLiveStats();
  }, []);

  const fetchLiveStats = async () => {
    setStatusLoading(true);
    
    // Get ISO string for the 1st of the current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    
    // 1. Fetch This Month's Sales
    const { data: sales } = await supabase
      .from('sales')
      .select('total_amount')
      .gte('created_at', startOfMonth);
    const totalSales = (sales || []).reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
    
    // 2. Fetch This Month's Purchases
    const { data: purchases } = await supabase
      .from('purchases')
      .select('total_amount')
      .gte('created_at', startOfMonth);
    const totalPurchases = (purchases || []).reduce((acc, curr) => acc + (curr.total_amount || 0), 0);

    // 3. Fetch All Items for Stock Value
    const { data: items } = await supabase
      .from('items')
      .select('price, stock_quantity');
    const stockValue = (items || []).reduce((acc, curr) => acc + ((curr.price || 0) * (curr.stock_quantity || 0)), 0);

    setStats({
      totalSales,
      totalPurchases,
      grossProfit: totalSales - totalPurchases,
      stockValue
    });

    // 4. Check for Updates
    const { data: settings } = await supabase.from('settings').select('app_version, update_message').limit(1).single();
    if (settings && settings.app_version !== CURRENT_APP_VERSION) {
      setUpdateInfo(settings);
    }

    setStatusLoading(false);
  };

  const sections = [
    {
      title: 'Applications',
      items: [
        { label: 'POS', icon: <MonitorSmartphone size={32} />, path: '/sales', color: 'var(--c-danger)' },
        { label: 'Purchase', icon: <ShoppingCart size={32} />, path: '/purchase', color: 'var(--c-success)' },
        { label: 'Stock Ver.', icon: <ClipboardCheck size={32} />, path: '/stock', color: 'var(--c-info)' },
      ]
    },
    {
      title: 'Reports',
      items: [
        { label: 'Shop Reports', icon: <Briefcase size={32} />, path: '/reports', color: 'var(--c-wave)' },
        { label: 'Purchase Report', icon: <FileText size={32} />, path: '/reports', color: 'var(--c-warning)' },
        { label: 'Sales Report', icon: <BarChart2 size={32} />, path: '/reports', color: 'var(--c-danger)' },
        { label: 'Inventory', icon: <PieChart size={32} />, path: '/reports', color: 'var(--c-success)' },
        { label: 'Transactions', icon: <Activity size={32} />, path: '/reports', color: 'var(--c-olive)' },
      ]
    },
    {
      title: 'Masters',
      items: [
        { label: 'Company', icon: <Building size={32} />, path: '/master/company', color: 'var(--c-info)' },
        { label: 'Shop', icon: <Store size={32} />, path: '/master/shop', color: 'var(--c-warning)' },
        { label: 'Customer', icon: <Users size={32} />, path: '/master/customer', color: 'var(--c-wave)' },
        { label: 'Supplier', icon: <Truck size={32} />, path: '/master/supplier', color: 'var(--c-olive)' },
        { label: 'Tax', icon: <Receipt size={32} />, path: '/master/tax', color: 'var(--c-danger)' },
        { label: 'Unit', icon: <Ruler size={32} />, path: '/master/unit', color: 'var(--c-earth)' },
        { label: 'Pack Type', icon: <Package size={32} />, path: '/master/packtype', color: 'var(--c-warning)' },
        { label: 'Item Category', icon: <Tags size={32} />, path: '/master/category', color: 'var(--c-wave)' },
        { label: 'Item Master', icon: <Box size={32} />, path: '/stock', color: 'var(--c-warning)' },
      ]
    },
    {
      title: 'Settings & User',
      items: [
        { label: 'Date', icon: <Calendar size={32} />, path: '/master/date', color: 'var(--c-danger)' },
        { label: 'Company Set.', icon: <Settings size={32} />, path: '/settings', color: 'var(--c-earth)' },
        { label: 'Shop Settings', icon: <Settings size={32} />, path: '/settings', color: 'var(--c-text-secondary)' },
        { label: 'User Mgmt', icon: <UserCog size={32} />, path: '/master/users', color: 'var(--c-info)' },
      ]
    }
  ];

  const StatCard = ({ icon: Icon, label, value, color, isCurrency = true }) => (
    <div className="card" style={{ flex: 1, padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', minWidth: '220px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ padding: '0.75rem', borderRadius: '12px', backgroundColor: `${color}15`, color }}>
        <Icon size={24} />
      </div>
      <div>
        <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--c-text-secondary)', marginBottom: '0.25rem' }}>{label}</span>
        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
          {loading ? '...' : (isCurrency ? `₹ ${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : value)}
        </span>
      </div>
    </div>
  );

  return (
    <div style={{ paddingBottom: '2rem', paddingTop: '1.5rem' }}>
      
      {/* Update Notification Banner */}
      {updateInfo && (
        <div style={{ 
          marginBottom: '2rem', 
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', 
          borderRadius: '16px', 
          padding: '1.25rem 2rem', 
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 20px 25px -5px rgba(59, 130, 246, 0.25)',
          animation: 'pulse 2s infinite ease-in-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '0.75rem', borderRadius: '12px' }}>
              <ArrowUpCircle size={28} />
            </div>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>New Update Available (v{updateInfo.app_version})</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>{updateInfo.update_message || 'New features and improvements are ready for use.'}</div>
            </div>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            style={{ 
              background: 'white', 
              color: '#1d4ed8', 
              border: 'none', 
              padding: '0.75rem 1.5rem', 
              borderRadius: '10px', 
              fontWeight: 800, 
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Refresh Interface
          </button>
        </div>
      )}

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ color: 'var(--c-info)' }}><IndianRupee size={32} /></div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--c-text-secondary)', fontWeight: 600 }}>This Month's Sales</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{loading ? '...' : `₹${stats.totalSales.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}</div>
          </div>
        </div>
        <div className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ color: 'var(--c-success)' }}><ShoppingCart size={32} /></div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--c-text-secondary)', fontWeight: 600 }}>This Month's Purchases</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{loading ? '...' : `₹${stats.totalPurchases.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}</div>
          </div>
        </div>
        <div className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ color: 'var(--c-wave)' }}><TrendingUp size={32} /></div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--c-text-secondary)', fontWeight: 600 }}>Monthly Gross Profit</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{loading ? '...' : `₹${stats.grossProfit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}</div>
          </div>
        </div>
        <div className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ color: 'var(--c-earth)' }}><Package size={32} /></div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--c-text-secondary)', fontWeight: 600 }}>Current Stock Value</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{loading ? '...' : `₹${stats.stockValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}</div>
          </div>
        </div>
      </div>

      {/* App Sections - Row Wise (Refined) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {sections.map((section, idx) => (
          <div key={idx} className="card" style={{ padding: '1.5rem 2rem' }}>
            {/* Section Header */}
            <div style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--c-border)', paddingBottom: '0.75rem' }}>
              <h2 style={{ 
                fontSize: '0.85rem', 
                fontWeight: 700, 
                color: 'var(--c-text-secondary)', 
                margin: 0,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {section.title}
              </h2>
            </div>

            {/* Row Items Area */}
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '1rem',
              alignItems: 'flex-start'
            }}>
              {section.items.map((item, i) => (
                <button
                  key={i}
                  onClick={() => navigate(item.path)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1rem',
                    padding: '1.5rem 1rem',
                    borderRadius: '16px',
                    border: '1px solid var(--c-border)',
                    backgroundColor: 'white',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    width: '120px',
                    height: '110px'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = item.color;
                    e.currentTarget.style.backgroundColor = `${item.color}05`;
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.08)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--c-border)';
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ color: item.color, display: 'flex', alignItems: 'center' }}>
                    {React.cloneElement(item.icon, { size: 32 })}
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, textAlign: 'center', color: 'var(--c-text-primary)' }}>
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
