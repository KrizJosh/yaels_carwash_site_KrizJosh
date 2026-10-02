// ============================================================
// USER LEVELS & PERMISSIONS SYSTEM
// ============================================================

const USER_ROLES = {
    ADMIN: 'admin',
    STAFF: 'staff',
    MANAGER: 'manager'
};

const PERMISSIONS = {
    admin: {
        canView: true, canAdd: true, canEdit: true, canDelete: true,
        canManageStaff: true, canManageSalary: true, canManageStore: true,
        canViewReports: true, canExport: true, canChangeStatus: true,
        canManageUsers: true, canViewAudit: true, canManagePrices: true,
        pages: ['dashboard', 'transactions', 'salary', 'store', 'reports', 'prices', 'audit', 'backup', 'users']
    },
    staff: {
        canView: true, canAdd: true, canEdit: true, canDelete: true,
        canManageStaff: false, canManageSalary: false, canManageStore: false,
        canViewReports: false, canExport: true, canChangeStatus: true,
        canManageUsers: false, canViewAudit: false, canManagePrices: false,
        pages: ['transactions', 'store']
    }
};

// ============================================================
// DEFAULT USERS (Fallback when offline)
// ============================================================
const DEFAULT_USERS = {
    admin: {
        password: 'password123',
        role: USER_ROLES.ADMIN,
        name: 'Admin Manager',
        employeeId: 'EMP-001',
        department: 'Management'
    },
    staff: {
        password: 'password123',
        role: USER_ROLES.STAFF,
        name: 'John Doe',
        employeeId: 'EMP-002',
        department: 'Operations'
    },
    jayson: {
        password: 'password123',
        role: USER_ROLES.STAFF,
        name: 'Jayson Carwash',
        employeeId: 'EMP-003',
        department: 'Carwash'
    },
    dennis: {
        password: 'password123',
        role: USER_ROLES.STAFF,
        name: 'Dennis Detailer',
        employeeId: 'EMP-004',
        department: 'Detailing'
    },
    jomar: {
        password: 'password123',
        role: USER_ROLES.STAFF,
        name: 'Jomar Carwash',
        employeeId: 'EMP-005',
        department: 'Carwash'
    },
    manager: {
        password: 'password123',
        role: USER_ROLES.MANAGER,
        name: 'Sarah Manager',
        employeeId: 'EMP-006',
        department: 'Operations'
    }
};

// ============================================================
// STATE
// ============================================================
let USERS = { ...DEFAULT_USERS };
let supabaseUsersClient = null;
let isUserDbConnected = false;
let syncInProgress = false;
let lastSyncTime = null;

const STORAGE_KEY = 'carwash_users';
const SYNC_META_KEY = 'carwash_users_sync_meta';

// ============================================================
// CONNECTION SETUP
// ============================================================
function setSupabaseUsersClient(client, connected) {
    supabaseUsersClient = client;
    isUserDbConnected = connected;
    console.log('📊 Users module Supabase connection:', connected ? '✅ Connected' : '📄 Offline');
    
    if (connected) {
        // Trigger full sync when connection established
        syncUsersWithDatabase().then(() => {
            console.log('✅ Initial sync completed');
        }).catch(err => {
            console.warn('⚠️ Initial sync failed:', err);
        });
    }
}

// ============================================================
// LOCAL CACHE MANAGEMENT
// ============================================================
function saveUsersToStorage() {
    try {
        const cache = {
            users: USERS,
            timestamp: Date.now(),
            version: '1.0'
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
        console.log('💾 Users saved to localStorage');
        return true;
    } catch (e) {
        console.warn('❌ Could not save users to localStorage:', e);
        return false;
    }
}

function loadUsersFromStorage() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            console.log('📄 No cached users found, using defaults');
            return false;
        }
        
        const parsed = JSON.parse(stored);
        
        // Handle both old and new formats
        if (parsed.users && parsed.timestamp) {
            // New format with metadata
            USERS = { ...DEFAULT_USERS, ...parsed.users };
            lastSyncTime = parsed.timestamp;
            console.log(`📂 Loaded ${Object.keys(parsed.users).length} users from cache (${new Date(parsed.timestamp).toLocaleString()})`);
        } else {
            // Old format (just the users object)
            USERS = { ...DEFAULT_USERS, ...parsed };
            console.log(`📂 Loaded ${Object.keys(parsed).length} users from legacy cache`);
        }
        
        return true;
    } catch (e) {
        console.warn('❌ Could not load users from localStorage:', e);
        return false;
    }
}

