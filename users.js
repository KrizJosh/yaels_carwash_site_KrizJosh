// ============================================================
// USER LEVELS & PERMISSIONS SYSTEM
// ============================================================

const USER_ROLES = {
    ADMIN: 'admin',
    STAFF: 'staff',
    MANAGER: 'manager'
};

// Define permissions for each role
const PERMISSIONS = {
    admin: {
        canView: true,
        canAdd: true,
        canEdit: true,
        canDelete: true,
        canManageStaff: true,
        canManageSalary: true,
        canManageStore: true,
        canViewReports: true,
        canExport: true,
        canChangeStatus: true,
        canManageUsers: true,
        canViewAudit: true,
        canManagePrices: true,
        pages: ['dashboard', 'transactions', 'salary', 'store', 'reports', 'prices', 'audit', 'backup']
    },
    staff: {
        canView: true,
        canAdd: true,
        canEdit: true,
        canDelete: true,
        canManageStaff: false,
        canManageSalary: false,
        canManageStore: false,
        canViewReports: false,
        canExport: true,
        canChangeStatus: true,
        canManageUsers: false,
        canViewAudit: false,
        canManagePrices: false,
        pages: ['transactions', 'store']
    },
    manager: {
        canView: true,
        canAdd: true,
        canEdit: true,
        canDelete: true,
        canManageStaff: true,
        canManageSalary: true,
        canManageStore: true,
        canViewReports: true,
        canExport: true,
        canChangeStatus: true,
        canManageUsers: false,
        canViewAudit: true,
        canManagePrices: true,
        pages: ['dashboard', 'transactions', 'salary', 'store', 'reports', 'prices', 'audit', 'backup']
    }
};

