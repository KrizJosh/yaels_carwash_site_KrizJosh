// ============================================================
// USER LEVELS & PERMISSIONS SYSTEM
// MINI BOSS CARWASH
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
        pages: ['dashboard', 'transactions', 'salary', 'store', 'accessories', 'reports', 'prices', 'audit', 'backup']
    },
    manager: {
        canView: true, canAdd: true, canEdit: true, canDelete: true,
        canManageStaff: true, canManageSalary: true, canManageStore: true,
        canViewReports: true, canExport: true, canChangeStatus: true,
        canManageUsers: false, canViewAudit: true, canManagePrices: true,
        pages: ['dashboard', 'transactions', 'salary', 'store', 'accessories', 'reports', 'prices', 'audit', 'backup']
    },
    staff: {
        canView: true, canAdd: true, canEdit: true, canDelete: true,
        canManageStaff: false, canManageSalary: false, canManageStore: true,
        canViewReports: false, canExport: true, canChangeStatus: true,
        canManageUsers: false, canViewAudit: false, canManagePrices: false,
        pages: ['dashboard', 'transactions', 'store', 'accessories']
    }
};

// ============================================================
// DEFAULT USERS DATABASE
// ============================================================
const DEFAULT_USERS = {
    admin: {
        password: 'password123', role: 'admin', name: 'Admin Manager',
        employeeId: 'EMP-001', department: 'Management'
    },
    staff: {
        password: 'password123', role: 'staff', name: 'John Doe',
        employeeId: 'EMP-002', department: 'Operations'
    },
    manager: {
        password: 'password123', role: 'manager', name: 'Jane Manager',
        employeeId: 'EMP-003', department: 'Management'
    }
};

// ============================================================
// STATE
// ============================================================
let USERS = { ...DEFAULT_USERS };
let supabaseUsersClient = null;
let isUserDbConnected = false;
let syncInProgress = false;

const STORAGE_KEY = 'carwash_users';
const SYNC_META_KEY = 'carwash_users_sync_meta';

// Expose live getter so window.USERS always reflects current state
Object.defineProperty(window, 'USERS', {
    get() { return USERS; },
    configurable: true
});

// ============================================================
// CORE AUTHENTICATION
// ============================================================
function authenticateUser(username, password) {
    if (!username || !password) return null;
    loadUsersFromStorage();
    const lowerUsername = username.toLowerCase().trim();
    const user = USERS[lowerUsername];
    if (!user) return null;
    if (user.password !== password) return null;

    // Track login
    user.lastLogin = new Date().toISOString();
    saveUsersToStorage();

    return {
        username: lowerUsername,
        role: user.role,
        name: user.name,
        employeeId: user.employeeId,
        department: user.department
    };
}

// ============================================================
// PERMISSION CHECKS
// ============================================================
function hasPermission(user, permission) {
    if (!user || !user.role) return false;
    const rolePermissions = PERMISSIONS[user.role];
    if (!rolePermissions) return false;
    return rolePermissions[permission] === true;
}

function canViewTransactions(u) { return hasPermission(u, 'canView'); }
function canAddTransaction(u) { return hasPermission(u, 'canAdd'); }
function canEditTransaction(u) { return hasPermission(u, 'canEdit'); }
function canDeleteTransaction(u) { return hasPermission(u, 'canDelete'); }
function canManageStaff(u) { return hasPermission(u, 'canManageStaff'); }
function canManageSalary(u) { return hasPermission(u, 'canManageSalary'); }
function canManageStore(u) { return hasPermission(u, 'canManageStore'); }
function canViewReports(u) { return hasPermission(u, 'canViewReports'); }
function canExport(u) { return hasPermission(u, 'canExport'); }
function canChangeStatus(u) { return hasPermission(u, 'canChangeStatus'); }
function canManageUsers(u) { return hasPermission(u, 'canManageUsers'); }
function canViewAudit(u) { return hasPermission(u, 'canViewAudit'); }
function canManagePrices(u) { return hasPermission(u, 'canManagePrices'); }

function getUserPages(user) {
    if (!user || !user.role) return [];
    return PERMISSIONS[user.role]?.pages || [];
}

function getAvailablePermissions(user) {
    if (!user || !user.role) return [];
    const permissions = PERMISSIONS[user.role];
    if (!permissions) return [];
    return Object.keys(permissions).filter(key => permissions[key] === true);
}

