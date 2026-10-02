// ============================================================
// SESSION MANAGEMENT
// ============================================================
const SESSION_KEY = 'carwash_session';
const SESSION_EXPIRY = 24 * 60 * 60 * 1000;

function saveSession(user) {
    if (!user) {
        localStorage.removeItem(SESSION_KEY);
        return;
    }
    const session = {
        user: user,
        timestamp: Date.now(),
        expires: Date.now() + SESSION_EXPIRY
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function getSession() {
    try {
        const sessionData = localStorage.getItem(SESSION_KEY);
        if (!sessionData) return null;
        const session = JSON.parse(sessionData);
        if (Date.now() > session.expires) {
            localStorage.removeItem(SESSION_KEY);
            return null;
        }
        return session.user;
    } catch (e) {
        return null;
    }
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}
// Add function to display sync status
function renderSyncStatus() {
    const statusEl = document.getElementById('syncStatus');
    if (!statusEl) return;
    
    if (typeof getSyncStatus !== 'function') {
        statusEl.innerHTML = '<span style="color:var(--warning);">Sync not available</span>';
        return;
    }
    
    const status = getSyncStatus();
    
    let html = '';
    if (status.isConnected) {
        html = `
            <span style="color:var(--success);">
                <i class="fas fa-cloud-check"></i> 
                Connected • Last sync: ${status.lastSyncFormatted}
            </span>
        `;
    } else {
        html = `
            <span style="color:var(--warning);">
                <i class="fas fa-cloud-slash"></i> 
                Offline • ${status.totalUsers} users cached locally
            </span>
        `;
    }
    
    if (status.pendingChanges > 0) {
        html += ` <span style="color:var(--warning);">• ${status.pendingChanges} pending changes</span>`;
    }
    
    statusEl.innerHTML = html;
}


// ============================================================
// CONFIGURATION
// ============================================================
const SUPABASE_URL = 'https://lbodymcytlzzcldswaku.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxib2R5bWN5dGx6emNsZHN3YWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MDMzMDksImV4cCI6MjEwMzQ3OTMwOX0.Nt77gIuO3dKyTg4LBfb-3TAVbC7S10Lp4A7fpfJPRS8';
const DELETED_TABLE = 'deleted_transactions';
const TABLE_NAME = 'transactions';
const SALARY_TABLE = 'carwasher_salaries';
const AUDIT_TABLE = 'audit_trail';
const SERVICE_PRICES_TABLE = 'service_prices';
const STORE_SUMMARY_TABLE = 'july19_summary';
const BACKUP_HISTORY_KEY = 'carwash_backup_history';

// ============================================================
// STATE
// ============================================================
let currentUser = null;
let supabaseClient = null;
let isSupabaseConnected = false;
let isLoading = false;
let dataLoaded = false;
let transactions = [];
let filteredTransactions = [];
let reportData = [];
let salaryData = [];
let auditLogs = [];
let filteredAuditLogs = [];
let storeOrderItems = [];
let selectedIds = new Set();
let selectedServices = [];
let serviceTotal = 0;
let servicePrices = [];
let changedPrices = new Set();
let sortColumn = 'id';
let sortDirection = 'desc';
let isDetailerRequired = false;
let backupHistory = [];
let autoBackupTimer = null;

// Store data
let storeData = {
    cigarettes: 0, snacks: 0,
    drinksWater: 0, drinksSoda: 0, drinksCoffee: 0, drinksJuice: 0, drinksEnergy: 0,
    palutoNoodles: 0, palutoRice: 0, palutoSoup: 0, palutoSilog: 0, palutoAppetizer: 0,
    otherSales: 0, gcashCw: 0, gcashFoods: 0, expenses: 0
};

// Dropdown data
let dropdownData = {
    models: ['VIOS', 'INNOVA', 'HILUX', 'XPANDER', 'AVANZA', 'MIRAGE', 'MONTERO', 'FORTUNER', 'BRV', 'WIGO', 'NV350', 'HIACE', 'RUSH', 'RAIZE', 'VELOZ'],
    services: ['CARWASH', 'HANDWAX', 'MACHINEWAX', 'ACIDRAIN', 'BACKTOZERO', 'ENGINEWASH', 'UNDERWASH', 'QW', 'BTZ'],
    other: ['ACIDRAIN', 'BACKTOZERO', 'BTZ', 'ENGINEWASH', 'MACHINEWAX', 'HANDWAX', 'HEADLIGHT REST.', 'SEAT COVER'],
    carwasher: ['JAYSON', 'DENNIS', 'JOMAR', 'RODEL', 'JUSTINE', 'JM', 'PHILIP', 'KURT', 'ADING', 'HART'],
    detailer: ['DENNIS', 'JOMAR', 'JAYSON', 'RODEL', 'JUSTINE', 'JM', 'PHILIP', 'KURT', 'ADING', 'HART', '']
};


// ============================================================
// USER MANAGEMENT FUNCTIONS
// ============================================================

async function refreshUsers() {
    showNotification('Refreshing users...', 'info');
    await loadUsersFromDatabase();
    renderUsersTable();
    showNotification('Users refreshed', 'success');
}

function renderUsersTable() {
    const tbody = document.getElementById('usersBody');
    if (!tbody) return;

    const users = getUsers();
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    users.forEach((user, idx) => {
        const tr = document.createElement('tr');
        const roleClass = user.role === 'admin' ? 'badge-danger' : 
                          user.role === 'manager' ? 'badge-warning' : 'badge-info';
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td><strong>${user.username}</strong></td>
            <td>${user.name || '—'}</td>
            <td><span class="badge ${roleClass}">${(user.role || '').toUpperCase()}</span></td>
            <td>${user.employeeId || '—'}</td>
            <td>${user.department || '—'}</td>
            <td><span class="badge badge-success">ACTIVE</span></td>
            <td>
                <div class="row-actions">
                    <button class="btn btn-sm btn-primary" onclick="openUserModal('${user.username}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${user.username !== 'admin' ? `
                        <button class="btn btn-sm btn-danger" onclick="deleteUserConfirm('${user.username}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openUserModal(username = null) {
    if (!checkPermission('manage_users')) return;

    const modal = document.getElementById('userModal');
    const title = document.getElementById('userModalTitle');
    const form = document.getElementById('userForm');
    
    form.reset();
    
    if (username) {
        title.textContent = '✏️ Edit User';
        document.getElementById('editUsername').value = username;
        document.getElementById('userUsername').value = username;
        document.getElementById('userUsername').disabled = true;
        
        const user = getUserByUsername(username);
        if (user) {
            document.getElementById('userName').value = user.name || '';
            document.getElementById('userRole').value = user.role || 'staff';
            document.getElementById('userEmployeeId').value = user.employeeId || '';
            document.getElementById('userDepartment').value = user.department || '';
            document.getElementById('userPassword').required = false;
            document.getElementById('userPassword').placeholder = 'Leave blank to keep current';
        }
    } else {
        title.textContent = '👤 Add User';
        document.getElementById('editUsername').value = '';
        document.getElementById('userUsername').disabled = false;
        document.getElementById('userPassword').required = true;
        document.getElementById('userPassword').placeholder = 'Min 6 characters';
    }

    modal.classList.add('active');
}

function closeUserModal() {
    const modal = document.getElementById('userModal');
    if (modal) modal.classList.remove('active');
}

async function saveUser(e) {
    e.preventDefault();
    if (!checkPermission('manage_users')) return;

    const editUsername = document.getElementById('editUsername').value;
    const username = document.getElementById('userUsername').value.trim().toLowerCase();
    const password = document.getElementById('userPassword').value;
    const name = document.getElementById('userName').value.trim();
    const role = document.getElementById('userRole').value;
    const employeeId = document.getElementById('userEmployeeId').value.trim();
    const department = document.getElementById('userDepartment').value.trim();

    let result;
    
    if (editUsername) {
        // Update existing user
        const updates = { name, role, employeeId, department };
        if (password) {
            if (password.length < 6) {
                showNotification('Password must be at least 6 characters', 'error');
                return;
            }
            updates.password = password;
        }
        result = updateUser(editUsername, updates);
        
        if (result.success && USERS_TABLE_REF) {
            const user = getUserByUsername(editUsername);
            await saveUserToDatabase(editUsername, {
                password: user.password,
                name: user.name,
                role: user.role,
                employeeId: user.employeeId,
                department: user.department
            });
        }
    } else {
        // Add new user
        if (password.length < 6) {
            showNotification('Password must be at least 6 characters', 'error');
            return;
        }
        result = addUser(username, { password, name, role, employeeId, department });
        
        if (result.success && USERS_TABLE_REF) {
            await saveUserToDatabase(username, {
                password, name, role, employeeId, department
            });
        }
    }

    if (result.success) {
        showNotification(result.message, 'success');
        closeUserModal();
        renderUsersTable();
        logAudit('UPDATE', `User ${editUsername ? 'updated' : 'added'}: ${username}`, {
            username, role, action: editUsername ? 'update' : 'add'
        });
    } else {
        showNotification(result.message, 'error');
    }
}

async function deleteUserConfirm(username) {
    if (!checkPermission('manage_users')) return;
    
    const confirmed = await showConfirm({
        icon: '🗑️',
        iconColor: '#dc2626',
        title: 'Delete User',
        message: `Are you sure you want to delete user "${username}"?`,
        details: {
            transaction: `<strong>${username}</strong>`,
            amount: 'This action cannot be undone',
            status: '⚠️ IRREVERSIBLE'
        },
        buttonClass: 'btn-danger',
        buttonText: '<i class="fas fa-trash"></i> Delete User'
    });
    
    if (!confirmed) return;

    const result = deleteUser(username);
    
    if (result.success && USERS_TABLE_REF) {
        await deleteUserFromDatabase(username);
    }

    if (result.success) {
        showNotification(result.message, 'success');
        renderUsersTable();
        logAudit('DELETE', `User deleted: ${username}`, { username });
    } else {
        showNotification(result.message, 'error');
    }
}

// Expose functions
window.refreshUsers = refreshUsers;
window.renderUsersTable = renderUsersTable;
window.openUserModal = openUserModal;
window.closeUserModal = closeUserModal;
window.saveUser = saveUser;
window.deleteUserConfirm = deleteUserConfirm;

// ============================================================
// PRICE FORMATTING
// ============================================================
function formatPrice(amount) {
    if (amount === undefined || amount === null || isNaN(amount)) return '₱0.00';
    const num = parseFloat(amount);
    return '₱' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ============================================================
// SERVICE PRICES
// ============================================================
function getStaticServicePrices() {
    return [
        { service_category: 'Carwash', service_name: 'Premium Carwash', size_category: 'Small', price: 130 },
        { service_category: 'Carwash', service_name: 'Premium Carwash', size_category: 'Medium', price: 160 },
        { service_category: 'Carwash', service_name: 'Premium Carwash', size_category: 'Large', price: 180 },
        { service_category: 'Carwash', service_name: 'Premium Carwash', size_category: 'XLarge', price: 200 },
        { service_category: 'Carwash', service_name: 'Premium Carwash', size_category: 'XXLarge', price: 240 },
        { service_category: 'Wax', service_name: 'Nano Ceramic Wax', size_category: 'Small', price: 300 },
        { service_category: 'Wax', service_name: 'Nano Ceramic Wax', size_category: 'Medium', price: 350 },
        { service_category: 'Wax', service_name: 'Nano Ceramic Wax', size_category: 'Large', price: 400 },
        { service_category: 'Wax', service_name: 'Nano Ceramic Wax', size_category: 'XLarge', price: 500 },
        { service_category: 'Wax', service_name: 'Nano Ceramic Wax', size_category: 'XXLarge', price: 550 },
        { service_category: 'Wax', service_name: 'Machine Wax', size_category: 'Small', price: 400 },
        { service_category: 'Wax', service_name: 'Machine Wax', size_category: 'Medium', price: 550 },
        { service_category: 'Wax', service_name: 'Machine Wax', size_category: 'Large', price: 600 },
        { service_category: 'Wax', service_name: 'Machine Wax', size_category: 'XLarge', price: 700 },
        { service_category: 'Wax', service_name: 'Machine Wax', size_category: 'XXLarge', price: 750 },
        { service_category: 'Detailing', service_name: 'Acid Rain Removal', size_category: 'Small', price: 700 },
        { service_category: 'Detailing', service_name: 'Acid Rain Removal', size_category: 'Medium', price: 800 },
        { service_category: 'Detailing', service_name: 'Acid Rain Removal', size_category: 'Large', price: 850 },
        { service_category: 'Detailing', service_name: 'Acid Rain Removal', size_category: 'XLarge', price: 1000 },
        { service_category: 'Detailing', service_name: 'Acid Rain Removal', size_category: 'XXLarge', price: 1100 },
        { service_category: 'Detailing', service_name: 'Back to Zero Disinfectant', size_category: 'Small', price: 700 },
        { service_category: 'Detailing', service_name: 'Back to Zero Disinfectant', size_category: 'Medium', price: 750 },
        { service_category: 'Detailing', service_name: 'Back to Zero Disinfectant', size_category: 'Large', price: 800 },
        { service_category: 'Detailing', service_name: 'Back to Zero Disinfectant', size_category: 'XLarge', price: 900 },
        { service_category: 'Detailing', service_name: 'Back to Zero Disinfectant', size_category: 'XXLarge', price: 950 },
        { service_category: 'Detailing', service_name: 'Engine Detailing Wash', size_category: 'Small', price: 500 },
        { service_category: 'Detailing', service_name: 'Engine Detailing Wash', size_category: 'Medium', price: 550 },
        { service_category: 'Detailing', service_name: 'Engine Detailing Wash', size_category: 'Large', price: 600 },
        { service_category: 'Detailing', service_name: 'Engine Detailing Wash', size_category: 'XLarge', price: 650 },
        { service_category: 'Detailing', service_name: 'Engine Detailing Wash', size_category: 'XXLarge', price: 700 },
        { service_category: 'Detailing', service_name: 'Head Light Restoration', size_category: 'Small', price: 500 },
        { service_category: 'Detailing', service_name: 'Head Light Restoration', size_category: 'Medium', price: 550 },
        { service_category: 'Detailing', service_name: 'Head Light Restoration', size_category: 'Large', price: 600 },
        { service_category: 'Detailing', service_name: 'Head Light Restoration', size_category: 'XLarge', price: 650 },
        { service_category: 'Detailing', service_name: 'Head Light Restoration', size_category: 'XXLarge', price: 700 },
        { service_category: 'Detailing', service_name: 'Asphalt Removal - Claybar', size_category: 'Small', price: 300 },
        { service_category: 'Detailing', service_name: 'Asphalt Removal - Claybar', size_category: 'Medium', price: 350 },
        { service_category: 'Detailing', service_name: 'Asphalt Removal - Claybar', size_category: 'Large', price: 400 },
        { service_category: 'Detailing', service_name: 'Asphalt Removal - Claybar', size_category: 'XLarge', price: 500 },
        { service_category: 'Detailing', service_name: 'Asphalt Removal - Claybar', size_category: 'XXLarge', price: 550 },
        { service_category: 'Detailing', service_name: 'Interior Detailing', size_category: 'Small', price: 4000 },
        { service_category: 'Detailing', service_name: 'Interior Detailing', size_category: 'Medium', price: 4500 },
        { service_category: 'Detailing', service_name: 'Interior Detailing', size_category: 'Large', price: 5000 },
        { service_category: 'Detailing', service_name: 'Interior Detailing', size_category: 'XLarge', price: 5500 },
        { service_category: 'Detailing', service_name: 'Interior Detailing', size_category: 'XXLarge', price: 6000 },
        { service_category: 'Detailing', service_name: 'Exterior Detailing 3 Step Buff', size_category: 'Small', price: 2000 },
        { service_category: 'Detailing', service_name: 'Exterior Detailing 3 Step Buff', size_category: 'Medium', price: 2500 },
        { service_category: 'Detailing', service_name: 'Exterior Detailing 3 Step Buff', size_category: 'Large', price: 3000 },
        { service_category: 'Detailing', service_name: 'Exterior Detailing 3 Step Buff', size_category: 'XLarge', price: 4000 },
        { service_category: 'Detailing', service_name: 'Exterior Detailing 3 Step Buff', size_category: 'XXLarge', price: 4500 },
        { service_category: 'Detailing', service_name: 'Under Wash', size_category: 'Small', price: 700 },
        { service_category: 'Detailing', service_name: 'Under Wash', size_category: 'Medium', price: 750 },
        { service_category: 'Detailing', service_name: 'Under Wash', size_category: 'Large', price: 800 },
        { service_category: 'Detailing', service_name: 'Under Wash', size_category: 'XLarge', price: 850 },
        { service_category: 'Detailing', service_name: 'Under Wash', size_category: 'XXLarge', price: 900 }
    ];
}

function getSizeOptions() {
    return ['Small', 'Medium', 'Large', 'XLarge', 'XXLarge'];
}

// ============================================================
// LOGIN FUNCTIONS (Async - Database Priority)
// ============================================================
async function handleLogin(e) {
    e.preventDefault();
    console.log('🔐 Login attempt...');
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const errorEl = document.getElementById('loginError');
    const loginBtn = document.querySelector('#loginForm button[type="submit"]');
    
    errorEl.textContent = '';
    
    if (!username || !password) {
        showNotification('Please enter both username and password', 'warning');
        errorEl.textContent = '❌ Please enter both username and password';
        return;
    }
    
    if (typeof authenticateUser === 'undefined') {
        showNotification('System error. Please refresh the page.', 'error');
        errorEl.textContent = '⚠️ System error. Please refresh the page.';
        return;
    }
    
    // Disable button and show loading
    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
    }
    
    try {
        let user = null;
        
        // Try async authentication first (database)
        if (typeof authenticateUser === 'function') {
            const authResult = authenticateUser(username, password);
            
            // Check if it's a Promise (async)
            if (authResult && typeof authResult.then === 'function') {
                user = await authResult;
            } else {
                user = authResult;
            }
        }
        
        if (user) {
            currentUser = { username, ...user };
            errorEl.textContent = '';
            
            // Save session
            saveSession(currentUser);
            
            // Show main app
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';
            
            // Initialize the app
            initializeApp();
            
            // Update UI
            updateUIForRole();
            updateAuditBadge();
            
            // Log login (skip for admin)
            if (!isAdmin(currentUser)) {
                logAudit('LOGIN', 'User logged in successfully', { username: username, name: user.name });
            }
            
            showNotification(`Welcome back, ${user.name}!`, 'success');
            console.log('✅ Login successful for:', username);
        } else {
            console.log('❌ Login failed for:', username);
            showNotification('Invalid username or password', 'error');
            errorEl.textContent = '❌ Invalid username or password';
            const loginBox = document.querySelector('.login-box');
            if (loginBox) {
                loginBox.style.animation = 'shake 0.5s ease';
                setTimeout(() => { loginBox.style.animation = ''; }, 500);
            }
        }
    } catch (err) {
        console.error('❌ Login error:', err);
        showNotification('Login error: ' + err.message, 'error');
        errorEl.textContent = '❌ Login error. Please try again.';
    } finally {
        // Re-enable button
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        }
    }
}

function handleLogout() {
    if (!confirm('Are you sure you want to logout?')) return;
    
    if (currentUser && !isAdmin(currentUser)) {
        logAudit('LOGOUT', 'User logged out', { 
            username: currentUser.username, 
            name: currentUser.name 
        });
    }
    
    stopAutoBackup();
    currentUser = null;
    dataLoaded = false;
    transactions = [];
    filteredTransactions = [];
    auditLogs = [];
    filteredAuditLogs = [];
    selectedIds = new Set();
    
    clearSession();
    
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.reset();
    const errorEl = document.getElementById('loginError');
    if (errorEl) errorEl.textContent = '';
    
    const container = document.getElementById('notificationContainer');
    if (container) container.innerHTML = '';
    
    showNotification('Logged out successfully', 'info');
    console.log('👋 User logged out');
}

// ============================================================
// INITIALIZATION
// ============================================================
function initializeApp() {
    console.log('🔄 Initializing app...');
    populateAllDropdowns();
    loadData();
    updateUIForRole();
    if (currentUser) {
        saveSession(currentUser);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 App initializing...');
    
    // Initialize Supabase
    initializeSupabase();
    
    // Load users from storage
    if (typeof loadUsersFromStorage === 'function') {
        loadUsersFromStorage();
    }
    
    // Check for existing session
    const savedUser = getSession();
    if (savedUser) {
        console.log('🔄 Session found for user:', savedUser.username);
        currentUser = savedUser;
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        
        // Initialize everything
        populateAllDropdowns();
        loadServicePrices();
        loadAuditLogs();
        loadBackupHistory();
        setupModalCloseListeners();
        loadData();
        updateUIForRole();
        updateAuditBadge();
        showNotification(`Welcome back, ${currentUser.name}!`, 'success');
    } else {
        console.log('🔄 No session found, showing login');
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
        populateAllDropdowns();
        loadServicePrices();
        loadAuditLogs();
        loadBackupHistory();
        setupModalCloseListeners();
    }
    
    const dateEl = document.getElementById('currentDate');
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
        });
    }
});