// ============================================================
// LOCAL CACHE FOR USERS (fallback and offline support)
// ============================================================
let USERS = {
    admin: {
        password: 'Passw0rd!',
        role: USER_ROLES.ADMIN,
        name: 'Admin Manager',
        employeeId: 'EMP-001',
        department: 'Management'
    },
    staff: {
        password: 'staffpasslOgin',
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

// Supabase client reference (will be set by app.js)
let supabaseUsersClient = null;
let isUserDbConnected = false;

// ============================================================
// SETUP SUPABASE CONNECTION
// ============================================================
function setSupabaseUsersClient(client, connected) {
    supabaseUsersClient = client;
    isUserDbConnected = connected;
    console.log('📊 Users module Supabase connection:', connected ? '✅ Connected' : '📄 Offline');
    
    if (connected) {
        // Load users from database
        loadUsersFromDatabase();
    }
}

// ============================================================
// LOAD USERS FROM DATABASE
// ============================================================
async function loadUsersFromDatabase() {
    if (!supabaseUsersClient || !isUserDbConnected) {
        console.log('📄 Users DB not connected, using local cache');
        return false;
    }

    try {
        const { data, error } = await supabaseUsersClient
            .from('user_accounts')
            .select('*')
            .eq('is_active', true);

        if (error) {
            console.error('❌ Error loading users from database:', error);
            return false;
        }

        if (data && data.length > 0) {
            // Merge database users with local cache
            data.forEach(user => {
                USERS[user.username] = {
                    password: user.password_hash,
                    role: user.role,
                    name: user.name,
                    employeeId: user.employee_id,
                    department: user.department,
                    id: user.id,
                    isActive: user.is_active,
                    lastLogin: user.last_login
                };
            });
            console.log(`✅ Loaded ${data.length} users from database`);
            saveUsersToStorage();
            return true;
        }
        return false;
    } catch (err) {
        console.error('❌ Could not load users from database:', err);
        return false;
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
// USER AUTHENTICATION FUNCTIONS (Database-first)
// ============================================================

async function authenticateUser(username, password) {
    console.log('🔐 authenticateUser called with:', username);
    
    // First, try to authenticate against database
    if (supabaseUsersClient && isUserDbConnected) {
        try {
            const { data, error } = await supabaseUsersClient
                .from('user_accounts')
                .select('*')
                .eq('username', username.toLowerCase())
                .eq('is_active', true)
                .single();

            if (!error && data) {
                // Simple password check (in production use bcrypt)
                if (data.password_hash === password) {
                    console.log('✅ Database authentication successful for:', username);
                    
                    // Update last login
                    await supabaseUsersClient
                        .from('user_accounts')
                        .update({ last_login: new Date().toISOString() })
                        .eq('id', data.id);

                    // Cache the user
                    USERS[username.toLowerCase()] = {
                        password: data.password_hash,
                        role: data.role,
                        name: data.name,
                        employeeId: data.employee_id,
                        department: data.department,
                        id: data.id
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
                }
            } else if (error) {
                console.log('⚠️ Database auth error, falling back to local:', error.message);
            }
        } catch (err) {
            console.warn('⚠️ Database auth failed, trying local cache:', err);
        }
    }

    // Fallback to local cache
    loadUsersFromStorage();
    const localUser = USERS[username.toLowerCase()];
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

// Synchronous version for compatibility
function authenticateUserSync(username, password) {
    console.log('🔐 authenticateUserSync called with:', username);
    
    // Load users from storage
    loadUsersFromStorage();
    
    const user = USERS[username.toLowerCase()];
    if (!user) {
        console.log('❌ User not found:', username);
        return null;
    }
    if (user.password !== password) {
        console.log('❌ Invalid password for user:', username);
        return null;
    }
    console.log('✅ Authentication successful for:', username);
    return {
        username: username,
        role: user.role,
        name: user.name,
        employeeId: user.employeeId,
        department: user.department
    };
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

function getUsers() {
    return Object.keys(USERS).map(username => ({
        username,
        ...USERS[username]
    }));
}

function getUserByUsername(username) { 
    return USERS[username.toLowerCase()] || null; 
}

function getUserRoleDisplay(role) {
    const display = { admin: 'Administrator', staff: 'Staff Member', manager: 'Manager' };
    return display[role] || role;
}

// ============================================================
// USER MANAGEMENT FUNCTIONS (Database-synced)
// ============================================================

async function addUser(username, userData) {
    // Validate
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
        return { success: false, message: 'Invalid role. Must be admin, staff, or manager' };
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

    // Save to database
    if (supabaseUsersClient && isUserDbConnected) {
        try {
            const { data, error } = await supabaseUsersClient
                .from('user_accounts')
                .insert({
                    username: username,
                    password_hash: userData.password,
                    role: userData.role.toLowerCase(),
                    name: userData.name.trim(),
                    employee_id: userData.employeeId.trim(),
                    department: userData.department ? userData.department.trim() : ''
                })
                .select()
                .single();

            if (error) {
                console.error('❌ Error adding user to database:', error);
                return { success: false, message: error.message };
            }

            console.log('✅ User added to database:', username);
        } catch (err) {
            console.error('❌ Database error:', err);
            return { success: false, message: 'Database error: ' + err.message };
        }
    }

    // Update local cache
    USERS[username] = {
        password: userData.password,
        role: userData.role.toLowerCase(),
        name: userData.name.trim(),
        employeeId: userData.employeeId.trim(),
        department: userData.department ? userData.department.trim() : ''
    };
    
    saveUsersToStorage();
    
    return { 
        success: true, 
        message: 'User added successfully',
        user: { username, ...USERS[username] }
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
        return { success: false, message: 'Invalid role. Must be admin, staff, or manager' };
    }

    // Update database
    if (supabaseUsersClient && isUserDbConnected) {
        try {
            const dbUpdates = {};
            if (updates.password) dbUpdates.password_hash = updates.password;
            if (updates.role) dbUpdates.role = updates.role.toLowerCase();
            if (updates.name) dbUpdates.name = updates.name.trim();
            if (updates.employeeId) dbUpdates.employee_id = updates.employeeId.trim();
            if (updates.department !== undefined) dbUpdates.department = updates.department ? updates.department.trim() : '';
            dbUpdates.updated_at = new Date().toISOString();

            const { error } = await supabaseUsersClient
                .from('user_accounts')
                .update(dbUpdates)
                .eq('username', username);

            if (error) {
                console.error('❌ Error updating user in database:', error);
                return { success: false, message: error.message };
            }

            console.log('✅ User updated in database:', username);
        } catch (err) {
            console.error('❌ Database error:', err);
            return { success: false, message: 'Database error: ' + err.message };
        }
    }

    // Update local cache
    if (updates.password) USERS[username].password = updates.password;
    if (updates.role) USERS[username].role = updates.role.toLowerCase();
    if (updates.name) USERS[username].name = updates.name.trim();
    if (updates.employeeId) USERS[username].employeeId = updates.employeeId.trim();
    if (updates.department !== undefined) USERS[username].department = updates.department ? updates.department.trim() : '';
    
    saveUsersToStorage();
    
    return {
        success: true,
        message: 'User updated successfully',
        user: { username, ...USERS[username] }
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

    // Soft delete in database (set is_active = false)
    if (supabaseUsersClient && isUserDbConnected) {
        try {
            const { error } = await supabaseUsersClient
                .from('user_accounts')
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .eq('username', username);

            if (error) {
                console.error('❌ Error deleting user from database:', error);
                return { success: false, message: error.message };
            }

            console.log('✅ User deactivated in database:', username);
        } catch (err) {
            console.error('❌ Database error:', err);
            return { success: false, message: 'Database error: ' + err.message };
        }
    }

    // Remove from local cache
    delete USERS[username];
    saveUsersToStorage();
    
    return {
        success: true,
        message: 'User deleted successfully'
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

function getAvailableRoles() {
    return Object.keys(USER_ROLES).map(key => ({
        value: USER_ROLES[key],
        label: getUserRoleDisplay(USER_ROLES[key])
    }));
}

// ============================================================
// LOCAL STORAGE FUNCTIONS
// ============================================================
function saveUsersToStorage() {
    try {
        localStorage.setItem('carwash_users', JSON.stringify(USERS));
    } catch (e) {
        console.warn('Could not save users to localStorage:', e);
    }
}

function loadUsersFromStorage() {
    try {
        const stored = localStorage.getItem('carwash_users');
        if (stored) {
            const parsed = JSON.parse(stored);
            USERS = { ...USERS, ...parsed };
            return true;
        }
    } catch (e) {
        console.warn('Could not load users from localStorage:', e);
    }
    return false;
}

// ============================================================
// INITIALIZATION
// ============================================================
loadUsersFromStorage();

// ============================================================
// EXPOSE FUNCTIONS GLOBALLY
// ============================================================
if (typeof window !== 'undefined') {
    // Data
    window.USERS = USERS;
    window.USER_ROLES = USER_ROLES;
    window.PERMISSIONS = PERMISSIONS;
    
    // Setup
    window.setSupabaseUsersClient = setSupabaseUsersClient;
    window.loadUsersFromDatabase = loadUsersFromDatabase;
    
    // Authentication
    window.authenticateUser = authenticateUser;
    window.authenticateUserSync = authenticateUserSync;
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
    
    // User management
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
    window.saveUsersToStorage = saveUsersToStorage;
    window.loadUsersFromStorage = loadUsersFromStorage;
}

console.log('✅ Users module loaded successfully!');
console.log('👥 Available users:', Object.keys(USERS));
console.log('📊 User stats:', getUserStats());