// ============================================================
// USER HELPERS
// ============================================================
function getUserRole(user) { return user ? user.role : null; }
function getUserDisplayName(user) { return user ? user.name : 'Unknown User'; }
function isAdmin(user) { return !!(user && user.role === USER_ROLES.ADMIN); }
function isStaff(user) { return !!(user && user.role === USER_ROLES.STAFF); }
function isManager(user) { return !!(user && user.role === USER_ROLES.MANAGER); }

function getUsers() {
    return Object.keys(USERS).map(username => ({ username, ...USERS[username] }));
}

function getUserByUsername(username) {
    if (!username) return null;
    return USERS[username.toLowerCase()] || null;
}

function getUserByEmployeeId(employeeId) {
    if (!employeeId) return null;
    const target = employeeId.trim();
    for (const [username, user] of Object.entries(USERS)) {
        if (user.employeeId === target) return { username, ...user };
    }
    return null;
}

function getUsersByRole(role) {
    if (!role || typeof role !== 'string') return [];
    const r = role.toLowerCase();
    if (!['admin', 'staff', 'manager'].includes(r)) return [];
    return Object.keys(USERS)
        .filter(username => USERS[username].role === r)
        .map(username => ({ username, ...USERS[username] }));
}

function searchUsers(query) {
    if (!query || query.trim() === '') return getUsers();
    const q = query.toLowerCase().trim();
    return Object.keys(USERS)
        .filter(username => {
            const u = USERS[username];
            return username.toLowerCase().includes(q)
                || (u.name || '').toLowerCase().includes(q)
                || (u.employeeId || '').toLowerCase().includes(q)
                || (u.department || '').toLowerCase().includes(q);
        })
        .map(username => ({ username, ...USERS[username] }));
}

function getUserStats() {
    const stats = { total: 0, admin: 0, staff: 0, manager: 0 };
    Object.values(USERS).forEach(u => {
        stats.total++;
        if (u.role === 'admin') stats.admin++;
        else if (u.role === 'staff') stats.staff++;
        else if (u.role === 'manager') stats.manager++;
    });
    return stats;
}

function isValidUsername(username) {
    return /^[a-zA-Z0-9_]+$/.test(username);
}

function getUserRoleDisplay(role) {
    const display = { admin: 'Administrator', staff: 'Staff Member', manager: 'Manager' };
    return display[role] || role;
}

function getAvailableRoles() {
    return [
        { value: 'admin', label: 'Administrator' },
        { value: 'staff', label: 'Staff Member' },
        { value: 'manager', label: 'Manager' }
    ];
}

// ============================================================
// USER CRUD (available for future use even if UI removed)
// ============================================================
async function addUser(username, userData) {
    if (!username || !username.trim()) return { success: false, message: 'Username is required' };
    username = username.trim().toLowerCase();

    if (!isValidUsername(username)) return { success: false, message: 'Username can only contain letters, numbers, and underscores' };
    if (USERS[username]) return { success: false, message: 'Username already exists' };
    if (!userData.password || userData.password.length < 6) return { success: false, message: 'Password must be at least 6 characters' };
    if (!userData.name || userData.name.trim() === '') return { success: false, message: 'Name is required' };
    if (!userData.role || !['admin', 'staff', 'manager'].includes(userData.role.toLowerCase())) return { success: false, message: 'Invalid role' };
    if (!userData.employeeId || userData.employeeId.trim() === '') return { success: false, message: 'Employee ID is required' };
    if (getUserByEmployeeId(userData.employeeId.trim())) return { success: false, message: 'Employee ID already exists' };

    const newUser = {
        password: userData.password,
        role: userData.role.toLowerCase(),
        name: userData.name.trim(),
        employeeId: userData.employeeId.trim(),
        department: userData.department ? userData.department.trim() : '',
        createdAt: new Date().toISOString()
    };

    USERS[username] = newUser;
    saveUsersToStorage();

    if (supabaseUsersClient && isUserDbConnected) {
        try {
            await supabaseUsersClient.from('user_accounts').insert({
                username,
                password_hash: newUser.password,
                role: newUser.role,
                name: newUser.name,
                employee_id: newUser.employeeId,
                department: newUser.department,
                is_active: true
            });
        } catch (err) { console.warn('DB sync error:', err); }
    }

    return { success: true, message: 'User added successfully', user: { username, ...newUser } };
}