function setupModalCloseListeners() {
    const modals = ['transactionModal', 'quickAddModal', 'auditDetailModal', 'confirmModal'];
    modals.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', function(e) {
                if (e.target === this) {
                    if (id === 'transactionModal') closeModal();
                    else if (id === 'quickAddModal') closeQuickAdd();
                    else if (id === 'auditDetailModal') closeAuditDetail();
                    else if (id === 'confirmModal') closeConfirm();
                }
            });
        }
    });
}


// ============================================================
// SUPABASE INITIALIZATION (Updated with sync)
// ============================================================
function initializeSupabase() {
    try {
        const isConfigured = SUPABASE_URL && !SUPABASE_URL.includes('your-project') && 
                           SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('your-anon');
        
        if (isConfigured && window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('✅ Supabase client initialized');
            isSupabaseConnected = true;
            updateStatus('✅ Connected', 'connected');
            
            // Connect users module to Supabase (triggers sync)
            if (typeof setSupabaseUsersClient === 'function') {
                setSupabaseUsersClient(supabaseClient, true);
                console.log('✅ Users module connected to Supabase (sync starting)');
            }
        } else {
            console.warn('⚠️ Supabase not configured');
            updateStatus('📄 Offline Mode', '');
            supabaseClient = null;
            isSupabaseConnected = false;
            
            if (typeof setSupabaseUsersClient === 'function') {
                setSupabaseUsersClient(null, false);
            }
        }
    } catch (error) {
        console.error('❌ Supabase error:', error);
        updateStatus('❌ Error', 'error');
        supabaseClient = null;
        isSupabaseConnected = false;
        
        if (typeof setSupabaseUsersClient === 'function') {
            setSupabaseUsersClient(null, false);
        }
    }
}

// ============================================================
// MANUAL SYNC TRIGGER (add to settings or user management page)
// ============================================================
async function syncUsersNow() {
    if (typeof forceSyncNow === 'function') {
        showNotification('Syncing users...', 'info');
        const result = await forceSyncNow();
        
        if (result.success) {
            showNotification(
                `✅ Sync complete! Added: ${result.added}, Updated: ${result.updated}, From DB: ${result.synced}`,
                'success'
            );
        } else {
            showNotification('⚠️ Sync failed: ' + (result.reason || result.error), 'warning');
        }
        return result;
    }
    return { success: false, reason: 'sync_not_available' };
}

window.syncUsersNow = syncUsersNow;

function updateStatus(text, type = '') {
    const badge = document.getElementById('statusBadge');
    if (badge) {
        badge.textContent = text;
        badge.className = 'status-badge';
        if (type) badge.classList.add(type);
    }
}

// ============================================================
// UI UPDATE
// ============================================================
function updateUIForRole() {
    const isAdminUser = isAdmin(currentUser);
    const isManagerUser = isManager(currentUser);
    
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = (isAdminUser || isManagerUser) ? '' : 'none';
    });
    
    const roleDisplay = isAdminUser ? 'ADMIN' : isManagerUser ? 'MANAGER' : 'STAFF';
    const sidebarRoleEl = document.getElementById('sidebarUserRole');
    if (sidebarRoleEl) sidebarRoleEl.textContent = roleDisplay;
    
    const sidebarNameEl = document.getElementById('sidebarUserName');
    if (sidebarNameEl) sidebarNameEl.textContent = getUserDisplayName(currentUser);
    
    updateNavigation();
}

function updateNavigation() {
    const allowedPages = getUserPages(currentUser);
    document.querySelectorAll('.nav-item').forEach(item => {
        const page = item.getAttribute('data-page');
        if (page && allowedPages.includes(page)) {
            item.style.display = '';
        } else if (page) {
            item.style.display = 'none';
        }
    });
}

// ============================================================
// AUDIT FUNCTIONS
// ============================================================
async function logAudit(action, description, details = {}) {
    if (!currentUser) {
        console.warn('No current user, skipping audit log');
        return;
    }
    
    if (action === 'LOGIN' && isAdmin(currentUser)) {
        console.log('⏭️ Skipping audit log for admin login');
        return;
    }
    
    const logEntry = {
        action,
        description,
        details: details || {},
        username: currentUser.username,
        user_name: currentUser.name,
        user_role: currentUser.role,
        created_at: new Date().toISOString()
    };
    
    auditLogs.unshift(logEntry);
    updateAuditBadge();
    
    if (supabaseClient && isSupabaseConnected) {
        try {
            await supabaseClient.from(AUDIT_TABLE).insert(logEntry);
            console.log('✅ Audit log saved to database:', action);
        } catch (err) {
            console.warn('Could not save audit log to database:', err);
        }
    } else {
        console.log('📝 Audit log saved locally:', action);
    }
}

async function loadAuditLogs() {
    try {
        if (supabaseClient && isSupabaseConnected) {
            const { data, error } = await supabaseClient
                .from(AUDIT_TABLE)
                .select('*')
                .order('created_at', { ascending: false })
                .limit(500);
            
            if (!error && data) {
                auditLogs = data;
                console.log(`✅ Loaded ${auditLogs.length} audit logs from database`);
            }
        }
        filteredAuditLogs = [...auditLogs];
        renderAuditLogs();
        updateAuditBadge();
    } catch (err) {
        console.warn('Could not load audit logs:', err);
    }
}

function updateAuditBadge() {
    const badge = document.getElementById('auditBadge');
    if (badge) {
        badge.textContent = auditLogs.length > 0 ? auditLogs.length : '0';
    }
}

function getAuditActionClass(action) {
    const classes = {
        'LOGIN': 'badge-success',
        'LOGOUT': 'badge-warning',
        'ADD': 'badge-primary',
        'UPDATE': 'badge-info',
        'DELETE': 'badge-danger',
        'PRICE_UPDATE': 'badge-price_update',
        'SALARY_UPDATE': 'badge-salary_update',
        'STORE_UPDATE': 'badge-store_update',
        'STATUS_UPDATE': 'badge-warning',
        'BACKUP': 'badge-info',
        'RESTORE': 'badge-danger'
    };
    return classes[action] || 'badge-other';
}

function getAuditActionEmoji(action) {
    const emojis = {
        'LOGIN': '🔐',
        'LOGOUT': '🚪',
        'ADD': '✅',
        'UPDATE': '📝',
        'DELETE': '🗑️',
        'PRICE_UPDATE': '💰',
        'SALARY_UPDATE': '💵',
        'STORE_UPDATE': '🏪',
        'STATUS_UPDATE': '🔄',
        'BACKUP': '💾',
        'RESTORE': '📂'
    };
    return emojis[action] || '📋';
}

function getAuditActionLabel(action) {
    const labels = {
        'LOGIN': 'Login',
        'LOGOUT': 'Logout',
        'ADD': 'Transaction Added',
        'UPDATE': 'Transaction Updated',
        'DELETE': 'Transaction Deleted',
        'PRICE_UPDATE': 'Price Update',
        'SALARY_UPDATE': 'Salary Update',
        'STORE_UPDATE': 'Store Update',
        'STATUS_UPDATE': 'Status Update',
        'BACKUP': 'Database Backup',
        'RESTORE': 'Database Restore'
    };
    return labels[action] || action;
}

// ============================================================
// DROPDOWN MANAGEMENT
// ============================================================
function populateAllDropdowns() {
    ['formModel', 'formServices', 'formOther', 'formCarwasher', 'formDetailer'].forEach(id => {
        const keyMap = { 
            formModel: 'models', 
            formServices: 'services', 
            formOther: 'other', 
            formCarwasher: 'carwasher', 
            formDetailer: 'detailer' 
        };
        const select = document.getElementById(id);
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = '<option value="">Select...</option>';
        dropdownData[keyMap[id]].forEach(item => {
            const option = document.createElement('option');
            option.value = item;
            option.textContent = item;
            select.appendChild(option);
        });
        if (currentValue) select.value = currentValue;
    });
    populateServiceDropdowns();
    populateSizeOptions();
}

function addDropdownItem(type) {
    if (!checkPermission('edit')) return;
    const promptMap = { 
        model: 'Enter new car model:', 
        services: 'Enter new service:', 
        other: 'Enter new other service:', 
        carwasher: 'Enter new carwasher name:', 
        detailer: 'Enter new detailer name:' 
    };
    const newItem = prompt(promptMap[type] || 'Enter new item:');
    if (!newItem || !newItem.trim()) return;
    const trimmed = newItem.trim();
    const keyMap = { 
        model: 'models', 
        services: 'services', 
        other: 'other', 
        carwasher: 'carwasher', 
        detailer: 'detailer' 
    };
    const arrayKey = keyMap[type];
    if (!dropdownData[arrayKey].includes(trimmed)) {
        dropdownData[arrayKey].push(trimmed);
        dropdownData[arrayKey].sort();
        populateAllDropdowns();
        const formIdMap = { 
            model: 'formModel', 
            services: 'formServices', 
            other: 'formOther', 
            carwasher: 'formCarwasher', 
            detailer: 'formDetailer' 
        };
        const select = document.getElementById(formIdMap[type]);
        if (select) select.value = trimmed;
        showNotification(`Added "${trimmed}" to ${type} list`, 'success');
        logAudit('UPDATE', `Added new ${type}: "${trimmed}"`, { type, value: trimmed });
    } else {
        showNotification(`"${trimmed}" already exists`, 'warning');
    }
}

function populateServiceDropdowns() {
    const select = document.getElementById('formServices');
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">Select services...</option>';

    const categories = {};
    servicePrices.forEach(service => {
        if (!categories[service.service_category]) categories[service.service_category] = [];
        categories[service.service_category].push(service);
    });

    Object.keys(categories).forEach(category => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = category;
        const serviceNames = [...new Set(categories[category].map(s => s.service_name))];
        serviceNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            optgroup.appendChild(option);
        });
        select.appendChild(optgroup);
    });

    if (currentValue) select.value = currentValue;
}

function populateSizeOptions() {
    const select = document.getElementById('formSize');
    if (!select) return;
    const currentValue = select.value;
    const sizes = getSizeOptions();
    select.innerHTML = '<option value="">Select size...</option>';
    sizes.forEach(size => {
        const option = document.createElement('option');
        option.value = size;
        option.textContent = size;
        select.appendChild(option);
    });
    if (currentValue) select.value = currentValue;
}

// ============================================================
// SERVICES LOGIC
// ============================================================
function checkForDetailingServices() {
    const hasDetailing = selectedServices.some(s => 
        s.category === 'Detailing' || 
        ['Acid Rain Removal', 'Back to Zero Disinfectant', 'Engine Detailing Wash', 
         'Head Light Restoration', 'Asphalt Removal - Claybar', 'Interior Detailing', 
         'Exterior Detailing 3 Step Buff', 'Under Wash'].includes(s.service_name)
    );
    
    isDetailerRequired = hasDetailing;
    
    const detailerLabel = document.getElementById('detailerRequired');
    const detailerOptional = document.getElementById('detailerOptional');
    const detailerNote = document.getElementById('detailerNote');
    const detailerSelect = document.getElementById('formDetailer');
    
    if (detailerLabel) detailerLabel.style.display = hasDetailing ? 'inline' : 'none';
    if (detailerOptional) detailerOptional.style.display = hasDetailing ? 'none' : 'inline';
    if (detailerNote) detailerNote.style.display = hasDetailing ? 'block' : 'none';
    if (detailerSelect) {
        if (hasDetailing) {
            detailerSelect.setAttribute('required', 'required');
        } else {
            detailerSelect.removeAttribute('required');
        }
    }
    
    return { hasDetailing };
}

function addServiceToSelection() {
    const serviceSelect = document.getElementById('formServices');
    const sizeSelect = document.getElementById('formSize');
    const selectedService = serviceSelect.value;
    const selectedSize = sizeSelect.value;

    if (!selectedService || !selectedSize) {
        showNotification('Please select a service and size', 'warning');
        return;
    }

    const priceEntry = servicePrices.find(s =>
        s.service_name === selectedService &&
        s.size_category === selectedSize
    );

    if (!priceEntry) {
        showNotification('Price not found for this combination', 'error');
        return;
    }

    const existing = selectedServices.find(s => s.service_name === selectedService && s.size === selectedSize);
    if (existing) {
        showNotification('Service already added', 'warning');
        return;
    }

    selectedServices.push({
        service_name: selectedService,
        size: selectedSize,
        price: priceEntry.price,
        category: priceEntry.service_category
    });

    updateSelectedServicesDisplay();
    updateServiceTotal();
    calculateCarwashTotal();
    checkForDetailingServices();
}

function removeServiceFromSelection(index) {
    selectedServices.splice(index, 1);
    updateSelectedServicesDisplay();
    updateServiceTotal();
    calculateCarwashTotal();
    checkForDetailingServices();
}

function updateSelectedServicesDisplay() {
    const container = document.getElementById('selectedServicesContainer');
    if (!container) return;

    if (selectedServices.length === 0) {
        container.innerHTML = '<span style="color:#94a3b8;font-size:0.85rem;">No services selected</span>';
        return;
    }

    container.innerHTML = '';
    selectedServices.forEach((service, index) => {
        const tag = document.createElement('span');
        tag.className = 'service-tag';
        const isDetailing = service.category === 'Detailing' || 
            ['Acid Rain Removal', 'Back to Zero Disinfectant', 'Engine Detailing Wash', 
             'Head Light Restoration', 'Asphalt Removal - Claybar', 'Interior Detailing', 
             'Exterior Detailing 3 Step Buff', 'Under Wash'].includes(service.service_name);
        
        let icon = '🛠️';
        if (isDetailing) icon = '🔧';
        else if (service.category === 'Wax') icon = '✨';
        else if (service.category === 'Carwash') icon = '🧼';
        
        tag.innerHTML = `
            ${icon} ${service.service_name} (${service.size}) - ${formatPrice(service.price)}
            <span class="remove-btn" onclick="removeServiceFromSelection(${index})">×</span>
        `;
        container.appendChild(tag);
    });
}

function updateServiceTotal() {
    serviceTotal = selectedServices.reduce((sum, s) => sum + s.price, 0);
    const display = document.getElementById('serviceTotalDisplay');
    if (display) display.textContent = formatPrice(serviceTotal);
}

// ============================================================
// STORE ORDER FUNCTIONS
// ============================================================
function addStoreItemToCarwash(name, price) {
    const existing = storeOrderItems.find(item => item.name === name);
    if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
    } else {
        storeOrderItems.push({ name, price, quantity: 1 });
    }
    renderStoreOrderItems();
    updateStoreOrderTotal();
    calculateCarwashTotal();
}

function addCustomStoreItem() {
    const name = document.getElementById('formStoreItemName').value.trim();
    const price = parseFloat(document.getElementById('formStoreItemPrice').value);
    if (!name || !price || price <= 0) {
        showNotification('Please enter valid item name and price', 'warning');
        return;
    }

    const existing = storeOrderItems.find(item => item.name === name);
    if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
    } else {
        storeOrderItems.push({ name, price, quantity: 1 });
    }

    renderStoreOrderItems();
    updateStoreOrderTotal();
    calculateCarwashTotal();
    document.getElementById('formStoreItemName').value = '';
    document.getElementById('formStoreItemPrice').value = '';
}

function removeStoreItem(index) {
    storeOrderItems.splice(index, 1);
    renderStoreOrderItems();
    updateStoreOrderTotal();
    calculateCarwashTotal();
}

function renderStoreOrderItems() {
    const container = document.getElementById('storeItemsContainer');
    if (!container) return;

    if (storeOrderItems.length === 0) {
        container.innerHTML = '<span style="color:#94a3b8;font-size:0.8rem;">No items added</span>';
        return;
    }

    container.innerHTML = '';
    storeOrderItems.forEach((item, index) => {
        const tag = document.createElement('span');
        tag.className = 'store-item-tag';
        tag.innerHTML = `
            <span class="item-name">${item.name}</span>
            <span class="item-price">${formatPrice(item.price)}</span>
            <span style="color:#94a3b8;font-size:0.65rem;">×${item.quantity || 1}</span>
            <span class="remove-btn" onclick="removeStoreItem(${index})">×</span>
        `;
        container.appendChild(tag);
    });
}

function updateStoreOrderTotal() {
    const total = storeOrderItems.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
    const display = document.getElementById('storeOrderTotal');
    if (display) display.textContent = formatPrice(total);
}

function clearStoreOrder() {
    storeOrderItems = [];
    renderStoreOrderItems();
    updateStoreOrderTotal();
    calculateCarwashTotal();
}

// ============================================================
// CALCULATE FUNCTIONS
// ============================================================
function calculateCarwashTotal() {
    const serviceTotal = selectedServices.reduce((sum, s) => sum + s.price, 0);
    const storeTotal = storeOrderItems.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
    const total = serviceTotal + storeTotal;
    const display = document.getElementById('formTotalDisplay');
    if (display) display.textContent = formatPrice(total);
}

function calculateStoreTotal() {
    const qty = parseFloat(document.getElementById('formQuantity').value) || 0;
    const price = parseFloat(document.getElementById('formUnitPrice').value) || 0;
    const display = document.getElementById('formStoreTotal');
    if (display) display.value = formatPrice(qty * price);
}

