import { supabase } from '../config/supabaseClient';

const ACTIVITIES_STORAGE_KEY = 'mm_user_activities';

// Color definitions matching the prompt's explicit requirement:
// "use red colour for unethical notification, blue for purchase and green for sales"
export const ACTIVITY_COLORS = {
  UNETHICAL: '#ef4444', // Red
  PURCHASE:  '#3b82f6', // Blue
  SALE:      '#10b981', // Green
  STOCK:     '#f59e0b', // Amber / Orange
  REPORT:    '#8b5cf6', // Purple
  CUSTOMER:  '#0d9488', // Teal
  TAX:       '#0284c7', // Sky Blue
  MARKETING: '#ec4899', // Pink
  AUTH:      '#64748b', // Slate Gray
};

export const ACTIVITY_LABELS = {
  UNETHICAL: 'Unethical Alert',
  PURCHASE:  'Purchase Entry',
  SALE:      'Sales (POS)',
  STOCK:     'Stock Verification',
  REPORT:    'Reports & Audit',
  CUSTOMER:  'Customer Master',
  TAX:       'Tax Settings',
  MARKETING: 'Marketing Broadcast',
  AUTH:      'Authentication',
};

export const initActivitiesStorage = () => {
  const existing = localStorage.getItem(ACTIVITIES_STORAGE_KEY);
  if (!existing) {
    localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify([]));
    return [];
  }
  try {
    const parsed = JSON.parse(existing);
    if (!Array.isArray(parsed)) {
      localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    // Clean out legacy demo seed items and auth login/logout notifications
    const cleaned = parsed.filter(a => 
      !a.id?.startsWith('act-seed-') && 
      !a.id?.startsWith('act-demo-') &&
      a.action_type !== 'AUTH' &&
      !a.action_title?.toLowerCase().includes('logged in') &&
      !a.action_title?.toLowerCase().includes('logged out')
    );
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(cleaned));
      return cleaned;
    }
    return parsed;
  } catch {
    localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify([]));
    return [];
  }
};

/**
 * Fetch activities with optional filters
 * @param {object} options
 * @param {string} [options.userId] - 'ALL' or specific user id
 * @param {string} [options.timeframe] - 'DAY', 'WEEK', 'MONTH', 'ALL'
 * @param {string} [options.type] - 'ALL', 'SALE', 'PURCHASE', 'UNETHICAL', etc.
 */
export const getActivities = async ({ 
  userId = 'ALL', 
  timeframe = 'ALL', 
  type = 'ALL',
  startDate = null,
  endDate = null
} = {}) => {
  let list = initActivitiesStorage();

  // Try to load from Supabase if connected (excluding AUTH)
  if (supabase) {
    try {
      // Proactively purge any residual auth login/logout logs from remote table
      supabase.from('activities').delete().eq('action_type', 'AUTH').then(() => {});

      let query = supabase
        .from('activities')
        .select('*')
        .neq('action_type', 'AUTH')
        .order('created_at', { ascending: false });
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        // Merge Supabase activities with local list
        const map = new Map();
        [...data, ...list].forEach(a => {
          if (
            a.action_type !== 'AUTH' &&
            !a.action_title?.toLowerCase().includes('logged in') &&
            !a.action_title?.toLowerCase().includes('logged out')
          ) {
            map.set(a.id, a);
          }
        });
        list = Array.from(map.values());
        localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(list));
      }
    } catch (e) {
      // Quiet fallback to local activities
    }
  }

  // Always filter out login / logout notifications
  list = list.filter(a => 
    a.action_type !== 'AUTH' && 
    !a.action_title?.toLowerCase().includes('logged in') && 
    !a.action_title?.toLowerCase().includes('logged out')
  );

  // 1. Filter by User
  if (userId && userId !== 'ALL') {
    list = list.filter(a => a.user_id === userId || a.user_name?.toLowerCase() === userId.toLowerCase());
  }

  // 2. Filter by Type
  if (type && type !== 'ALL') {
    list = list.filter(a => a.action_type === type);
  }

  // 3. Filter by Date Range (startDate & endDate)
  if (startDate) {
    const startMs = new Date(startDate).setHours(0, 0, 0, 0);
    list = list.filter(a => new Date(a.created_at).getTime() >= startMs);
  }
  if (endDate) {
    const endMs = new Date(endDate).setHours(23, 59, 59, 999);
    list = list.filter(a => new Date(a.created_at).getTime() <= endMs);
  }

  // If no explicit date range, check timeframe preset
  if (!startDate && !endDate) {
    const now = new Date();
    if (timeframe === 'DAY') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      list = list.filter(a => new Date(a.created_at).getTime() >= startOfDay);
    } else if (timeframe === 'WEEK') {
      const sevenDaysAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);
      list = list.filter(a => new Date(a.created_at).getTime() >= sevenDaysAgo);
    } else if (timeframe === 'MONTH') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      list = list.filter(a => new Date(a.created_at).getTime() >= startOfMonth);
    }
  }

  // Sort descending by created_at
  return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

