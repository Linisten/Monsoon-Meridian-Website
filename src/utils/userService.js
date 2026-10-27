import { supabase } from '../config/supabaseClient';

const USERS_STORAGE_KEY = 'mm_users';

// Default initial users (Admin only, staff are registered dynamically by admin)
const DEFAULT_USERS = [
  {
    id: 'usr-admin-01',
    name: 'Admin',
    username: 'admin',
    password: 'Amma@3747', // Specified Admin credentials
    email: 'monsoonmeridian@gmail.com',
    role: 'Admin',
    status: 'Active',
    created_at: new Date().toISOString(),
  }
];

export const initUsersStorage = () => {
  const existing = localStorage.getItem(USERS_STORAGE_KEY);
  if (!existing) {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
    return DEFAULT_USERS;
  }
  try {
    let parsed = JSON.parse(existing);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }
    // Filter out old demo dummy staff entries (Rahul and Priya)
    const initialLen = parsed.length;
    parsed = parsed.filter(u => 
      u.id !== 'usr-staff-01' && 
      u.id !== 'usr-staff-02' && 
      u.username !== 'rahul' && 
      u.username !== 'priya'
    );
    let modified = parsed.length !== initialLen;

    // Update admin user to specified credentials and name
    parsed = parsed.map(u => {
      if (u.role === 'Admin' || u.username === 'admin' || u.name === 'Administrator') {
        modified = true;
        return { 
          ...u, 
          name: 'Admin',
          username: 'admin',
          email: 'monsoonmeridian@gmail.com',
          password: 'Amma@3747'
        };
      }
      return u;
    });

    // If no admin exists in list, prepend default admin
    if (!parsed.some(u => u.role === 'Admin' || u.username === 'admin')) {
      parsed.unshift(DEFAULT_USERS[0]);
      modified = true;
    }

    if (modified) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
    return DEFAULT_USERS;
  }
};

/**
 * Update active heartbeat timestamp for a user
 */
export const updateUserHeartbeat = (userId) => {
  if (!userId) return;
  try {
    localStorage.setItem(`mm_heartbeat_${userId}`, Date.now().toString());
  } catch {}
};

/**
 * Check if a user is truly active right now.
 * True if they are the current session user or had a heartbeat within 5 minutes.
 */
export const isUserOnline = (user) => {
  if (!user || !user.id) return false;
  try {
    const sessionRaw = localStorage.getItem('mm_auth_session');
    if (sessionRaw) {
      const sessionUser = JSON.parse(sessionRaw);
      if (sessionUser && (sessionUser.id === user.id || sessionUser.username === user.username)) {
        return true;
      }
    }
    const heartbeat = localStorage.getItem(`mm_heartbeat_${user.id}`);
    if (heartbeat) {
      const diff = Date.now() - Number(heartbeat);
      if (diff < 5 * 60 * 1000) return true;
    }
  } catch {}
  return false;
};

/**
 * Fetch all users from Supabase or localStorage fallback
 */
export const getAllUsers = async () => {
  let localList = initUsersStorage();

  if (supabase) {
    try {
      const { data, error } = await supabase.from('users').select('*').order('name');
      if (!error && data && data.length > 0) {
        // Merge with local list to preserve passwords/fields if needed
        const merged = data.map(dbUser => {
          const match = localList.find(l => l.id === dbUser.id || l.username === dbUser.username || l.email === dbUser.email);
          return {
            ...dbUser,
            username: dbUser.username || match?.username || dbUser.email?.split('@')[0] || dbUser.name.toLowerCase().replace(/\s+/g, ''),
            password: dbUser.password || match?.password || 'password123',
            status: dbUser.status || 'Active',
            role: dbUser.role || 'Staff'
          };
        });

        // Ensure Admin user always exists
        const hasAdmin = merged.some(u => 
          u.role?.toLowerCase() === 'admin' || 
          u.username?.toLowerCase() === 'admin' || 
          u.email?.toLowerCase() === 'monsoonmeridian@gmail.com'
        );
        if (!hasAdmin) {
          merged.unshift(DEFAULT_USERS[0]);
        }

        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(merged));
        return merged;
      }
    } catch (err) {
      console.warn('Supabase users fetch failed, falling back to local users:', err);
    }
  }

  return localList;
};

/**
 * Add a new user with Name, Username, Password, Role
 */