// ============================================================
// TOGGLE TRANSACTION FIELDS
// ============================================================
function toggleTransactionFields() {
    const category = document.getElementById('formCategory').value;
    const carwashFields = document.getElementById('carwashFields');
    const storeFields = document.getElementById('storeFields');
    
    if (carwashFields) carwashFields.style.display = category === 'carwash' ? 'block' : 'none';
    if (storeFields) storeFields.style.display = category !== 'carwash' ? 'block' : 'none';

    if (category === 'carwash') {
        clearStoreOrder();
        selectedServices = [];
        updateSelectedServicesDisplay();
        updateServiceTotal();
        populateServiceDropdowns();
        populateSizeOptions();
        checkForDetailingServices();
    }

    const formModel = document.getElementById('formModel');
    const formCarwasher = document.getElementById('formCarwasher');
    const formItem = document.getElementById('formItem');
    const formQuantity = document.getElementById('formQuantity');
    const formUnitPrice = document.getElementById('formUnitPrice');
    
    if (formModel) formModel.required = (category === 'carwash');
    if (formCarwasher) formCarwasher.required = (category === 'carwash');
    if (formItem) formItem.required = (category !== 'carwash');
    if (formQuantity) formQuantity.required = (category !== 'carwash');
    if (formUnitPrice) formUnitPrice.required = (category !== 'carwash');
}

// ============================================================
// TRANSACTION CRUD
// ============================================================
function openAddModal() {
    if (!checkPermission('add')) return;

    const title = document.getElementById('modalTitle');
    if (title) title.textContent = '📝 New Transaction';
    
    const editId = document.getElementById('editId');
    if (editId) editId.value = '';
    
    const form = document.getElementById('transactionForm');
    if (form) form.reset();
    
    const submitBtn = document.getElementById('modalSubmitBtn');
    if (submitBtn) submitBtn.textContent = 'Add Transaction';
    
    const category = document.getElementById('formCategory');
    if (category) category.value = 'carwash';
    
    const status = document.getElementById('formPaymentStatus');
    if (status) status.value = 'unpaid';

    selectedServices = [];
    isDetailerRequired = false;
    updateSelectedServicesDisplay();
    updateServiceTotal();
    storeOrderItems = [];
    renderStoreOrderItems();
    updateStoreOrderTotal();

    toggleTransactionFields();
    populateAllDropdowns();
    calculateCarwashTotal();
    checkForDetailingServices();
    openModal();
}

function openEditModal(id) {
    if (!checkPermission('edit')) return;
    const row = transactions.find(r => r.id === id);
    if (!row) {
        showNotification('Transaction not found', 'error');
        return;
    }

    const title = document.getElementById('modalTitle');
    if (title) title.textContent = '✏️ Edit Transaction';
    
    const editId = document.getElementById('editId');
    if (editId) editId.value = id;
    
    const category = document.getElementById('formCategory');
    if (category) category.value = row.category || 'carwash';
    
    toggleTransactionFields();
    populateAllDropdowns();
    
    const payment = document.getElementById('formPayment');
    if (payment) payment.value = row.payment || 'CASH';
    
    const status = document.getElementById('formPaymentStatus');
    if (status) status.value = row.payment_status || 'unpaid';
    
    const remarks = document.getElementById('formRemarks');
    if (remarks) remarks.value = row.remarks || '';

    selectedServices = [];
    storeOrderItems = [];

    if (row.category === 'carwash') {
        const bay = document.getElementById('formBay');
        if (bay) bay.value = row.bay || '';
        
        const model = document.getElementById('formModel');
        if (model) model.value = row.car_model || '';
        
        const plate = document.getElementById('formPlate');
        if (plate) plate.value = row.plate || '';

        if (row.selected_services && row.selected_services.length > 0) {
            selectedServices = row.selected_services.map(s => ({ ...s }));
        } else if (row.services) {
            const serviceParts = row.services.split(',');
            serviceParts.forEach(part => {
                const match = part.trim().match(/^(.+?)\s*\((.+?)\)$/);
                if (match) {
                    const priceEntry = servicePrices.find(s =>
                        s.service_name === match[1].trim() &&
                        s.size_category === match[2].trim()
                    );
                    if (priceEntry) {
                        selectedServices.push({
                            service_name: priceEntry.service_name,
                            size: priceEntry.size_category,
                            price: priceEntry.price,
                            category: priceEntry.service_category
                        });
                    }
                }
            });
        }
        updateSelectedServicesDisplay();
        updateServiceTotal();

        const carwasher = document.getElementById('formCarwasher');
        if (carwasher) carwasher.value = row.carwasher || '';
        
        const detailer = document.getElementById('formDetailer');
        if (detailer) detailer.value = row.detailer || '';

        if (row.store_order) {
            storeOrderItems = row.store_order.map(item => ({ ...item }));
            renderStoreOrderItems();
            updateStoreOrderTotal();
        }
        calculateCarwashTotal();
        checkForDetailingServices();
    } else {
        const item = document.getElementById('formItem');
        if (item) item.value = row.item || '';
        
        const quantity = document.getElementById('formQuantity');
        if (quantity) quantity.value = row.quantity || 1;
        
        const unitPrice = document.getElementById('formUnitPrice');
        if (unitPrice) unitPrice.value = row.unit_price || 0;
        
        calculateStoreTotal();
    }

    const submitBtn = document.getElementById('modalSubmitBtn');
    if (submitBtn) submitBtn.textContent = 'Update Transaction';
    
    openModal();
}

async function saveTransaction(e) {
    e.preventDefault();
    if (!checkPermission('add')) return;

    const id = document.getElementById('editId').value;
    const category = document.getElementById('formCategory').value;
    const payment = document.getElementById('formPayment').value;
    const paymentStatus = document.getElementById('formPaymentStatus').value;
    const remarks = document.getElementById('formRemarks').value.trim();
    const now = new Date().toISOString();

    const serviceInfo = checkForDetailingServices();
    
    if (category === 'carwash') {
        const carwasher = document.getElementById('formCarwasher').value.trim();
        
        if (!carwasher && selectedServices.length > 0) {
            showNotification('Please select a Carwasher for this service', 'error');
            document.getElementById('formCarwasher').focus();
            return;
        }
        
        if (serviceInfo.hasDetailing) {
            const detailer = document.getElementById('formDetailer').value.trim();
            if (!detailer) {
                showNotification('Detailing services require a Detailer to be selected', 'error');
                document.getElementById('formDetailer').focus();
                return;
            }
        }
    }

    let transaction = { 
        category, 
        payment, 
        payment_status: paymentStatus, 
        remarks, 
        updated_at: now 
    };

    if (category === 'carwash') {
        const bay = parseInt(document.getElementById('formBay').value) || 0;
        const car_model = document.getElementById('formModel').value.trim();
        const plate = document.getElementById('formPlate').value.trim();
        const carwasher = document.getElementById('formCarwasher').value.trim();
        const detailer = document.getElementById('formDetailer').value.trim();

        const serviceTotal = selectedServices.reduce((sum, s) => sum + s.price, 0);
        const storeTotal = storeOrderItems.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
        const total = serviceTotal + storeTotal;

        if (!car_model) {
            showNotification('Please select a Car Model', 'error');
            document.getElementById('formModel').focus();
            return;
        }

        if (selectedServices.length === 0) {
            showNotification('Please select at least one service', 'error');
            document.getElementById('formServices').focus();
            return;
        }

        const serviceDisplay = selectedServices.map(s => `${s.service_name} (${s.size})`).join(', ');

        transaction = {
            ...transaction,
            bay: bay || null,
            car_model: car_model || '',
            plate: plate || '',
            services: serviceDisplay || 'CARWASH',
            other: '',
            carwasher: carwasher || '',
            detailer: detailer || '',
            carwash_price: serviceTotal || 0,
            detailing_price: 0,
            total: total || 0,
            item: `${car_model} - ${serviceDisplay || 'CARWASH'}`,
            quantity: 1,
            unit_price: total || 0,
            store_order: storeOrderItems,
            selected_services: selectedServices
        };
    } else {
        const item = document.getElementById('formItem').value.trim();
        const quantity = parseFloat(document.getElementById('formQuantity').value) || 1;
        const unit_price = parseFloat(document.getElementById('formUnitPrice').value) || 0;
        const total = quantity * unit_price;

        if (!item) {
            showNotification('Please enter an Item name', 'error');
            document.getElementById('formItem').focus();
            return;
        }
        
        if (quantity <= 0) {
            showNotification('Please enter a valid Quantity', 'error');
            document.getElementById('formQuantity').focus();
            return;
        }
        
        if (unit_price <= 0) {
            showNotification('Please enter a valid Unit Price', 'error');
            document.getElementById('formUnitPrice').focus();
            return;
        }
        
        transaction = {
            ...transaction,
            item,
            quantity,
            unit_price,
            total,
            car_model: '',
            services: '',
            store_order: [],
            selected_services: []
        };
    }

    try {
        let savedTransaction = null;
        
        if (id) {
            const index = transactions.findIndex(r => r.id === parseInt(id));
            if (index !== -1) {
                const oldTransaction = { ...transactions[index] };
                transaction.id = parseInt(id);
                transaction.created_at = transactions[index].created_at;
                
                if (supabaseClient && isSupabaseConnected) {
                    const { data, error } = await supabaseClient
                        .from(TABLE_NAME)
                        .update(transaction)
                        .eq('id', id)
                        .select();
                    if (!error && data && data.length > 0) {
                        savedTransaction = data[0];
                    } else {
                        showNotification('Error updating transaction in database', 'error');
                        return;
                    }
                }
                
                transactions[index] = savedTransaction || transaction;
                await logAudit('UPDATE', `Transaction #${id} updated`, {
                    transaction_id: id,
                    old_values: { 
                        total: oldTransaction.total, 
                        services: oldTransaction.services, 
                        status: oldTransaction.payment_status 
                    },
                    new_values: { 
                        total: transaction.total, 
                        services: transaction.services, 
                        status: transaction.payment_status 
                    }
                });
                showNotification('Transaction updated successfully', 'success');
            } else {
                showNotification('Transaction not found', 'error');
                return;
            }
        } else {
            transaction.created_at = now;
            
            if (supabaseClient && isSupabaseConnected) {
                const { data, error } = await supabaseClient
                    .from(TABLE_NAME)
                    .insert(transaction)
                    .select();
                if (!error && data && data.length > 0) {
                    savedTransaction = data[0];
                    transactions.unshift(savedTransaction);
                    await logAudit('ADD', `Transaction #${savedTransaction.id} added`, {
                        transaction_id: savedTransaction.id,
                        category: savedTransaction.category,
                        item: savedTransaction.item,
                        amount: savedTransaction.total
                    });
                } else {
                    showNotification('Error adding transaction to database', 'error');
                    return;
                }
            } else {
                transaction.id = Date.now();
                transactions.unshift(transaction);
                await logAudit('ADD', `Transaction #${transaction.id} added (offline)`, {
                    transaction_id: transaction.id,
                    category: transaction.category,
                    item: transaction.item,
                    amount: transaction.total
                });
            }
            showNotification('Transaction added successfully', 'success');
        }

        selectedServices = [];
        isDetailerRequired = false;
        updateSelectedServicesDisplay();
        updateServiceTotal();
        storeOrderItems = [];
        renderStoreOrderItems();
        updateStoreOrderTotal();

        closeModal();
        populateFilters();
        applyFilters();
        renderAll();
        renderSalaryTable();
        updateAuditBadge();
        updateStoreHistory();
    } catch (err) {
        console.error('Save error:', err);
        showNotification('Error saving: ' + err.message, 'error');
    }
}

// ============================================================
// SORTING FUNCTIONS
// ============================================================
function sortTable(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }
    
    document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('sorted', 'sorted-asc', 'sorted-desc');
        const icon = th.querySelector('.sort-icon');
        if (icon) icon.textContent = '⇅';
    });
    
    const currentTh = document.querySelector(`th[data-sort="${column}"]`);
    if (currentTh) {
        currentTh.classList.add('sorted', sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
        const icon = currentTh.querySelector('.sort-icon');
        if (icon) icon.textContent = sortDirection === 'asc' ? '▲' : '▼';
    }
    
    applyFilters();
}

// ============================================================
// PERMISSION CHECKS
// ============================================================
function checkPermission(action) {
    if (!currentUser) {
        showNotification('Please login first', 'warning');
        return false;
    }
    const permissionMap = {
        'add': 'canAddTransaction', 
        'edit': 'canEditTransaction', 
        'delete': 'canDeleteTransaction',
        'view': 'canViewTransactions', 
        'manage_staff': 'canManageStaff', 
        'salary': 'canManageSalary',
        'store': 'canManageStore', 
        'reports': 'canViewReports', 
        'export': 'canExport',
        'change_status': 'canChangeStatus', 
        'audit': 'canViewAudit', 
        'prices': 'canManagePrices',
        'backup': 'canManagePrices', 
        'restore': 'canManagePrices',
        'manage_users': 'canManageUsers'
    };
    const funcName = permissionMap[action];
    if (!funcName) return false;
    const hasPermission = window[funcName] ? window[funcName](currentUser) : false;
    if (!hasPermission) showNotification(`You don't have permission to ${action}`, 'warning');
    return hasPermission;
}

// ============================================================
// DATA LOADING
// ============================================================
function getStaticTransactions() {
    const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'];
    const carwashers = ['JM', 'JAYSON', 'DENNIS', 'KURT', 'ADING', 'JUSTINE', 'JOMAR', 'PHILIP', 'RODEL', 'HART'];
    const models = ['VIOS', 'INNOVA', 'HILUX', 'XPANDER', 'AVANZA', 'MIRAGE', 'MONTERO', 'FORTUNER', 'BRV', 'WIGO'];
    const services = ['CARWASH', 'HANDWAX', 'MACHINEWAX', 'ACIDRAIN', 'BACKTOZERO', 'ENGINEWASH', 'UNDERWASH', 'QW', 'BTZ'];
    const statuses = ['paid', 'unpaid', 'partial'];
    const payments = ['CASH', 'GCASH', 'MARI BANK', 'OTHER BANKS'];
    const storeItems = ['Marlboro', 'Skyflakes', 'Fudgee Bar', 'Rebisco', 'Lucky Me'];
    const drinkItems = ['Coca-Cola', 'Water', 'Coffee', 'Cobra', 'Juice'];
    const palutoItems = ['Canton Noodles', 'Rice Meal', 'Soup', 'Silog Meal', 'Appetizers'];
    const otherItems = ['Spanish Ice', 'Graham', 'Car Perfume', 'Bamboo'];

    let data = [];
    let id = 1;

    for (let m = 0; m < months.length; m++) {
        const month = months[m];
        const daysInMonth = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate();
        const numTransactions = Math.floor(Math.random() * 6) + 3;

        for (let t = 0; t < numTransactions; t++) {
            const day = Math.floor(Math.random() * daysInMonth) + 1;
            const dateStr = `${month}-${String(day).padStart(2, '0')}`;
            const carwasher = carwashers[Math.floor(Math.random() * carwashers.length)];
            const model = models[Math.floor(Math.random() * models.length)];
            const service = services[Math.floor(Math.random() * services.length)];
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            const payment = payments[Math.floor(Math.random() * payments.length)];
            const price = Math.floor(Math.random() * 400) + 100;
            const total = price;

            const category = Math.random() > 0.7 ? ['store', 'drinks', 'paluto', 'other'][Math.floor(Math.random() * 4)] : 'carwash';
            let item = '', quantity = 1, unitPrice = total;

            if (category === 'carwash') {
                item = `${model} - ${service}`;
            } else if (category === 'store') {
                item = storeItems[Math.floor(Math.random() * storeItems.length)];
                quantity = Math.floor(Math.random() * 5) + 1;
                unitPrice = Math.floor(Math.random() * 20) + 5;
            } else if (category === 'drinks') {
                item = drinkItems[Math.floor(Math.random() * drinkItems.length)];
                quantity = Math.floor(Math.random() * 4) + 1;
                unitPrice = Math.floor(Math.random() * 20) + 10;
            } else if (category === 'paluto') {
                item = palutoItems[Math.floor(Math.random() * palutoItems.length)];
                quantity = Math.floor(Math.random() * 3) + 1;
                unitPrice = Math.floor(Math.random() * 40) + 20;
            } else {
                item = otherItems[Math.floor(Math.random() * otherItems.length)];
                quantity = 1;
                unitPrice = Math.floor(Math.random() * 100) + 50;
            }

            const totalAmount = category === 'carwash' ? total : quantity * unitPrice;
            data.push({
                id: id++,
                category: category,
                bay: Math.floor(Math.random() * 4) + 1,
                car_model: category === 'carwash' ? model : '',
                plate: category === 'carwash' ? `ABC ${Math.floor(Math.random() * 9000) + 1000}` : '',
                services: category === 'carwash' ? service : '',
                other: category === 'carwash' ? (Math.random() > 0.5 ? 'ACIDRAIN' : '') : '',
                carwasher: category === 'carwash' ? carwasher : '',
                detailer: category === 'carwash' && Math.random() > 0.5 ? carwashers[Math.floor(Math.random() * carwashers.length)] : '',
                carwash_price: category === 'carwash' ? total : 0,
                detailing_price: 0,
                total: totalAmount,
                payment: payment,
                payment_status: status,
                remarks: Math.random() > 0.7 ? 'NIGHT' : '',
                created_at: new Date(`${dateStr}T${String(Math.floor(Math.random() * 12) + 6).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00+08:00`).toISOString(),
                item: item || '',
                quantity: quantity || 1,
                unit_price: unitPrice || totalAmount,
                store_order: [],
                selected_services: []
            });
        }
    }
    data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return data;
}

async function loadData() {
    showLoadingState(true, 'Loading data...');
    try {
        if (supabaseClient && isSupabaseConnected) {
            const { data, error } = await supabaseClient
                .from(TABLE_NAME)
                .select('*')
                .order('created_at', { ascending: false });
            if (!error && data && data.length > 0) {
                transactions = data.map(row => ({ ...row, payment_status: row.payment_status || 'unpaid' }));
                console.log(`✅ Loaded ${transactions.length} transactions from database`);
            } else {
                transactions = getStaticTransactions();
                console.log(`📄 Using ${transactions.length} static transactions`);
                if (supabaseClient && isSupabaseConnected && data && data.length === 0) {
                    seedTransactions();
                }
            }
        } else {
            transactions = getStaticTransactions();
            console.log(`📄 Using ${transactions.length} static transactions (offline mode)`);
        }

        await loadSummaryData();
        await loadSalaryData();
        await loadAuditLogs();

        populateFilters();
        applyFilters();
        renderAll();
        renderSalaryTable();
        renderAuditLogs();
        renderStoreTotals();
        updateStoreHistory();
        if (isAdmin(currentUser) || isManager(currentUser)) calculateSalaries();

        showLoadingState(false);
        showNotification(`Loaded ${transactions.length} transactions`, 'success');
    } catch (err) {
        console.error('Load error:', err);
        showErrorState('Failed to load data. Please refresh.');
        showLoadingState(false);
    }
}

async function seedTransactions() {
    try {
        const staticData = getStaticTransactions();
        for (const tx of staticData) {
            await supabaseClient.from(TABLE_NAME).insert(tx);
        }
        console.log('✅ Seeded static transactions to database');
    } catch (err) {
        console.warn('Could not seed transactions:', err);
    }
}

