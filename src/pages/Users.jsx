import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Users as UsersIcon, UserPlus, Trash2, Shield, ShieldAlert, 
  Activity, ArrowLeft, CheckCircle, AlertTriangle, ShoppingCart, 
  ShoppingBag, ClipboardList, TrendingUp, Megaphone, Barcode, 
  Settings as SettingsIcon, FileText, Calendar, Filter, Eye, EyeOff,
  Clock, IndianRupee, Search, RefreshCw, X, Pencil, Package, Store
} from 'lucide-react';
import { supabase } from '../config/supabaseClient';
import { getUserShopStockTotal } from '../utils/stockService';
import { getAllUsers, addUser, updateUser, deleteUser, isUserOnline } from '../utils/userService';
import { getActivities, deleteActivity, ACTIVITY_COLORS } from '../utils/activityService';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';

// Dynamic lazy imports of components for preview in user workspace tabs
import Dashboard from './Dashboard';
import Sales from './Sales';
import Purchase from './Purchase';
import Stock from './Stock';
import Reports from './Reports';
import GenericMaster from './GenericMaster';
import Marketing from './Marketing';
import BarcodeGenerator from './BarcodeGenerator';
import Settings from './Settings';

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

const Users = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, isAdmin } = useAuth();
  const { confirm, alert: showAlert } = useConfirm();

  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [activeTab, setActiveTab] = useState('activities'); // 'activities' default when viewing user

  // Add User Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('Staff');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit User Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('Staff');
  const [editStatus, setEditStatus] = useState('Active');
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Activities filter state
  const [userActivities, setUserActivities] = useState([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [categoryFilter, setCategoryFilter] = useState('ALL'); // 'ALL', 'UNETHICAL', 'SALE', 'PURCHASE', etc.
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [selectedActivityDetail, setSelectedActivityDetail] = useState(null);

  const getCurrentMonthKey = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const getMonthDisplayName = (monthStr) => {
    if (!monthStr) return '';
    const [y, m] = monthStr.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, 1);
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  };

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerViewMode, setCustomerViewMode] = useState('shop_customers'); // 'shop_customers' or 'directory'

  // Shop specific data states for selected user
  const [userShopSales, setUserShopSales] = useState([]);
  const [userShopPurchases, setUserShopPurchases] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [shopDataLoading, setShopDataLoading] = useState(false);
  const [salesSearch, setSalesSearch] = useState('');
  const [purchaseSearch, setPurchaseSearch] = useState('');

  // Fetch users list
  const fetchUsers = async () => {
    setLoading(true);
    const users = await getAllUsers();
    setUsersList(users);

    if (userId) {
      const target = users.find(u => u.id === userId);
      if (target) {
        setSelectedUser(target);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, [userId]);

  // Load activities when selected user, date range, or category changes
  const fetchUserActivities = async () => {
    if (!selectedUser) return;
    setActivitiesLoading(true);
    const acts = await getActivities({
      userId: selectedUser.id,
      startDate: startDate,
      endDate: endDate,
      type: categoryFilter
    });
    setUserActivities(acts);
    setActivitiesLoading(false);
  };

  // Load shop specific data (sales, purchases, stock) for selected user
  const fetchUserShopData = async () => {
    if (!selectedUser) return;
    setShopDataLoading(true);
    try {
      const isSelectedAdmin = 
        selectedUser.role?.toLowerCase() === 'admin' || 
        selectedUser.username?.toLowerCase() === 'admin' ||
        selectedUser.id === 'usr-admin-01';

      const [salesRes, purchRes, itemsRes] = await Promise.all([
        supabase.from('sales').select('*').order('created_at', { ascending: false }),
        supabase.from('purchases').select('*').order('created_at', { ascending: false }),
        supabase.from('items').select('*')
      ]);

      const itemsList = itemsRes.data || [];
      setAllItems(itemsList);

      const allSales = salesRes.data || [];
      const allPurchases = purchRes.data || [];

      if (isSelectedAdmin) {
        const staffUsers = (usersList || []).filter(u => u.role !== 'Admin');
        setUserShopSales(allSales.filter(s => {
          if (s.user_id && s.user_id !== 'admin' && s.user_id !== 'usr-admin-01') {
            const isStaff = staffUsers.some(u => u.id === s.user_id);
            if (isStaff) return false;
          }
          if (s.user_name && s.user_name.toLowerCase() !== 'admin') {
            const isStaff = staffUsers.some(u => (u.name && u.name.toLowerCase() === s.user_name.toLowerCase()) || (u.username && u.username.toLowerCase() === s.user_name.toLowerCase()));
            if (isStaff) return false;
          }
          return true;
        }));

        setUserShopPurchases(allPurchases.filter(p => {
          const isStaff = staffUsers.some(u => 
            p.target_user_id === u.id || 
            (p.target_user_name && p.target_user_name.toLowerCase() === (u.name || '').toLowerCase()) ||
            (Array.isArray(p.items_json) && p.items_json.some(it => it.target_user_id === u.id))
          );
          return !isStaff;
        }));
      } else {
        const uId = selectedUser.id;
        const uName = (selectedUser.name || '').toLowerCase();
        const uUname = (selectedUser.username || '').toLowerCase();

        setUserShopSales(allSales.filter(s => {
          if (s.user_id === uId) return true;
          const sName = (s.user_name || '').toLowerCase();
          return sName && (sName === uName || sName === uUname);
        }));

        setUserShopPurchases(allPurchases.filter(p => {
          if (p.target_user_id === uId) return true;
          const pName = (p.target_user_name || '').toLowerCase();
          if (pName && (pName === uName || pName === uUname)) return true;
          if (Array.isArray(p.items_json) && p.items_json.some(it => it.target_user_id === uId || (it.target_user_name && it.target_user_name.toLowerCase() === uName))) {
            return true;
          }
          return false;
        }));
      }
    } catch (err) {
      console.warn('Failed to load user shop data:', err);
    }
    setShopDataLoading(false);
  };

  const handleDeleteUserActivity = async (id, title, e) => {
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
      setUserActivities(prev => prev.filter(a => a.id !== id));
      if (selectedActivityDetail?.id === id) setSelectedActivityDetail(null);
      await showAlert('Notification deleted successfully', 'success');
    }
  };

  useEffect(() => {
    if (selectedUser) {
      fetchUserActivities();
      fetchUserShopData();
    }
  }, [selectedUser, startDate, endDate, categoryFilter]);

  // Listen to live activity logged & stock updated events
  useEffect(() => {
    const handleLiveActivity = () => {
      fetchUserActivities();
    };
    const handleStockUpdate = () => {
      fetchUserShopData();
    };
    window.addEventListener('mm_activity_logged', handleLiveActivity);
    window.addEventListener('mm_stock_updated', handleStockUpdate);
    return () => {
      window.removeEventListener('mm_activity_logged', handleLiveActivity);
      window.removeEventListener('mm_stock_updated', handleStockUpdate);
    };
  }, [selectedUser, startDate, endDate, categoryFilter]);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setActiveTab('activities');
    navigate(`/users/${user.id}`);
  };

  const handleBackToUsersList = () => {
    setSelectedUser(null);
    navigate('/users');
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const cleanUsername = newUserUsername.trim();
    const cleanPassword = newUserPassword.trim();
    if (!cleanUsername || !cleanPassword) {
      return showAlert('Please enter both username and password!', 'error');
    }

    setIsSubmitting(true);
    try {
      await addUser({
        name: cleanUsername,
        username: cleanUsername,
        password: cleanPassword,
        role: newUserRole
      });

      await showAlert(`User "${cleanUsername}" created successfully! Credentials: Username: ${cleanUsername}, Password: ${cleanPassword}`, 'success');
      setShowAddModal(false);
      setNewUserUsername('');
      setNewUserPassword('');
      setNewUserRole('Staff');
      fetchUsers();
    } catch (err) {
      showAlert(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditUser = (targetUser, e) => {
    if (e) e.stopPropagation();
    setEditingUser(targetUser);
    setEditName(targetUser.name || '');
    setEditUsername(targetUser.username || '');
    setEditPassword(targetUser.password || '');
    setEditEmail(targetUser.email || '');
    setEditRole(targetUser.role || 'Staff');
    setEditStatus(targetUser.status || 'Active');
    setShowEditPassword(false);
    setShowEditModal(true);
  };

  const handleSaveUserEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    const cleanUsername = editUsername.trim();
    if (!cleanUsername) return showAlert('Username is required', 'error');

    setIsSubmitting(true);
    try {
      const updated = await updateUser(editingUser.id, {
        name: cleanUsername,
        username: cleanUsername,
        password: editPassword.trim(),
        role: editRole,
        status: editStatus
      });

      await showAlert(`User "${cleanUsername}" updated successfully!`, 'success');
      setShowEditModal(false);
      setEditingUser(null);
      if (selectedUser?.id === editingUser.id) {
        setSelectedUser(updated);
      }
      fetchUsers();
    } catch (err) {
      showAlert(err.message || 'Failed to update user', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderEditModal = () => {
    if (!showEditModal || !editingUser) return null;
    const isEditingAdmin = 
      editingUser.role?.toLowerCase() === 'admin' || 
      editingUser.username?.toLowerCase() === 'admin' || 
      editingUser.email?.toLowerCase() === 'monsoonmeridian@gmail.com';

    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 99999, padding: '1rem', backdropFilter: 'blur(4px)'
      }}>
        <div className="card" style={{ width: '100%', maxWidth: 460, padding: '2rem', borderRadius: '20px', background: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Pencil size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>Update User Details</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Edit credentials and permissions for {editingUser.name}</div>
              </div>
            </div>
            <button onClick={() => setShowEditModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSaveUserEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Login Username */}
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Username / Login ID <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input 
                type="text" 
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                required
                style={{ width: '100%', padding: '0.7rem', borderRadius: 8, border: '1.5px solid var(--c-border)', fontSize: '0.9rem' }}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Password <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showEditPassword ? 'text' : 'password'} 
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.7rem 2.5rem 0.7rem 0.7rem', borderRadius: 8, border: '1.5px solid var(--c-border)', fontSize: '0.9rem' }}
                />
                <button 
                  type="button" 
                  onClick={() => setShowEditPassword(!showEditPassword)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
                >
                  {showEditPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Role & Status (2 columns) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Role
                </label>
                <select 
                  value={editRole} 
                  onChange={(e) => setEditRole(e.target.value)}
                  disabled={isEditingAdmin}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: 8, border: '1.5px solid var(--c-border)', fontSize: '0.9rem', background: (isEditingAdmin ? '#f1f5f9' : 'white') }}
                >
                  <option value="Staff">Staff</option>
                  <option value="Admin">Administrator</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Status
                </label>
                <select 
                  value={editStatus} 
                  onChange={(e) => setEditStatus(e.target.value)}
                  style={{ width: '100%', padding: '0.7rem', borderRadius: 8, border: '1.5px solid var(--c-border)', fontSize: '0.9rem' }}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button 
                type="button" 
                onClick={() => setShowEditModal(false)}
                className="btn-secondary" 
                style={{ flex: 1, padding: '0.75rem' }}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="btn-primary" 
                style={{ flex: 1, padding: '0.75rem', background: '#2563eb' }}
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const handleDeleteUserClick = async (userToDelete, e) => {
    if (e) e.stopPropagation();

    if (
      userToDelete.role?.toLowerCase() === 'admin' || 
      userToDelete.username?.toLowerCase() === 'admin' || 
      userToDelete.email?.toLowerCase() === 'monsoonmeridian@gmail.com' ||
      userToDelete.username?.toLowerCase() === 'monsoonmeridian@gmail.com' ||
      userToDelete.name?.toLowerCase() === 'admin' ||
      userToDelete.id === currentUser?.id ||
      userToDelete.id === 'usr-admin-01'
    ) {
      return showAlert('The Admin account cannot be deleted!', 'error');
    }

    const isConfirmed = await confirm({
      title: 'Delete Staff User?',
      message: `Are you sure you want to permanently delete "${userToDelete.name}" (${userToDelete.username})? They will immediately lose access to the system.`,
      type: 'danger',
      confirmText: 'Yes, Delete User',
      cancelText: 'Cancel'
    });

    if (!isConfirmed) return;

    try {
      await deleteUser(userToDelete.id);
      await showAlert(`User "${userToDelete.name}" was deleted successfully.`, 'success');
      if (selectedUser?.id === userToDelete.id) {
        setSelectedUser(null);
        navigate('/users');
      }
      fetchUsers();
    } catch (err) {
      showAlert(err.message, 'error');
    }
  };

  // If normal user attempts to access /users, block and redirect
  if (!isAdmin) {
    return (
      <div className="card" style={{ padding: '3rem', textAlign: 'center', maxWidth: 500, margin: '4rem auto' }}>
        <ShieldAlert size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.5rem', color: '#0f172a' }}>Access Restricted</h2>
        <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>User Management and Activity Auditing is only accessible to Administrators.</p>
        <button onClick={() => navigate('/')} className="btn-primary" style={{ margin: '0 auto' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  // Helper formatting for dates
  const formatTime = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + d.toLocaleDateString();
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // VIEW MODE A: LIST OF ALL USERS
  // ─────────────────────────────────────────────────────────────────────────────
  if (!selectedUser) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
        
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Staff & User Management
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>
              Create credentials for staff, monitor real-time actions, and track user activities.
            </p>
          </div>

          <button 
            id="add-user-btn"
            onClick={() => setShowAddModal(true)}
            className="btn-primary" 
            style={{ 
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', 
              boxShadow: '0 4px 12px rgba(37,99,235,0.25)', 
              padding: '0.75rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <UserPlus size={18} />
            <span>Add New User</span>
          </button>
        </div>

        {/* Quick KPI Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div className="card" style={{ padding: '1.25rem', borderLeft: '5px solid #3b82f6' }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Users</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>{usersList.length}</div>
          </div>
          <div className="card" style={{ padding: '1.25rem', borderLeft: '5px solid #10b981' }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Active Staff</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>
              {usersList.filter(u => u.role === 'Staff' && isUserOnline(u)).length}
            </div>
          </div>
          <div className="card" style={{ padding: '1.25rem', borderLeft: '5px solid #8b5cf6' }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Admin</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#8b5cf6', marginTop: '4px' }}>
              {usersList.filter(u => u.role === 'Admin').length}
            </div>
          </div>
        </div>

        {/* Users Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {usersList.map((user) => {
            const isAdminRole = user.role === 'Admin';
            const isOnline = isUserOnline(user);
            return (
              <div 
                key={user.id}
                onClick={() => handleSelectUser(user)}
                className="card"
                style={{
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  cursor: 'pointer',
                  position: 'relative',
                  border: '1.5px solid var(--c-border)',
                  transition: 'all 0.2s ease',
                  boxShadow: 'var(--shadow-sm)'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.borderColor = '#2563eb';
                  e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(37,99,235,0.15)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.borderColor = 'var(--c-border)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: 52,
                    height: 52,
                    borderRadius: '16px',
                    background: isAdminRole ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: '1.3rem',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                  }}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {user.name}
                      </h3>
                      {isAdminRole && <Shield size={16} color="#10b981" title="Admin" />}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '2px' }}>
                      @{user.username}
                    </div>
                  </div>

                  <span style={{
                    padding: '0.25rem 0.65rem',
                    borderRadius: 999,
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    background: isAdminRole ? '#dcfce7' : '#dbeafe',
                    color: isAdminRole ? '#166534' : '#1e40af'
                  }}>
                    {user.role}
                  </span>
                </div>

                {/* Info Details */}
                <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Password:</span>
                    <span style={{ fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.05em' }}>••••••••</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Created:</span>
                    <span style={{ fontWeight: 600 }}>{new Date(user.created_at || Date.now()).toLocaleDateString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b' }}>Status:</span>
                    {isOnline ? (
                      <span style={{ color: '#16a34a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', boxShadow: '0 0 6px #16a34a' }} />
                        Active
                      </span>
                    ) : (
                      <span style={{ color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#94a3b8' }} />
                        Offline
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                {(() => {
                  const isAdminUser = 
                    user.role?.toLowerCase() === 'admin' || 
                    user.username?.toLowerCase() === 'admin' || 
                    user.email?.toLowerCase() === 'monsoonmeridian@gmail.com' ||
                    user.username?.toLowerCase() === 'monsoonmeridian@gmail.com' ||
                    user.name?.toLowerCase() === 'admin' ||
                    user.id === currentUser?.id ||
                    user.id === 'usr-admin-01';
                  return (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.6rem', borderTop: '1px solid #f1f5f9' }}>
                      <button 
                        onClick={() => handleSelectUser(user)}
                        className="btn-primary"
                        style={{
                          flex: 1,
                          padding: '0.65rem 0.65rem',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          borderRadius: '8px',
                          background: '#0f172a',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <Activity size={14} />
                        <span>View Activities</span>
                      </button>

                      {/* Edit User Details Button */}
                      <button 
                        onClick={(e) => handleOpenEditUser(user, e)}
                        title="Update User Details"
                        style={{
                          padding: '0.65rem 0.85rem',
                          borderRadius: '8px',
                          border: '1.5px solid #cbd5e1',
                          background: '#f8fafc',
                          color: '#1e293b',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; }}
                      >
                        <Pencil size={14} color="#2563eb" />
                        <span>Edit</span>
                      </button>

                      {/* Delete Button (NEVER shown for Admin) */}
                      {!isAdminUser && (
                        <button 
                          onClick={(e) => handleDeleteUserClick(user, e)}
                          title="Delete Staff User"
                          style={{
                            padding: '0.65rem 0.85rem',
                            borderRadius: '8px',
                            border: '1.5px solid #fee2e2',
                            background: '#fff1f2',
                            color: '#dc2626',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.color = 'white'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#fff1f2'; e.currentTarget.style.color = '#dc2626'; }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>

        {/* Modal: Add New User */}
        {showAddModal && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 99999, padding: '1rem', backdropFilter: 'blur(4px)'
          }}>
            <div className="card" style={{ width: '100%', maxWidth: 440, padding: '2rem', borderRadius: '20px', background: 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <UserPlus size={22} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, color: '#0f172a' }}>Add New User</h3>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Enter name and password for staff login</div>
                  </div>
                </div>
                <button onClick={() => setShowAddModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Username */}
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.4rem' }}>
                    Login Username / ID <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="Enter staff username" 
                    value={newUserUsername}
                    onChange={(e) => setNewUserUsername(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.75rem', borderRadius: 8, border: '1.5px solid var(--c-border)', fontSize: '0.95rem' }}
                  />
                </div>

                {/* Password */}
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.4rem' }}>
                    Password <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      placeholder="Enter secret password" 
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      required
                      style={{ width: '100%', padding: '0.75rem 2.5rem 0.75rem 0.75rem', borderRadius: 8, border: '1.5px solid var(--c-border)', fontSize: '0.95rem' }}
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Role */}
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.4rem' }}>
                    Role / Permissions
                  </label>
                  <select 
                    value={newUserRole} 
                    onChange={(e) => setNewUserRole(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: 8, border: '1.5px solid var(--c-border)', fontSize: '0.95rem' }}
                  >
                    <option value="Staff">Staff (Sales, Purchase, Stock, Reports - No Delete)</option>
                    <option value="Admin">Administrator (Full Access & Activity Monitoring)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button 
                    type="button" 
                    onClick={() => setShowAddModal(false)}
                    className="btn-secondary" 
                    style={{ flex: 1, padding: '0.8rem' }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="btn-primary" 
                    style={{ flex: 1, padding: '0.8rem', background: '#2563eb' }}
                  >
                    {isSubmitting ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit User Details */}
        {renderEditModal()}

      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // VIEW MODE B: USER WORKSPACE INTERFACE (Exact same tabs + "Activities")
  // ─────────────────────────────────────────────────────────────────────────────
  const isSelectedAdmin = selectedUser.role === 'Admin';

  const userTabs = [
    { key: 'activities', label: 'Activities', icon: <Activity size={18} />, highlight: true },
    { key: 'overview',   label: 'Overview',   icon: <TrendingUp size={18} /> },
    { key: 'stock',      label: 'Stock Ver.', icon: <ClipboardList size={18} /> },
    { key: 'reports',    label: 'Reports',    icon: <FileText size={18} /> },
    { key: 'customer',   label: 'Customers',  icon: <UsersIcon size={18} /> },
    { key: 'settings',   label: 'Settings',   icon: <SettingsIcon size={18} /> },
  ];

  // Filter for the selected month (e.g. '2026-10')
  const monthlySales = userShopSales.filter(s => {
    const d = (s.created_at || '').slice(0, 7);
    return d === selectedMonth;
  });

  const monthlyPurchases = userShopPurchases.filter(p => {
    const d = (p.bill_date || p.created_at || '').slice(0, 7);
    return d === selectedMonth;
  });

  const monthlySalesTotal = monthlySales.reduce((acc, s) => acc + (parseFloat(s.total_amount) || 0), 0);
  const monthlyPurchasesTotal = monthlyPurchases.reduce((acc, p) => acc + (parseFloat(p.total_amount) || 0), 0);

  let monthlyGrossProfit = 0;
  monthlySales.forEach(s => {
    const total = parseFloat(s.total_amount) || 0;
    let cost = 0;
    if (Array.isArray(s.items_json)) {
      s.items_json.forEach(it => {
        cost += (Number(it.qty || 0) * Number(it.cost_price || 0));
      });
    }
    monthlyGrossProfit += (total - cost);
  });

  // Aggregate customer details for this shop during the selected month
  const monthlyCustomerMap = {};
  monthlySales.forEach(s => {
    const cName = s.customer_name?.trim() || 'Walk-in Customer';
    if (!monthlyCustomerMap[cName]) {
      monthlyCustomerMap[cName] = {
        name: cName,
        phone: s.customer_phone || '—',
        billsCount: 0,
        totalSpent: 0,
        lastDate: s.created_at,
        paymentMethods: new Set()
      };
    }
    monthlyCustomerMap[cName].billsCount += 1;
    monthlyCustomerMap[cName].totalSpent += (parseFloat(s.total_amount) || 0);
    if (new Date(s.created_at) > new Date(monthlyCustomerMap[cName].lastDate)) {
      monthlyCustomerMap[cName].lastDate = s.created_at;
    }
    if (s.payment_method) {
      monthlyCustomerMap[cName].paymentMethods.add(s.payment_method);
    }
  });

  const shopCustomersList = Object.values(monthlyCustomerMap).sort((a, b) => b.totalSpent - a.totalSpent);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%' }}>
      
      {/* ── TOP USER BANNER ── */}
      <div className="card" style={{
        padding: '1rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: 'white',
        border: 'none',
        boxShadow: '0 10px 25px -5px rgba(15,23,42,0.3)'
      }}>
        {/* Left: Back button + User details */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <button 
            onClick={handleBackToUsersList}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '10px',
              padding: '0.5rem 0.85rem',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontWeight: 700,
              fontSize: '0.85rem',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          >
            <ArrowLeft size={16} /> All Users
          </button>

          <div style={{
            width: 44,
            height: 44,
            borderRadius: '12px',
            background: isSelectedAdmin ? '#10b981' : '#3b82f6',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            fontSize: '1.2rem'
          }}>
            {selectedUser.name.charAt(0).toUpperCase()}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: 'white' }}>
                {selectedUser.name}
              </h2>
              <span style={{
                padding: '0.2rem 0.5rem',
                borderRadius: 999,
                fontSize: '0.7rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                background: isSelectedAdmin ? '#10b981' : '#3b82f6',
                color: 'white'
              }}>
                {selectedUser.role}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 2 }}>
              Username: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>@{selectedUser.username}</span> &nbsp;•&nbsp; 
              Joined: <span style={{ color: '#e2e8f0' }}>{new Date(selectedUser.created_at || Date.now()).toLocaleDateString()}</span>
            </div>
          </div>

          <button
            onClick={(e) => handleOpenEditUser(selectedUser, e)}
            title="Update User Details"
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: '8px',
              padding: '0.45rem 0.85rem',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              marginLeft: '0.5rem',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
          >
            <Pencil size={13} />
            <span>Edit Details</span>
          </button>
        </div>

        {/* Right: Quick activities count */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Total Activities</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#38bdf8' }}>{userActivities.length}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Unethical Attempts</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#f87171' }}>
              {userActivities.filter(a => a.is_unethical || a.action_type === 'UNETHICAL').length}
            </div>
          </div>
        </div>
      </div>

      {/* ── TABS NAVIGATION (Matching Image + Activities) ── */}
      <div style={{
        display: 'flex',
        gap: '0.4rem',
        overflowX: 'auto',
        paddingBottom: '4px',
        borderBottom: '2px solid var(--c-border)'
      }}>
        {userTabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1rem',
                borderRadius: '8px 8px 0 0',
                border: 'none',
                background: isActive 
                  ? (tab.highlight ? '#10b981' : '#0f172a') 
                  : 'transparent',
                color: isActive ? 'white' : '#64748b',
                fontWeight: isActive ? 800 : 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
                boxShadow: isActive ? '0 -2px 8px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.key === 'activities' && (
                <span style={{
                  padding: '1px 6px',
                  borderRadius: 999,
                  background: isActive ? 'white' : '#e2e8f0',
                  color: isActive ? '#10b981' : '#475569',
                  fontSize: '0.72rem',
                  fontWeight: 900
                }}>
                  {userActivities.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── TAB CONTENT: 1. ACTIVITIES TAB ── */}
      {activeTab === 'activities' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, minHeight: 0 }}>
          
          {/* Controls: Timeframe Filter + Category Filter */}
          <div className="card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            
            {/* Date Range Filter (Inline, No Refresh Button) */}
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

            {/* Type/Color Filter: Unethical (Red), Purchase (Blue), Sales (Green), All */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginRight: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Filter size={14} /> Category:
              </span>
              {[
                { key: 'ALL',       label: 'All Activities', color: '#475569' },
                { key: 'UNETHICAL', label: '🔴 Unethical (Red)', color: '#ef4444' },
                { key: 'PURCHASE',  label: '🔵 Purchases (Blue)', color: '#3b82f6' },
                { key: 'SALE',      label: '🟢 Sales (Green)', color: '#10b981' },
                { key: 'STOCK',     label: 'Stock Ver.', color: '#f59e0b' },
              ].map(cat => (
                <button
                  key={cat.key}
                  onClick={() => setCategoryFilter(cat.key)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    border: `1.5px solid ${categoryFilter === cat.key ? cat.color : '#e2e8f0'}`,
                    background: categoryFilter === cat.key ? cat.color : '#f8fafc',
                    color: categoryFilter === cat.key ? 'white' : '#475569',
                    transition: 'all 0.15s'
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Activities List */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '4px' }}>
            {activitiesLoading ? (
              <div className="card" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.5rem' }} />
                <div>Loading user activity logs...</div>
              </div>
            ) : userActivities.length === 0 ? (
              <div className="card" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                <CheckCircle size={36} color="#10b981" style={{ margin: '0 auto 0.5rem' }} />
                <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.25rem' }}>No Activities Found</h4>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>No actions recorded for this timeframe and filter.</p>
              </div>
            ) : (
              userActivities.map((act) => {
                const isUnethical = act.is_unethical || act.action_type === 'UNETHICAL';
                const isSale = act.action_type === 'SALE';
                const isPurchase = act.action_type === 'PURCHASE';

                // Use required colors: red for unethical, blue for purchase, green for sales
                let cardBorderColor = ACTIVITY_COLORS[act.action_type] || '#64748b';
                let badgeBg = '#f1f5f9';
                let badgeColor = '#475569';
                let cardBg = 'white';

                if (isUnethical) {
                  cardBorderColor = '#ef4444'; // RED
                  badgeBg = '#fee2e2';
                  badgeColor = '#dc2626';
                  cardBg = '#fffafb';
                } else if (isPurchase) {
                  cardBorderColor = '#3b82f6'; // BLUE
                  badgeBg = '#dbeafe';
                  badgeColor = '#1d4ed8';
                  cardBg = '#f8faff';
                } else if (isSale) {
                  cardBorderColor = '#10b981'; // GREEN
                  badgeBg = '#dcfce7';
                  badgeColor = '#15803d';
                  cardBg = '#fafffc';
                }

                return (
                  <div
                    key={act.id}
                    onClick={() => setSelectedActivityDetail(act)}
                    className="card"
                    style={{
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1.25rem',
                      borderLeft: `6px solid ${cardBorderColor}`,
                      background: cardBg,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative'
                    }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 15px rgba(0,0,0,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
                  >
                    {/* Icon circle */}
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: '12px',
                      background: badgeBg,
                      color: badgeColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {isUnethical ? <AlertTriangle size={22} /> : (isPurchase ? <ShoppingBag size={22} /> : (isSale ? <ShoppingCart size={22} /> : <Activity size={22} />))}
                    </div>

                    {/* Middle description */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: isUnethical ? '#dc2626' : '#0f172a' }}>
                          {act.action_title}
                        </h4>
                        <span style={{
                          padding: '0.15rem 0.5rem',
                          borderRadius: '999px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          background: badgeBg,
                          color: badgeColor
                        }}>
                          {isUnethical ? 'UNETHICAL NOTIFICATION' : act.action_type}
                        </span>
                      </div>
                      <p style={{ margin: '3px 0 0', color: '#475569', fontSize: '0.85rem', lineHeight: 1.4 }}>
                        {act.description}
                      </p>
                    </div>

                    {/* Right timestamp */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} /> {formatTime(act.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Modal: Activity Details Inspection */}
          {selectedActivityDetail && (
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
                      background: selectedActivityDetail.is_unethical ? '#fee2e2' : '#dbeafe',
                      color: selectedActivityDetail.is_unethical ? '#dc2626' : '#1d4ed8'
                    }}>
                      {selectedActivityDetail.is_unethical ? '⚠️ UNETHICAL ALERT' : selectedActivityDetail.action_type}
                    </span>
                    <h3 style={{ margin: '0.5rem 0 0', fontSize: '1.3rem', fontWeight: 900, color: '#0f172a' }}>
                      {selectedActivityDetail.action_title}
                    </h3>
                  </div>
                  <button onClick={() => setSelectedActivityDetail(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
                    <X size={20} />
                  </button>
                </div>

                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', fontSize: '0.9rem', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 800, color: '#334155', marginBottom: '0.3rem', fontSize: '0.8rem', textTransform: 'uppercase' }}>Description:</div>
                  <div style={{ color: '#0f172a', lineHeight: 1.5, fontWeight: 600 }}>{selectedActivityDetail.description}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                  <div style={{ padding: '0.75rem', background: '#f1f5f9', borderRadius: 8 }}>
                    <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Staff Member</div>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>{selectedActivityDetail.user_name} ({selectedActivityDetail.user_role})</div>
                  </div>
                  <div style={{ padding: '0.75rem', background: '#f1f5f9', borderRadius: 8 }}>
                    <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Timestamp</div>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>{formatTime(selectedActivityDetail.created_at)}</div>
                  </div>
                </div>

                {/* Action Breakdown in clean points & sentences */}
                {selectedActivityDetail.metadata && Object.keys(selectedActivityDetail.metadata).length > 0 && (
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
                      {Object.entries(selectedActivityDetail.metadata).map(([k, v]) => (
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
                      onClick={() => handleDeleteUserActivity(selectedActivityDetail.id, selectedActivityDetail.action_title)}
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
                  <button onClick={() => setSelectedActivityDetail(null)} className="btn-primary" style={{ padding: '0.65rem 1.5rem', marginLeft: 'auto' }}>
                    Close Details
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── TAB CONTENT: 2. OVERVIEW TAB (User's Shop Overview) ── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1, overflowY: 'auto' }}>
          
          {/* Month Filter Bar */}
          <div className="card" style={{ padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Calendar size={18} color="#2563eb" />
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>
                Period: <strong>{getMonthDisplayName(selectedMonth)}</strong>
              </span>
              {selectedMonth === getCurrentMonthKey() && (
                <span style={{ padding: '2px 8px', borderRadius: 999, background: '#dcfce7', color: '#166534', fontWeight: 800, fontSize: '0.72rem' }}>
                  Current Month (Auto-refreshed)
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'white', padding: '0.35rem 0.65rem', borderRadius: '8px', border: '1.5px solid #cbd5e1' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Select Month:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontWeight: 800, fontSize: '0.82rem', color: '#0f172a', outline: 'none', cursor: 'pointer' }}
                />
              </div>

              {selectedMonth !== getCurrentMonthKey() && (
                <button
                  onClick={() => setSelectedMonth(getCurrentMonthKey())}
                  className="btn-secondary"
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem', fontWeight: 700 }}
                >
                  Reset to Current Month
                </button>
              )}
            </div>
          </div>

          {/* Shop KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: '1px solid #bfdbfe', borderRadius: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>Shop Stock Units</span>
                <Package size={20} color="#2563eb" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e3a8a' }}>
                {getUserShopStockTotal(
                  isSelectedAdmin ? 'admin' : selectedUser.id,
                  allItems,
                  isSelectedAdmin
                )}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#3b82f6', marginTop: '0.25rem', fontWeight: 600 }}>Active units in this shop</div>
            </div>

            <div className="card" style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '1px solid #bbf7d0', borderRadius: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>Sales ({getMonthDisplayName(selectedMonth)})</span>
                <IndianRupee size={20} color="#16a34a" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#14532d' }}>
                ₹{monthlySalesTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#16a34a', marginTop: '0.25rem', fontWeight: 600 }}>{monthlySales.length} bills in {getMonthDisplayName(selectedMonth)}</div>
            </div>

            <div className="card" style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #fefce8 0%, #fef9c3 100%)', border: '1px solid #fef08a', borderRadius: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#854d0e', textTransform: 'uppercase' }}>Purchases ({getMonthDisplayName(selectedMonth)})</span>
                <ShoppingBag size={20} color="#ca8a04" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#713f12' }}>
                ₹{monthlyPurchasesTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#ca8a04', marginTop: '0.25rem', fontWeight: 600 }}>{monthlyPurchases.length} purchases in {getMonthDisplayName(selectedMonth)}</div>
            </div>

            <div className="card" style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Gross Profit ({getMonthDisplayName(selectedMonth)})</span>
                <TrendingUp size={20} color="#0f766e" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: monthlyGrossProfit >= 0 ? '#0f766e' : '#dc2626' }}>
                ₹{Math.round(monthlyGrossProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem', fontWeight: 600 }}>Estimated profit margin</div>
            </div>
          </div>

          {/* Recent Sales & Purchases Preview Tables */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.25rem' }}>
            {/* Recent Sales */}
            <div className="card" style={{ padding: '1.25rem', borderRadius: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShoppingCart size={18} color="#2563eb" /> Recent Sales ({selectedUser.name}) — {getMonthDisplayName(selectedMonth)}
                </div>
                <button onClick={() => setActiveTab('sales')} style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2563eb', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  View All →
                </button>
              </div>
              {monthlySales.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>No sales recorded in {getMonthDisplayName(selectedMonth)} for this shop.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                      <th style={{ padding: '0.5rem' }}>Date</th>
                      <th style={{ padding: '0.5rem' }}>Customer</th>
                      <th style={{ padding: '0.5rem' }}>Mode</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlySales.slice(0, 5).map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.6rem 0.5rem', color: '#475569' }}>{new Date(s.created_at).toLocaleDateString()}</td>
                        <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }}>{s.customer_name || 'Walk-in'}</td>
                        <td style={{ padding: '0.6rem 0.5rem' }}><span style={{ padding: '1px 6px', borderRadius: 4, background: '#f1f5f9', fontSize: '0.75rem', fontWeight: 700 }}>{s.payment_method || 'CASH'}</span></td>
                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>₹{parseFloat(s.total_amount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Recent Purchases */}
            <div className="card" style={{ padding: '1.25rem', borderRadius: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShoppingBag size={18} color="#ca8a04" /> Recent Purchases ({selectedUser.name}) — {getMonthDisplayName(selectedMonth)}
                </div>
                <button onClick={() => setActiveTab('purchase')} style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ca8a04', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  View All →
                </button>
              </div>
              {monthlyPurchases.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>No purchases assigned in {getMonthDisplayName(selectedMonth)} for this shop.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                      <th style={{ padding: '0.5rem' }}>Bill No</th>
                      <th style={{ padding: '0.5rem' }}>Date</th>
                      <th style={{ padding: '0.5rem' }}>Supplier</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyPurchases.slice(0, 5).map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.6rem 0.5rem', fontFamily: 'monospace', fontWeight: 600 }}>{p.bill_no || 'Auto'}</td>
                        <td style={{ padding: '0.6rem 0.5rem', color: '#475569' }}>{p.bill_date || new Date(p.created_at).toLocaleDateString()}</td>
                        <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }}>{p.supplier || '—'}</td>
                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: 800, color: '#0284c7' }}>₹{parseFloat(p.total_amount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT: 3. SALES TAB ── */}
      {activeTab === 'sales' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, overflowY: 'auto' }}>
          <div className="card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShoppingCart size={20} color="#2563eb" />
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Sales Billed by {selectedUser.name}'s Shop</h3>
              <span style={{ padding: '2px 8px', borderRadius: 999, background: '#dbeafe', color: '#1e40af', fontWeight: 800, fontSize: '0.78rem' }}>
                {userShopSales.length} bills
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.4rem 0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
              <Search size={16} color="#64748b" />
              <input 
                type="text" 
                placeholder="Search invoice or customer..." 
                value={salesSearch}
                onChange={e => setSalesSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          <div className="card" style={{ flex: 1, overflowX: 'auto', padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <tr>
                  <th style={{ padding: '0.85rem 1rem' }}>#</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Invoice ID</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Date & Time</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Customer</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Payment</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {userShopSales
                  .filter(s => !salesSearch || (s.id && s.id.toLowerCase().includes(salesSearch.toLowerCase())) || (s.customer_name && s.customer_name.toLowerCase().includes(salesSearch.toLowerCase())))
                  .map((sale, i) => (
                    <tr key={sale.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1rem', color: '#94a3b8' }}>{i + 1}</td>
                      <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontWeight: 600 }}>{sale.id}</td>
                      <td style={{ padding: '0.85rem 1rem', color: '#475569' }}>{new Date(sale.created_at).toLocaleString()}</td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{sale.customer_name || 'Walk-in Customer'}</td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 999, background: '#f1f5f9', fontSize: '0.78rem', fontWeight: 700 }}>
                          {sale.payment_method || 'CASH'}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                        ₹{parseFloat(sale.total_amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                {userShopSales.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                      No sales records found for {selectedUser.name}'s shop.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT: 4. PURCHASE TAB ── */}
      {activeTab === 'purchase' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, overflowY: 'auto' }}>
          <div className="card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShoppingBag size={20} color="#ca8a04" />
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Purchases Assigned to {selectedUser.name}'s Shop</h3>
              <span style={{ padding: '2px 8px', borderRadius: 999, background: '#fef08a', color: '#854d0e', fontWeight: 800, fontSize: '0.78rem' }}>
                {userShopPurchases.length} bills
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.4rem 0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
              <Search size={16} color="#64748b" />
              <input 
                type="text" 
                placeholder="Search bill or supplier..." 
                value={purchaseSearch}
                onChange={e => setPurchaseSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          <div className="card" style={{ flex: 1, overflowX: 'auto', padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <tr>
                  <th style={{ padding: '0.85rem 1rem' }}>#</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Bill No</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Date</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Supplier</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Mode</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {userShopPurchases
                  .filter(p => !purchaseSearch || (p.bill_no && p.bill_no.toLowerCase().includes(purchaseSearch.toLowerCase())) || (p.supplier && p.supplier.toLowerCase().includes(purchaseSearch.toLowerCase())))
                  .map((purch, i) => (
                    <tr key={purch.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1rem', color: '#94a3b8' }}>{i + 1}</td>
                      <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontWeight: 600 }}>{purch.bill_no || 'Auto'}</td>
                      <td style={{ padding: '0.85rem 1rem', color: '#475569' }}>{purch.bill_date || new Date(purch.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{purch.supplier || '—'}</td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 999, background: '#f1f5f9', fontSize: '0.78rem', fontWeight: 700 }}>
                          {purch.payment_mode || 'Cash'}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 800, color: '#0284c7' }}>
                        ₹{parseFloat(purch.total_amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                {userShopPurchases.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                      No purchases recorded for {selectedUser.name}'s shop.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT: 5. STOCK VER. TAB (Shop Stock for this User) ── */}
      {activeTab === 'stock' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Stock shopUserId={isSelectedAdmin ? 'admin' : selectedUser.id} />
        </div>
      )}

      {/* ── TAB CONTENT: 6. REPORTS TAB (Filtered for this User's Shop) ── */}
      {activeTab === 'reports' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Reports 
            filterUserId={isSelectedAdmin ? 'admin' : selectedUser.id} 
            filterUserName={selectedUser.name || selectedUser.username} 
          />
        </div>
      )}

      {/* ── TAB CONTENT: 7. CUSTOMERS TAB ── */}
      {activeTab === 'customer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1, overflowY: 'auto' }}>
          {/* Header & Controls */}
          <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <UsersIcon size={24} color="#2563eb" />
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                  Customer Activity — {selectedUser.name}'s Shop
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                  Showing customers billed in <strong>{getMonthDisplayName(selectedMonth)}</strong>
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {/* Month Picker */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#f8fafc', padding: '0.35rem 0.65rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                <Calendar size={15} color="#64748b" />
                <input 
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontWeight: 700, fontSize: '0.82rem', color: '#0f172a', outline: 'none', cursor: 'pointer' }}
                />
              </div>

              {/* View toggle */}
              <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                <button
                  onClick={() => setCustomerViewMode('shop_customers')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: customerViewMode === 'shop_customers' ? 'white' : 'transparent',
                    color: customerViewMode === 'shop_customers' ? '#0f172a' : '#64748b',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    boxShadow: customerViewMode === 'shop_customers' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  Monthly Customers ({shopCustomersList.length})
                </button>
                <button
                  onClick={() => setCustomerViewMode('directory')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: customerViewMode === 'directory' ? 'white' : 'transparent',
                    color: customerViewMode === 'directory' ? '#0f172a' : '#64748b',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    boxShadow: customerViewMode === 'directory' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  Master Directory
                </button>
              </div>
            </div>
          </div>

          {customerViewMode === 'directory' ? (
            <GenericMaster title="Customers" table="customers" defaultSort="name" />
          ) : (
            <>
              {/* Customer KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #2563eb' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Customers Served</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0f172a', marginTop: 4 }}>{shopCustomersList.length}</div>
                </div>
                <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Invoices Billed</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#166534', marginTop: 4 }}>{monthlySales.length}</div>
                </div>
                <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #8b5cf6' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Customer Spend</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#6d28d9', marginTop: 4 }}>₹{monthlySalesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Avg. Spend / Customer</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#b45309', marginTop: 4 }}>
                    ₹{shopCustomersList.length > 0 ? (monthlySalesTotal / shopCustomersList.length).toFixed(2) : '0.00'}
                  </div>
                </div>
              </div>

              {/* Customers Table */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                    Customer Breakdown for {getMonthDisplayName(selectedMonth)}
                  </div>
                  <div style={{ position: 'relative', width: 240 }}>
                    <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Search customer..."
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      style={{ width: '100%', padding: '0.4rem 0.5rem 0.4rem 2rem', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.82rem' }}
                    />
                  </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                    <tr>
                      <th style={{ padding: '0.75rem 1rem' }}>#</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Customer Name</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Phone</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Bills This Month</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Payment Modes</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Last Billed</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total Spend (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shopCustomersList
                      .filter(c => !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase()) || (c.phone && c.phone.includes(customerSearch)))
                      .map((cust, i) => (
                        <tr key={cust.name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>{i + 1}</td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#0f172a' }}>{cust.name}</td>
                          <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{cust.phone}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 999, background: '#e0f2fe', color: '#0369a1', fontWeight: 800, fontSize: '0.75rem' }}>
                              {cust.billsCount} bill{cust.billsCount > 1 ? 's' : ''}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {Array.from(cust.paymentMethods).map(m => (
                              <span key={m} style={{ padding: '2px 6px', borderRadius: 4, background: '#f1f5f9', fontSize: '0.72rem', fontWeight: 700, marginRight: 4 }}>
                                {m}
                              </span>
                            ))}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.78rem' }}>
                            {new Date(cust.lastDate).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 900, color: '#16a34a', fontSize: '0.92rem' }}>
                            ₹{cust.totalSpent.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    {shopCustomersList.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                          No customer transactions recorded in {getMonthDisplayName(selectedMonth)} for {selectedUser.name}'s shop.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB CONTENT: 8. SETTINGS TAB ── */}
      {activeTab === 'settings' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Settings />
        </div>
      )}

      {/* Modal: Edit User Details */}
      {renderEditModal()}

    </div>
  );
};

export default Users;