async function updateUser(username, updates) {
    if (!username || !USERS[username]) return { success: false, message: 'User not found' };
    if (username === 'admin' && updates.role && updates.role !== 'admin') {
        return { success: false, message: 'Cannot change the role of the primary admin' };
    }
    if (updates.password && updates.password.length < 6) return { success: false, message: 'Password must be at least 6 characters' };
    if (updates.role && !['admin', 'staff', 'manager'].includes(updates.role.toLowerCase())) return { success: false, message: 'Invalid role' };

    if (updates.role && USERS[username].role === 'admin' && updates.role !== 'admin') {
        const adminCount = Object.values(USERS).filter(u => u.role === 'admin').length;
        if (adminCount <= 1) return { success: false, message: 'Cannot demote the last admin' };
    }

    if (updates.employeeId) {
        const existing = getUserByEmployeeId(updates.employeeId.trim());
        if (existing && existing.username !== username) return { success: false, message: 'Employee ID already exists' };
    }

    if (updates.password) USERS[username].password = updates.password;
    if (updates.role) USERS[username].role = updates.role.toLowerCase();
    if (updates.name) USERS[username].name = updates.name.trim();
    if (updates.employeeId) USERS[username].employeeId = updates.employeeId.trim();
    if (updates.department !== undefined) USERS[username].department = updates.department ? updates.department.trim() : '';
    USERS[username].updatedAt = new Date().toISOString();

    saveUsersToStorage();

    if (supabaseUsersClient && isUserDbConnected) {
        try {
            const dbUpdates = { updated_at: new Date().toISOString() };
            if (updates.password) dbUpdates.password_hash = updates.password;
            if (updates.role) dbUpdates.role = updates.role.toLowerCase();
            if (updates.name) dbUpdates.name = updates.name.trim();
            if (updates.employeeId) dbUpdates.employee_id = updates.employeeId.trim();
            if (updates.department !== undefined) dbUpdates.department = (updates.department || '').trim();
            await supabaseUsersClient.from('user_accounts').update(dbUpdates).eq('username', username);
        } catch (err) { console.warn('DB sync error:', err); }
    }

    return { success: true, message: 'User updated successfully', user: { username, ...USERS[username] } };
}

async function deleteUser(username) {
    if (!username || !USERS[username]) return { success: false, message: 'User not found' };
    if (username === 'admin') return { success: false, message: 'Cannot delete the primary admin user' };

    const adminCount = Object.values(USERS).filter(u => u.role === 'admin').length;
    if (USERS[username].role === 'admin' && adminCount <= 1) {
        return { success: false, message: 'Cannot delete the last admin' };
    }

    delete USERS[username];
    saveUsersToStorage();

    if (supabaseUsersClient && isUserDbConnected) {
        try {
            await supabaseUsersClient.from('user_accounts')
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .eq('username', username);
        } catch (err) { console.warn('DB sync error:', err); }
    }

    return { success: true, message: 'User deleted successfully' };
}

async function changePassword(username, oldPassword, newPassword) {
    if (!username || !USERS[username]) return { success: false, message: 'User not found' };
    if (USERS[username].password !== oldPassword) return { success: false, message: 'Current password is incorrect' };
    if (!newPassword || newPassword.length < 6) return { success: false, message: 'New password must be at least 6 characters' };
    return await updateUser(username, { password: newPassword });
}

async function resetUserPassword(username, newPassword) {
    if (!username || !USERS[username]) return { success: false, message: 'User not found' };
    if (!newPassword || newPassword.length < 6) return { success: false, message: 'Password must be at least 6 characters' };
    return await updateUser(username, { password: newPassword });
}

// ============================================================
// STORAGE
// ============================================================
function saveUsersToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            users: USERS,
            timestamp: Date.now(),
            version: '1.1'
        }));
        return true;
    } catch (e) {
        console.warn('Could not save users:', e);
        return false;
    }
}

function loadUsersFromStorage() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            USERS = { ...DEFAULT_USERS };
            saveUsersToStorage();
            return false;
        }
        const parsed = JSON.parse(stored);
        const storedUsers = parsed.users || parsed;
        if (!storedUsers || typeof storedUsers !== 'object') {
            USERS = { ...DEFAULT_USERS };
            return false;
        }
        USERS = { ...storedUsers };

        // Safety net: ensure at least one admin exists
        const hasAdmin = Object.values(USERS).some(u => u.role === 'admin');
        if (!hasAdmin) {
            USERS.admin = { ...DEFAULT_USERS.admin };
            saveUsersToStorage();
        }
        return true;
    } catch (e) {
        console.warn('Could not load users:', e);
        USERS = { ...DEFAULT_USERS };
        return false;
    }
}