// ============================================================
// RENDER FUNCTIONS
// ============================================================
function renderAll() {
    renderSummaryCards();
    renderStoreInputs();
    renderRecentTransactions();
    if (filteredTransactions.length === 0 && transactions.length > 0) filteredTransactions = [...transactions];
    renderTable();
    updateBadgeCount();
    renderStoreTotals();
    updateStoreHistory();
}

function sortData(data) {
    return [...data].sort((a, b) => {
        let valA, valB;
        
        switch(sortColumn) {
            case 'id':
                valA = a.id || 0;
                valB = b.id || 0;
                break;
            case 'date':
                valA = new Date(a.created_at || 0);
                valB = new Date(b.created_at || 0);
                break;
            case 'category':
                valA = (a.category || '').toLowerCase();
                valB = (b.category || '').toLowerCase();
                break;
            case 'item':
                valA = (a.item || a.car_model || '').toLowerCase();
                valB = (b.item || b.car_model || '').toLowerCase();
                break;
            case 'carwasher':
                valA = (a.carwasher || '').toLowerCase();
                valB = (b.carwasher || '').toLowerCase();
                break;
            case 'detailer':
                valA = (a.detailer || '').toLowerCase();
                valB = (b.detailer || '').toLowerCase();
                break;
            case 'total':
                valA = parseFloat(a.total) || 0;
                valB = parseFloat(b.total) || 0;
                break;
            case 'payment':
                valA = (a.payment || '').toLowerCase();
                valB = (b.payment || '').toLowerCase();
                break;
            case 'status':
                valA = (a.payment_status || '').toLowerCase();
                valB = (b.payment_status || '').toLowerCase();
                break;
            default:
                valA = a.id || 0;
                valB = b.id || 0;
        }
        
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
}

function renderTable() {
    const tbody = document.getElementById('transactionsBody');
    const footer = document.getElementById('transactionsFooter');
    const table = document.getElementById('transactionsTable');
    const loading = document.getElementById('loadingState');
    
    let data = filteredTransactions.length > 0 ? filteredTransactions : transactions;
    data = sortData(data);

    if (!data || data.length === 0) {
        if (table) table.style.display = 'none';
        if (loading) {
            loading.style.display = 'block';
            loading.innerHTML = `<div class="empty-state"><i class="fas fa-inbox" style="font-size:2rem;color:#94a3b8;margin-bottom:1rem;display:block;"></i><h3 style="color:#64748b;">No Transactions Found</h3></div>`;
        }
        return;
    }

    if (table) table.style.display = '';
    if (loading) loading.style.display = 'none';
    if (tbody) tbody.innerHTML = '';

    const canEdit = checkPermission('edit');
    const canDelete = checkPermission('delete');
    const canChangeStatus = checkPermission('change_status');

    data.forEach((row, idx) => {
        const isSelected = selectedIds.has(row.id);
        const categoryClass = `badge-${row.category || 'other'}`;
        const paymentClass = getPaymentClass(row.payment);
        const statusClass = `badge-${row.payment_status || 'unpaid'}`;
        const total = parseFloat(row.total) || 0;
        const categoryEmoji = { carwash: '🚘', store: '🏪', drinks: '🥤', paluto: '🍜', other: '💰' };
        let displayName = row.category === 'carwash' ? `${row.car_model || ''} - ${row.services || ''}` : row.item || '';
        const statusOptions = ['paid', 'unpaid', 'partial'].map(s => `<option value="${s}" ${row.payment_status === s ? 'selected' : ''}>${s.toUpperCase()}</option>`).join('');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" class="row-checkbox" data-id="${row.id}" ${isSelected ? 'checked' : ''} onchange="toggleRow(${row.id})" ${!canDelete ? 'disabled' : ''}></td>
            <td>${row.id || idx + 1}</td>
            <td>${row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}</td>
            <td><span class="badge ${categoryClass}">${categoryEmoji[row.category] || '📋'} ${(row.category || 'other').toUpperCase()}</span></td>
            <td>${displayName}</td>
            <td>${row.carwasher || '—'}</td>
            <td>${row.detailer || '—'}</td>
            <td class="price-col">${formatPrice(total)}</td>
            <td><span class="badge ${paymentClass}">${row.payment || '—'}</span></td>
            <td>${canChangeStatus ? `<select class="status-select status-${row.payment_status || 'unpaid'}" onchange="updatePaymentStatus(${row.id}, this.value)">${statusOptions}</select>` : `<span class="badge ${statusClass}">${(row.payment_status || 'unpaid').toUpperCase()}</span>`}</td>
            <td><div class="row-actions">${canEdit ? `<button class="btn btn-sm btn-primary" onclick="openEditModal(${row.id})"><i class="fas fa-edit"></i></button>` : ''}${canDelete ? `<button class="btn btn-sm btn-danger" onclick="deleteTransaction(${row.id})"><i class="fas fa-trash"></i></button>` : '<span style="font-size:0.7rem;color:#94a3b8;">View</span>'}</div></td>
        `;
        if (tbody) tbody.appendChild(tr);
    });

    const totalAll = data.reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);
    if (footer) {
        footer.innerHTML = `<tr class="total-row"><td colspan="7" style="text-align:right;font-weight:700;">TOTAL</td><td class="price-col" style="font-size:1.1rem;">${formatPrice(totalAll)}</td><td colspan="3"></td></tr>`;
    }
}

function renderSummaryCards() {
    if (!currentUser || isStaff(currentUser)) {
        const cards = document.getElementById('summaryCards');
        if (cards) cards.style.display = 'none';
        return;
    }

    const totalCarwash = transactions.filter(t => t.category === 'carwash').reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);
    const totalStore = transactions.filter(t => t.category === 'store').reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);
    const totalDrinks = transactions.filter(t => t.category === 'drinks').reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);
    const totalPaluto = transactions.filter(t => t.category === 'paluto').reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);
    const totalOther = transactions.filter(t => t.category === 'other').reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);
    const totalIncome = transactions.reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);

    const carCount = document.getElementById('carCount');
    if (carCount) carCount.textContent = transactions.filter(t => t.category === 'carwash').length;
    
    const carwashTotal = document.getElementById('carwashTotal');
    if (carwashTotal) carwashTotal.textContent = formatPrice(totalCarwash);
    
    const storeTotal = document.getElementById('storeTotal');
    if (storeTotal) storeTotal.textContent = formatPrice(totalStore);
    
    const drinksTotal = document.getElementById('drinksTotal');
    if (drinksTotal) drinksTotal.textContent = formatPrice(totalDrinks);
    
    const palutoTotal = document.getElementById('palutoTotal');
    if (palutoTotal) palutoTotal.textContent = formatPrice(totalPaluto);
    
    const otherTotal = document.getElementById('otherTotal');
    if (otherTotal) otherTotal.textContent = formatPrice(totalOther);
    
    const incomeTotal = document.getElementById('incomeTotal');
    if (incomeTotal) incomeTotal.textContent = formatPrice(totalIncome);

    const today = new Date().toDateString();
    const todayEarnings = transactions.filter(t => new Date(t.created_at).toDateString() === today).reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);
    
    const todayEarningsEl = document.getElementById('todayEarnings');
    if (todayEarningsEl) todayEarningsEl.textContent = formatPrice(todayEarnings);
    
    const pendingPaymentsEl = document.getElementById('pendingPayments');
    if (pendingPaymentsEl) pendingPaymentsEl.textContent = transactions.filter(t => t.payment_status === 'unpaid').length;
    
    const unpaidAmountEl = document.getElementById('unpaidAmount');
    if (unpaidAmountEl) unpaidAmountEl.textContent = formatPrice(transactions.filter(t => t.payment_status === 'unpaid').reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0));
    
    const totalTransactionsEl = document.getElementById('totalTransactions');
    if (totalTransactionsEl) totalTransactionsEl.textContent = transactions.length;
}

function renderRecentTransactions() {
    const tbody = document.getElementById('recentBody');
    if (!tbody) return;

    const recent = transactions.slice(0, 5);
    if (recent.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No recent transactions</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    recent.forEach((row, idx) => {
        const tr = document.createElement('tr');
        const categoryEmoji = { carwash: '🚘', store: '🏪', drinks: '🥤', paluto: '🍜', other: '💰' };
        const statusClass = `badge-${row.payment_status || 'unpaid'}`;
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}</td>
            <td>${categoryEmoji[row.category] || '📋'} ${(row.category || 'other').toUpperCase()}</td>
            <td>${row.category === 'carwash' ? `${row.car_model} - ${row.services}` : row.item}</td>
            <td class="price-col">${formatPrice(parseFloat(row.total) || 0)}</td>
            <td><span class="badge ${statusClass}">${(row.payment_status || 'unpaid').toUpperCase()}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderStoreInputs() {
    const idMap = {
        cigarettes: 'cigInput', snacks: 'snacksInput',
        drinksWater: 'drinksWaterInput', drinksSoda: 'drinksSodaInput',
        drinksCoffee: 'drinksCoffeeInput', drinksJuice: 'drinksJuiceInput', drinksEnergy: 'drinksEnergyInput',
        palutoNoodles: 'palutoNoodlesInput', palutoRice: 'palutoRiceInput',
        palutoSoup: 'palutoSoupInput', palutoSilog: 'palutoSilogInput', palutoAppetizer: 'palutoAppetizerInput',
        otherSales: 'otherSalesInput', gcashCw: 'gcashCwInput', gcashFoods: 'gcashFoodsInput', expenses: 'expensesInput'
    };
    Object.keys(idMap).forEach(f => {
        const el = document.getElementById(idMap[f]);
        if (el) {
            el.value = storeData[f] || 0;
            const statusEl = document.getElementById(f + 'Status');
            if (statusEl) statusEl.textContent = '';
        }
    });
}

function renderAuditLogs() {
    const tbody = document.getElementById('auditBody');
    const footer = document.getElementById('auditFooter');
    if (!tbody) return;

    const data = filteredAuditLogs.length > 0 ? filteredAuditLogs : auditLogs;
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No audit logs available.</td></tr>';
        if (footer) footer.innerHTML = '';
        return;
    }

    tbody.innerHTML = '';
    data.slice(0, 200).forEach((log, idx) => {
        const actionClass = getAuditActionClass(log.action);
        const actionEmoji = getAuditActionEmoji(log.action);
        const actionLabel = getAuditActionLabel(log.action);
        const hasDetails = log.details && Object.keys(log.details).length > 0;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${log.created_at ? new Date(log.created_at).toLocaleString() : '—'}</td>
            <td><span class="badge ${actionClass}">${actionEmoji} ${actionLabel}</span></td>
            <td><strong>${log.user_name || log.username || 'Unknown'}</strong><br><span style="font-size:0.65rem;color:#94a3b8;">${log.user_role || ''}</span></td>
            <td>${log.description || ''}</td>
            <td>${hasDetails ? `<button class="btn btn-sm btn-primary" onclick="viewAuditDetails(${idx})"><i class="fas fa-eye"></i> View</button>` : '<span style="font-size:0.75rem;color:#94a3b8;">No details</span>'}</td>
        `;
        tbody.appendChild(tr);
    });
    
    const auditCount = document.getElementById('auditCount');
    if (auditCount) auditCount.textContent = `Showing ${Math.min(data.length, 200)} of ${auditLogs.length} entries`;
    
    if (footer) {
        footer.innerHTML = `<tr class="total-row"><td colspan="6" style="text-align:right;font-weight:700;">Total: ${auditLogs.length} entries</td></tr>`;
    }
}

function viewAuditDetails(index) {
    const data = filteredAuditLogs.length > 0 ? filteredAuditLogs : auditLogs;
    const log = data[index];
    if (!log) {
        showNotification('Audit log not found', 'error');
        return;
    }

    const modal = document.getElementById('auditDetailModal');
    const content = document.getElementById('auditDetailContent');
    if (!modal || !content) return;

    const actionClass = getAuditActionClass(log.action);
    const actionEmoji = getAuditActionEmoji(log.action);
    const actionLabel = getAuditActionLabel(log.action);
    const details = log.details || {};

    let html = `
        <div class="audit-detail-container">
            <div class="audit-detail-grid">
                <span class="label">Action:</span>
                <span class="value"><span class="badge ${actionClass}" style="font-size:0.85rem; padding:0.3rem 0.8rem;">${actionEmoji} ${actionLabel}</span></span>
                
                <span class="label">User:</span>
                <span class="value"><strong>${log.user_name || log.username || 'Unknown'}</strong> ${log.user_role ? `(${log.user_role})` : ''}</span>
                
                <span class="label">Date & Time:</span>
                <span class="value">${log.created_at ? new Date(log.created_at).toLocaleString() : '—'}</span>
                
                <span class="label">Description:</span>
                <span class="value">${log.description || '—'}</span>
            </div>
    `;

    if (details && Object.keys(details).length > 0) {
        if (log.action === 'SALARY_UPDATE' && details.carwashers !== undefined) {
            html += `
                <div style="margin-bottom:1rem;">
                    <h4 style="font-size:1rem; color:var(--gray-700); margin-bottom:0.5rem;">💵 Salary Summary</h4>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; background:var(--gray-50); padding:1rem; border-radius:8px; border:1px solid var(--gray-200);">
                        <div><span style="color:var(--gray-500);">Total Carwashers:</span> <strong>${details.carwashers}</strong></div>
                        <div><span style="color:var(--gray-500);">Total Salary:</span> <strong style="color:var(--primary);">${formatPrice(details.total_salary)}</strong></div>
                        ${details.carwasher ? `<div><span style="color:var(--gray-500);">Carwasher:</span> <strong>${details.carwasher}</strong></div>` : ''}
                        ${details.old_rate !== undefined ? `<div><span style="color:var(--gray-500);">Old Rate:</span> <strong>${(details.old_rate * 100).toFixed(0)}%</strong></div>` : ''}
                        ${details.new_rate !== undefined ? `<div><span style="color:var(--gray-500);">New Rate:</span> <strong>${(details.new_rate * 100).toFixed(0)}%</strong></div>` : ''}
                        ${details.old_status ? `<div><span style="color:var(--gray-500);">Old Status:</span> <strong>${details.old_status}</strong></div>` : ''}
                        ${details.new_status ? `<div><span style="color:var(--gray-500);">New Status:</span> <strong>${details.new_status}</strong></div>` : ''}
                    </div>
                </div>
            `;
        }
        else if (log.action === 'PRICE_UPDATE' && details.changes && details.changes.length > 0) {
            html += `
                <div style="margin-bottom:1rem;">
                    <h4 style="font-size:1rem; color:var(--gray-700); margin-bottom:0.5rem;">💰 Price Changes (${details.changes.length})</h4>
                    <div style="background:var(--gray-50); padding:0.75rem; border-radius:8px; border:1px solid var(--gray-200); max-height:300px; overflow-y:auto;">
                        ${details.changes.map(c => `
                            <div style="display:flex; justify-content:space-between; padding:0.4rem 0; border-bottom:1px solid var(--gray-200);">
                                <span><strong>${c.service}</strong></span>
                                <span>
                                    <span style="color:var(--danger); text-decoration:line-through;">${formatPrice(c.old_price)}</span>
                                    <span style="color:var(--gray-400);"> → </span>
                                    <span style="color:var(--success); font-weight:700;">${formatPrice(c.new_price)}</span>
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        else if (log.action === 'STORE_UPDATE' && details.field) {
            html += `
                <div style="margin-bottom:1rem;">
                    <h4 style="font-size:1rem; color:var(--gray-700); margin-bottom:0.5rem;">🏪 Store Update</h4>
                    <div style="display:grid; grid-template-columns:auto 1fr; gap:0.5rem 1rem; background:var(--gray-50); padding:1rem; border-radius:8px; border:1px solid var(--gray-200);">
                        <span style="font-weight:600; color:var(--gray-600);">Field:</span>
                        <span>${details.field}</span>
                        <span style="font-weight:600; color:var(--gray-600);">Old Value:</span>
                        <span style="color:var(--danger);">${formatPrice(details.old_value)}</span>
                        <span style="font-weight:600; color:var(--gray-600);">New Value:</span>
                        <span style="color:var(--success); font-weight:700;">${formatPrice(details.new_value)}</span>
                    </div>
                </div>
            `;
        }
        else if (log.action === 'STATUS_UPDATE' && details.old_status && details.new_status) {
            html += `
                <div style="margin-bottom:1rem;">
                    <h4 style="font-size:1rem; color:var(--gray-700); margin-bottom:0.5rem;">🔄 Status Change</h4>
                    <div style="display:grid; grid-template-columns:auto 1fr; gap:0.5rem 1rem; background:var(--gray-50); padding:1rem; border-radius:8px; border:1px solid var(--gray-200);">
                        <span style="font-weight:600; color:var(--gray-600);">Transaction:</span>
                        <span>#${details.transaction_id} - ${details.transaction || 'Unknown'}</span>
                        <span style="font-weight:600; color:var(--gray-600);">Old Status:</span>
                        <span style="color:${details.old_status === 'paid' ? 'var(--success)' : details.old_status === 'partial' ? 'var(--warning)' : 'var(--danger)'}; font-weight:600;">${details.old_status.toUpperCase()}</span>
                        <span style="font-weight:600; color:var(--gray-600);">New Status:</span>
                        <span style="color:${details.new_status === 'paid' ? 'var(--success)' : details.new_status === 'partial' ? 'var(--warning)' : 'var(--danger)'}; font-weight:700;">${details.new_status.toUpperCase()}</span>
                        ${details.amount ? `<span style="font-weight:600; color:var(--gray-600);">Amount:</span><span>${formatPrice(details.amount)}</span>` : ''}
                    </div>
                </div>
            `;
        }
        else if (log.action === 'BACKUP' || log.action === 'RESTORE') {
            html += `
                <div style="margin-bottom:1rem;">
                    <h4 style="font-size:1rem; color:var(--gray-700); margin-bottom:0.5rem;">${log.action === 'BACKUP' ? '💾' : '📂'} ${log.action === 'BACKUP' ? 'Backup' : 'Restore'} Details</h4>
                    <div style="display:grid; grid-template-columns:auto 1fr; gap:0.5rem 1rem; background:var(--gray-50); padding:1rem; border-radius:8px; border:1px solid var(--gray-200);">
                        ${details.filename ? `<span style="font-weight:600; color:var(--gray-600);">File:</span><span>${details.filename}</span>` : ''}
                        ${details.record_count !== undefined ? `<span style="font-weight:600; color:var(--gray-600);">Records:</span><span>${details.record_count}</span>` : ''}
                        ${details.type ? `<span style="font-weight:600; color:var(--gray-600);">Type:</span><span>${details.type}</span>` : ''}
                        ${details.restored_records ? `
                            <span style="font-weight:600; color:var(--gray-600);">Restored:</span>
                            <span>Transactions: ${details.restored_records.transactions || 0}, Salaries: ${details.restored_records.salaries || 0}, Prices: ${details.restored_records.service_prices || 0}</span>
                        ` : ''}
                    </div>
                </div>
            `;
        }
        else {
            html += `
                <div style="margin-bottom:1rem;">
                    <h4 style="font-size:1rem; color:var(--gray-700); margin-bottom:0.5rem;">📋 Details</h4>
                    <div style="background:var(--gray-50); padding:1rem; border-radius:8px; border:1px solid var(--gray-200); max-height:300px; overflow-y:auto;">
                        <pre style="font-family:'Courier New',monospace; font-size:0.85rem; white-space:pre-wrap; word-break:break-word; margin:0; color:var(--gray-800);">${JSON.stringify(details, null, 2)}</pre>
                    </div>
                </div>
            `;
        }
    }

    if ((log.action === 'UPDATE' || log.action === 'PRICE_UPDATE' || log.action === 'SALARY_UPDATE' || log.action === 'STATUS_UPDATE') && 
        details.old_values && details.new_values) {
        html += `
            <div style="margin-bottom:1rem;">
                <h4 style="font-size:1rem; color:var(--gray-700); margin-bottom:0.5rem;">🔄 Changes Comparison</h4>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                    <div style="background:var(--danger-light); padding:0.75rem; border-radius:8px; border:1px solid var(--danger);">
                        <div style="font-weight:600; color:var(--danger); margin-bottom:0.25rem;">Before</div>
                        <pre style="font-family:'Courier New',monospace; font-size:0.8rem; white-space:pre-wrap; word-break:break-word; margin:0; color:var(--gray-700);">${JSON.stringify(details.old_values, null, 2)}</pre>
                    </div>
                    <div style="background:var(--success-light); padding:0.75rem; border-radius:8px; border:1px solid var(--success);">
                        <div style="font-weight:600; color:var(--success); margin-bottom:0.25rem;">After</div>
                        <pre style="font-family:'Courier New',monospace; font-size:0.8rem; white-space:pre-wrap; word-break:break-word; margin:0; color:var(--gray-700);">${JSON.stringify(details.new_values, null, 2)}</pre>
                    </div>
                </div>
            </div>
        `;
    }

    html += '</div>';
    content.innerHTML = html;
    modal.classList.add('active');
}

function closeAuditDetail() {
    const modal = document.getElementById('auditDetailModal');
    if (modal) modal.classList.remove('active');
}

function filterAudit() {
    const search = document.getElementById('auditSearch')?.value.toLowerCase() || '';
    const action = document.getElementById('auditActionFilter')?.value || '';
    filteredAuditLogs = auditLogs.filter(log => {
        const matchSearch = !search || 
            (log.description || '').toLowerCase().includes(search) || 
            (log.user_name || '').toLowerCase().includes(search) ||
            (log.username || '').toLowerCase().includes(search);
        const matchAction = !action || log.action === action;
        return matchSearch && matchAction;
    });
    renderAuditLogs();
}

function refreshAudit() {
    showNotification('Refreshing audit...', 'info');
    loadAuditLogs().then(() => {
        filteredAuditLogs = [];
        const search = document.getElementById('auditSearch');
        if (search) search.value = '';
        const action = document.getElementById('auditActionFilter');
        if (action) action.value = '';
        renderAuditLogs();
        updateAuditBadge();
        showNotification('Audit refreshed successfully', 'success');
    });
}

function exportAuditLogs() {
    if (!checkPermission('audit')) return;
    if (auditLogs.length === 0) {
        showNotification('No audit logs to export', 'warning');
        return;
    }
    try {
        const wb = XLSX.utils.book_new();
        const excelData = auditLogs.slice(0, 500).map(log => ({
            'Date & Time': log.created_at ? new Date(log.created_at).toLocaleString() : '',
            'Action': log.action || '',
            'User': log.user_name || log.username || '',
            'Role': log.user_role || '',
            'Description': log.description || '',
            'Details': log.details ? JSON.stringify(log.details) : ''
        }));
        
        const ws = XLSX.utils.json_to_sheet(excelData);
        ws['!cols'] = [
            { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 40 }, { wch: 50 }
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Audit Logs');
        
        const filename = `Audit_Logs_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        showNotification(`✅ Audit logs exported successfully!`, 'success');
    } catch (err) {
        console.error('Export audit error:', err);
        showNotification('Error exporting audit logs: ' + err.message, 'error');
    }
}

// ============================================================
// SALARY FUNCTIONS
// ============================================================
function calculateSalaries() {
    if (!checkPermission('salary')) return;

    const carwashers = [...new Set(transactions.filter(t => t.category === 'carwash' && t.carwasher).map(t => t.carwasher).filter(Boolean))];
    if (carwashers.length === 0) {
        showNotification('No carwasher data found', 'warning');
        return;
    }

    const earnings = {};
    const counts = {};
    carwashers.forEach(cw => {
        const filtered = transactions.filter(t => t.category === 'carwash' && t.carwasher === cw);
        earnings[cw] = filtered.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);
        counts[cw] = filtered.length;
    });

    const oldSalaryData = [...salaryData];
    salaryData = carwashers.map(cw => {
        const existing = oldSalaryData.find(s => s.name === cw);
        const rate = existing ? existing.rate : 0.30;
        return {
            name: cw,
            cars_washed: counts[cw] || 0,
            total_earnings: earnings[cw] || 0,
            rate: rate,
            salary: (earnings[cw] || 0) * rate,
            status: existing ? existing.status : 'pending'
        };
    });
    renderSalaryTable();
    showNotification('Salaries calculated successfully', 'success');
    logAudit('SALARY_UPDATE', 'Salaries calculated', { 
        carwashers: carwashers.length, 
        total_salary: salaryData.reduce((sum, s) => sum + s.salary, 0)
    });
}

function renderSalaryTable() {
    const tbody = document.getElementById('salaryBody');
    const footer = document.getElementById('salaryFooter');
    if (!tbody) return;

    if (isStaff(currentUser)) {
        const table = document.getElementById('salaryTable');
        const summary = document.getElementById('salarySummary');
        if (table) table.style.display = 'none';
        if (summary) summary.style.display = 'none';
        return;
    }

    if (!salaryData || salaryData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No salary data. Click "Calculate".</td></tr>';
        if (footer) footer.innerHTML = '';
        return;
    }

    tbody.innerHTML = '';
    let totalSalary = 0, totalCars = 0, paidCount = 0, pendingCount = 0;
    const canEdit = checkPermission('salary');

    salaryData.forEach((row, idx) => {
        const statusClass = row.status === 'paid' ? 'badge-paid' : 'badge-pending';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td><strong>${row.name}</strong></td>
            <td>${row.cars_washed || 0}</td>
            <td class="price-col">${formatPrice(row.total_earnings || 0)}</td>
            <td>${canEdit ? `<input type="number" class="salary-rate-input" value="${(row.rate * 100).toFixed(0)}" min="0" max="100" step="5" onchange="updateSalaryRate(${idx}, this.value)"><span style="font-size:0.7rem;color:#64748b;">%</span>` : `${(row.rate * 100).toFixed(0)}%`}</td>
            <td class="price-col salary-total">${formatPrice(row.salary || 0)}</td>
            <td><span class="badge ${statusClass}">${(row.status || 'pending').toUpperCase()}</span></td>
            <td>${canEdit ? `<button class="btn btn-sm ${row.status === 'paid' ? 'btn-warning' : 'btn-success'}" onclick="toggleSalaryStatus(${idx})">${row.status === 'paid' ? '↩️' : '✅'}</button>` : '<span style="font-size:0.7rem;color:#94a3b8;">View</span>'}</td>
        `;
        tbody.appendChild(tr);
        totalSalary += row.salary || 0;
        totalCars += row.cars_washed || 0;
        if (row.status === 'paid') paidCount++; else pendingCount++;
    });

    const totalCarwashersEl = document.getElementById('totalCarwashers');
    if (totalCarwashersEl) totalCarwashersEl.textContent = salaryData.length;
    
    const totalCarsWashedEl = document.getElementById('totalCarsWashed');
    if (totalCarsWashedEl) totalCarsWashedEl.textContent = totalCars;
    
    const totalSalaryAmountEl = document.getElementById('totalSalaryAmount');
    if (totalSalaryAmountEl) totalSalaryAmountEl.textContent = formatPrice(totalSalary);
    
    const salaryPaidCountEl = document.getElementById('salaryPaidCount');
    if (salaryPaidCountEl) salaryPaidCountEl.textContent = paidCount;
    
    const salaryPendingCountEl = document.getElementById('salaryPendingCount');
    if (salaryPendingCountEl) salaryPendingCountEl.textContent = pendingCount;

    if (footer) {
        footer.innerHTML = `<tr class="total-row"><td colspan="5" style="text-align:right;font-weight:700;">TOTAL</td><td class="price-col" style="font-size:1.1rem;color:var(--primary);">${formatPrice(totalSalary)}</td><td colspan="2"></td></tr>`;
    }
}

function updateSalaryRate(index, value) {
    if (!checkPermission('salary')) return;
    const rate = parseFloat(value) / 100;
    if (isNaN(rate) || rate < 0) return;
    const oldRate = salaryData[index].rate;
    const oldSalary = salaryData[index].salary;
    salaryData[index].rate = rate;
    salaryData[index].salary = (salaryData[index].total_earnings || 0) * rate;
    renderSalaryTable();
    logAudit('SALARY_UPDATE', `Updated rate for ${salaryData[index].name}`, {
        carwasher: salaryData[index].name,
        old_rate: oldRate,
        new_rate: rate,
        old_salary: oldSalary,
        new_salary: salaryData[index].salary
    });
    showNotification(`Rate updated for ${salaryData[index].name}`, 'success');
}

function toggleSalaryStatus(index) {
    if (!checkPermission('salary')) return;
    const oldStatus = salaryData[index].status;
    salaryData[index].status = salaryData[index].status === 'paid' ? 'pending' : 'paid';
    renderSalaryTable();
    logAudit('SALARY_UPDATE', `Changed status for ${salaryData[index].name}`, {
        carwasher: salaryData[index].name,
        old_status: oldStatus,
        new_status: salaryData[index].status
    });
    showNotification(`Status changed to ${salaryData[index].status.toUpperCase()} for ${salaryData[index].name}`, 'success');
}

async function saveSalaries() {
    if (!checkPermission('salary')) return;
    if (!supabaseClient || !isSupabaseConnected) {
        showNotification('Supabase not connected. Please check your connection.', 'warning');
        return;
    }
    try {
        await supabaseClient.from(SALARY_TABLE).delete().neq('id', 0);
        for (const row of salaryData) {
            await supabaseClient.from(SALARY_TABLE).insert({
                name: row.name,
                cars_washed: row.cars_washed || 0,
                total_earnings: row.total_earnings || 0,
                rate: row.rate || 0.30,
                salary: row.salary || 0,
                status: row.status || 'pending'
            });
        }
        showNotification('Salaries saved successfully', 'success');
        logAudit('SALARY_UPDATE', 'Salaries saved to database', { 
            count: salaryData.length,
            total_salary: salaryData.reduce((sum, s) => sum + s.salary, 0)
        });
    } catch (err) {
        console.error('Save salaries error:', err);
        showNotification('Error saving salaries', 'error');
    }
}

// ============================================================
// FILTERS
// ============================================================
function populateFilters() {
    const carwashers = [...new Set(transactions.map(t => t.carwasher).filter(Boolean))];
    const carwasherSelect = document.getElementById('carwasherFilter');
    if (carwasherSelect) {
        carwasherSelect.innerHTML = '<option value="">All Carwashers</option>';
        carwashers.forEach(c => { carwasherSelect.innerHTML += `<option value="${c}">${c}</option>`; });
    }
    
    const detailers = [...new Set(transactions.map(t => t.detailer).filter(Boolean))];
    const detailerSelect = document.getElementById('detailerFilter');
    if (detailerSelect) {
        detailerSelect.innerHTML = '<option value="">All Detailers</option>';
        detailers.forEach(d => { detailerSelect.innerHTML += `<option value="${d}">${d}</option>`; });
    }
}

function applyFilters() {
    const search = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const category = document.getElementById('categoryFilter')?.value || '';
    const payment = document.getElementById('paymentFilter')?.value || '';
    const status = document.getElementById('paymentStatusFilter')?.value || '';
    const carwasher = document.getElementById('carwasherFilter')?.value || '';
    const detailer = document.getElementById('detailerFilter')?.value || '';

    filteredTransactions = transactions.filter(t => {
        const searchable = `${t.car_model || ''} ${t.item || ''} ${t.services || ''} ${t.plate || ''} ${t.remarks || ''} ${t.carwasher || ''} ${t.detailer || ''}`.toLowerCase();
        return (!search || searchable.includes(search)) &&
               (!category || t.category === category) &&
               (!payment || t.payment === payment) &&
               (!status || t.payment_status === status) &&
               (!carwasher || t.carwasher === carwasher) &&
               (!detailer || t.detailer === detailer);
    });

    const filterCount = document.getElementById('filterCount');
    if (filterCount) filterCount.textContent = `Showing ${filteredTransactions.length} of ${transactions.length}`;
    renderTable();
}

function clearFilters() {
    const search = document.getElementById('searchInput');
    if (search) search.value = '';
    
    const category = document.getElementById('categoryFilter');
    if (category) category.value = '';
    
    const payment = document.getElementById('paymentFilter');
    if (payment) payment.value = '';
    
    const status = document.getElementById('paymentStatusFilter');
    if (status) status.value = '';
    
    const carwasher = document.getElementById('carwasherFilter');
    if (carwasher) carwasher.value = '';
    
    const detailer = document.getElementById('detailerFilter');
    if (detailer) detailer.value = '';
    
    applyFilters();
    showNotification('Filters cleared', 'info');
}

function updateBadgeCount() {
    const badge = document.getElementById('txBadge');
    if (badge) badge.textContent = transactions.length;
}

// ============================================================
// STORE VALUE UPDATE - DATABASE SYNC
// ============================================================
async function updateStoreValue(field, value) {
    if (!checkPermission('store')) return;
    
    const numValue = parseFloat(value) || 0;
    const oldValue = storeData[field] || 0;
    const fieldName = field.replace(/([A-Z])/g, ' $1').trim();
    
    storeData[field] = numValue;
    
    const statusEl = document.getElementById(field + 'Status');
    if (statusEl) {
        statusEl.textContent = '⏳';
        statusEl.style.color = 'var(--warning)';
    }
    
    try {
        if (supabaseClient && isSupabaseConnected) {
            await saveSummaryData();
            console.log(`✅ Store value saved: ${field} = ${numValue}`);
        }
        
        if (statusEl) {
            statusEl.textContent = '✅';
            statusEl.style.color = 'var(--success)';
            setTimeout(() => {
                statusEl.textContent = '';
            }, 2000);
        }
        
        await logAudit('STORE_UPDATE', `Updated store value: ${fieldName}`, {
            field: field,
            old_value: oldValue,
            new_value: numValue
        });
        
        renderStoreTotals();
        renderSummaryCards();
        updateStoreHistory();
        
        showNotification(`${fieldName} updated to ${formatPrice(numValue)}`, 'success');
        
    } catch (err) {
        console.error('Store update error:', err);
        if (statusEl) {
            statusEl.textContent = '❌';
            statusEl.style.color = 'var(--danger)';
            setTimeout(() => {
                statusEl.textContent = '';
            }, 3000);
        }
        showNotification('Error saving store value: ' + err.message, 'error');
    }
}

async function addStoreTransaction(category, itemName, amount) {
    if (!checkPermission('add')) return;
    
    const now = new Date().toISOString();
    const transaction = {
        category: category,
        item: itemName,
        total: Math.abs(amount),
        quantity: 1,
        unit_price: Math.abs(amount),
        payment: 'CASH',
        payment_status: 'paid',
        remarks: amount < 0 ? 'EXPENSE' : 'STORE SALE',
        created_at: now,
        updated_at: now,
        store_order: [],
        selected_services: []
    };
    
    try {
        let savedTx = null;
        
        if (supabaseClient && isSupabaseConnected) {
            const { data, error } = await supabaseClient
                .from(TABLE_NAME)
                .insert(transaction)
                .select();
            if (!error && data && data.length > 0) {
                savedTx = data[0];
            } else {
                showNotification('Error saving transaction to database', 'error');
                return;
            }
        } else {
            transaction.id = Date.now();
            savedTx = transaction;
        }
        
        if (savedTx) {
            transactions.unshift(savedTx);
            await logAudit('ADD', `Store transaction: ${itemName}`, {
                item: itemName,
                amount: amount,
                category: category,
                type: amount < 0 ? 'Expense' : 'Sale'
            });
            
            if (amount > 0) {
                const fieldMap = {
                    'store': { 'Cigarettes': 'cigarettes', 'Snacks': 'snacks' },
                    'drinks': { 'Water': 'drinksWater', 'Soft Drinks': 'drinksSoda', 'Coffee': 'drinksCoffee', 'Juice': 'drinksJuice', 'Energy Drinks': 'drinksEnergy' },
                    'paluto': { 'Noodles': 'palutoNoodles', 'Rice Meal': 'palutoRice', 'Soup': 'palutoSoup', 'Silog Meal': 'palutoSilog', 'Appetizers': 'palutoAppetizer' },
                    'other': { 'Other Sale': 'otherSales', 'Expense': 'expenses' }
                };
                
                const field = fieldMap[category]?.[itemName];
                if (field && amount > 0) {
                    const currentValue = storeData[field] || 0;
                    storeData[field] = currentValue + amount;
                    renderStoreInputs();
                    renderStoreTotals();
                    if (supabaseClient && isSupabaseConnected) {
                        await saveSummaryData();
                    }
                }
            }
            
            populateFilters();
            applyFilters();
            renderAll();
            updateStoreHistory();
            showNotification(`✅ ${itemName} ${amount < 0 ? 'expense' : 'sale'} recorded: ${formatPrice(amount)}`, 'success');
        }
    } catch (err) {
        console.error('Add store transaction error:', err);
        showNotification('Error adding store transaction: ' + err.message, 'error');
    }
}

function renderStoreTotals() {
    const storeTotal = (storeData.cigarettes || 0) + (storeData.snacks || 0);
    document.getElementById('storeItemsTotal').textContent = formatPrice(storeTotal);
    document.getElementById('storeCatTotal').textContent = formatPrice(storeTotal);
    
    const drinksTotal = (storeData.drinksWater || 0) + (storeData.drinksSoda || 0) + 
                       (storeData.drinksCoffee || 0) + (storeData.drinksJuice || 0) + 
                       (storeData.drinksEnergy || 0);
    document.getElementById('drinksTotalDisplay').textContent = formatPrice(drinksTotal);
    document.getElementById('drinksCatTotal').textContent = formatPrice(drinksTotal);
    
    const palutoTotal = (storeData.palutoNoodles || 0) + (storeData.palutoRice || 0) + 
                       (storeData.palutoSoup || 0) + (storeData.palutoSilog || 0) + 
                       (storeData.palutoAppetizer || 0);
    document.getElementById('palutoTotalDisplay').textContent = formatPrice(palutoTotal);
    document.getElementById('palutoCatTotal').textContent = formatPrice(palutoTotal);
    
    const otherTotal = (storeData.otherSales || 0) + (storeData.gcashCw || 0) + 
                      (storeData.gcashFoods || 0);
    const netOther = otherTotal - (storeData.expenses || 0);
    document.getElementById('otherTotalDisplay').textContent = formatPrice(netOther);
    document.getElementById('otherCatTotal').textContent = formatPrice(netOther);
    
    const totalStoreSales = storeTotal + drinksTotal + palutoTotal + otherTotal;
    document.getElementById('totalStoreSales').textContent = formatPrice(totalStoreSales);
    document.getElementById('totalDrinksSummary').textContent = formatPrice(drinksTotal);
    document.getElementById('totalPalutoSummary').textContent = formatPrice(palutoTotal);
    document.getElementById('totalOtherSummary').textContent = formatPrice(netOther);
}

function updateStoreHistory() {
    const tbody = document.getElementById('storeHistoryBody');
    if (!tbody) return;
    
    const storeTxs = transactions
        .filter(t => ['store', 'drinks', 'paluto', 'other'].includes(t.category))
        .slice(0, 20);
    
    document.getElementById('storeTxCount').textContent = storeTxs.length;
    
    if (storeTxs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No store transactions</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    storeTxs.forEach((row, idx) => {
        const tr = document.createElement('tr');
        const isExpense = row.remarks === 'EXPENSE' || row.amount < 0;
        const statusClass = row.payment_status === 'paid' ? 'badge-success' : 'badge-warning';
        const amount = parseFloat(row.total) || 0;
        
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}</td>
            <td>${row.item || row.category}</td>
            <td class="price-col" style="color:${isExpense ? 'var(--danger)' : 'var(--success)'}">
                ${isExpense ? '-' : ''}${formatPrice(amount)}
            </td>
            <td><span class="badge badge-${row.category}">${row.category.toUpperCase()}</span></td>
            <td><span class="badge ${statusClass}">${(row.payment_status || 'unpaid').toUpperCase()}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

async function refreshStoreData() {
    showNotification('Refreshing store data...', 'info');
    await loadSummaryData();
    renderStoreInputs();
    renderStoreTotals();
    updateStoreHistory();
    showNotification('Store data refreshed', 'success');
}

function exportStoreData() {
    if (!checkPermission('export')) return;
    
    try {
        const wb = XLSX.utils.book_new();
        
        const storeItems = [
            ['STORE INVENTORY REPORT'],
            [''],
            ['Category', 'Item', 'Amount'],
            ['Store Items', 'Cigarettes', storeData.cigarettes || 0],
            ['Store Items', 'Snacks', storeData.snacks || 0],
            ['Drinks', 'Water', storeData.drinksWater || 0],
            ['Drinks', 'Soft Drinks', storeData.drinksSoda || 0],
            ['Drinks', 'Coffee', storeData.drinksCoffee || 0],
            ['Drinks', 'Juice', storeData.drinksJuice || 0],
            ['Drinks', 'Energy Drinks', storeData.drinksEnergy || 0],
            ['Paluto', 'Noodles', storeData.palutoNoodles || 0],
            ['Paluto', 'Rice Meals', storeData.palutoRice || 0],
            ['Paluto', 'Soup', storeData.palutoSoup || 0],
            ['Paluto', 'Silog Meals', storeData.palutoSilog || 0],
            ['Paluto', 'Appetizers', storeData.palutoAppetizer || 0],
            ['Other', 'GCash (CW)', storeData.gcashCw || 0],
            ['Other', 'GCash Foods', storeData.gcashFoods || 0],
            ['Other', 'Other Sales', storeData.otherSales || 0],
            ['Other', 'Expenses', storeData.expenses || 0],
            [],
            ['SUMMARY'],
            ['Total Store Sales', formatPrice((storeData.cigarettes || 0) + (storeData.snacks || 0))],
            ['Total Drinks', formatPrice((storeData.drinksWater || 0) + (storeData.drinksSoda || 0) + 
                (storeData.drinksCoffee || 0) + (storeData.drinksJuice || 0) + (storeData.drinksEnergy || 0))],
            ['Total Paluto', formatPrice((storeData.palutoNoodles || 0) + (storeData.palutoRice || 0) + 
                (storeData.palutoSoup || 0) + (storeData.palutoSilog || 0) + (storeData.palutoAppetizer || 0))],
            ['Total Other', formatPrice((storeData.otherSales || 0) + (storeData.gcashCw || 0) + 
                (storeData.gcashFoods || 0) - (storeData.expenses || 0))],
            ['GRAND TOTAL', formatPrice(
                (storeData.cigarettes || 0) + (storeData.snacks || 0) + 
                (storeData.drinksWater || 0) + (storeData.drinksSoda || 0) + 
                (storeData.drinksCoffee || 0) + (storeData.drinksJuice || 0) + 
                (storeData.drinksEnergy || 0) + (storeData.palutoNoodles || 0) + 
                (storeData.palutoRice || 0) + (storeData.palutoSoup || 0) + 
                (storeData.palutoSilog || 0) + (storeData.palutoAppetizer || 0) + 
                (storeData.otherSales || 0) + (storeData.gcashCw || 0) + 
                (storeData.gcashFoods || 0) - (storeData.expenses || 0)
            )],
            [''],
            ['Generated on', new Date().toLocaleString()]
        ];
        
        const ws = XLSX.utils.aoa_to_sheet(storeItems);
        ws['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Store Inventory');
        
        const filename = `Store_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        showNotification(`✅ Store inventory exported successfully!`, 'success');
    } catch (err) {
        console.error('Export store error:', err);
        showNotification('Error exporting store data: ' + err.message, 'error');
    }
}

// ============================================================
// REPORTS
// ============================================================
function generateReport(type) {
    if (!checkPermission('reports')) return;
    const now = new Date();
    let fromDate, toDate;

    switch(type) {
        case 'daily':
            fromDate = new Date(now); fromDate.setHours(0, 0, 0, 0);
            toDate = new Date(now); toDate.setHours(23, 59, 59, 999);
            break;
        case 'weekly':
            const day = now.getDay() || 7;
            fromDate = new Date(now); fromDate.setDate(now.getDate() - day + 1); fromDate.setHours(0, 0, 0, 0);
            toDate = new Date(now); toDate.setDate(now.getDate() + (7 - day)); toDate.setHours(23, 59, 59, 999);
            break;
        case 'monthly':
            fromDate = new Date(now.getFullYear(), now.getMonth(), 1); fromDate.setHours(0, 0, 0, 0);
            toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); toDate.setHours(23, 59, 59, 999);
            break;
        case 'yearly':
            fromDate = new Date(now.getFullYear(), 0, 1); fromDate.setHours(0, 0, 0, 0);
            toDate = new Date(now.getFullYear(), 11, 31); toDate.setHours(23, 59, 59, 999);
            break;
        case 'custom':
            const customRange = document.getElementById('customDateRange');
            if (customRange) customRange.style.display = 'block';
            return;
        default: return;
    }
    
    const dateFrom = document.getElementById('reportDateFrom');
    const dateTo = document.getElementById('reportDateTo');
    if (dateFrom) dateFrom.value = fromDate.toISOString().split('T')[0];
    if (dateTo) dateTo.value = toDate.toISOString().split('T')[0];
    generateCustomReport();
}

function generateCustomReport() {
    if (!checkPermission('reports')) return;
    const fromDate = new Date(document.getElementById('reportDateFrom').value);
    const toDate = new Date(document.getElementById('reportDateTo').value);
    if (!fromDate || !toDate || fromDate > toDate) {
        showNotification('Please select a valid date range', 'error');
        return;
    }
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);
    reportData = transactions.filter(t => {
        const date = new Date(t.created_at);
        return date >= fromDate && date <= toDate;
    });
    renderReport(reportData);
    showNotification(`Report generated with ${reportData.length} transactions`, 'success');
}

function renderReport(data) {
    const tbody = document.getElementById('reportBody');
    const footer = document.getElementById('reportFooter');
    const summary = document.getElementById('reportSummary');

    if (!data || data.length === 0) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No transactions found.</td></tr>';
        if (footer) footer.innerHTML = '';
        if (summary) summary.innerHTML = '';
        return;
    }

    const totalCarwash = data.filter(t => t.category === 'carwash').reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);
    const totalStore = data.filter(t => t.category === 'store').reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);
    const totalDrinks = data.filter(t => t.category === 'drinks').reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);
    const totalPaluto = data.filter(t => t.category === 'paluto').reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);
    const totalOther = data.filter(t => t.category === 'other').reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);
    const totalAll = data.reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);

    if (summary) {
        summary.innerHTML = `
            <div class="report-summary-item"><div class="label">📋 Total</div><div class="value">${data.length}</div></div>
            <div class="report-summary-item"><div class="label">🚘 Carwash</div><div class="value">${formatPrice(totalCarwash)}</div></div>
            <div class="report-summary-item"><div class="label">🏪 Store</div><div class="value">${formatPrice(totalStore)}</div></div>
            <div class="report-summary-item"><div class="label">🥤 Drinks</div><div class="value">${formatPrice(totalDrinks)}</div></div>
            <div class="report-summary-item"><div class="label">🍜 Paluto</div><div class="value">${formatPrice(totalPaluto)}</div></div>
            <div class="report-summary-item"><div class="label">💰 Other</div><div class="value">${formatPrice(totalOther)}</div></div>
            <div class="report-summary-item" style="background:#dbeafe;border-color:#2563eb;"><div class="label">🧾 Total</div><div class="value" style="color:#2563eb;">${formatPrice(totalAll)}</div></div>
        `;
    }

    if (tbody) {
        tbody.innerHTML = '';
        data.forEach((row) => {
            const tr = document.createElement('tr');
            const categoryEmoji = { carwash: '🚘', store: '🏪', drinks: '🥤', paluto: '🍜', other: '💰' };
            tr.innerHTML = `
                <td>${row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}</td>
                <td>${categoryEmoji[row.category] || '📋'} ${(row.category || 'other').toUpperCase()}</td>
                <td>${row.category === 'carwash' ? `${row.car_model} - ${row.services}` : row.item}</td>
                <td class="price-col">${formatPrice(parseFloat(row.total) || 0)}</td>
                <td><span class="badge ${getPaymentClass(row.payment)}">${row.payment || '—'}</span></td>
                <td><span class="badge badge-${row.payment_status || 'unpaid'}">${(row.payment_status || 'unpaid').toUpperCase()}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    if (footer) {
        footer.innerHTML = `<tr class="total-row"><td colspan="3" style="text-align:right;font-weight:700;">TOTAL</td><td class="price-col" style="font-size:1.1rem;">${formatPrice(totalAll)}</td><td colspan="2"></td></tr>`;
    }
}

// ============================================================
// EXPORT FUNCTIONS
// ============================================================
function exportData() {
    if (!checkPermission('export')) return;
    if (transactions.length === 0) {
        showNotification('No data to export', 'warning');
        return;
    }
    
    try {
        const wb = XLSX.utils.book_new();
        
        const headers = [
            'ID', 'Date', 'Category', 'Item', 'Car Model', 'Plate Number',
            'Services', 'Carwasher', 'Detailer', 'Quantity', 'Unit Price',
            'Total', 'Payment Method', 'Payment Status', 'Remarks', 'Bay'
        ];
        
        const excelData = transactions.map(row => {
            const date = row.created_at ? new Date(row.created_at) : new Date();
            return {
                'ID': row.id || '',
                'Date': date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
                'Category': (row.category || '').toUpperCase(),
                'Item': row.item || row.car_model || '',
                'Car Model': row.car_model || '',
                'Plate Number': row.plate || '',
                'Services': row.services || '',
                'Carwasher': row.carwasher || '',
                'Detailer': row.detailer || '',
                'Quantity': row.quantity || 1,
                'Unit Price': formatPrice(row.unit_price || 0),
                'Total': formatPrice(row.total || 0),
                'Payment Method': row.payment || '',
                'Payment Status': (row.payment_status || '').toUpperCase(),
                'Remarks': row.remarks || '',
                'Bay': row.bay || ''
            };
        });
        
        const ws = XLSX.utils.json_to_sheet(excelData);
        ws['!cols'] = [
            { wch: 8 }, { wch: 15 }, { wch: 12 }, { wch: 30 }, { wch: 15 },
            { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 10 },
            { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 8 }
        ];
        
        XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
        
        const summaryData = [
            ['SUMMARY REPORT'],
            [''],
            ['Total Transactions', transactions.length],
            ['Total Income', formatPrice(transactions.reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0))],
            ['Generated on', new Date().toLocaleString()],
            ['Generated by', currentUser ? currentUser.name : 'Unknown']
        ];
        const ws2 = XLSX.utils.aoa_to_sheet(summaryData);
        ws2['!cols'] = [{ wch: 25 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws2, 'Summary');
        
        const filename = `Transactions_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        logAudit('EXPORT', `Exported ${transactions.length} transactions to Excel`, { 
            filename: filename,
            count: transactions.length,
            format: 'Excel'
        });
        
        showNotification(`✅ ${transactions.length} transactions exported successfully!`, 'success');
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error exporting data: ' + err.message, 'error');
    }
}

function exportReportExcel() {
    if (!checkPermission('export')) return;
    if (reportData.length === 0) {
        showNotification('No data to export', 'warning');
        return;
    }
    
    try {
        const wb = XLSX.utils.book_new();
        const excelData = reportData.map(row => ({
            'Date': row.created_at ? new Date(row.created_at).toLocaleDateString() : '',
            'Category': (row.category || '').toUpperCase(),
            'Item': row.category === 'carwash' ? `${row.car_model} - ${row.services}` : row.item,
            'Amount': formatPrice(parseFloat(row.total) || 0),
            'Payment': row.payment || '',
            'Status': (row.payment_status || '').toUpperCase()
        }));
        
        const ws = XLSX.utils.json_to_sheet(excelData);
        ws['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Report');
        
        const totalAmount = reportData.reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);
        const summaryData = [
            ['REPORT SUMMARY'],
            [''],
            ['Date Range', document.getElementById('reportDateFrom').value + ' to ' + document.getElementById('reportDateTo').value],
            ['Total Transactions', reportData.length],
            ['Total Amount', formatPrice(totalAmount)],
            ['Generated on', new Date().toLocaleString()]
        ];
        const ws2 = XLSX.utils.aoa_to_sheet(summaryData);
        ws2['!cols'] = [{ wch: 25 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws2, 'Summary');
        
        const filename = `Sales_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        showNotification(`✅ Report exported successfully!`, 'success');
    } catch (err) {
        console.error('Export Excel error:', err);
        showNotification('Error exporting Excel: ' + err.message, 'error');
    }
}

function exportReportPDF() {
    if (!checkPermission('export')) return;
    if (reportData.length === 0) {
        showNotification('No data to export', 'warning');
        return;
    }
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape', 'mm', 'a4');
        
        doc.setFontSize(20);
        doc.setTextColor(37, 99, 235);
        doc.text('SALES REPORT', 14, 22);
        
        doc.setFontSize(11);
        doc.setTextColor(100, 116, 139);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
        doc.text(`Date Range: ${document.getElementById('reportDateFrom').value} to ${document.getElementById('reportDateTo').value}`, 14, 37);
        
        const totalAmount = reportData.reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`Total Transactions: ${reportData.length}  |  Total Amount: ${formatPrice(totalAmount)}`, 14, 44);
        
        const tableData = reportData.map(row => [
            row.created_at ? new Date(row.created_at).toLocaleDateString() : '',
            (row.category || '').toUpperCase(),
            row.category === 'carwash' ? `${row.car_model} - ${row.services}` : (row.item || ''),
            formatPrice(parseFloat(row.total) || 0),
            row.payment || '',
            (row.payment_status || '').toUpperCase()
        ]);

        doc.autoTable({
            startY: 50,
            head: [['Date', 'Category', 'Item', 'Amount', 'Payment', 'Status']],
            body: tableData,
            theme: 'striped',
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
            footStyles: { fillColor: [241, 245, 249] },
            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 20 },
                2: { cellWidth: 45 },
                3: { cellWidth: 25 },
                4: { cellWidth: 25 },
                5: { cellWidth: 20 }
            }
        });

        const finalY = doc.lastAutoTable.finalY || 50;
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(`Total Income: ${formatPrice(totalAmount)}`, 14, finalY + 10);
        doc.text(`Total Transactions: ${reportData.length}`, 14, finalY + 17);
        doc.text(`Generated by: ${currentUser ? currentUser.name : 'Unknown'}`, 14, finalY + 24);
        doc.text(`© MINI BOSS CARWASH - ${new Date().getFullYear()}`, 14, finalY + 31);
        
        const filename = `Sales_Report_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);
        
        showNotification(`✅ PDF exported successfully!`, 'success');
    } catch (err) {
        console.error('Export PDF error:', err);
        showNotification('Error exporting PDF: ' + err.message, 'error');
    }
}

function exportSalaries() {
    if (!checkPermission('salary')) return;
    if (!salaryData || salaryData.length === 0) {
        showNotification('No salary data to export', 'warning');
        return;
    }
    
    try {
        const wb = XLSX.utils.book_new();
        const excelData = salaryData.map((row, idx) => ({
            '#': idx + 1,
            'Carwasher': row.name || '',
            'Cars Washed': row.cars_washed || 0,
            'Total Earnings': formatPrice(row.total_earnings || 0),
            'Rate': (row.rate * 100).toFixed(0) + '%',
            'Salary': formatPrice(row.salary || 0),
            'Status': (row.status || '').toUpperCase()
        }));
        
        const ws = XLSX.utils.json_to_sheet(excelData);
        ws['!cols'] = [
            { wch: 6 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 20 }, { wch: 15 }
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Salaries');
        
        const totalSalary = salaryData.reduce((sum, s) => sum + (s.salary || 0), 0);
        const summaryData = [
            ['SALARY SUMMARY'],
            [''],
            ['Total Carwashers', salaryData.length],
            ['Total Salary', formatPrice(totalSalary)],
            ['Paid Count', salaryData.filter(s => s.status === 'paid').length],
            ['Pending Count', salaryData.filter(s => s.status === 'pending').length],
            [''],
            ['Generated on', new Date().toLocaleString()]
        ];
        const ws2 = XLSX.utils.aoa_to_sheet(summaryData);
        ws2['!cols'] = [{ wch: 25 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws2, 'Summary');
        
        const filename = `Salaries_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        showNotification(`✅ Salaries exported successfully!`, 'success');
    } catch (err) {
        console.error('Export salaries error:', err);
        showNotification('Error exporting salaries: ' + err.message, 'error');
    }
}

// ============================================================
// PRICE MANAGEMENT
// ============================================================
async function loadServicePrices() {
    try {
        if (supabaseClient && isSupabaseConnected) {
            const { data, error } = await supabaseClient
                .from(SERVICE_PRICES_TABLE)
                .select('*')
                .order('service_category')
                .order('service_name')
                .order('size_category');
            if (!error && data && data.length > 0) {
                servicePrices = data;
                console.log(`✅ Loaded ${servicePrices.length} service prices from database`);
                renderPriceSettings();
                populateServiceDropdowns();
                return;
            }
        }
        servicePrices = getStaticServicePrices();
        console.log(`📄 Using ${servicePrices.length} static service prices`);
        renderPriceSettings();
        populateServiceDropdowns();
        if (supabaseClient && isSupabaseConnected) {
            await seedServicePrices();
        }
    } catch (err) {
        console.warn('Could not load service prices:', err);
        servicePrices = getStaticServicePrices();
        renderPriceSettings();
        populateServiceDropdowns();
    }
}

async function seedServicePrices() {
    try {
        const { data, error } = await supabaseClient
            .from(SERVICE_PRICES_TABLE)
            .select('id')
            .limit(1);
        if (!error && data && data.length === 0) {
            const staticPrices = getStaticServicePrices();
            for (const price of staticPrices) {
                await supabaseClient.from(SERVICE_PRICES_TABLE).insert(price);
            }
            console.log('✅ Seeded service prices to database');
            showNotification('Service prices seeded to database', 'success');
            await logAudit('PRICE_UPDATE', 'Seeded initial service prices', { count: staticPrices.length });
        }
    } catch (err) {
        console.warn('Could not seed service prices:', err);
    }
}

async function saveAllPrices() {
    if (!checkPermission('prices')) return;
    if (changedPrices.size === 0) {
        showNotification('No changes to save', 'info');
        return;
    }

    const confirmed = await showConfirm({
        icon: '💰', iconColor: '#2563eb', title: 'Save Price Changes',
        message: `Are you sure you want to save ${changedPrices.size} price changes?`,
        details: {
            transaction: `<strong>${changedPrices.size}</strong> prices will be updated`,
            amount: 'This will affect all future transactions',
            status: 'Price Update'
        },
        buttonClass: 'btn-success', buttonText: '<i class="fas fa-save"></i> Save Changes'
    });
    if (!confirmed) return;

    try {
        let savedCount = 0;
        const changes = [];

        for (const uniqueId of changedPrices) {
            const [category, serviceName, size] = uniqueId.split('-');
            const inputId = `price_${uniqueId.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const input = document.getElementById(inputId);
            if (!input) continue;

            const newPrice = parseFloat(input.value);
            if (isNaN(newPrice) || newPrice < 0) continue;

            const original = servicePrices.find(p => 
                p.service_category === category &&
                p.service_name === serviceName &&
                p.size_category === size
            );
            if (!original) continue;

            const oldPrice = original.price;

            if (supabaseClient && isSupabaseConnected) {
                const { error } = await supabaseClient
                    .from(SERVICE_PRICES_TABLE)
                    .update({ price: newPrice, updated_at: new Date().toISOString() })
                    .eq('id', original.id);
                if (error) {
                    console.error('Error saving price:', error);
                    continue;
                }
            }

            original.price = newPrice;
            savedCount++;
            changes.push({
                service: `${serviceName} (${size})`,
                old_price: oldPrice,
                new_price: newPrice
            });

            input.className = 'price-input saved';
            setTimeout(() => {
                if (input) input.className = 'price-input';
            }, 1500);
        }

        changedPrices.clear();
        
        await logAudit('PRICE_UPDATE', `Updated ${savedCount} service prices`, {
            changes: changes,
            count: savedCount
        });

        showNotification(`✅ ${savedCount} prices saved successfully`, 'success');
        populateServiceDropdowns();
        renderPriceSettings();

    } catch (err) {
        console.error('Error saving prices:', err);
        showNotification('Error saving prices: ' + err.message, 'error');
    }
}

function renderPriceSettings() {
    const container = document.getElementById('priceSettingsContainer');
    if (!container) return;

    if (!servicePrices || servicePrices.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-tags"></i>
                <h3>No prices found</h3>
                <p>Click refresh to load prices from database</p>
                <button class="btn btn-primary" onclick="loadServicePrices()" style="margin-top:0.5rem;">
                    <i class="fas fa-sync"></i> Refresh
                </button>
            </div>`;
        return;
    }

    const categories = {};
    servicePrices.forEach(p => {
        if (!categories[p.service_category]) categories[p.service_category] = [];
        categories[p.service_category].push(p);
    });

    let html = `
        <div style="margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div>
                <span style="font-weight:600; color:var(--gray-700);">Total Services: ${servicePrices.length}</span>
                <span style="font-size:0.8rem; color:var(--gray-500); margin-left:0.5rem;">
                    ${isSupabaseConnected ? '✅ Connected to database' : '📄 Offline Mode'}
                </span>
            </div>
            <div>
                <button class="btn btn-sm btn-outline" onclick="loadServicePrices()">
                    <i class="fas fa-sync"></i> Refresh
                </button>
            </div>
        </div>
    `;

    Object.keys(categories).sort().forEach(category => {
        const prices = categories[category];
        html += `
            <div class="price-category">
                <div class="price-category-header">
                    <span>${category}</span>
                    <span class="count">${prices.length} services</span>
                </div>
                <div class="price-table-wrap">
                    <table class="price-table">
                        <thead>
                            <tr>
                                <th>Service Name</th>
                                <th>Size</th>
                                <th style="text-align:right;">Price (₱)</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        prices.forEach((p) => {
            const uniqueId = `${p.service_category}-${p.service_name}-${p.size_category}`;
            const isChanged = changedPrices.has(uniqueId);
            html += `
                <tr>
                    <td><strong>${p.service_name}</strong></td>
                    <td>${p.size_category}</td>
                    <td style="text-align:right;">
                        <input type="number" class="price-input ${isChanged ? 'changed' : ''}" 
                               id="price_${uniqueId.replace(/[^a-zA-Z0-9]/g, '_')}" 
                               value="${p.price}" 
                               step="5" min="0"
                               onchange="markPriceChanged('${uniqueId}', this.value)"
                               onfocus="this.select()"
                               title="Click to edit price">
                        ${isChanged ? '<span style="color:var(--warning);font-size:0.65rem;margin-left:0.3rem;">⬆️ modified</span>' : ''}
                    </td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    });

    html += `
        <div style="margin-top:1rem; text-align:center; padding:0.5rem; background:var(--gray-50); border-radius:8px; font-size:0.8rem; color:var(--gray-500);">
            <i class="fas fa-info-circle"></i> 
            ${changedPrices.size > 0 ? `You have ${changedPrices.size} unsaved changes. Click "Save All Changes" to update the database.` : 'All prices are saved in the database.'}
        </div>
    `;

    container.innerHTML = html;
    const priceCount = document.getElementById('priceCount');
    if (priceCount) priceCount.textContent = servicePrices.length;
}

function markPriceChanged(uniqueId, value) {
    const price = parseFloat(value);
    if (isNaN(price) || price < 0) return;
    
    const original = servicePrices.find(p => 
        `${p.service_category}-${p.service_name}-${p.size_category}` === uniqueId
    );
    if (!original) return;

    const inputId = `price_${uniqueId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const input = document.getElementById(inputId);
    
    if (Math.abs(original.price - price) > 0.01) {
        changedPrices.add(uniqueId);
        if (input) input.className = 'price-input changed';
        const statusDiv = document.querySelector('.price-settings-container > div:last-child');
        if (statusDiv) {
            statusDiv.innerHTML = `
                <i class="fas fa-info-circle"></i> 
                You have ${changedPrices.size} unsaved changes. Click "Save All Changes" to update the database.
            `;
        }
    } else {
        changedPrices.delete(uniqueId);
        if (input) input.className = 'price-input saved';
        setTimeout(() => {
            if (input) input.className = 'price-input';
        }, 1000);
        const statusDiv = document.querySelector('.price-settings-container > div:last-child');
        if (statusDiv) {
            if (changedPrices.size > 0) {
                statusDiv.innerHTML = `
                    <i class="fas fa-info-circle"></i> 
                    You have ${changedPrices.size} unsaved changes. Click "Save All Changes" to update the database.
                `;
            } else {
                statusDiv.innerHTML = `
                    <i class="fas fa-check-circle" style="color:var(--success);"></i> 
                    All prices are saved in the database.
                `;
            }
        }
    }
}

// ============================================================
// SUMMARY DATA
// ============================================================
async function saveSummaryData() {
    if (!supabaseClient || !isSupabaseConnected) {
        console.warn('Supabase not connected, skipping save');
        return;
    }
    
    try {
        await supabaseClient.from(STORE_SUMMARY_TABLE).insert({
            cigarettes: storeData.cigarettes || 0,
            snacks: storeData.snacks || 0,
            drinks_water: storeData.drinksWater || 0,
            drinks_soda: storeData.drinksSoda || 0,
            drinks_coffee: storeData.drinksCoffee || 0,
            drinks_juice: storeData.drinksJuice || 0,
            drinks_energy: storeData.drinksEnergy || 0,
            paluto_noodles: storeData.palutoNoodles || 0,
            paluto_rice: storeData.palutoRice || 0,
            paluto_soup: storeData.palutoSoup || 0,
            paluto_silog: storeData.palutoSilog || 0,
            paluto_appetizer: storeData.palutoAppetizer || 0,
            other_sales: storeData.otherSales || 0,
            gcash_cw: storeData.gcashCw || 0,
            gcash_foods: storeData.gcashFoods || 0,
            expenses: storeData.expenses || 0
        });
        console.log('✅ Store summary saved to database');
    } catch (err) {
        console.error('Error saving store summary:', err);
        throw err;
    }
}

async function loadSummaryData() {
    if (!supabaseClient || !isSupabaseConnected) {
        console.log('📄 Using local store data (offline mode)');
        return;
    }
    
    try {
        const { data, error } = await supabaseClient
            .from(STORE_SUMMARY_TABLE)
            .select('*')
            .order('id', { ascending: false })
            .limit(1);
            
        if (!error && data && data.length > 0) {
            const s = data[0];
            storeData = {
                cigarettes: parseFloat(s.cigarettes) || 0,
                snacks: parseFloat(s.snacks) || 0,
                drinksWater: parseFloat(s.drinks_water) || 0,
                drinksSoda: parseFloat(s.drinks_soda) || 0,
                drinksCoffee: parseFloat(s.drinks_coffee) || 0,
                drinksJuice: parseFloat(s.drinks_juice) || 0,
                drinksEnergy: parseFloat(s.drinks_energy) || 0,
                palutoNoodles: parseFloat(s.paluto_noodles) || 0,
                palutoRice: parseFloat(s.paluto_rice) || 0,
                palutoSoup: parseFloat(s.paluto_soup) || 0,
                palutoSilog: parseFloat(s.paluto_silog) || 0,
                palutoAppetizer: parseFloat(s.paluto_appetizer) || 0,
                otherSales: parseFloat(s.other_sales) || 0,
                gcashCw: parseFloat(s.gcash_cw) || 0,
                gcashFoods: parseFloat(s.gcash_foods) || 0,
                expenses: parseFloat(s.expenses) || 0
            };
            console.log('✅ Loaded store data from database');
            renderStoreInputs();
            renderStoreTotals();
        } else {
            console.log('📄 No store data in database, using defaults');
        }
    } catch (err) {
        console.warn('Could not load store summary:', err);
    }
}

// ============================================================
// GET PAYMENT CLASS
// ============================================================
function getPaymentClass(payment) {
    if (!payment) return 'mod-other';
    const p = payment.toUpperCase();
    if (p.includes('CASH')) return 'mod-cash';
    if (p.includes('GCASH')) return 'mod-gcash';
    if (p.includes('BANK') || p.includes('MARI')) return 'mod-bank';
    if (p.includes('FREE')) return 'mod-free';
    return 'mod-other';
}

// ============================================================
// NOTIFICATION SYSTEM
// ============================================================
function showNotification(message, type = 'info', duration = 4000) {
    const container = document.getElementById('notificationContainer');
    if (!container) {
        console.log(`${type.toUpperCase()}: ${message}`);
        return;
    }

    const config = {
        success: { icon: '✅', title: 'Success', className: 'notification-success' },
        error: { icon: '❌', title: 'Error', className: 'notification-error' },
        warning: { icon: '⚠️', title: 'Warning', className: 'notification-warning' },
        info: { icon: 'ℹ️', title: 'Info', className: 'notification-info' }
    };
    const cfg = config[type] || config.info;

    const notification = document.createElement('div');
    notification.className = `notification ${cfg.className}`;
    notification.innerHTML = `
        <span class="notif-icon">${cfg.icon}</span>
        <div class="notif-content">
            <div class="notif-title">${cfg.title}</div>
            <div class="notif-message">${message}</div>
        </div>
        <button class="notif-close" onclick="this.closest('.notification').remove()">×</button>
        <div class="notif-progress"></div>
    `;
    container.appendChild(notification);

    const timeout = setTimeout(() => {
        if (notification.parentNode) {
            notification.classList.add('notification-exit');
            setTimeout(() => { if (notification.parentNode) notification.remove(); }, 400);
        }
    }, duration);

    notification.addEventListener('click', function(e) {
        if (e.target.closest('.notif-close')) return;
        clearTimeout(timeout);
        this.classList.add('notification-exit');
        setTimeout(() => { if (this.parentNode) this.remove(); }, 400);
    });
}

// ============================================================
// LOADING STATES
// ============================================================
function showLoadingState(show, message) {
    const loading = document.getElementById('loadingState');
    const spinner = document.getElementById('loadingSpinner');
    if (show) {
        isLoading = true;
        if (spinner) { 
            spinner.style.display = 'flex'; 
            spinner.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${message || 'Loading...'}`; 
        }
        if (loading) { 
            loading.style.display = 'block'; 
            loading.innerHTML = `<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> ${message || 'Loading...'}</div>`; 
        }
    } else {
        isLoading = false;
        if (spinner) spinner.style.display = 'none';
        if (loading) loading.style.display = 'none';
    }
}

function showErrorState(message) {
    const loading = document.getElementById('loadingState');
    if (loading) {
        loading.style.display = 'block';
        loading.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle" style="font-size:2rem;color:#dc2626;margin-bottom:1rem;display:block;"></i>
                <h3 style="color:#dc2626;">Error</h3>
                <p style="color:#64748b;">${message}</p>
                <button class="btn btn-primary" onclick="refreshData()" style="margin-top:1rem;"><i class="fas fa-sync"></i> Retry</button>
            </div>
        `;
    }
}

// ============================================================
// REFRESH DATA
// ============================================================
async function refreshData() {
    showNotification('Refreshing data...', 'info');
    await loadData();
    await loadServicePrices();
    await loadAuditLogs();
    await loadSummaryData();
    renderStoreTotals();
    updateStoreHistory();
    updateAuditBadge();
    showNotification('Data refreshed successfully', 'success');
}

// ============================================================
// BACKUP FUNCTIONS
// ============================================================
function loadBackupHistory() {
    try {
        const history = localStorage.getItem(BACKUP_HISTORY_KEY);
        if (history) {
            backupHistory = JSON.parse(history);
            renderBackupHistory();
        }
    } catch (err) {
        console.warn('Could not load backup history:', err);
    }
}

function saveBackupHistory() {
    try {
        localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(backupHistory));
    } catch (err) {
        console.warn('Could not save backup history:', err);
    }
}

function renderBackupHistory() {
    const container = document.getElementById('backupHistoryContainer');
    if (!container) return;

    if (!backupHistory || backupHistory.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding:1rem;">
                <i class="fas fa-inbox" style="font-size:1.5rem; color:var(--gray-300);"></i>
                <p style="color:var(--gray-400);">No backups created in this session.</p>
            </div>
        `;
        return;
    }

    let html = '<div style="max-height:300px; overflow-y:auto;">';
    backupHistory.slice().reverse().forEach((backup, index) => {
        const date = new Date(backup.created_at);
        const size = (backup.size / 1024).toFixed(1);
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0.75rem; border-bottom:1px solid var(--gray-100);">
                <div>
                    <div style="font-weight:600; color:var(--gray-700);">
                        <i class="fas fa-file-archive" style="color:var(--primary);"></i>
                        ${backup.filename}
                    </div>
                    <div style="font-size:0.7rem; color:var(--gray-500);">
                        ${date.toLocaleString()} • ${size} KB • ${backup.record_count || 0} records
                    </div>
                </div>
                <div style="display:flex; gap:0.3rem;">
                    <button class="btn btn-sm btn-outline" onclick="downloadBackupFile('${backup.filename}')" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteBackup('${backup.filename}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

function startAutoBackup() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    const todayStr = now.toISOString().split('T')[0];
    const todayBackup = backupHistory.find(b => b.filename.includes(todayStr));
    
    if (!todayBackup && isAdmin(currentUser)) {
        if (autoBackupTimer) clearTimeout(autoBackupTimer);
        autoBackupTimer = setTimeout(() => {
            performAutoBackup();
        }, msUntilMidnight + 60000);
        console.log('⏰ Auto-backup scheduled for midnight');
    }
}

function stopAutoBackup() {
    if (autoBackupTimer) {
        clearTimeout(autoBackupTimer);
        autoBackupTimer = null;
    }
}

async function performAutoBackup() {
    if (!isAdmin(currentUser)) return;
    
    try {
        const data = await gatherBackupData();
        const filename = `backup_${new Date().toISOString().split('T')[0]}_auto.json`;
        const backupData = {
            version: '1.0',
            created_at: new Date().toISOString(),
            type: 'auto',
            data: data
        };
        
        const json = JSON.stringify(backupData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        
        const backupEntry = {
            filename: filename,
            created_at: new Date().toISOString(),
            size: blob.size,
            record_count: data.transactions?.length || 0
        };
        backupHistory.push(backupEntry);
        saveBackupHistory();
        renderBackupHistory();
        
        await logAudit('BACKUP', `Auto backup created: ${filename}`, {
            filename: filename,
            record_count: data.transactions?.length || 0,
            type: 'auto'
        });
        
        showNotification(`Auto backup created successfully: ${filename}`, 'success');
        startAutoBackup();
    } catch (err) {
        console.error('Auto backup error:', err);
        showNotification('Auto backup failed: ' + err.message, 'error');
    }
}

async function gatherBackupData() {
    let transactionsData = transactions;
    let salaryDataLocal = salaryData;
    let servicePricesData = servicePrices;
    let storeDataLocal = storeData;
    
    if (supabaseClient && isSupabaseConnected) {
        try {
            const { data: txData } = await supabaseClient.from(TABLE_NAME).select('*');
            if (txData) transactionsData = txData;
            
            const { data: salData } = await supabaseClient.from(SALARY_TABLE).select('*');
            if (salData) salaryDataLocal = salData;
            
            const { data: priceData } = await supabaseClient.from(SERVICE_PRICES_TABLE).select('*');
            if (priceData) servicePricesData = priceData;
        } catch (err) {
            console.warn('Could not fetch fresh data for backup:', err);
        }
    }
    
    return {
        transactions: transactionsData,
        salaries: salaryDataLocal,
        service_prices: servicePricesData,
        store_data: storeDataLocal,
        exported_at: new Date().toISOString(),
        total_transactions: transactionsData.length
    };
}

async function createBackup() {
    if (!checkPermission('backup')) return;
    
    try {
        showNotification('Creating backup...', 'info');
        
        const data = await gatherBackupData();
        const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup_${dateStr}.json`;
        
        const backupData = {
            version: '1.0',
            created_at: new Date().toISOString(),
            type: 'manual',
            data: data
        };
        
        const json = JSON.stringify(backupData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        
        const backupEntry = {
            filename: filename,
            created_at: new Date().toISOString(),
            size: blob.size,
            record_count: data.transactions?.length || 0
        };
        backupHistory.push(backupEntry);
        saveBackupHistory();
        renderBackupHistory();
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        
        await logAudit('BACKUP', `Manual backup created: ${filename}`, {
            filename: filename,
            record_count: data.transactions?.length || 0,
            type: 'manual'
        });
        
        showNotification(`Backup created successfully: ${filename}`, 'success');
    } catch (err) {
        console.error('Backup error:', err);
        showNotification('Backup failed: ' + err.message, 'error');
    }
}

function downloadBackupFile(filename) {
    const backup = backupHistory.find(b => b.filename === filename);
    if (!backup) {
        showNotification('Backup file not found in history', 'error');
        return;
    }
    
    try {
        const stored = localStorage.getItem(`backup_${filename}`);
        if (stored) {
            const blob = new Blob([stored], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 10000);
            showNotification('Downloading backup file...', 'info');
            return;
        }
    } catch (err) {
        console.warn('Could not retrieve backup from storage:', err);
    }
    
    showNotification('Backup file not found. Please create a new backup.', 'warning');
}

function deleteBackup(filename) {
    if (!confirm(`Are you sure you want to delete backup: ${filename}?`)) return;
    
    backupHistory = backupHistory.filter(b => b.filename !== filename);
    saveBackupHistory();
    renderBackupHistory();
    showNotification('Backup deleted successfully', 'success');
}

async function restoreFromBackup() {
    if (!checkPermission('restore')) return;
    
    const fileInput = document.getElementById('restoreFileInput');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showNotification('Please select a backup file to restore', 'warning');
        return;
    }
    
    const file = fileInput.files[0];
    if (!file.name.endsWith('.json')) {
        showNotification('Please select a valid JSON backup file', 'error');
        return;
    }
    
    const confirmed = await showConfirm({
        icon: '⚠️', iconColor: '#dc2626', title: 'Restore Database',
        message: 'This will REPLACE ALL current data with the data from the backup file.',
        details: {
            transaction: `<strong>${file.name}</strong>`,
            amount: 'All current data will be overwritten',
            status: '⚠️ IRREVERSIBLE ACTION'
        },
        buttonClass: 'btn-danger', buttonText: '<i class="fas fa-upload"></i> Restore Now'
    });
    
    if (!confirmed) return;
    
    try {
        const text = await file.text();
        const backupData = JSON.parse(text);
        
        if (!backupData.version || !backupData.data) {
            showNotification('Invalid backup file format', 'error');
            return;
        }
        
        const data = backupData.data;
        
        if (data.transactions && data.transactions.length > 0) {
            if (supabaseClient && isSupabaseConnected) {
                await supabaseClient.from(TABLE_NAME).delete().neq('id', 0);
                for (const tx of data.transactions) {
                    const { id, ...txWithoutId } = tx;
                    await supabaseClient.from(TABLE_NAME).insert(txWithoutId);
                }
                console.log(`✅ Restored ${data.transactions.length} transactions`);
            }
            transactions = data.transactions;
        }
        
        if (data.salaries && data.salaries.length > 0) {
            if (supabaseClient && isSupabaseConnected) {
                await supabaseClient.from(SALARY_TABLE).delete().neq('id', 0);
                for (const sal of data.salaries) {
                    const { id, ...salWithoutId } = sal;
                    await supabaseClient.from(SALARY_TABLE).insert(salWithoutId);
                }
                console.log(`✅ Restored ${data.salaries.length} salaries`);
            }
            salaryData = data.salaries;
        }
        
        if (data.service_prices && data.service_prices.length > 0) {
            if (supabaseClient && isSupabaseConnected) {
                await supabaseClient.from(SERVICE_PRICES_TABLE).delete().neq('id', 0);
                for (const price of data.service_prices) {
                    const { id, ...priceWithoutId } = price;
                    await supabaseClient.from(SERVICE_PRICES_TABLE).insert(priceWithoutId);
                }
                console.log(`✅ Restored ${data.service_prices.length} service prices`);
            }
            servicePrices = data.service_prices;
        }
        
        if (data.store_data) {
            storeData = data.store_data;
            renderStoreInputs();
        }
        
        await logAudit('RESTORE', `Database restored from backup: ${file.name}`, {
            filename: file.name,
            restored_records: {
                transactions: data.transactions?.length || 0,
                salaries: data.salaries?.length || 0,
                service_prices: data.service_prices?.length || 0
            }
        });
        
        populateFilters();
        applyFilters();
        renderAll();
        renderSalaryTable();
        renderPriceSettings();
        showNotification(`✅ Database restored successfully from ${file.name}`, 'success');
        
        fileInput.value = '';
    } catch (err) {
        console.error('Restore error:', err);
        showNotification('Restore failed: ' + err.message, 'error');
    }
}

// ============================================================
// MODAL CONTROLS
// ============================================================
function openModal() {
    const modal = document.getElementById('transactionModal');
    if (modal) modal.classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('transactionModal');
    if (modal) modal.classList.remove('active');
}

function openQuickAdd() {
    if (!checkPermission('add')) return;
    const form = document.getElementById('quickAddForm');
    if (form) form.reset();
    const modal = document.getElementById('quickAddModal');
    if (modal) modal.classList.add('active');
}

function closeQuickAdd() {
    const modal = document.getElementById('quickAddModal');
    if (modal) modal.classList.remove('active');
}

async function saveQuickAdd(e) {
    e.preventDefault();
    if (!checkPermission('add')) return;

    const category = document.getElementById('quickCategory').value;
    const item = document.getElementById('quickItem').value.trim();
    const amount = parseFloat(document.getElementById('quickAmount').value) || 0;
    const payment = document.getElementById('quickPayment').value;
    const paymentStatus = document.getElementById('quickPaymentStatus').value;
    const carwasher = document.getElementById('quickCarwasher').value.trim();
    const remarks = document.getElementById('quickRemarks').value.trim();

    if (!item) {
        showNotification('Please enter an Item/Service name', 'error');
        document.getElementById('quickItem').focus();
        return;
    }
    
    if (amount <= 0) {
        showNotification('Please enter a valid Amount', 'error');
        document.getElementById('quickAmount').focus();
        return;
    }

    const now = new Date().toISOString();
    let transaction = {
        category, payment, payment_status: paymentStatus, remarks,
        total: amount, unit_price: amount, quantity: 1,
        created_at: now, updated_at: now,
        store_order: [], selected_services: []
    };

    if (category === 'carwash') {
        transaction.car_model = item;
        transaction.services = 'CARWASH';
        transaction.carwasher = carwasher || 'UNASSIGNED';
        transaction.carwash_price = amount;
        transaction.detailing_price = 0;
        transaction.item = `${item} - CARWASH`;
        transaction.other = '';
        transaction.detailer = '';
        transaction.unit_price = amount;
    } else {
        transaction.item = item;
        transaction.quantity = 1;
        transaction.unit_price = amount;
        transaction.car_model = '';
        transaction.services = '';
    }

    try {
        let savedTransaction = null;
        
        if (supabaseClient && isSupabaseConnected) {
            const { data, error } = await supabaseClient
                .from(TABLE_NAME)
                .insert(transaction)
                .select();
            if (!error && data && data.length > 0) {
                savedTransaction = data[0];
                transactions.unshift(savedTransaction);
                await logAudit('ADD', `Quick transaction #${savedTransaction.id} added`, {
                    transaction_id: savedTransaction.id,
                    category: savedTransaction.category,
                    item: savedTransaction.item || savedTransaction.car_model,
                    amount: savedTransaction.total
                });
            } else {
                showNotification('Error adding transaction to database', 'error');
                return;
            }
        } else {
            transaction.id = Date.now();
            transactions.unshift(transaction);
            await logAudit('ADD', `Quick transaction #${transaction.id} added (offline)`, {
                transaction_id: transaction.id,
                category: transaction.category,
                item: transaction.item || transaction.car_model,
                amount: transaction.total
            });
        }
        closeQuickAdd();
        populateFilters();
        applyFilters();
        renderAll();
        renderSalaryTable();
        updateAuditBadge();
        updateStoreHistory();
        showNotification('Transaction added successfully', 'success');
    } catch (err) {
        console.error('Quick add error:', err);
        showNotification('Error saving: ' + err.message, 'error');
    }
}

// ============================================================
// SELECTION
// ============================================================
function toggleRow(id) {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    updateSelectAllState();
}

function toggleAllCheckboxes() {
    const checked = document.getElementById('selectAll')?.checked || false;
    const data = filteredTransactions.length > 0 ? filteredTransactions : transactions;
    data.forEach(r => { if (checked) selectedIds.add(r.id); else selectedIds.delete(r.id); });
    renderTable();
}

function updateSelectAllState() {
    const data = filteredTransactions.length > 0 ? filteredTransactions : transactions;
    const selectAll = document.getElementById('selectAll');
    if (selectAll) {
        selectAll.checked = data.length > 0 && data.every(r => selectedIds.has(r.id));
    }
}

// ============================================================
// CONFIRMATION SYSTEM
// ============================================================
let confirmResolve = null;

function showConfirm(options) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        if (!modal) return resolve(false);
        
        const icon = document.getElementById('confirmIcon');
        if (icon) {
            icon.textContent = options.icon || '⚠️';
            icon.style.color = options.iconColor || '#f59e0b';
        }
        
        const title = document.getElementById('confirmTitle');
        if (title) title.textContent = options.title || 'Confirm Action';
        
        const message = document.getElementById('confirmMessage');
        if (message) message.textContent = options.message || 'Are you sure?';
        
        const details = document.getElementById('confirmDetails');
        if (details) {
            if (options.details) {
                details.style.display = 'block';
                const tx = document.getElementById('confirmTransaction');
                if (tx) tx.innerHTML = options.details.transaction || '—';
                const amt = document.getElementById('confirmAmount');
                if (amt) amt.textContent = options.details.amount || '—';
                const st = document.getElementById('confirmStatus');
                if (st) st.innerHTML = options.details.status || '—';
            } else {
                details.style.display = 'none';
            }
        }
        
        const confirmBtn = document.getElementById('confirmBtn');
        if (confirmBtn) {
            confirmBtn.className = `btn ${options.buttonClass || 'btn-danger'}`;
            confirmBtn.innerHTML = options.buttonText || 'Confirm';
        }
        
        confirmResolve = (result) => {
            closeConfirm();
            resolve(result);
        };
        
        modal.classList.add('active');
    });
}