/**
 * Log an activity event
 */
export const logActivity = async ({
  type = 'SALE',
  title = '',
  description = '',
  metadata = {},
  isUnethical = false,
  color = null,
  userId = null,
  userName = null,
  userRole = null
}) => {
  // Exclude and ignore login and logout notifications
  if (
    type === 'AUTH' ||
    title?.toLowerCase().includes('logged in') ||
    title?.toLowerCase().includes('logged out') ||
    description?.toLowerCase().includes('successfully authenticated') ||
    description?.toLowerCase().includes('signed out')
  ) {
    return null;
  }

  // If user details not supplied, read from active auth session
  let activeUser = null;
  try {
    const session = localStorage.getItem('mm_auth_session');
    if (session) activeUser = JSON.parse(session);
  } catch {}

  const finalUserId = userId || activeUser?.id || 'usr-staff-01';
  const finalUserName = userName || activeUser?.name || 'Staff User';
  const finalUserRole = userRole || activeUser?.role || 'Staff';

  const assignedColor = color || (isUnethical ? ACTIVITY_COLORS.UNETHICAL : (ACTIVITY_COLORS[type] || ACTIVITY_COLORS.SALE));

  const newActivity = {
    id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    user_id: finalUserId,
    user_name: finalUserName,
    user_role: finalUserRole,
    action_type: type,
    action_title: title || ACTIVITY_LABELS[type] || 'Activity Logged',
    description: description || '',
    metadata: metadata || {},
    is_unethical: !!isUnethical,
    color_code: assignedColor,
    created_at: new Date().toISOString()
  };

  // 1. Save to Supabase if connected
  if (supabase) {
    try {
      await supabase.from('activities').insert([newActivity]);
    } catch (err) {
      console.warn('Could not insert activity to Supabase table:', err);
    }
  }

  // 2. Save to local storage
  const list = initActivitiesStorage();
  const updatedList = [newActivity, ...list];
  localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(updatedList));

  // 3. Dispatch global browser event for instant live UI updates (Header bell, live activity feed)
  window.dispatchEvent(new CustomEvent('mm_activity_logged', { detail: newActivity }));

  return newActivity;
};

/**
 * Get summary stats for a user or globally
 */
export const getActivityStats = async (userId = 'ALL') => {
  const all = await getActivities({ userId, timeframe: 'ALL' });
  const today = await getActivities({ userId, timeframe: 'DAY' });

  return {
    total: all.length,
    today: today.length,
    unethical: all.filter(a => a.is_unethical || a.action_type === 'UNETHICAL').length,
    sales: all.filter(a => a.action_type === 'SALE').length,
    purchases: all.filter(a => a.action_type === 'PURCHASE').length,
  };
};

/**
 * Delete a single activity / notification (Admin only)
 */
export const deleteActivity = async (id) => {
  if (!id) return false;

  // 1. Delete from Supabase
  if (supabase) {
    try {
      await supabase.from('activities').delete().eq('id', id);
    } catch (err) {
      console.warn('Could not delete activity from Supabase table:', err);
    }
  }

  // 2. Delete from local storage
  try {
    const list = initActivitiesStorage();
    const updated = list.filter(a => a.id !== id);
    localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Could not delete activity from local storage:', err);
  }

  // 3. Dispatch global browser event for instant live UI updates across sidebar/header
  window.dispatchEvent(new CustomEvent('mm_activity_logged', { detail: { deletedId: id } }));
  return true;
};

/**
 * Clear multiple or all activities / notifications (Admin only)
 */
export const clearActivities = async (ids = null) => {
  if (supabase) {
    try {
      if (Array.isArray(ids) && ids.length > 0) {
        await supabase.from('activities').delete().in('id', ids);
      } else {
        await supabase.from('activities').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      }
    } catch (err) {
      console.warn('Could not clear activities from Supabase:', err);
    }
  }

  try {
    if (Array.isArray(ids) && ids.length > 0) {
      const list = initActivitiesStorage();
      const updated = list.filter(a => !ids.includes(a.id));
      localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(updated));
    } else {
      localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify([]));
    }
  } catch {}

  window.dispatchEvent(new CustomEvent('mm_activity_logged', { detail: { cleared: true } }));
  return true;
};