function clearUsersCache() {
    try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(SYNC_META_KEY);
        USERS = { ...DEFAULT_USERS };
        saveUsersToStorage();
    } catch (e) { console.warn('Could not clear cache:', e); }
}

// ============================================================
// SUPABASE SYNC
// ============================================================
function setSupabaseUsersClient(client, connected) {
    supabaseUsersClient = client;
    isUserDbConnected = connected;
    console.log('📊 Users DB:', connected ? '✅ Connected' : '📄 Offline');
    if (connected && client) {
        loadUsersFromDatabase().catch(err => console.warn('Initial user sync failed:', err));
    }
}

async function loadUsersFromDatabase() {
    if (!supabaseUsersClient || !isUserDbConnected) return false;
    try {
        const { data, error } = await supabaseUsersClient.from('user_accounts').select('*').eq('is_active', true);
        if (error) throw error;
        if (data && data.length > 0) {
            data.forEach(u => {
                USERS[u.username.toLowerCase()] = {
                    password: u.password_hash,
                    role: u.role,
                    name: u.name,
                    employeeId: u.employee_id,
                    department: u.department,
                    id: u.id,
                    isActive: u.is_active,
                    lastLogin: u.last_login
                };
            });
            saveUsersToStorage();
            return true;
        }
    } catch (err) { console.warn('Could not load users from DB:', err); }
    return false;
}

async function syncUsersWithDatabase() {
    if (!supabaseUsersClient || !isUserDbConnected) return { success: false, reason: 'not_connected' };
    if (syncInProgress) return { success: false, reason: 'in_progress' };

    syncInProgress = true;
    try {
        const { data: dbUsers, error } = await supabaseUsersClient.from('user_accounts').select('*');
        if (error) throw error;

        const dbMap = {};
        (dbUsers || []).forEach(u => { dbMap[u.username] = u; });

        for (const [username, localUser] of Object.entries(USERS)) {
            if (!dbMap[username]) {
                try {
                    await supabaseUsersClient.from('user_accounts').insert({
                        username,
                        password_hash: localUser.password,
                        role: localUser.role,
                        name: localUser.name,
                        employee_id: localUser.employeeId,
                        department: localUser.department,
                        is_active: true
                    });
                } catch (e) { /* ignore */ }
            }
        }

        await loadUsersFromDatabase();
        syncInProgress = false;
        return { success: true, totalUsers: Object.keys(USERS).length };
    } catch (err) {
        syncInProgress = false;
        return { success: false, error: err.message };
    }
}

// ============================================================
// INIT
// ============================================================
loadUsersFromStorage();

// ============================================================
// GLOBAL EXPORTS
// ============================================================
window.USER_ROLES = USER_ROLES;
window.PERMISSIONS = PERMISSIONS;
window.authenticateUser = authenticateUser;
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
window.getUserRole = getUserRole;
window.getUserDisplayName = getUserDisplayName;
window.isAdmin = isAdmin;
window.isStaff = isStaff;
window.isManager = isManager;
window.getUsers = getUsers;
window.getUserByUsername = getUserByUsername;
window.getUserByEmployeeId = getUserByEmployeeId;
window.getUsersByRole = getUsersByRole;
window.searchUsers = searchUsers;
window.getUserStats = getUserStats;
window.isValidUsername = isValidUsername;
window.getUserRoleDisplay = getUserRoleDisplay;
window.getAvailableRoles = getAvailableRoles;
window.addUser = addUser;
window.updateUser = updateUser;
window.deleteUser = deleteUser;
window.changePassword = changePassword;
window.resetUserPassword = resetUserPassword;
window.saveUsersToStorage = saveUsersToStorage;
window.loadUsersFromStorage = loadUsersFromStorage;
window.clearUsersCache = clearUsersCache;
window.setSupabaseUsersClient = setSupabaseUsersClient;
window.loadUsersFromDatabase = loadUsersFromDatabase;
window.syncUsersWithDatabase = syncUsersWithDatabase;
