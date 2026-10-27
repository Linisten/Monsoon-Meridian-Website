import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MonitorSmartphone, ShoppingCart, ClipboardCheck, 
  FileText, BarChart2, PieChart, Activity, FileSpreadsheet,
  Building, Store, Users, Truck, Receipt, Ruler, Package, Tags, Box,
  Calendar, Settings, UserCog, Briefcase, TrendingUp, IndianRupee,
  Bell, Info, ArrowUpCircle, ChevronDown
} from 'lucide-react';
import { supabase } from '../config/supabaseClient';
import { fetchAllRecords } from '../utils/transactionUtils';
import { useAuth } from '../context/AuthContext';
import { getAllUsers } from '../utils/userService';
import { getUserStock, syncRemoteUserStocks } from '../utils/stockService';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user: currentUser, isAdmin } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [loading, setStatusLoading] = useState(true);

  // 1. Admin Shop Stats (Current Stocks & Sales)
  const [adminStats, setAdminStats] = useState({
    totalSales: 0,
    totalPurchases: 0,
    grossProfit: 0,
    stockValue: 0
  });

  // 2. Individual Staff Users' Shop Stats
  const [userShopsStats, setUserShopsStats] = useState([]);

  // 3. Overall Combined Stats (Admin + All Users)
  const [overallStats, setOverallStats] = useState({
    totalSales: 0,
    totalPurchases: 0,
    grossProfit: 0,
    stockValue: 0
  });

  useEffect(() => {
    fetchLiveStats();
  }, []);

  const fetchLiveStats = async () => {
    setStatusLoading(true);
    
    // Sync remote stock records into local cache
    await syncRemoteUserStocks();

    // Get ISO string for the 1st of the current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    
    const [salesData, purchasesData, itemsRes, allUsers] = await Promise.all([
      fetchAllRecords(
        'sales',
        'created_at',
        false,
        '*',
        q => q.gte('created_at', startOfMonth)
      ),
      fetchAllRecords(
        'purchases',
        'created_at',
        false,
        '*',
        q => q.gte('created_at', startOfMonth)
      ),
      supabase.from('items').select('id, price, cost_price, stock_quantity'),
      getAllUsers()
    ]);

    const sales = salesData || [];
    const purchases = purchasesData || [];
    const items = itemsRes.data || [];
    const staffUsers = (allUsers || []).filter(u => u.role !== 'Admin');
    setUsersList(staffUsers);

    // Helper to calculate profit for a set of sales
    const calcSalesMetrics = (salesList) => {
      let totalSales = 0;
      let totalProfit = 0;
      salesList.forEach(sale => {
        totalSales += (sale.total_amount || 0);
        const saleItems = sale.items_json || [];
        let saleCost = 0;
        saleItems.forEach(it => {
          const qty = it.qty || 0;
          const cost = it.cost_price || 0;
          saleCost += (qty * cost);
        });
        totalProfit += ((sale.total_amount || 0) - saleCost);
      });
      return { totalSales, totalProfit };
    };

    // Helper to check if a purchase belongs to a specific staff user
    const doesPurchaseMatchUser = (p, u) => {
      if (p.target_user_id === u.id) return true;
      const uName = (u.name || '').toLowerCase();
      const uUname = (u.username || '').toLowerCase();
      const pTarget = (p.target_user_name || '').toLowerCase();
      if (pTarget && (pTarget === uName || pTarget === uUname)) return true;
      if (Array.isArray(p.items_json)) {
        return p.items_json.some(it => 
          it.target_user_id === u.id || 
          (it.target_user_name && (it.target_user_name.toLowerCase() === uName || it.target_user_name.toLowerCase() === uUname))
        );
      }
      return false;
    };

    // 1. Admin Shop Stats (Exclude anything explicitly belonging to staff shops)
    const adminSales = sales.filter(s => {
      if (s.user_id && s.user_id !== 'admin' && s.user_id !== 'usr-admin-01') {
        const isStaff = staffUsers.some(u => u.id === s.user_id);
        if (isStaff) return false;
      }
      if (s.user_name && s.user_name.toLowerCase() !== 'admin') {
        const isStaff = staffUsers.some(u => (u.name && u.name.toLowerCase() === s.user_name.toLowerCase()) || (u.username && u.username.toLowerCase() === s.user_name.toLowerCase()));
        if (isStaff) return false;
      }
      return true;
    });

    const adminPurchases = purchases.filter(p => {
      const isStaff = staffUsers.some(u => doesPurchaseMatchUser(p, u));
      return !isStaff;
    });

    const adminSalesMetrics = calcSalesMetrics(adminSales);
    const adminPurchasesTotal = adminPurchases.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
    const adminStockValue = items.reduce((acc, curr) => acc + ((curr.price || 0) * (curr.stock_quantity || 0)), 0);

    setAdminStats({
      totalSales: adminSalesMetrics.totalSales,
      totalPurchases: adminPurchasesTotal,
      grossProfit: adminSalesMetrics.totalProfit,
      stockValue: adminStockValue
    });

    // 2. Individual Staff Users' Shop Stats
    const usersMetrics = staffUsers.map(u => {
      const uSales = sales.filter(s => s.user_id === u.id || (s.user_name && (s.user_name.toLowerCase() === (u.name || '').toLowerCase() || s.user_name.toLowerCase() === (u.username || '').toLowerCase())));
      const uPurchases = purchases.filter(p => doesPurchaseMatchUser(p, u));
      const uSalesMetrics = calcSalesMetrics(uSales);
      const uPurchasesTotal = uPurchases.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
      const uStockValue = items.reduce((acc, curr) => {
        const uStock = getUserStock(u.id, curr.id, 0, false);
        return acc + ((curr.price || 0) * uStock);
      }, 0);

      return {
        user: u,
        totalSales: uSalesMetrics.totalSales,
        totalPurchases: uPurchasesTotal,
        grossProfit: uSalesMetrics.totalProfit,
        stockValue: uStockValue
      };
    });
    setUserShopsStats(usersMetrics);

    // 3. Overall Combined Stats (Admin + All Users)
    const allSalesMetrics = calcSalesMetrics(sales);
    const allPurchasesTotal = purchases.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
    const totalUsersStockValue = usersMetrics.reduce((acc, um) => acc + um.stockValue, 0);
    const combinedStockValue = adminStockValue + totalUsersStockValue;

    setOverallStats({
      totalSales: allSalesMetrics.totalSales,
      totalPurchases: allPurchasesTotal,
      grossProfit: allSalesMetrics.totalProfit,
      stockValue: combinedStockValue
    });

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
          {loading ? '...' : (isCurrency ? `₹ ${Math.round(value).toLocaleString('en-IN')}` : Math.round(value))}
        </span>
      </div>
    </div>
  );

  const currentStaffMetric = !isAdmin && userShopsStats.find(um => 
    (currentUser?.id && um.user.id === currentUser.id) || 
    (currentUser?.username && um.user.username && um.user.username.toLowerCase() === currentUser.username.toLowerCase()) || 
    (currentUser?.name && um.user.name && um.user.name.toLowerCase() === currentUser.name.toLowerCase())
  );

  const displayedStats = isAdmin ? adminStats : (currentStaffMetric || {
    totalSales: 0,
    totalPurchases: 0,
    grossProfit: 0,
    stockValue: 0
  });

  return (
    <div style={{ paddingBottom: '2rem', paddingTop: '1.5rem' }}>
      

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: showDropdown ? '1rem' : '2rem' }}>
        <div className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ color: 'var(--c-info)' }}><IndianRupee size={32} /></div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--c-text-secondary)', fontWeight: 600 }}>This Month's Sales</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{loading ? '...' : `₹${Math.round(displayedStats.totalSales).toLocaleString('en-IN')}`}</div>
          </div>
        </div>
        <div className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ color: 'var(--c-success)' }}><ShoppingCart size={32} /></div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--c-text-secondary)', fontWeight: 600 }}>This Month's Purchases</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{loading ? '...' : `₹${Math.round(displayedStats.totalPurchases).toLocaleString('en-IN')}`}</div>
          </div>
        </div>
        <div className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ color: displayedStats.grossProfit >= 0 ? 'var(--c-success)' : 'var(--c-danger)' }}>
            {displayedStats.grossProfit >= 0 ? <TrendingUp size={32} /> : <ArrowUpCircle size={32} style={{ transform: 'rotate(180deg)' }} />}
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--c-text-secondary)', fontWeight: 600 }}>Monthly Gross Profit</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: displayedStats.grossProfit >= 0 ? 'var(--c-success)' : 'var(--c-danger)' }}>
              {loading ? '...' : `₹${Math.round(displayedStats.grossProfit).toLocaleString('en-IN')}`}
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ color: 'var(--c-earth)' }}><Package size={32} /></div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--c-text-secondary)', fontWeight: 600 }}>Current Stock Value</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{loading ? '...' : `₹${Math.round(displayedStats.stockValue).toLocaleString('en-IN')}`}</div>
            </div>
          </div>
          {/* Dropdown Symbol Button (Admin Dashboard Only) */}
          {isAdmin && (
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              title={showDropdown ? "Collapse shop breakdown" : "View individual users & overall shops breakdown"}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '42px',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                background: showDropdown ? '#f1f5f9' : 'white',
                color: '#0f172a',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                flexShrink: 0
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.background = '#f8fafc'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = showDropdown ? '#f1f5f9' : 'white'; }}
            >
              <ChevronDown size={20} style={{ transform: showDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
          )}
        </div>
      </div>

      {/* ── EXPANDABLE SHOP BREAKDOWN (Admin Only, revealed on clicking dropdown button) ── */}
      {isAdmin && showDropdown && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          marginBottom: '2rem',
          padding: '1.5rem',
          background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
          borderRadius: '20px',
          border: '1.5px dashed #cbd5e1',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Store size={20} color="#0f766e" />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                Multi-Shop Performance Breakdown
              </h3>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
              Individual Staff Shops & Combined Total
            </span>
          </div>

          {/* Line for each existing user */}
          {userShopsStats.map((item, idx) => (
            <div key={item.user.id || idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9rem', color: '#334155' }}>
                <Store size={16} color="#2563eb" />
                <span>🏪 {item.user.name}'s Shop</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>@{item.user.username}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                {/* 1. Sales */}
                <div className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', background: 'white' }}>
                  <div style={{ color: 'var(--c-info)' }}><IndianRupee size={28} /></div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--c-text-secondary)', fontWeight: 600 }}>This Month's Sales</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800 }}>₹{Math.round(item.totalSales).toLocaleString('en-IN')}</div>
                  </div>
                </div>
                {/* 2. Purchases */}
                <div className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', background: 'white' }}>
                  <div style={{ color: 'var(--c-success)' }}><ShoppingCart size={28} /></div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--c-text-secondary)', fontWeight: 600 }}>This Month's Purchases</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800 }}>₹{Math.round(item.totalPurchases).toLocaleString('en-IN')}</div>
                  </div>
                </div>
                {/* 3. Gross Profit */}
                <div className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', background: 'white' }}>
                  <div style={{ color: item.grossProfit >= 0 ? 'var(--c-success)' : 'var(--c-danger)' }}>
                    {item.grossProfit >= 0 ? <TrendingUp size={28} /> : <ArrowUpCircle size={28} style={{ transform: 'rotate(180deg)' }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--c-text-secondary)', fontWeight: 600 }}>Monthly Gross Profit</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: item.grossProfit >= 0 ? 'var(--c-success)' : 'var(--c-danger)' }}>
                      ₹{Math.round(item.grossProfit).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
                {/* 4. Current Stock Value */}
                <div className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', background: 'white' }}>
                  <div style={{ color: 'var(--c-earth)' }}><Package size={28} /></div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--c-text-secondary)', fontWeight: 600 }}>Current Stock Value</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800 }}>₹{Math.round(item.stockValue).toLocaleString('en-IN')}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Final Line: Overall Shops Overview (Admin + Users Combined) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingTop: '1rem', borderTop: '2px dashed #cbd5e1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
              <Building size={18} color="#0f766e" />
              <span>🌐 Overall Shops Overview (Admin + Users Combined)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {/* 1. Overall Sales */}
              <div className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <div style={{ color: '#2563eb' }}><IndianRupee size={28} /></div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 700 }}>Total Month Sales</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#1e3a8a' }}>₹{Math.round(overallStats.totalSales).toLocaleString('en-IN')}</div>
                </div>
              </div>
              {/* 2. Overall Purchases */}
              <div className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <div style={{ color: '#16a34a' }}><ShoppingCart size={28} /></div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 700 }}>Total Month Purchases</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#14532d' }}>₹{Math.round(overallStats.totalPurchases).toLocaleString('en-IN')}</div>
                </div>
              </div>
              {/* 3. Overall Profit */}
              <div className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', background: '#fefce8', border: '1px solid #fef08a' }}>
                <div style={{ color: overallStats.grossProfit >= 0 ? '#16a34a' : '#dc2626' }}>
                  {overallStats.grossProfit >= 0 ? <TrendingUp size={28} /> : <ArrowUpCircle size={28} style={{ transform: 'rotate(180deg)' }} />}
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#854d0e', fontWeight: 700 }}>Total Gross Profit</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: overallStats.grossProfit >= 0 ? '#166534' : '#dc2626' }}>
                    ₹{Math.round(overallStats.grossProfit).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
              {/* 4. Overall Stock Value */}
              <div className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', background: '#fff7ed', border: '1px solid #fed7aa' }}>
                <div style={{ color: '#ea580c' }}><Package size={28} /></div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#9a3412', fontWeight: 700 }}>Total Stock Value</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#7c2d12' }}>₹{Math.round(overallStats.stockValue).toLocaleString('en-IN')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