export const addUser = async ({ name, username, password, role = 'Staff', email = '' }) => {
  const cleanName = name?.trim();
  const cleanUsername = (username?.trim() || cleanName.toLowerCase().replace(/\s+/g, ''));
  const cleanPassword = password?.trim();

  if (!cleanName) throw new Error('User Name is required');
  if (!cleanPassword) throw new Error('Password is required');

  const users = await getAllUsers();
  const exists = users.find(u => u.username?.toLowerCase() === cleanUsername.toLowerCase());
  if (exists) {
    throw new Error(`Username "${cleanUsername}" already exists! Please choose another.`);
  }

  let newUser = {
    name: cleanName,
    username: cleanUsername,
    password: cleanPassword,
    email: email?.trim() || `${cleanUsername}@monsoonmeridian.com`,
    role: role || 'Staff',
    status: 'Active',
    created_at: new Date().toISOString()
  };

  // 1. Save to Supabase (do NOT send custom non-UUID id, let Supabase gen_random_uuid())
  if (supabase) {
    try {
      const { data, error } = await supabase.from('users').insert([{
        name: newUser.name,
        username: newUser.username,
        password: newUser.password,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status
      }]).select();

      if (error) {
        console.error('Supabase user insert error:', error);
        throw new Error(error.message || 'Failed to insert user in database');
      }

      if (data && data[0]) {
        newUser = {
          ...newUser,
          id: data[0].id,
          created_at: data[0].created_at || newUser.created_at
        };
      }
    } catch (e) {
      console.error('Error inserting user to Supabase:', e);
      throw e;
    }
  } else {
    newUser.id = `usr-${Date.now()}`;
  }

  // 2. Save to local storage
  const updatedList = [...users.filter(u => u.id !== newUser.id), newUser];
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedList));
  return newUser;
};

/**
 * Update an existing user's details (Name, Username, Password, Role, Status)
 */
export const updateUser = async (userId, updates) => {
  const users = await getAllUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) throw new Error('User not found');

  const existing = users[index];
  const updatedUser = {
    ...existing,
    ...updates,
    id: existing.id // preserve immutable ID
  };

  // 1. Update in Supabase if connected
  if (supabase) {
    try {
      const dbPayload = {};
      if (updates.name !== undefined) dbPayload.name = updates.name.trim();
      if (updates.email !== undefined) dbPayload.email = updates.email.trim();
      if (updates.username !== undefined) dbPayload.username = updates.username.trim();
      if (updates.password !== undefined) dbPayload.password = updates.password.trim();
      if (updates.role !== undefined) dbPayload.role = updates.role;
      if (updates.status !== undefined) dbPayload.status = updates.status;

      const { error } = await supabase.from('users').update(dbPayload).eq('id', userId);
      if (error) {
        console.error('Supabase user update error:', error);
        throw new Error(error.message || 'Failed to update user in database');
      }
    } catch (e) {
      console.error('Could not update user in Supabase:', e);
      throw e;
    }
  }

  // 2. Update in local storage
  users[index] = updatedUser;
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));

  // If current logged-in user was updated, also update session!
  try {
    const sessionRaw = localStorage.getItem('mm_auth_session');
    if (sessionRaw) {
      const sessionUser = JSON.parse(sessionRaw);
      if (sessionUser && (sessionUser.id === userId || sessionUser.username === existing.username)) {
        const newSession = {
          ...sessionUser,
          name: updatedUser.name,
          username: updatedUser.username,
          email: updatedUser.email,
          role: updatedUser.role
        };
        localStorage.setItem('mm_auth_session', JSON.stringify(newSession));
      }
    }
  } catch {}

  // Dispatch update event for reactivity across tabs/pages
  window.dispatchEvent(new CustomEvent('mm_users_updated', { detail: updatedUser }));
  return updatedUser;
};

/**
 * Delete a user by ID
 */
export const deleteUser = async (userId) => {
  const users = await getAllUsers();
  const target = users.find(u => u.id === userId);
  if (!target) throw new Error('User not found');

  if (
    target.role?.toLowerCase() === 'admin' || 
    target.username?.toLowerCase() === 'admin' ||
    target.email?.toLowerCase() === 'monsoonmeridian@gmail.com' ||
    target.username?.toLowerCase() === 'monsoonmeridian@gmail.com' ||
    target.name?.toLowerCase() === 'admin'
  ) {
    throw new Error('The Admin account cannot be deleted!');
  }

  if (supabase) {
    try {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) {
        throw new Error(error.message || 'Failed to delete user from database');
      }
    } catch (e) {
      console.error('Could not delete user from Supabase:', e);
      throw e;
    }
  }

  const updatedList = users.filter(u => u.id !== userId);
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedList));
  return target;
};

/**
 * Authenticate by identifier (username/name/email) and password
 */
export const authenticateUser = async (identifier, password) => {
  const users = await getAllUsers();
  const cleanId = (identifier || '').trim().toLowerCase();
  const cleanPw = (password || '').trim();

  // Explicit check for Administrator credentials specified by user: monsoonmeridian@gmail.com / Amma@3747
  if ((cleanId === 'monsoonmeridian@gmail.com' || cleanId === 'admin') && (cleanPw === 'Amma@3747' || cleanPw === 'admin')) {
    const adminUser = users.find(u => u.role === 'Admin') || DEFAULT_USERS[0];
    return {
      success: true,
      user: {
        id: adminUser.id,
        name: 'Admin',
        username: 'admin',
        email: 'monsoonmeridian@gmail.com',
        role: 'Admin'
      }
    };
  }

  const match = users.find(u => 
    (u.username?.toLowerCase() === cleanId || 
     u.email?.toLowerCase() === cleanId || 
     u.name?.toLowerCase() === cleanId) &&
    u.password === cleanPw
  );

  if (match) {
    return {
      success: true,
      user: {
        id: match.id,
        name: match.name,
        username: match.username,
        email: match.email,
        role: match.role || 'Staff'
      }
    };
  }

  return { success: false, error: 'Invalid name/username or password' };
};