function clearUsersCache() {
    try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(SYNC_META_KEY);
        USERS = { ...DEFAULT_USERS };
        console.log('🗑️ Users cache cleared');
    } catch (e) {
        console.warn('Could not clear cache:', e);
    }
}

// ============================================================
// SYNC META MANAGEMENT
// ============================================================
function saveSyncMeta(meta) {
    try {
        localStorage.setItem(SYNC_META_KEY, JSON.stringify({
            ...meta,
            timestamp: Date.now()
        }));
    } catch (e) {
        console.warn('Could not save sync meta:', e);
    }
}

function getSyncMeta() {
    try {
        const stored = localStorage.getItem(SYNC_META_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch (e) {
        return null;
    }
}

// ============================================================
// TWO-WAY SYNC: LOCAL ↔ DATABASE
// ============================================================
async function syncUsersWithDatabase() {
    if (!supabaseUsersClient || !isUserDbConnected) {
        console.log('📄 Cannot sync - database not connected');
        return { success: false, reason: 'not_connected' };
    }

    if (syncInProgress) {
        console.log('⏳ Sync already in progress');
        return { success: false, reason: 'in_progress' };
    }

    syncInProgress = true;
    console.log('🔄 Starting two-way sync with database...');

    try {
        // Step 1: Get all users from database
        const { data: dbUsers, error: dbError } = await supabaseUsersClient
            .from('user_accounts')
            .select('*');

        if (dbError) {
            throw new Error('Database fetch failed: ' + dbError.message);
        }

        // Step 2: Get all local users
        const localUsers = { ...USERS };

        // Step 3: Create maps for comparison
        const dbUserMap = {};
        (dbUsers || []).forEach(u => {
            dbUserMap[u.username] = u;
        });

        const localUserMap = { ...localUsers };

        // Step 4: Determine what needs to be synced
        const toAddToDb = [];       // Local only (not in DB)
        const toUpdateLocal = [];   // DB newer than local
        const toUpdateDb = [];      // Local newer than DB
        const conflicts = [];       // Both changed

        // Check local users against database
        for (const [username, localUser] of Object.entries(localUserMap)) {
            const dbUser = dbUserMap[username];
            
            if (!dbUser) {
                // User exists locally but not in DB → add to DB
                toAddToDb.push({ username, ...localUser });
            } else {
                // User exists in both → compare timestamps
                const localTime = getLocalUserTimestamp(username);
                const dbTime = dbUser.updated_at ? new Date(dbUser.updated_at).getTime() : 0;
                
                if (localTime > dbTime) {
                    // Local is newer → update DB
                    toUpdateDb.push({ username, localUser, dbUser });
                } else if (dbTime > localTime) {
                    // DB is newer → update local
                    toUpdateLocal.push({ username, dbUser });
                }
            }
        }

        // Check database users against local (find DB-only users)
        for (const [username, dbUser] of Object.entries(dbUserMap)) {
            if (!localUserMap[username]) {
                // User exists in DB but not locally → add to local
                toUpdateLocal.push({ username, dbUser });
            }
        }

        console.log('📊 Sync analysis:', {
            localOnly: toAddToDb.length,
            dbOnly: toUpdateLocal.length,
            localNewer: toUpdateDb.length,
            totalLocal: Object.keys(localUserMap).length,
            totalDb: Object.keys(dbUserMap).length
        });

        // Step 5: Apply changes
        let added = 0, updated = 0, synced = 0;

        // 5a: Add local-only users to database
        for (const user of toAddToDb) {
            try {
                const { error } = await supabaseUsersClient
                    .from('user_accounts')
                    .insert({
                        username: user.username,
                        password_hash: user.password,
                        role: user.role,
                        name: user.name,
                        employee_id: user.employeeId,
                        department: user.department,
                        is_active: true,
                        updated_at: new Date().toISOString()
                    });
                
                if (!error) {
                    added++;
                    console.log(`➕ Added ${user.username} to database`);
                } else if (error.code === '23505') {
                    // Duplicate - already exists
                    console.log(`⏭️ ${user.username} already in database`);
                } else {
                    console.warn(`⚠️ Failed to add ${user.username}:`, error.message);
                }
            } catch (err) {
                console.warn(`⚠️ Error adding ${user.username}:`, err);
            }
        }

        // 5b: Update database with newer local data
        for (const { username, localUser } of toUpdateDb) {
            try {
                const { error } = await supabaseUsersClient
                    .from('user_accounts')
                    .update({
                        password_hash: localUser.password,
                        role: localUser.role,
                        name: localUser.name,
                        employee_id: localUser.employeeId,
                        department: localUser.department,
                        updated_at: new Date().toISOString()
                    })
                    .eq('username', username);
                
                if (!error) {
                    updated++;
                    console.log(`🔄 Updated ${username} in database`);
                } else {
                    console.warn(`⚠️ Failed to update ${username}:`, error.message);
                }
            } catch (err) {
                console.warn(`⚠️ Error updating ${username}:`, err);
            }
        }

        // 5c: Update local cache with database data
        for (const { username, dbUser } of toUpdateLocal) {
            USERS[username] = {
                password: dbUser.password_hash,
                role: dbUser.role,
                name: dbUser.name,
                employeeId: dbUser.employee_id,
                department: dbUser.department,
                id: dbUser.id,
                isActive: dbUser.is_active,
                lastLogin: dbUser.last_login,
                _dbUpdatedAt: dbUser.updated_at
            };
            synced++;
            console.log(`📥 Updated ${username} from database`);
        }

        // Step 6: Save the synced state
        saveUsersToStorage();
        
        // Record sync metadata
        lastSyncTime = Date.now();
        saveSyncMeta({
            lastSync: lastSyncTime,
            added,
            updated,
            synced,
            totalUsers: Object.keys(USERS).length
        });

        const result = {
            success: true,
            added,
            updated,
            synced,
            totalLocal: Object.keys(USERS).length,
            totalDb: Object.keys(dbUserMap).length,
            timestamp: lastSyncTime
        };

        console.log('✅ Two-way sync completed:', result);
        return result;

    } catch (err) {
        console.error('❌ Sync error:', err);
        return { success: false, reason: 'error', error: err.message };
    } finally {
        syncInProgress = false;
    }
}

// Helper: Get local user timestamp (tracked via meta or fallback)
function getLocalUserTimestamp(username) {
    const meta = getSyncMeta();
    if (meta && meta.userTimestamps && meta.userTimestamps[username]) {
        return meta.userTimestamps[username];
    }
    // Fallback to last sync time or current
    return lastSyncTime || Date.now();
}

// Helper: Track local user modification time
function markUserModified(username) {
    try {
        const meta = getSyncMeta() || {};
        if (!meta.userTimestamps) meta.userTimestamps = {};
        meta.userTimestamps[username] = Date.now();
        saveSyncMeta(meta);
    } catch (e) {
        console.warn('Could not mark user modified:', e);
    }
}

// ============================================================
// SYNC OPERATIONS (called after user changes)
// ============================================================
async function syncAddUser(username, userData) {
    if (!supabaseUsersClient || !isUserDbConnected) {
        console.log('📄 Offline - user will sync later');
        return { success: true, offline: true };
    }

    try {
        const { error } = await supabaseUsersClient
            .from('user_accounts')
            .insert({
                username: username,
                password_hash: userData.password,
                role: userData.role,
                name: userData.name,
                employee_id: userData.employeeId,
                department: userData.department,
                is_active: true,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
        console.log(`✅ User ${username} synced to database`);
        return { success: true };
    } catch (err) {
        console.warn(`⚠️ Could not sync ${username} to database:`, err);
        return { success: false, error: err.message };
    }
}

async function syncUpdateUser(username, userData) {
    if (!supabaseUsersClient || !isUserDbConnected) {
        return { success: true, offline: true };
    }

    try {
        const { error } = await supabaseUsersClient
            .from('user_accounts')
            .update({
                password_hash: userData.password,
                role: userData.role,
                name: userData.name,
                employee_id: userData.employeeId,
                department: userData.department,
                updated_at: new Date().toISOString()
            })
            .eq('username', username);

        if (error) throw error;
        console.log(`✅ User ${username} update synced to database`);
        return { success: true };
    } catch (err) {
        console.warn(`⚠️ Could not sync ${username} update:`, err);
        return { success: false, error: err.message };
    }
}

async function syncDeleteUser(username) {
    if (!supabaseUsersClient || !isUserDbConnected) {
        return { success: true, offline: true };
    }

    try {
        // Soft delete - mark as inactive
        const { error } = await supabaseUsersClient
            .from('user_accounts')
            .update({ 
                is_active: false, 
                updated_at: new Date().toISOString() 
            })
            .eq('username', username);

        if (error) throw error;
        console.log(`✅ User ${username} deactivated in database`);
        return { success: true };
    } catch (err) {
        console.warn(`⚠️ Could not sync ${username} deletion:`, err);
        return { success: false, error: err.message };
    }
}

// ============================================================
// PERMISSION CHECK FUNCTIONS
// ============================================================
function hasPermission(user, permission) {
    if (!user || !user.role) return false;
    const rolePermissions = PERMISSIONS[user.role];
    if (!rolePermissions) return false;
    return rolePermissions[permission] === true;
}

function canViewTransactions(user) { return hasPermission(user, 'canView'); }
function canAddTransaction(user) { return hasPermission(user, 'canAdd'); }
function canEditTransaction(user) { return hasPermission(user, 'canEdit'); }
function canDeleteTransaction(user) { return hasPermission(user, 'canDelete'); }
function canManageStaff(user) { return hasPermission(user, 'canManageStaff'); }
function canManageSalary(user) { return hasPermission(user, 'canManageSalary'); }
function canManageStore(user) { return hasPermission(user, 'canManageStore'); }
function canViewReports(user) { return hasPermission(user, 'canViewReports'); }
function canExport(user) { return hasPermission(user, 'canExport'); }
function canChangeStatus(user) { return hasPermission(user, 'canChangeStatus'); }
function canManageUsers(user) { return hasPermission(user, 'canManageUsers'); }
function canViewAudit(user) { return hasPermission(user, 'canViewAudit'); }
function canManagePrices(user) { return hasPermission(user, 'canManagePrices'); }

function getUserPages(user) {
    if (!user || !user.role) return [];
    const rolePermissions = PERMISSIONS[user.role];
    if (!rolePermissions) return [];
    return rolePermissions.pages || [];
}

// ============================================================
// USER AUTHENTICATION
// ============================================================
async function authenticateUser(username, password) {
    console.log('🔐 authenticateUser called with:', username);
    
    const lowerUsername = username.toLowerCase();
    
    // First, try to authenticate against database
    if (supabaseUsersClient && isUserDbConnected) {
        try {
            const { data, error } = await supabaseUsersClient
                .from('user_accounts')
                .select('*')
                .eq('username', lowerUsername)
                .eq('is_active', true)
                .maybeSingle();

            if (!error && data) {
                if (data.password_hash === password) {
                    console.log('✅ Database authentication successful for:', username);
                    
                    // Update last login
                    await supabaseUsersClient
                        .from('user_accounts')
                        .update({ last_login: new Date().toISOString() })
                        .eq('id', data.id);

                    // Update local cache
                    USERS[lowerUsername] = {
                        password: data.password_hash,
                        role: data.role,
                        name: data.name,
                        employeeId: data.employee_id,
                        department: data.department,
                        id: data.id,
                        isActive: data.is_active,
                        lastLogin: data.last_login,
                        _dbUpdatedAt: data.updated_at
                    };
                    saveUsersToStorage();

                    return {
                        username: username,
                        role: data.role,
                        name: data.name,
                        employeeId: data.employee_id,
                        department: data.department,
                        id: data.id
                    };
                } else {
                    console.log('❌ Invalid password for user:', username);
                    return null;
                }
            } else if (error) {
                console.log('⚠️ Database error, falling back to local:', error.message);
            }
        } catch (err) {
            console.warn('⚠️ Database auth failed, trying local cache:', err);
        }
    }

    // Fallback to local cache
    loadUsersFromStorage();
    const localUser = USERS[lowerUsername];
    if (localUser && localUser.password === password) {
        console.log('✅ Local authentication successful for:', username);
        return {
            username: username,
            role: localUser.role,
            name: localUser.name,
            employeeId: localUser.employeeId,
            department: localUser.department
        };
    }

    console.log('❌ Authentication failed for:', username);
    return null;
}

function getUserRole(user) { return user ? user.role : null; }
function getUserDisplayName(user) { return user ? user.name : 'Unknown User'; }
function isAdmin(user) { return user && user.role === USER_ROLES.ADMIN; }
function isStaff(user) { return user && user.role === USER_ROLES.STAFF; }
function isManager(user) { return user && user.role === USER_ROLES.MANAGER; }

function getAvailablePermissions(user) {
    if (!user || !user.role) return [];
    const permissions = PERMISSIONS[user.role];
    if (!permissions) return [];
    return Object.keys(permissions).filter(key => permissions[key] === true);
}

// ============================================================
// USER MANAGEMENT FUNCTIONS (with two-way sync)
// ============================================================
async function addUser(username, userData) {
    if (!username || username.trim() === '') {
        return { success: false, message: 'Username is required' };
    }
    username = username.trim().toLowerCase();
    
    if (USERS[username]) {
        return { success: false, message: 'Username already exists' };
    }
    
    if (!userData.password || userData.password.length < 6) {
        return { success: false, message: 'Password must be at least 6 characters' };
    }
    if (!userData.name || userData.name.trim() === '') {
        return { success: false, message: 'Name is required' };
    }
    if (!userData.role || !USER_ROLES[userData.role.toUpperCase()]) {
        return { success: false, message: 'Invalid role' };
    }
    if (!userData.employeeId || userData.employeeId.trim() === '') {
        return { success: false, message: 'Employee ID is required' };
    }

    // Check employee ID uniqueness
    for (const key in USERS) {
        if (USERS[key].employeeId === userData.employeeId.trim()) {
            return { success: false, message: 'Employee ID already exists' };
        }
    }

    const newUser = {
        password: userData.password,
        role: userData.role.toLowerCase(),
        name: userData.name.trim(),
        employeeId: userData.employeeId.trim(),
        department: userData.department ? userData.department.trim() : ''
    };

    // Add to local cache
    USERS[username] = newUser;
    saveUsersToStorage();
    markUserModified(username);

    // Sync to database
    const syncResult = await syncAddUser(username, newUser);
    
    return { 
        success: true, 
        message: syncResult.success 
            ? 'User added and synced to database' 
            : 'User added locally (will sync when online)',
        user: { username, ...newUser },
        synced: syncResult.success
    };
}

async function updateUser(username, updates) {
    if (!username || !USERS[username]) {
        return { success: false, message: 'User not found' };
    }
    
    if (username === 'admin') {
        return { success: false, message: 'Cannot modify the admin user' };
    }
    
    if (updates.password && updates.password.length < 6) {
        return { success: false, message: 'Password must be at least 6 characters' };
    }
    if (updates.role && !USER_ROLES[updates.role.toUpperCase()]) {
        return { success: false, message: 'Invalid role' };
    }

    // Update local cache
    if (updates.password) USERS[username].password = updates.password;
    if (updates.role) USERS[username].role = updates.role.toLowerCase();
    if (updates.name) USERS[username].name = updates.name.trim();
    if (updates.employeeId) USERS[username].employeeId = updates.employeeId.trim();
    if (updates.department !== undefined) {
        USERS[username].department = updates.department ? updates.department.trim() : '';
    }
    
    saveUsersToStorage();
    markUserModified(username);

    // Sync to database
    const syncResult = await syncUpdateUser(username, USERS[username]);
    
    return {
        success: true,
        message: syncResult.success 
            ? 'User updated and synced' 
            : 'User updated locally (will sync when online)',
        user: { username, ...USERS[username] },
        synced: syncResult.success
    };
}

async function deleteUser(username) {
    if (!username || !USERS[username]) {
        return { success: false, message: 'User not found' };
    }
    
    if (username === 'admin') {
        return { success: false, message: 'Cannot delete the admin user' };
    }
    
    const adminCount = Object.values(USERS).filter(u => u.role === 'admin').length;
    if (USERS[username].role === 'admin' && adminCount <= 1) {
        return { success: false, message: 'Cannot delete the last admin user' };
    }

    // Remove from local cache
    delete USERS[username];
    saveUsersToStorage();

    // Sync to database
    const syncResult = await syncDeleteUser(username);
    
    return {
        success: true,
        message: syncResult.success 
            ? 'User deleted and synced' 
            : 'User deleted locally (will sync when online)',
        synced: syncResult.success
    };
}

async function changePassword(username, oldPassword, newPassword) {
    if (!username || !USERS[username]) {
        return { success: false, message: 'User not found' };
    }
    
    if (USERS[username].password !== oldPassword) {
        return { success: false, message: 'Current password is incorrect' };
    }
    
    if (!newPassword || newPassword.length < 6) {
        return { success: false, message: 'New password must be at least 6 characters' };
    }

    return await updateUser(username, { password: newPassword });
}

async function resetUserPassword(username, newPassword) {
    if (!username || !USERS[username]) {
        return { success: false, message: 'User not found' };
    }
    
    if (!newPassword || newPassword.length < 6) {
        return { success: false, message: 'Password must be at least 6 characters' };
    }

    return await updateUser(username, { password: newPassword });
}

// ============================================================
// USER LOOKUP FUNCTIONS
// ============================================================
function getUsers() {
    return Object.keys(USERS).map(username => ({
        username,
        ...USERS[username]
    }));
}

function getUserByUsername(username) { 
    return USERS[username.toLowerCase()] || null; 
}

function getUsersByRole(role) {
    if (!USER_ROLES[role.toUpperCase()]) return [];
    return Object.keys(USERS)
        .filter(username => USERS[username].role === role.toLowerCase())
        .map(username => ({ username, ...USERS[username] }));
}

function searchUsers(query) {
    if (!query || query.trim() === '') return getUsers();
    const q = query.toLowerCase().trim();
    return Object.keys(USERS)
        .filter(username => {
            const user = USERS[username];
            return username.toLowerCase().includes(q) ||
                   (user.name || '').toLowerCase().includes(q) ||
                   (user.employeeId || '').toLowerCase().includes(q) ||
                   (user.department || '').toLowerCase().includes(q);
        })
        .map(username => ({ username, ...USERS[username] }));
}

function getUserStats() {
    const stats = { total: 0, admin: 0, staff: 0, manager: 0 };
    Object.values(USERS).forEach(user => {
        stats.total++;
        if (user.role === 'admin') stats.admin++;
        else if (user.role === 'staff') stats.staff++;
        else if (user.role === 'manager') stats.manager++;
    });
    return stats;
}

function isValidUsername(username) {
    return /^[a-zA-Z0-9_]+$/.test(username);
}

function getUserRoleDisplay(role) {
    const display = { 
        admin: 'Administrator', 
        staff: 'Staff Member', 
        manager: 'Manager' 
    };
    return display[role] || role;
}

function getAvailableRoles() {
    return Object.keys(USER_ROLES).map(key => ({
        value: USER_ROLES[key],
        label: getUserRoleDisplay(USER_ROLES[key])
    }));
}

// ============================================================
// SYNC STATUS FUNCTIONS
// ============================================================
function getSyncStatus() {
    const meta = getSyncMeta();
    return {
        isConnected: isUserDbConnected,
        syncInProgress: syncInProgress,
        lastSync: lastSyncTime,
        lastSyncFormatted: lastSyncTime ? new Date(lastSyncTime).toLocaleString() : 'Never',
        totalUsers: Object.keys(USERS).length,
        pendingChanges: Object.keys(USERS).filter(u => {
            const meta = getSyncMeta();
            return meta?.userTimestamps?.[u] > (lastSyncTime || 0);
        }).length
    };
}

async function forceSyncNow() {
    console.log('🔄 Force sync requested');
    return await syncUsersWithDatabase();
}

// ============================================================
// INITIALIZATION
// ============================================================
loadUsersFromStorage();
console.log('📊 Users module initialized');
console.log('👥 Available users:', Object.keys(USERS));
console.log('📈 User stats:', getUserStats());

// ============================================================
// EXPOSE GLOBALLY
// ============================================================
if (typeof window !== 'undefined') {
    // Data
    window.USERS = USERS;
    window.USER_ROLES = USER_ROLES;
    window.PERMISSIONS = PERMISSIONS;
    
    // Setup & Sync
    window.setSupabaseUsersClient = setSupabaseUsersClient;
    window.syncUsersWithDatabase = syncUsersWithDatabase;
    window.forceSyncNow = forceSyncNow;
    window.getSyncStatus = getSyncStatus;
    window.clearUsersCache = clearUsersCache;
    
    // Authentication
    window.authenticateUser = authenticateUser;
    window.getUserRole = getUserRole;
    window.getUserDisplayName = getUserDisplayName;
    window.isAdmin = isAdmin;
    window.isStaff = isStaff;
    window.isManager = isManager;
    
    // Permissions
    window.hasPermission = hasPermission;
    window.canViewTransactions = canViewTransactions;
    window.canAddTransaction = canAddTransaction;
    window.canEditTransaction = canEditTransaction;
    window.canDeleteTransaction = canDeleteTransaction;
    window.canManageStaff = canManageStaff;
    window.canManageSalary = canManageSalary;
    window.canManageStore = canManageStore;
    window.canViewReports = canViewReports;
    window.canExport = canExport;
    window.canChangeStatus = canChangeStatus;
    window.canManageUsers = canManageUsers;
    window.canViewAudit = canViewAudit;
    window.canManagePrices = canManagePrices;
    window.getUserPages = getUserPages;
    window.getAvailablePermissions = getAvailablePermissions;
    
    // User Management
    window.getUsers = getUsers;
    window.getUserByUsername = getUserByUsername;
    window.addUser = addUser;
    window.updateUser = updateUser;
    window.deleteUser = deleteUser;
    window.changePassword = changePassword;
    window.resetUserPassword = resetUserPassword;
    window.getUsersByRole = getUsersByRole;
    window.searchUsers = searchUsers;
    window.getUserStats = getUserStats;
    window.isValidUsername = isValidUsername;
    window.getUserRoleDisplay = getUserRoleDisplay;
    window.getAvailableRoles = getAvailableRoles;
    
    // Storage
    window.saveUsersToStorage = saveUsersToStorage;
    window.loadUsersFromStorage = loadUsersFromStorage;
}

console.log('✅ Users module loaded successfully with two-way sync!');