function closeConfirm() {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.classList.remove('active');
    confirmResolve = null;
}

function executeConfirm() {
    if (confirmResolve) confirmResolve(true);
}

// ============================================================
// TRANSACTION DELETE & STATUS UPDATE
// ============================================================
async function deleteTransaction(id) {
    if (!checkPermission('delete')) return;
    const row = transactions.find(r => r.id === id);
    if (!row) {
        showNotification('Transaction not found', 'error');
        return;
    }

    const confirmed = await showConfirm({
        icon: '🗑️', iconColor: '#dc2626', title: 'Delete Transaction',
        message: 'Are you sure you want to delete this transaction?',
        details: {
            transaction: `<strong>#${row.id}</strong> - ${row.item || row.car_model || 'Unknown'}`,
            amount: formatPrice(row.total || 0),
            status: row.payment_status || 'unpaid'
        },
        buttonClass: 'btn-danger', buttonText: '<i class="fas fa-trash"></i> Delete'
    });
    if (!confirmed) return;

    try {
        if (supabaseClient && isSupabaseConnected) {
            const { error } = await supabaseClient
                .from(TABLE_NAME)
                .delete()
                .eq('id', id);
            if (error) {
                console.error('Error deleting transaction:', error);
                showNotification('Error deleting transaction from database', 'error');
                return;
            }
        }
        transactions = transactions.filter(r => r.id !== id);
        selectedIds.delete(id);
        await logAudit('DELETE', `Transaction #${id} deleted`, {
            transaction_id: id,
            category: row.category,
            item: row.item || row.car_model,
            amount: row.total
        });
        populateFilters();
        applyFilters();
        renderAll();
        renderSalaryTable();
        updateAuditBadge();
        updateStoreHistory();
        showNotification('Transaction deleted successfully', 'success');
    } catch (err) {
        console.error('Delete error:', err);
        showNotification('Error deleting: ' + err.message, 'error');
    }
}

