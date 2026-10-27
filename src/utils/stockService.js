import { supabase } from '../config/supabaseClient';

const USER_STOCKS_KEY = 'mm_user_stocks';

/**
 * Initialize and get user stocks map from localStorage
 * Structure: { [userId]: { [itemId]: number } }
 */
export const getUserStocksMap = () => {
  try {
    const raw = localStorage.getItem(USER_STOCKS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
};

/**
 * Save user stocks map to localStorage
 */
const saveUserStocksMap = (map) => {
  try {
    localStorage.setItem(USER_STOCKS_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent('mm_stock_updated', { detail: map }));
  } catch (err) {
    console.warn('Failed to save user stocks to storage:', err);
  }
};

/**
 * Get stock quantity for a specific user (shop) and item.
 * Admin owns one shop whose inventory is the current master data (masterFallbackStock).
 * Other users each have their own allocated stock quantities (defaulting to 0).
 */
export const getUserStock = (userId, itemId, masterFallbackStock = 0, isAdmin = false) => {
  if (isAdmin || userId === 'main' || userId === 'admin' || userId === 'usr-admin-01') {
    return masterFallbackStock;
  }
  if (!userId) {
    return masterFallbackStock;
  }
  const map = getUserStocksMap();
  const userMap = map[userId];
  if (userMap && typeof userMap[itemId] === 'number') {
    return userMap[itemId];
  }
  return 0; // Each staff shop starts with 0 until allocated/purchased
};

/**
 * Add or update stock for a specific user (shop).
 * Updates the user's shop inventory allocation.
 */
export const addUserStock = async ({ userId = 'main', itemId, quantityChange = 0, itemName = '', isAdmin = false }) => {
  if (!itemId || quantityChange === 0) return;

  const isAdminShop = isAdmin || userId === 'main' || userId === 'admin' || userId === 'usr-admin-01';

  if (isAdminShop) {
    // Admin shop stock updates directly in central master items
    if (supabase) {
      try {
        await supabase.rpc('handle_stock_update', {
          item_id: itemId,
          quantity_change: quantityChange
        });
      } catch {
        try {
          const { data: item } = await supabase.from('items').select('stock_quantity').eq('id', itemId).single();
          if (item) {
            await supabase.from('items').update({
              stock_quantity: Math.max(0, (item.stock_quantity || 0) + Number(quantityChange))
            }).eq('id', itemId);
          }
        } catch {}
      }
    }
    return;
  }

  // Staff User's Own Shop
  const map = getUserStocksMap();
  if (!map[userId]) {
    map[userId] = {};
  }

  const currentStock = map[userId][itemId] || 0;
  const newStock = Math.max(0, currentStock + Number(quantityChange));
  map[userId][itemId] = newStock;
  saveUserStocksMap(map);

  // Sync to Supabase user_stocks table if connected
  if (supabase) {
    try {
      await supabase
        .from('user_stocks')
        .upsert({
          user_id: userId,
          item_id: itemId,
          stock_quantity: newStock,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,item_id' });
    } catch (err) {
      console.warn('Supabase user_stocks upsert notice:', err);
    }
  }

  return newStock;
};

/**
 * Get all stocks for a specific user/shop
 * Returns: { [itemId]: number }
 */
export const getAllStocksForUser = (userId) => {
  if (!userId || userId === 'all' || userId === 'main') return null;
  const map = getUserStocksMap();
  return map[userId] || {};
};

/**
 * Calculate total stock units for a specific shop
 */
export const getUserShopStockTotal = (userId, items = [], isAdmin = false) => {
  if (isAdmin || userId === 'main' || userId === 'admin' || userId === 'usr-admin-01') {
    return items.reduce((sum, it) => sum + (Number(it.stock_quantity) || 0), 0);
  }
  const map = getUserStocksMap();
  const userMap = map[userId] || {};
  return Object.values(userMap).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
};

/**
 * Fetch remote user stocks if available
 */
export const syncRemoteUserStocks = async () => {
  if (!supabase) return;
  try {
    const { data, error } = await supabase.from('user_stocks').select('*');
    if (!error && data && data.length > 0) {
      const map = getUserStocksMap();
      data.forEach(row => {
        if (!map[row.user_id]) map[row.user_id] = {};
        map[row.user_id][row.item_id] = Number(row.stock_quantity) || 0;
      });
      saveUserStocksMap(map);
    }
  } catch (err) {
    // Graceful fallback
  }
};