async function deleteSelected() {
    if (!checkPermission('delete')) return;
    if (selectedIds.size === 0) {
        showNotification('No transactions selected', 'info');
        return;
    }

    const confirmed = await showConfirm({
        icon: '🗑️', iconColor: '#dc2626', title: `Delete ${selectedIds.size} Transactions`,
        message: `Are you sure you want to delete ${selectedIds.size} transactions?`,
        details: {
            transaction: `<strong>${selectedIds.size}</strong> transactions`,
            amount: formatPrice(transactions.filter(r => selectedIds.has(r.id)).reduce((sum, r) => sum + parseFloat(r.total || 0), 0)),
            status: 'BULK DELETE'
        },
        buttonClass: 'btn-danger', buttonText: `<i class="fas fa-trash"></i> Delete ${selectedIds.size}`
    });
    if (!confirmed) return;

    try {
        const deletedItems = [];
        for (const id of selectedIds) {
            const row = transactions.find(r => r.id === id);
            if (row) {
                deletedItems.push({ id, item: row.item || row.car_model, amount: row.total });
                if (supabaseClient && isSupabaseConnected) {
                    await supabaseClient.from(TABLE_NAME).delete().eq('id', id);
                }
            }
            transactions = transactions.filter(r => r.id !== id);
        }
        const count = selectedIds.size;
        selectedIds.clear();
        await logAudit('DELETE', `Bulk delete: ${count} transactions`, {
            count: count,
            items: deletedItems
        });
        populateFilters();
        applyFilters();
        renderAll();
        renderSalaryTable();
        updateAuditBadge();
        updateStoreHistory();
        showNotification(`${count} transactions deleted successfully`, 'success');
    } catch (err) {
        console.error('Bulk delete error:', err);
        showNotification('Error deleting: ' + err.message, 'error');
    }
}

async function updatePaymentStatus(id, status) {
    if (!checkPermission('change_status')) return;
    const row = transactions.find(r => r.id === id);
    if (!row) return;

    const confirmed = await showConfirm({
        icon: '💰', iconColor: '#2563eb', title: 'Update Payment Status',
        message: 'Change payment status for this transaction?',
        details: {
            transaction: `<strong>#${row.id}</strong> - ${row.item || row.car_model || 'Unknown'}`,
            amount: formatPrice(row.total || 0),
            status: `<span style="color:${row.payment_status === 'paid' ? '#16a34a' : row.payment_status === 'partial' ? '#f59e0b' : '#dc2626'}">${(row.payment_status || 'unpaid').toUpperCase()}</span> → <span style="color:${status === 'paid' ? '#16a34a' : status === 'partial' ? '#f59e0b' : '#dc2626'}">${status.toUpperCase()}</span>`
        },
        buttonClass: 'btn-primary', buttonText: `<i class="fas fa-sync"></i> Update to ${status.toUpperCase()}`
    });
    if (!confirmed) return;

    try {
        const oldStatus = row.payment_status;
        row.payment_status = status;
        if (supabaseClient && isSupabaseConnected) {
            const { error } = await supabaseClient
                .from(TABLE_NAME)
                .update({ payment_status: status })
                .eq('id', id);
            if (error) {
                console.error('Error updating status:', error);
                showNotification('Error updating status in database', 'error');
                return;
            }
        }
        await logAudit('STATUS_UPDATE', `Payment status changed for #${id}`, {
            transaction_id: id,
            old_status: oldStatus,
            new_status: status,
            transaction: row.item || row.car_model,
            amount: row.total
        });
        renderTable();
        updateAuditBadge();
        updateStoreHistory();
        showNotification(`Status updated to ${status.toUpperCase()}`, 'success');
    } catch (err) {
        console.error('Status update error:', err);
        showNotification('Error updating status', 'error');
    }
}

// ============================================================
// SIDEBAR TOGGLE
// ============================================================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (window.innerWidth <= 992) {
        if (sidebar) sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('active');
    }
}

// ============================================================
// PAGE SWITCHING
// ============================================================
function switchPage(page) {
    const allowedPages = getUserPages(currentUser);
    if (!allowedPages.includes(page)) {
        showNotification('You don\'t have access to this page', 'warning');
        return;
    }
    
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(`page-${page}`);
    if (targetPage) targetPage.classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navItem) navItem.classList.add('active');

    const titles = {
        dashboard: 'Dashboard',
        transactions: 'Transactions',
        salary: 'Carwasher Salary',
        store: 'Store Sales',
        reports: 'Reports',
        prices: 'Price Settings',
        audit: 'Audit Trail',
        backup: 'Backup & Restore'
    };
    
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = titles[page] || page;
    
    if (page === 'transactions') {
        const badge = document.getElementById('txBadge');
        if (badge) badge.textContent = transactions.length;
    }
    if (page === 'prices') renderPriceSettings();
    if (page === 'audit') {
        renderAuditLogs();
        updateAuditBadge();
    }
    if (page === 'backup') {
        renderBackupHistory();
    }
    if (page === 'store') {
        renderStoreTotals();
        updateStoreHistory();
    }
    
    if (window.innerWidth <= 992) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
    }
}

// ============================================================
// GLOBAL EXPOSURE
// ============================================================
window.openAddModal = openAddModal;
window.openEditModal = openEditModal;
window.openQuickAdd = openQuickAdd;
window.closeQuickAdd = closeQuickAdd;
window.saveQuickAdd = saveQuickAdd;
window.deleteTransaction = deleteTransaction;
window.deleteSelected = deleteSelected;
window.refreshData = refreshData;
window.saveTransaction = saveTransaction;
window.closeModal = closeModal;
window.toggleRow = toggleRow;
window.toggleAllCheckboxes = toggleAllCheckboxes;
window.updateStoreValue = updateStoreValue;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.exportData = exportData;
window.addDropdownItem = addDropdownItem;
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.toggleTransactionFields = toggleTransactionFields;
window.calculateCarwashTotal = calculateCarwashTotal;
window.calculateStoreTotal = calculateStoreTotal;
window.calculateSalaries = calculateSalaries;
window.saveSalaries = saveSalaries;
window.updateSalaryRate = updateSalaryRate;
window.toggleSalaryStatus = toggleSalaryStatus;
window.addStoreItemToCarwash = addStoreItemToCarwash;
window.addCustomStoreItem = addCustomStoreItem;
window.removeStoreItem = removeStoreItem;
window.addServiceToSelection = addServiceToSelection;
window.removeServiceFromSelection = removeServiceFromSelection;
window.generateReport = generateReport;
window.generateCustomReport = generateCustomReport;
window.exportReportExcel = exportReportExcel;
window.exportReportPDF = exportReportPDF;
window.updatePaymentStatus = updatePaymentStatus;
window.switchPage = switchPage;
window.toggleSidebar = toggleSidebar;
window.filterAudit = filterAudit;
window.refreshAudit = refreshAudit;
window.exportAuditLogs = exportAuditLogs;
window.viewAuditDetails = viewAuditDetails;
window.closeAuditDetail = closeAuditDetail;
window.formatPrice = formatPrice;
window.executeConfirm = executeConfirm;
window.closeConfirm = closeConfirm;
window.saveAllPrices = saveAllPrices;
window.loadServicePrices = loadServicePrices;
window.markPriceChanged = markPriceChanged;
window.sortTable = sortTable;
window.createBackup = createBackup;
window.restoreFromBackup = restoreFromBackup;
window.downloadBackupFile = downloadBackupFile;
window.deleteBackup = deleteBackup;
window.addStoreTransaction = addStoreTransaction;
window.refreshStoreData = refreshStoreData;
window.exportStoreData = exportStoreData;
window.exportSalaries = exportSalaries;

console.log('✅ App initialized successfully with session persistence!');