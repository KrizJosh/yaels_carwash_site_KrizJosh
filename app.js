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
// SESSION & STATE
// ============================================================
const SESSION_KEY = 'carwash_session';
const SESSION_EXPIRY = 24 * 60 * 60 * 1000;

let currentUser = null;
let supabaseClient = null;
let isSupabaseConnected = false;
let transactions = [];
let filteredTransactions = [];
let ongoingTransactions = [];
let completedTransactions = [];
let filteredCompleted = [];
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
let backupHistory = [];
let currentTransactionTab = 'all';
let salaryDateRange = { preset: 'this-week', fromDate: null, toDate: null };
let ongoingViewDate = null;
let completedViewDate = null;

let storeData = {
    cigarettes: 0, snacks: 0, drinksWater: 0, drinksSoda: 0, drinksCoffee: 0, drinksJuice: 0, drinksEnergy: 0,
    palutoNoodles: 0, palutoRice: 0, palutoSoup: 0, palutoSilog: 0, palutoAppetizer: 0,
    otherSales: 0, gcashCw: 0, gcashFoods: 0, expenses: 0
};
// ============================================================
// KIOSK PRODUCTS (Store + Accessories)
// ============================================================
const PRODUCTS_KEY = 'carwash_products_v1';

let products = [];          // [{ id, name, price, category, emoji, stock, active }]
let kioskCart = [];         // [{ productId, name, price, qty }]
let kioskMode = 'store';    // 'store' | 'accessories'
let editingProductId = null;
let productSearchQuery = '';
let productCategoryFilter = 'all';

const DEFAULT_PRODUCTS = [
    // Store
    { id: 'p-c1', name: 'Cigarettes',         price: 12,  category: 'store',       emoji: '🚬', stock: 50, active: true },
    { id: 'p-c2', name: 'Snacks',             price: 10,  category: 'store',       emoji: '🍪', stock: 50, active: true },
    { id: 'p-c3', name: 'Biscuits',           price: 8,   category: 'store',       emoji: '🍘', stock: 40, active: true },
    { id: 'p-c4', name: 'Candy',              price: 5,   category: 'store',       emoji: '🍬', stock: 60, active: true },
    // Drinks
    { id: 'p-d1', name: 'Water',              price: 15,  category: 'drinks',      emoji: '💧', stock: 40, active: true },
    { id: 'p-d2', name: 'Soft Drinks',        price: 15,  category: 'drinks',      emoji: '🥤', stock: 40, active: true },
    { id: 'p-d3', name: 'Coffee',             price: 25,  category: 'drinks',      emoji: '☕', stock: 30, active: true },
    { id: 'p-d4', name: 'Juice',              price: 20,  category: 'drinks',      emoji: '🧃', stock: 30, active: true },
    { id: 'p-d5', name: 'Energy Drink',       price: 35,  category: 'drinks',      emoji: '⚡', stock: 20, active: true },
    // Paluto
    { id: 'p-p1', name: 'Noodles',            price: 30,  category: 'paluto',      emoji: '🍜', stock: 25, active: true },
    { id: 'p-p2', name: 'Rice Meal',          price: 50,  category: 'paluto',      emoji: '🍚', stock: 25, active: true },
    { id: 'p-p3', name: 'Soup',               price: 40,  category: 'paluto',      emoji: '🍲', stock: 20, active: true },
    { id: 'p-p4', name: 'Silog Meal',         price: 60,  category: 'paluto',      emoji: '🍳', stock: 15, active: true },
    { id: 'p-p5', name: 'Appetizer',          price: 45,  category: 'paluto',      emoji: '🥗', stock: 15, active: true },
    // Accessories
    { id: 'p-a1', name: 'Car Shampoo',        price: 250, category: 'accessories', emoji: '🧴', stock: 15, active: true },
    { id: 'p-a2', name: 'Tire Black',         price: 180, category: 'accessories', emoji: '⚫', stock: 20, active: true },
    { id: 'p-a3', name: 'Microfiber Towel',   price: 150, category: 'accessories', emoji: '🧽', stock: 25, active: true },
    { id: 'p-a4', name: 'Car Wax',            price: 350, category: 'accessories', emoji: '✨', stock: 12, active: true },
    { id: 'p-a5', name: 'Air Freshener',      price: 100, category: 'accessories', emoji: '🌸', stock: 30, active: true },
    { id: 'p-a6', name: 'Glass Cleaner',      price: 200, category: 'accessories', emoji: '🪟', stock: 15, active: true },
    { id: 'p-a7', name: 'Dashboard Polish',   price: 220, category: 'accessories', emoji: '💎', stock: 10, active: true },
    { id: 'p-a8', name: 'Engine Degreaser',   price: 280, category: 'accessories', emoji: '🔧', stock: 8,  active: true }
];

const STORE_CATEGORIES = {
    store:       { label: 'Store Items',  icon: '📦', color: '#16a34a' },
    drinks:      { label: 'Drinks',       icon: '🥤', color: '#0ea5e9' },
    paluto:      { label: 'Paluto',       icon: '🍜', color: '#7c3aed' },
    accessories: { label: 'Accessories',  icon: '🧴', color: '#f59e0b' },
    other:       { label: 'Other',        icon: '💰', color: '#dc2626' }
};

// ============================================================
// PRODUCT STORAGE
// ============================================================
function loadProducts() {
    try {
        const raw = localStorage.getItem(PRODUCTS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                products = parsed;
                return;
            }
        }
    } catch (e) { console.warn('Could not load products:', e); }
    products = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
    saveProducts();
}

function saveProducts() {
    try {
        localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
    } catch (e) { console.warn('Could not save products:', e); }
}

function getProductById(id) {
    return products.find(p => p.id === id);
}

function getProductsForKiosk(mode) {
    let list = products.filter(p => p.active !== false);

    if (mode === 'store') {
        // Store tab shows store, drinks, paluto, other
        list = list.filter(p => ['store', 'drinks', 'paluto', 'other'].includes(p.category));
    } else if (mode === 'accessories') {
        list = list.filter(p => p.category === 'accessories');
    }

    if (productCategoryFilter !== 'all') {
        list = list.filter(p => p.category === productCategoryFilter);
    }

    if (productSearchQuery) {
        const q = productSearchQuery.toLowerCase();
        list = list.filter(p =>
            p.name.toLowerCase().includes(q) ||
            (p.emoji && p.emoji.includes(q))
        );
    }

    return list;
}

// ============================================================
// CART
// ============================================================
function addToCart(productId) {
    const p = getProductById(productId);
    if (!p) return;
    if (p.stock != null && p.stock <= 0) {
        showNotification(`${p.name} is out of stock`, 'warning');
        return;
    }
    const existing = kioskCart.find(c => c.productId === productId);
    if (existing) {
        existing.qty += 1;
    } else {
        kioskCart.push({
            productId: p.id,
            name: p.name,
            price: p.price,
            emoji: p.emoji || '📦',
            qty: 1
        });
    }
    renderKioskCart();
    renderKioskGrid();
}

function incrementCart(productId) {
    const item = kioskCart.find(c => c.productId === productId);
    if (!item) return;
    const p = getProductById(productId);
    if (p && p.stock != null && item.qty >= p.stock) {
        showNotification(`Only ${p.stock} in stock`, 'warning');
        return;
    }
    item.qty += 1;
    renderKioskCart();
    renderKioskGrid();
}

function decrementCart(productId) {
    const item = kioskCart.find(c => c.productId === productId);
    if (!item) return;
    item.qty -= 1;
    if (item.qty <= 0) {
        removeFromCart(productId);
        return;
    }
    renderKioskCart();
    renderKioskGrid();
}

function removeFromCart(productId) {
    kioskCart = kioskCart.filter(c => c.productId !== productId);
    renderKioskCart();
    renderKioskGrid();
}

function clearCart() {
    if (kioskCart.length === 0) return;
    kioskCart = [];
    renderKioskCart();
    renderKioskGrid();
}

function getCartTotal() {
    return kioskCart.reduce((s, c) => s + c.price * c.qty, 0);
}

function getCartQty() {
    return kioskCart.reduce((s, c) => s + c.qty, 0);
}

// ============================================================
// RENDER: KIOSK GRID
// ============================================================
function renderKioskGrid() {
    const grid = document.getElementById('kioskGrid');
    if (!grid) return;

    const list = getProductsForKiosk(kioskMode);

    if (list.length === 0) {
        grid.innerHTML = `
            <div class="kiosk-empty">
                <div class="kiosk-empty-icon">📭</div>
                <div class="kiosk-empty-title">No products found</div>
                <div class="kiosk-empty-text">Try a different search or add a new product.</div>
                <button class="btn btn-primary" onclick="openProductModal()">
                    <i class="fas fa-plus"></i> Add Product
                </button>
            </div>
        `;
        return;
    }

    grid.innerHTML = '';
    list.forEach(p => {
        const inCart = kioskCart.find(c => c.productId === p.id);
        const qty = inCart ? inCart.qty : 0;
        const outOfStock = p.stock != null && p.stock <= 0;
        const catMeta = STORE_CATEGORIES[p.category] || { color: '#64748b' };

        const card = document.createElement('div');
        card.className = `kiosk-product${outOfStock ? ' out-of-stock' : ''}${qty > 0 ? ' in-cart' : ''}`;
        card.style.setProperty('--kp-color', catMeta.color);
        card.innerHTML = `
            ${qty > 0 ? `<span class="kp-badge">${qty}</span>` : ''}
            <div class="kp-emoji">${p.emoji || '📦'}</div>
            <div class="kp-name">${p.name}</div>
            <div class="kp-price">${formatPrice(p.price)}</div>
            <div class="kp-stock ${outOfStock ? 'out' : p.stock != null && p.stock < 10 ? 'low' : ''}">
                ${outOfStock ? 'Out of stock' : p.stock != null ? `${p.stock} in stock` : 'Available'}
            </div>
            <button class="kp-add-btn" onclick="event.stopPropagation();addToCart('${p.id}')" ${outOfStock ? 'disabled' : ''}>
                <i class="fas fa-plus"></i>
            </button>
            <div class="kp-actions">
                <button class="kp-action" onclick="event.stopPropagation();editProduct('${p.id}')" title="Edit">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="kp-action kp-action-danger" onclick="event.stopPropagation();deleteProductConfirm('${p.id}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        card.onclick = () => { if (!outOfStock) addToCart(p.id); };
        grid.appendChild(card);
    });
}

// ============================================================
// RENDER: KIOSK CART
// ============================================================
function renderKioskCart() {
    const panel = document.getElementById('kioskCartItems');
    const countEl = document.getElementById('kioskCartCount');
    const subtotalEl = document.getElementById('kioskSubtotal');
    const totalEl = document.getElementById('kioskTotal');
    const checkoutBtn = document.getElementById('kioskCheckoutBtn');
    const emptyState = document.getElementById('kioskCartEmpty');

    if (countEl) countEl.textContent = getCartQty();
    const total = getCartTotal();
    if (subtotalEl) subtotalEl.textContent = formatPrice(total);
    if (totalEl) totalEl.textContent = formatPrice(total);
    if (checkoutBtn) checkoutBtn.disabled = kioskCart.length === 0;

    if (!panel) return;

    if (kioskCart.length === 0) {
        panel.innerHTML = '';
        if (emptyState) emptyState.style.display = 'flex';
        return;
    }
    if (emptyState) emptyState.style.display = 'none';

    panel.innerHTML = kioskCart.map(c => `
        <div class="kc-item">
            <div class="kc-emoji">${c.emoji || '📦'}</div>
            <div class="kc-info">
                <div class="kc-name">${c.name}</div>
                <div class="kc-price">${formatPrice(c.price)} × ${c.qty} = <strong>${formatPrice(c.price * c.qty)}</strong></div>
            </div>
            <div class="kc-qty-controls">
                <button class="kc-qty-btn" onclick="decrementCart('${c.productId}')"><i class="fas fa-minus"></i></button>
                <span class="kc-qty">${c.qty}</span>
                <button class="kc-qty-btn" onclick="incrementCart('${c.productId}')"><i class="fas fa-plus"></i></button>
            </div>
            <button class="kc-remove" onclick="removeFromCart('${c.productId}')"><i class="fas fa-times"></i></button>
        </div>
    `).join('');
}

// ============================================================
// KIOSK TAB SWITCHING
// ============================================================
function switchKioskMode(mode) {
    kioskMode = mode;
    productCategoryFilter = 'all';
    productSearchQuery = '';
    const searchEl = document.getElementById('kioskSearch');
    if (searchEl) searchEl.value = '';
    document.querySelectorAll('.kiosk-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.kiosk === mode);
    });
    // Populate category filter
    populateKioskCategoryFilter();
    renderKioskGrid();
}

function populateKioskCategoryFilter() {
    const sel = document.getElementById('kioskCategoryFilter');
    if (!sel) return;
    sel.innerHTML = '<option value="all">All Categories</option>';
    const cats = kioskMode === 'store'
        ? ['store', 'drinks', 'paluto', 'other']
        : ['accessories'];
    cats.forEach(c => {
        const meta = STORE_CATEGORIES[c];
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = `${meta.icon} ${meta.label}`;
        sel.appendChild(opt);
    });
}

function filterKioskProducts() {
    productSearchQuery = (document.getElementById('kioskSearch')?.value || '').trim();
    productCategoryFilter = document.getElementById('kioskCategoryFilter')?.value || 'all';
    renderKioskGrid();
}

// ============================================================
// PRODUCT MODAL (Add / Edit)
// ============================================================
function openProductModal(productId = null) {
    if (!checkPermission('add')) return;
    editingProductId = productId;
    const modal = document.getElementById('productModal');
    if (!modal) return;

    const title = document.getElementById('productModalTitle');
    const form = document.getElementById('productForm');
    form.reset();

    // Preset category based on active kiosk mode
    const catSelect = document.getElementById('productCategory');
    if (kioskMode === 'accessories') catSelect.value = 'accessories';
    else catSelect.value = 'store';

    if (productId) {
        const p = getProductById(productId);
        if (!p) return;
        title.textContent = `✏️ Edit Product`;
        document.getElementById('productName').value = p.name;
        document.getElementById('productPrice').value = p.price;
        document.getElementById('productCategory').value = p.category;
        document.getElementById('productEmoji').value = p.emoji || '';
        document.getElementById('productStock').value = p.stock != null ? p.stock : '';
    } else {
        title.textContent = `➕ Add Product`;
        document.getElementById('productEmoji').value = '';
        document.getElementById('productStock').value = '';
    }
    updateProductEmojiPreview();
    modal.classList.add('active');
    setTimeout(() => document.getElementById('productName')?.focus(), 150);
}

function closeProductModal() {
    document.getElementById('productModal')?.classList.remove('active');
    editingProductId = null;
}

function updateProductEmojiPreview() {
    const emoji = document.getElementById('productEmoji')?.value || '';
    const preview = document.getElementById('productEmojiPreview');
    if (preview) preview.textContent = emoji.trim() || '📦';
}

async function saveProduct(e) {
    e.preventDefault();
    const name = document.getElementById('productName').value.trim();
    const price = parseFloat(document.getElementById('productPrice').value);
    const category = document.getElementById('productCategory').value;
    const emoji = document.getElementById('productEmoji').value.trim() || '📦';
    const stockVal = document.getElementById('productStock').value;
    const stock = stockVal === '' ? null : parseFloat(stockVal);

    if (!name) { showNotification('Product name is required', 'warning'); return; }
    if (isNaN(price) || price <= 0) { showNotification('Enter a valid price', 'warning'); return; }
    if (!category) { showNotification('Select a category', 'warning'); return; }
    if (stock !== null && (isNaN(stock) || stock < 0)) { showNotification('Stock must be 0 or more', 'warning'); return; }

    if (editingProductId) {
        const p = getProductById(editingProductId);
        if (!p) return;
        const ok = await showConfirm({
            icon: '💾', title: 'Update Product',
            message: `Save changes to "${name}"?`,
            details: { transaction: name, amount: formatPrice(price), status: 'UPDATE' },
            buttonClass: 'btn-success', buttonText: '<i class="fas fa-save"></i> Update'
        });
        if (!ok) return;
        p.name = name;
        p.price = price;
        p.category = category;
        p.emoji = emoji;
        p.stock = stock;
        saveProducts();
        await logAudit('UPDATE', `Product updated: ${name}`, { price, category });
        showNotification(`Updated "${name}"`, 'success');
    } else {
        const ok = await showConfirm({
            icon: '➕', title: 'Add Product',
            message: `Add "${name}" at ${formatPrice(price)}?`,
            details: { transaction: name, amount: formatPrice(price), status: 'NEW' },
            buttonClass: 'btn-success', buttonText: '<i class="fas fa-plus"></i> Add'
        });
        if (!ok) return;
        const newProduct = {
            id: 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
            name, price, category, emoji, stock,
            active: true,
            createdAt: new Date().toISOString()
        };
        products.push(newProduct);
        saveProducts();
        await logAudit('ADD', `Product added: ${name}`, { price, category });
        showNotification(`Added "${name}"`, 'success');
    }

    closeProductModal();
    renderKioskGrid();
    populateKioskCategoryFilter();
}

function editProduct(id) { openProductModal(id); }

async function deleteProductConfirm(id) {
    const p = getProductById(id);
    if (!p) return;
    const ok = await showConfirm({
        icon: '🗑️', title: 'Delete Product',
        message: `Delete "${p.name}"? This cannot be undone.`,
        details: { transaction: p.name, amount: formatPrice(p.price), status: 'DELETE' },
        buttonClass: 'btn-danger', buttonText: '<i class="fas fa-trash"></i> Delete'
    });
    if (!ok) return;
    products = products.filter(pr => pr.id !== id);
    // Also remove from cart
    kioskCart = kioskCart.filter(c => c.productId !== id);
    saveProducts();
    await logAudit('DELETE', `Product deleted: ${p.name}`, { price: p.price });
    showNotification(`Deleted "${p.name}"`, 'success');
    renderKioskGrid();
    renderKioskCart();
}

// ============================================================
// CHECKOUT
// ============================================================
async function kioskCheckout() {
    if (kioskCart.length === 0) {
        showNotification('Cart is empty', 'warning');
        return;
    }
    if (!checkPermission('add')) return;

    const total = getCartTotal();
    const itemCount = getCartQty();
    const summaryText = kioskCart.map(c => `${c.qty}× ${c.name}`).join(', ');

    const ok = await showConfirm({
        icon: '💳', title: 'Checkout',
        message: `Complete this sale?`,
        details: {
            transaction: `${itemCount} item${itemCount !== 1 ? 's' : ''}`,
            amount: formatPrice(total),
            status: 'PAID'
        },
        buttonClass: 'btn-success',
        buttonText: '<i class="fas fa-check"></i> Confirm Sale'
    });
    if (!ok) return;

    const payment = document.getElementById('kioskPayment')?.value
        || document.getElementById('kioskPaymentAcc')?.value
        || 'CASH';
    const now = new Date().toISOString();

    // Group id is LOCAL ONLY — not written to DB.
    // If your schema later adds a `cart_group` column, uncomment the DB line below.
    const groupId = 'cart-' + Date.now();
    const createdTxIds = [];

    try {
        for (const item of kioskCart) {
            // Build payload matching your existing schema only
            const tx = {
                category: kioskMode === 'accessories'
                    ? 'accessories'
                    : (getProductById(item.productId)?.category || 'store'),
                item: item.name,
                quantity: item.qty,
                unit_price: item.price,
                total: item.price * item.qty,
                payment,
                payment_status: 'paid',
                carwash_price: 0,
                detailing_price: 0,
                is_ongoing: false,
                created_at: now,
                updated_at: now
                // cart_group: groupId   // ← only add this line if you actually
                //                         added the column to the DB
            };

            let saved = tx;
            if (supabaseClient && isSupabaseConnected) {
                const { data, error } = await supabaseClient.from(TABLE_NAME).insert(tx).select();
                if (error) throw error;
                if (data && data.length) saved = data[0];
            } else {
                saved.id = Date.now() + Math.floor(Math.random() * 1000);
            }
            // Keep the group tag in-memory only so the UI can group if needed
            saved._cart_group = groupId;

            transactions.unshift(saved);
            createdTxIds.push(saved.id);

            // Decrement stock locally
            const prod = getProductById(item.productId);
            if (prod && prod.stock != null) {
                prod.stock = Math.max(0, prod.stock - item.qty);
            }
        }
        saveProducts();
        await logAudit('ADD', `Kiosk sale: ${summaryText}`, { amount: total, group: groupId });

        kioskCart = [];
        renderKioskCart();
        renderKioskGrid();
        applyFilters();
        renderAll();
        renderAccessories();
        renderStoreTotals();
        updateStoreHistory();

        showNotification(
            `✅ Sale completed — ${formatPrice(total)}`,
            'success',
            7000,
            createdTxIds.length === 1
                ? [{ text: '🖨️ Receipt', onclick: `quickReceipt(${createdTxIds[0]})` }]
                : null
        );
    } catch (err) {
        showNotification('Checkout failed: ' + err.message, 'error');
    }
}


// ============================================================
// INIT
// ============================================================
loadProducts();

let dropdownData = {
    models: ['VIOS', 'INNOVA', 'HILUX', 'XPANDER', 'AVANZA', 'MIRAGE', 'MONTERO', 'FORTUNER', 'BRV', 'WIGO', 'NV350', 'HIACE', 'RUSH', 'RAIZE', 'VELOZ'],
    services: [],
    other: ['ACIDRAIN', 'BACKTOZERO', 'BTZ', 'ENGINEWASH', 'MACHINEWAX', 'HANDWAX', 'HEADLIGHT REST.', 'SEAT COVER'],
    carwasher: ['JAYSON', 'DENNIS', 'JOMAR', 'RODEL', 'JUSTINE', 'JM', 'PHILIP', 'KURT', 'ADING', 'HART']
};

// ============================================================
// DATE HELPERS
// ============================================================
function getTodayKey() {
    const d = new Date();
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

function toLocalDateKey(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

function isToday(dateStr) {
    if (!dateStr) return false;
    return toLocalDateKey(dateStr) === getTodayKey();
}

function formatDateKey(dateKey) {
    if (!dateKey) return '—';
    const d = new Date(dateKey + 'T00:00:00');
    const today = new Date();
    if (toLocalDateKey(d) === toLocalDateKey(today)) return 'Today';
    const y = new Date(today); y.setDate(today.getDate() - 1);
    if (toLocalDateKey(d) === toLocalDateKey(y)) return 'Yesterday';
    return d.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric',
        year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
}
// ============================================================
// FLOATING ACTION BAR
// ============================================================
function toggleFabDock() {
    const dock = document.getElementById('fabDock');
    if (!dock) return;
    const isOpen = dock.classList.contains('open');
    if (isOpen) closeFabDock();
    else openFabDock();
}

function openFabDock() {
    document.getElementById('fabDock')?.classList.add('open');
    const icon = document.getElementById('fabMainIcon');
    if (icon) icon.className = 'fas fa-times';
    document.body.classList.add('fab-open');
}

function closeFabDock() {
    document.getElementById('fabDock')?.classList.remove('open');
    const icon = document.getElementById('fabMainIcon');
    if (icon) icon.className = 'fas fa-plus';
    document.body.classList.remove('fab-open');
}

function fabAction(action) {
    closeFabDock();
    setTimeout(() => {
        if (action === 'new') openAddModal();
        else if (action === 'quick') openQuickAdd();
        else if (action === 'refresh') refreshData();
        else if (action === 'tour') startTour();
    }, 180);
}

// Auto-close on escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeFabDock();
});

// ============================================================
// ANIMATED NUMBER COUNTERS
// ============================================================
function animateValue(el, from, to, duration = 700, formatter = null) {
    if (!el) return;
    const start = performance.now();
    const diff = to - from;
    function tick(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = from + diff * eased;
        el.textContent = formatter ? formatter(current) : Math.round(current).toLocaleString();
        if (progress < 1) requestAnimationFrame(tick);
        else el.textContent = formatter ? formatter(to) : Math.round(to).toLocaleString();
    }
    requestAnimationFrame(tick);
}

function animateMoney(el, targetAmount) {
    if (!el) return;
    const from = parseFloat(el.dataset.count || '0') || 0;
    el.dataset.count = targetAmount;
    animateValue(el, from, targetAmount, 700, (v) => formatPrice(v));
}

function animateCount(el, targetCount) {
    if (!el) return;
    const from = parseFloat(el.dataset.count || '0') || 0;
    el.dataset.count = targetCount;
    animateValue(el, from, targetCount, 700, (v) => Math.round(v).toString());
}
// ============================================================
// PRICE FORMATTER
// ============================================================
function formatPrice(amount) {
    if (amount === undefined || amount === null || isNaN(amount)) return '₱0.00';
    const num = parseFloat(amount);
    return '₱' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ============================================================
// PARTIAL PAYMENT HELPERS
// ============================================================
function getBalanceDue(tx) {
    const paid = parseFloat(tx.amount_paid) || 0;
    const total = parseFloat(tx.total) || 0;
    return Math.max(0, total - paid);
}

let partialPaymentResolver = null;

function promptPartialPayment({ total, currentStatus, currentPaid, title }) {
    return new Promise((resolve) => {
        const modal = document.getElementById('partialPaymentModal');
        if (!modal) { resolve(null); return; }

        document.getElementById('partialTitle').textContent = title || 'Partial Payment';
        document.getElementById('partialTotalDisplay').textContent = formatPrice(total);
        const paidInput = document.getElementById('partialAmountPaid');
        const noteInput = document.getElementById('partialNote');
        const errEl = document.getElementById('partialError');
        const balanceEl = document.getElementById('partialBalanceDisplay');
        const fromEl = document.getElementById('partialFromStatus');

        paidInput.value = currentPaid != null ? currentPaid : '';
        noteInput.value = '';
        errEl.textContent = '';
        fromEl.textContent = (currentStatus || 'unpaid').toUpperCase();
        updateBalancePreview();

        function updateBalancePreview() {
            const p = parseFloat(paidInput.value) || 0;
            const bal = Math.max(0, total - p);
            balanceEl.textContent = formatPrice(bal);
            balanceEl.className = bal > 0 ? 'text-warning' : 'text-success';
        }
        paidInput.oninput = updateBalancePreview;

        partialPaymentResolver = (res) => {
            closePartialPaymentModal();
            resolve(res);
        };
        modal.classList.add('active');
        setTimeout(() => paidInput.focus(), 150);
    });
}

function closePartialPaymentModal() {
    document.getElementById('partialPaymentModal')?.classList.remove('active');
    partialPaymentResolver = null;
}

function confirmPartialPayment() {
    const paidInput = document.getElementById('partialAmountPaid');
    const noteInput = document.getElementById('partialNote');
    const errEl = document.getElementById('partialError');
    const total = parseFloat(document.getElementById('partialTotalValue').value) || 0;

    const paid = parseFloat(paidInput.value);
    const note = noteInput.value.trim();

    if (isNaN(paid) || paid < 0) { errEl.textContent = 'Enter a valid amount paid'; return; }
    if (paid > total) { errEl.textContent = `Amount cannot exceed total ${formatPrice(total)}`; return; }
    if (!note) { errEl.textContent = 'Please add a note explaining the partial payment'; return; }

    if (partialPaymentResolver) partialPaymentResolver({ amountPaid: paid, note });
}

// ============================================================
// STATIC SERVICE PRICES
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

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', function () {
    const dateEl = document.getElementById('currentDate');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });

    ongoingViewDate = getTodayKey();
    completedViewDate = getTodayKey();

    initializeSupabase();
    populateAllDropdowns();
    loadServicePrices();
    loadAuditLogs();
    loadBackupHistory();
    setupModalCloseListeners();
    initializeSalaryDateRange();
    loadStoreData();

    const ongoingInput = document.getElementById('ongoingDateFilter');
    if (ongoingInput) ongoingInput.value = getTodayKey();
    const completedInput = document.getElementById('completedDateFilter');
    if (completedInput) completedInput.value = getTodayKey();

    const savedUser = getSession();
    if (savedUser) {
        currentUser = savedUser;
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        initializeApp();
    }
	// Initialize report period on load
	setReportPreset('daily');
});

function initializeApp() {
    populateAllDropdowns();
    loadData();
    updateUIForRole();
    updateAuditBadge();
    checkFirstTimeTour();
}

function setupModalCloseListeners() {
    const modals = ['transactionModal', 'quickAddModal', 'confirmModal', 'accessoryModal', 'addServiceModal', 'receiptModal', 'storeItemModal', 'partialPaymentModal', 'carwasherJobsModal'];
    modals.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('click', function (e) {
            if (e.target !== this) return;
            if (id === 'transactionModal') closeModal();
            else if (id === 'quickAddModal') closeQuickAdd();
            else if (id === 'confirmModal') closeConfirm();
            else if (id === 'accessoryModal') closeAccessoryModal();
            else if (id === 'addServiceModal') closeAddServiceModal();
            else if (id === 'receiptModal') closeReceiptModal();
            else if (id === 'storeItemModal') closeStoreItemModal();
            else if (id === 'partialPaymentModal') closePartialPaymentModal();
            else if (id === 'carwasherJobsModal') closeCarwasherJobsModal();
        });
    });
}

// ============================================================
// AUTH
// ============================================================
function saveSession(user) {
    if (!user) { localStorage.removeItem(SESSION_KEY); return; }
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user, expires: Date.now() + SESSION_EXPIRY }));
}

function getSession() {
    try {
        const data = localStorage.getItem(SESSION_KEY);
        if (!data) return null;
        const session = JSON.parse(data);
        if (Date.now() > session.expires) { localStorage.removeItem(SESSION_KEY); return null; }
        return session.user;
    } catch (e) { return null; }
}

function clearSession() { localStorage.removeItem(SESSION_KEY); }

function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = '';

    if (typeof authenticateUser === 'undefined') {
        showNotification('System error. Please refresh.', 'error');
        return;
    }
    const user = authenticateUser(username, password);
    if (user) {
        currentUser = { username, ...user };
        saveSession(currentUser);
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        initializeApp();
        logAudit('LOGIN', 'User logged in', { username });
        showNotification(`Welcome back, ${user.name}!`, 'success');
    } else {
        errorEl.textContent = '❌ Invalid username or password';
        const box = document.querySelector('.login-box');
        box.style.animation = 'shake 0.5s ease';
        setTimeout(() => box.style.animation = '', 500);
    }
}

async function handleLogout() {
    const ok = await showConfirm({
        icon: '🚪', title: 'Logout', message: 'Are you sure you want to logout?',
        details: { transaction: currentUser?.name || '—', amount: '—', status: '—' },
        buttonClass: 'btn-danger', buttonText: '<i class="fas fa-sign-out-alt"></i> Logout'
    });
    if (!ok) return;
    if (currentUser) logAudit('LOGOUT', 'User logged out', { username: currentUser.username });
    clearSession();
    currentUser = null;
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('loginForm').reset();
}

function updateUIForRole() {
    const isAdminUser = isAdmin(currentUser) || isManager(currentUser);
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdminUser ? '' : 'none');
    const role = isAdmin(currentUser) ? 'ADMIN' : isManager(currentUser) ? 'MANAGER' : 'STAFF';
    const roleEl = document.getElementById('sidebarUserRole');
    if (roleEl) roleEl.textContent = role;
    const nameEl = document.getElementById('sidebarUserName');
    if (nameEl) nameEl.textContent = getUserDisplayName(currentUser);
    const pages = getUserPages(currentUser);
    document.querySelectorAll('.nav-item').forEach(item => {
        const page = item.getAttribute('data-page');
        item.style.display = (page && pages.includes(page)) ? '' : 'none';
    });
}

// ============================================================
// SUPABASE
// ============================================================
function initializeSupabase() {
    try {
        const ok = SUPABASE_URL && !SUPABASE_URL.includes('your-project') && SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('your-anon');
        if (ok && window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            isSupabaseConnected = true;
            if (typeof setSupabaseUsersClient === 'function') {
                setSupabaseUsersClient(supabaseClient, true);
            }
            const sb = document.getElementById('statusBadge');
            if (sb) {
                sb.textContent = '✅ Connected';
                sb.className = 'status-badge connected';
            }
        } else {
            if (typeof setSupabaseUsersClient === 'function') {
                setSupabaseUsersClient(null, false);
            }
            const sb = document.getElementById('statusBadge');
            if (sb) {
                sb.textContent = '📄 Offline';
                sb.className = 'status-badge';
            }
        }
    } catch (e) { isSupabaseConnected = false; }
}

async function loadData() {
    showLoadingState(true);
    try {
        if (supabaseClient && isSupabaseConnected) {
            const { data, error } = await supabaseClient.from(TABLE_NAME).select('*').order('created_at', { ascending: false });
            if (!error && data) transactions = data;
        }
        await loadSalaryData();
        await loadAuditLogs();
        await loadOngoingTransactions();
        await loadCompletedTransactions();

        applyFilters();
        renderAll();
        renderSalaryTable();
        renderAuditLogs();
        renderStoreTotals();
        updateStoreHistory();
        renderCompletedTable();
        renderAccessories();
        if (isAdmin(currentUser) || isManager(currentUser)) await calculateSalaries(true);

        showLoadingState(false);
        showNotification(`Loaded ${transactions.length} transactions`, 'success', 3000);
    } catch (err) {
        console.error(err);
        showLoadingState(false);
        showNotification('Failed to load data', 'error');
    }
}

async function loadOngoingTransactions() {
    try {
        if (supabaseClient && isSupabaseConnected) {
            const { data } = await supabaseClient.from(TABLE_NAME).select('*').eq('is_ongoing', true).order('started_at', { ascending: false });
            if (data) ongoingTransactions = data;
        } else {
            ongoingTransactions = transactions.filter(t => t.is_ongoing === true);
        }
		
		renderOngoingTable();
		updateOngoingStats();
		refreshBayPickerIfOpen();   // ✅ sync the picker if the modal is open
		updateTransactionTabCounts();	
    } catch (e) { console.warn(e); }
}

async function loadCompletedTransactions() {
    try {
        if (supabaseClient && isSupabaseConnected) {
            const { data } = await supabaseClient.from(TABLE_NAME).select('*').eq('category', 'carwash').or('is_ongoing.is.null,is_ongoing.eq.false').order('created_at', { ascending: false });
            if (data) completedTransactions = data;
        } else {
            completedTransactions = transactions.filter(t => t.category === 'carwash' && !t.is_ongoing);
        }
        filteredCompleted = [...completedTransactions];
        updateCompletedStats();
        renderCompletedTable();
        updateTransactionTabCounts();
    } catch (e) { console.warn(e); }
}

function getOngoingForView() {
    return ongoingTransactions.filter(t => {
        const d = t.started_at || t.created_at;
        return toLocalDateKey(d) === ongoingViewDate;
    });
}
// ============================================================
// BAY PICKER
// ============================================================
const BAY_COUNT = 4;

/**
 * Returns a Set of bay numbers currently occupied by ongoing washes.
 * @param {number|null} excludeTxId - treat this tx as not occupying (used when editing)
 */
function getOccupiedBays(excludeTxId = null) {
    const occupied = new Set();
    ongoingTransactions.forEach(t => {
        if (!t.bay) return;
        if (excludeTxId != null && t.id === excludeTxId) return;
        occupied.add(Number(t.bay));
    });
    return occupied;
}

/**
 * Render the bay picker buttons.
 * @param {number|null} selectedBay - currently selected bay
 * @param {number|null} excludeTxId - ignore this transaction's own occupancy
 */
function renderBayPicker(selectedBay = null, excludeTxId = null) {
    const picker = document.getElementById('bayPicker');
    const hint = document.getElementById('bayPickerHint');
    const hidden = document.getElementById('formBay');
    if (!picker) return;

    const occupied = getOccupiedBays(excludeTxId);

    picker.innerHTML = '';
    for (let i = 1; i <= BAY_COUNT; i++) {
        const isOccupied = occupied.has(i);
        const isSelected = Number(selectedBay) === i;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bay-btn';
        if (isOccupied) btn.classList.add('occupied');
        if (isSelected) btn.classList.add('selected');
        btn.dataset.bay = i;
        btn.disabled = isOccupied;
        btn.setAttribute('aria-label', `Bay ${i}${isOccupied ? ' (occupied)' : ''}`);
        btn.innerHTML = `
            <span class="bay-num">${i}</span>
            <span class="bay-status">${isOccupied ? 'Occupied' : 'Available'}</span>
        `;
        btn.onclick = () => selectBay(i, excludeTxId);
        picker.appendChild(btn);
    }

    if (hidden) hidden.value = selectedBay != null ? selectedBay : '';

    if (hint) {
        if (occupied.size >= BAY_COUNT) {
            hint.innerHTML = '<i class="fas fa-exclamation-triangle"></i> All bays are occupied';
            hint.classList.add('all-occupied');
        } else if (occupied.size > 0) {
            const avail = Array.from({ length: BAY_COUNT }, (_, i) => i + 1).filter(b => !occupied.has(b));
            hint.innerHTML = `<i class="fas fa-info-circle"></i> Available: ${avail.join(', ')}`;
            hint.classList.remove('all-occupied');
        } else {
            hint.innerHTML = '<i class="fas fa-info-circle"></i> All bays are available';
            hint.classList.remove('all-occupied');
        }
    }
}

function selectBay(bay, excludeTxId = null) {
    const occupied = getOccupiedBays(excludeTxId);
    if (occupied.has(Number(bay))) {
        showNotification(`Bay ${bay} is currently occupied`, 'warning');
        return;
    }
    const hidden = document.getElementById('formBay');
    if (hidden) hidden.value = bay;

    // Update visual selection
    document.querySelectorAll('#bayPicker .bay-btn').forEach(btn => {
        btn.classList.toggle('selected', Number(btn.dataset.bay) === Number(bay));
    });
}

// Re-check availability any time ongoing data changes
function refreshBayPickerIfOpen() {
    const modal = document.getElementById('transactionModal');
    if (!modal || !modal.classList.contains('active')) return;
    const editId = document.getElementById('editId')?.value;
    const current = document.getElementById('formBay')?.value;
    renderBayPicker(current || null, editId ? parseInt(editId) : null);
}
// ============================================================
// TABS
// ============================================================
function switchTransactionTab(tab) {
    currentTransactionTab = tab;
    document.querySelectorAll('.transaction-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === `tab-${tab}`));

    if (tab === 'ongoing') {
        const input = document.getElementById('ongoingDateFilter');
        if (input && !input.value) {
            input.value = getTodayKey();
            ongoingViewDate = getTodayKey();
        }
        loadOngoingTransactions().then(() => {
            renderOngoingTable();
            updateOngoingStats();
        });
    } else if (tab === 'completed') {
        const input = document.getElementById('completedDateFilter');
        if (input && !input.value) {
            input.value = getTodayKey();
            completedViewDate = getTodayKey();
        }
        loadCompletedTransactions().then(() => {
            renderCompletedTable();
            updateCompletedStats();
        });
    } else {
        renderTable();
    }
}

function updateTransactionTabCounts() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('allTabCount', transactions.length);
    set('ongoingTabCount', ongoingTransactions.length);
    set('completedTabCount', completedTransactions.length);
    set('ongoingCount', ongoingTransactions.length);
    set('totalTransactions', transactions.length);
    set('txBadge', transactions.length);
}

// ============================================================
// DROPDOWNS
// ============================================================
function populateAllDropdowns() {
    const map = { formModel: 'models', formCarwasher: 'carwasher' };
    Object.entries(map).forEach(([id, key]) => {
        const select = document.getElementById(id);
        if (!select) return;
        const current = select.value;
        select.innerHTML = '<option value="">Select...</option>';
        (dropdownData[key] || []).forEach(item => {
            const opt = document.createElement('option');
            opt.value = item;
            opt.textContent = item;
            select.appendChild(opt);
        });
        if (current) select.value = current;
    });
    populateServiceDropdowns();
}

function populateServiceDropdowns() {
    const select = document.getElementById('formServices');
    if (!select) return;
    select.innerHTML = '<option value="">Select service & size...</option>';
    servicePrices.forEach(s => {
        const opt = document.createElement('option');
        opt.value = JSON.stringify({ name: s.service_name, size: s.size_category, price: s.price, category: s.service_category });
        opt.textContent = `${s.service_name} - ${s.size_category} (₱${s.price})`;
        select.appendChild(opt);
    });
}

function addServiceToSelection() {
    const select = document.getElementById('formServices');
    if (!select || !select.value) { showNotification('Please select a service', 'warning'); return; }
    let data; try { data = JSON.parse(select.value); } catch { return; }
    if (selectedServices.find(s => s.service_name === data.name && s.size === data.size)) {
        showNotification('Service already added', 'warning');
        return;
    }
    selectedServices.push({ service_name: data.name, size: data.size, price: data.price, category: data.category });
    updateSelectedServicesDisplay();
    updateServiceTotal();
    calculateCarwashTotal();
    select.value = '';
}

function removeServiceFromSelection(i) {
    selectedServices.splice(i, 1);
    updateSelectedServicesDisplay();
    updateServiceTotal();
    calculateCarwashTotal();
}

function updateSelectedServicesDisplay() {
    const c = document.getElementById('selectedServicesContainer');
    if (!c) return;
    if (selectedServices.length === 0) {
        c.innerHTML = '<span style="color:#94a3b8;font-size:0.85rem;">No services selected</span>';
        return;
    }
    c.innerHTML = '';
    selectedServices.forEach((s, i) => {
        const tag = document.createElement('span');
        tag.className = 'service-tag';
        tag.innerHTML = `${s.service_name} (${s.size}) - ${formatPrice(s.price)} <span class="remove-btn" onclick="removeServiceFromSelection(${i})">×</span>`;
        c.appendChild(tag);
    });
}

function updateServiceTotal() {
    serviceTotal = selectedServices.reduce((s, x) => s + x.price, 0);
    const d = document.getElementById('serviceTotalDisplay');
    if (d) d.textContent = formatPrice(serviceTotal);
}

function toggleTransactionFields() {
    const cat = document.getElementById('formCategory').value;
    document.getElementById('carwashFields').style.display = cat === 'carwash' ? 'block' : 'none';
    document.getElementById('storeFields').style.display = cat !== 'carwash' ? 'block' : 'none';
    if (cat === 'carwash') {
        clearStoreOrder();
        selectedServices = [];
        updateSelectedServicesDisplay();
        updateServiceTotal();
        calculateCarwashTotal();
    }
}

function addDropdownItem(type) {
    const prompts = { model: 'Enter new car model', carwasher: 'Enter new carwasher name' };
    const v = prompt(prompts[type] || 'Enter value');
    if (!v || !v.trim()) return;
    const map = { model: 'models', carwasher: 'carwasher' };
    const key = map[type];
    if (key && !dropdownData[key].includes(v.trim().toUpperCase())) {
        dropdownData[key].push(v.trim().toUpperCase());
        populateAllDropdowns();
        showNotification(`Added ${v}`, 'success');
    }
}

// ============================================================
// STORE ORDER IN TRANSACTION
// ============================================================
function clearStoreOrder() {
    storeOrderItems = [];
    renderStoreOrderItems();
    updateStoreOrderTotal();
}
function addCustomStoreItem() {
    const n = document.getElementById('formStoreItemName');
    const p = document.getElementById('formStoreItemPrice');
    const name = n.value.trim();
    const price = parseFloat(p.value);
    if (!name || isNaN(price) || price <= 0) { showNotification('Enter item name and price', 'warning'); return; }
    storeOrderItems.push({ name, price, quantity: 1 });
    n.value = ''; p.value = '';
    renderStoreOrderItems();
    updateStoreOrderTotal();
    calculateCarwashTotal();
}
function addStoreItemToCarwash(name, price) {
    storeOrderItems.push({ name, price, quantity: 1 });
    renderStoreOrderItems();
    updateStoreOrderTotal();
    calculateCarwashTotal();
}
function removeStoreItem(i) {
    storeOrderItems.splice(i, 1);
    renderStoreOrderItems();
    updateStoreOrderTotal();
    calculateCarwashTotal();
}
function renderStoreOrderItems() {
    const c = document.getElementById('storeItemsContainer');
    if (!c) return;
    if (storeOrderItems.length === 0) { c.innerHTML = ''; return; }
    c.innerHTML = '';
    storeOrderItems.forEach((item, i) => {
        const tag = document.createElement('span');
        tag.className = 'store-item-tag';
        tag.innerHTML = `<span>${item.name}</span> <span style="color:var(--gray-500);">${formatPrice(item.price)}</span> <span class="remove-btn" onclick="removeStoreItem(${i})">×</span>`;
        c.appendChild(tag);
    });
}
function updateStoreOrderTotal() {
    const t = storeOrderItems.reduce((s, x) => s + (x.price * (x.quantity || 1)), 0);
    const el = document.getElementById('storeOrderTotal');
    if (el) el.textContent = formatPrice(t);
}
function calculateCarwashTotal() {
    const s = selectedServices.reduce((a, x) => a + x.price, 0);
    const st = storeOrderItems.reduce((a, x) => a + (x.price * (x.quantity || 1)), 0);
    const d = document.getElementById('formTotalDisplay');
    if (d) d.textContent = formatPrice(s + st);
}
function calculateStoreTotal() {
    const qty = parseFloat(document.getElementById('formQuantity').value) || 0;
    const price = parseFloat(document.getElementById('formUnitPrice').value) || 0;
    const el = document.getElementById('formStoreTotal');
    if (el) el.value = (qty * price).toFixed(2);
}

// ============================================================
// TRANSACTION MODAL
// ============================================================
function openAddModal() {
    if (!checkPermission('add')) return;
    document.getElementById('modalTitle').textContent = '📝 New Transaction';
    document.getElementById('editId').value = '';
    document.getElementById('transactionForm').reset();
    document.getElementById('modalSubmitBtn').textContent = 'Save Transaction';
    document.getElementById('formCategory').value = 'carwash';
    document.getElementById('formPaymentStatus').value = 'unpaid';
    selectedServices = [];
    storeOrderItems = [];
    updateSelectedServicesDisplay();
    updateServiceTotal();
    clearStoreOrder();
    toggleTransactionFields();
    populateAllDropdowns();
    calculateCarwashTotal();

    // ✅ Fresh bay picker every time
    renderBayPicker(null, null);

    document.getElementById('transactionModal').classList.add('active');
}

function openEditModal(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    if (!checkPermission('edit')) return;
    document.getElementById('modalTitle').textContent = `✏️ Edit Transaction #${id}`;
    document.getElementById('editId').value = id;
    document.getElementById('modalSubmitBtn').textContent = 'Update Transaction';
    document.getElementById('formCategory').value = tx.category || 'carwash';
    document.getElementById('formPayment').value = tx.payment || 'CASH';
    document.getElementById('formPaymentStatus').value = tx.payment_status || 'unpaid';
    document.getElementById('formRemarks').value = tx.remarks || '';
    if (tx.category === 'carwash') {
		renderBayPicker(tx.bay || null, tx.id);
		document.getElementById('formPlate').value = tx.plate || '';
		document.getElementById('formModel').value = tx.car_model || '';
		document.getElementById('formCarwasher').value = tx.carwasher || '';
		selectedServices = Array.isArray(tx.selected_services) ? tx.selected_services : [];
		storeOrderItems = Array.isArray(tx.store_order) ? tx.store_order : [];
		updateSelectedServicesDisplay();
		updateServiceTotal();
		renderStoreOrderItems();
		updateStoreOrderTotal();
	} else {
        document.getElementById('formItem').value = tx.item || '';
        document.getElementById('formQuantity').value = tx.quantity || 1;
        document.getElementById('formUnitPrice').value = tx.unit_price || 0;
        calculateStoreTotal();
    }
    toggleTransactionFields();
    calculateCarwashTotal();
    document.getElementById('transactionModal').classList.add('active');
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

    if (category === 'carwash') {
		const carwasher = document.getElementById('formCarwasher').value.trim();
		const car_model = document.getElementById('formModel').value.trim();
		const bayVal = document.getElementById('formBay').value;

		if (!car_model || selectedServices.length === 0) {
			showNotification('Please fill required fields', 'warning');
			return;
		}
		if (!bayVal) {
			showNotification('Please select a bay', 'warning');
			return;
		}
		const bayNum = parseInt(bayVal);
		// ✅ Re-check occupancy at save time (another wash may have started)
		const occupied = getOccupiedBays(id ? parseInt(id) : null);
		if (occupied.has(bayNum)) {
			showNotification(`Bay ${bayNum} is currently occupied by another wash. Please pick a different bay.`, 'error');
			// Re-render picker to reflect current state and unselect the stale value
			renderBayPicker(null, id ? parseInt(id) : null);
			return;
		}
		if (!carwasher) {
			showNotification('Please select a Carwasher', 'warning');
			return;
		}
	} else {
        const item = document.getElementById('formItem').value.trim();
        const qty = parseFloat(document.getElementById('formQuantity').value) || 1;
        const price = parseFloat(document.getElementById('formUnitPrice').value) || 0;
        if (!item || qty <= 0 || price <= 0) { showNotification('Please fill required fields', 'warning'); return; }
    }

    let details = { transaction: '', amount: '—', status: paymentStatus.toUpperCase() };
    if (category === 'carwash') {
        details.transaction = document.getElementById('formModel').value.trim();
        details.amount = formatPrice(selectedServices.reduce((a, x) => a + x.price, 0) + storeOrderItems.reduce((a, x) => a + x.price * (x.quantity || 1), 0));
    } else {
        details.transaction = document.getElementById('formItem').value.trim();
        details.amount = formatPrice((parseFloat(document.getElementById('formQuantity').value) || 0) * (parseFloat(document.getElementById('formUnitPrice').value) || 0));
    }
    const ok = await showConfirm({
        icon: id ? '💾' : '✅',
        title: id ? 'Update Transaction' : 'Save Transaction',
        message: id ? 'Save changes?' : 'Create this transaction?',
        details,
        buttonClass: 'btn-success',
        buttonText: id ? '<i class="fas fa-save"></i> Update' : '<i class="fas fa-check"></i> Save'
    });
    if (!ok) return;

    let transaction = { category, payment, payment_status: paymentStatus, remarks, updated_at: now };

    if (category === 'carwash') {
        const bay = parseInt(document.getElementById('formBay').value) || null;
        const car_model = document.getElementById('formModel').value.trim();
        const plate = document.getElementById('formPlate').value.trim();
        const carwasher = document.getElementById('formCarwasher').value.trim();
        const sTotal = selectedServices.reduce((a, x) => a + x.price, 0);
        const stTotal = storeOrderItems.reduce((a, x) => a + (x.price * (x.quantity || 1)), 0);
        const total = sTotal + stTotal;
        transaction = {
            ...transaction,
            bay, car_model, plate, carwasher,
            services: selectedServices.map(s => `${s.service_name} (${s.size})`).join(', '),
            carwash_price: sTotal, detailing_price: 0, total,
            item: `${car_model} - ${selectedServices[0].service_name}`,
            quantity: 1, unit_price: total,
            store_order: storeOrderItems, selected_services: selectedServices,
            is_ongoing: !id ? true : false,
            started_at: !id ? now : undefined
        };
    } else {
        const item = document.getElementById('formItem').value.trim();
        const qty = parseFloat(document.getElementById('formQuantity').value) || 1;
        const price = parseFloat(document.getElementById('formUnitPrice').value) || 0;
        transaction = { ...transaction, item, quantity: qty, unit_price: price, total: qty * price, car_model: '', services: '', store_order: [], selected_services: [] };
    }

    try {
        let savedTx = null;
        if (supabaseClient && isSupabaseConnected) {
            const { data, error } = id
                ? await supabaseClient.from(TABLE_NAME).update(transaction).eq('id', id).select()
                : await supabaseClient.from(TABLE_NAME).insert(transaction).select();
            if (error) throw error;
            if (data && data.length) savedTx = data[0];
        } else {
            transaction.id = id ? parseInt(id) : Date.now();
            transaction.created_at = transaction.created_at || now;
            savedTx = transaction;
        }
        if (savedTx) {
            if (id) {
                const i = transactions.findIndex(t => t.id === parseInt(id));
                if (i !== -1) transactions[i] = savedTx;
                showNotification('Transaction updated', 'success');
            } else {
                transactions.unshift(savedTx);
                showNotification(`Transaction #${savedTx.id} saved (${paymentStatus.toUpperCase()})`, 'success', 6000, [
                    { text: '🖨️ Receipt', onclick: `quickReceipt(${savedTx.id})` }
                ]);
            }
            await logAudit(id ? 'UPDATE' : 'ADD', `Transaction #${savedTx.id}`, { amount: transaction.total });
            closeModal();
            applyFilters();
            renderAll();
            await loadOngoingTransactions();
            await loadCompletedTransactions();
            if (category === 'carwash' && !id) switchTransactionTab('ongoing');
        }
    } catch (err) { showNotification('Error: ' + err.message, 'error'); }
}

// ============================================================
// ONGOING
// ============================================================
async function completeOngoing(id) {
    if (!checkPermission('edit')) return;
    const ong = ongoingTransactions.find(t => t.id === id);
    refreshBayPickerIfOpen();
	if (!ong) { showNotification('Transaction not found', 'error'); return; }

    if (ong.payment_status !== 'paid') {
        // Offer to mark as paid & complete in one shot
        const changeToPaid = await showConfirm({
            icon: '💳',
            title: 'Not Fully Paid',
            message: `This wash is currently ${(ong.payment_status || 'unpaid').toUpperCase()}. Mark it as PAID and complete it now?`,
            details: {
                transaction: ong.car_model || '—',
                amount: formatPrice(ong.total || 0),
                status: 'PAID'
            },
            buttonClass: 'btn-success',
            buttonText: '<i class="fas fa-check-double"></i> Mark Paid & Complete'
        });
        if (changeToPaid) {
            // First set payment_status = paid, then complete
            try {
                const paidUpdate = {
                    payment_status: 'paid',
                    amount_paid: ong.total,
                    payment_note: null,
                    updated_at: new Date().toISOString()
                };
                if (supabaseClient && isSupabaseConnected) {
                    const { error } = await supabaseClient.from(TABLE_NAME).update(paidUpdate).eq('id', id);
                    if (error) throw error;
                }
                Object.assign(ong, paidUpdate);
                const main = transactions.find(t => t.id === id);
                if (main) Object.assign(main, paidUpdate);
                await logAudit('UPDATE', `Marked PAID before completion #${id}`, { amount: ong.total });
                await autoCompleteOngoing(id);
            } catch (err) {
                showNotification('Failed: ' + err.message, 'error');
                renderOngoingTable();
            }
        }
        return;
    }

    const confirmed = await showConfirm({
        icon: '✅', title: 'Complete Wash',
        message: 'Mark this wash as completed?',
        details: { transaction: ong.car_model || '—', amount: formatPrice(ong.total || 0), status: 'PAID' },
        buttonClass: 'btn-success', buttonText: '<i class="fas fa-check"></i> Complete'
    });
    if (!confirmed) return;

    try {
        const completedAt = new Date().toISOString();
        const start = new Date(ong.started_at || ong.created_at);
        const dur = Math.round((new Date(completedAt) - start) / 60000);
        const upd = { is_ongoing: false, completed_at: completedAt, remarks: `COMPLETED in ${dur} min` };
        if (supabaseClient && isSupabaseConnected) {
            await supabaseClient.from(TABLE_NAME).update(upd).eq('id', id);
        }
        Object.assign(ong, upd);
        ongoingTransactions = ongoingTransactions.filter(t => t.id !== id);
        await logAudit('UPDATE', `Wash completed: ${ong.car_model}`, { duration_minutes: dur });
        renderOngoingTable();
        updateOngoingStats();
        await loadCompletedTransactions();
        updateTransactionTabCounts();
        showNotification(`Wash completed in ${dur} min!`, 'success', 6000, [
            { text: '🖨️ Receipt', onclick: `quickReceipt(${id})` }
        ]);
    } catch (err) { showNotification('Error: ' + err.message, 'error'); }
}

async function changeOngoingPayment(id, newStatus) {
    if (!canChangeStatus(currentUser)) { renderOngoingTable(); return; }
    const ong = ongoingTransactions.find(t => t.id === id);
    if (!ong) return;
    if (ong.payment_status === newStatus) return;

    let partialData = null;

    if (newStatus === 'partial') {
        const total = parseFloat(ong.total) || 0;
        const totalEl = document.getElementById('partialTotalValue');
        if (totalEl) totalEl.value = total;
        const prefill = ong.payment_status === 'partial' ? (ong.amount_paid || '') : '';
        const paidEl = document.getElementById('partialAmountPaid');
        if (paidEl) paidEl.value = prefill;

        partialData = await promptPartialPayment({
            total,
            currentStatus: ong.payment_status,
            currentPaid: prefill,
            title: `Partial Payment — ${ong.car_model || 'Wash #' + id}`
        });
        if (partialData === null) { renderOngoingTable(); return; }
    } else {
        const ok = await showConfirm({
            icon: '💳',
            title: 'Change Payment Status',
            message: newStatus === 'paid'
                ? `Mark this wash as FULLY PAID? It will be moved to Completed automatically.`
                : `Update payment status to "${newStatus.toUpperCase()}"?`,
            details: {
                transaction: ong.car_model || '—',
                amount: formatPrice(ong.total || 0),
                status: newStatus.toUpperCase()
            },
            buttonClass: newStatus === 'paid' ? 'btn-success' : 'btn-primary',
            buttonText: newStatus === 'paid'
                ? '<i class="fas fa-check-double"></i> Mark Paid & Complete'
                : '<i class="fas fa-check"></i> Update'
        });
        if (!ok) { renderOngoingTable(); return; }
    }

    try {
        const update = { payment_status: newStatus, updated_at: new Date().toISOString() };
        if (newStatus === 'partial' && partialData) {
            update.amount_paid = partialData.amountPaid;
            update.payment_note = partialData.note;
        } else if (newStatus === 'paid') {
            update.amount_paid = ong.total;
            update.payment_note = null;
        } else if (newStatus === 'unpaid') {
            update.amount_paid = 0;
            update.payment_note = null;
        }

        if (supabaseClient && isSupabaseConnected) {
            const { error } = await supabaseClient.from(TABLE_NAME).update(update).eq('id', id);
            if (error) throw error;
        }

        Object.assign(ong, update);
        const main = transactions.find(t => t.id === id);
        if (main) Object.assign(main, update);

        await logAudit('UPDATE', `Ongoing payment #${id} → ${newStatus}`,
            newStatus === 'partial'
                ? { partial_amount: partialData.amountPaid, note: partialData.note }
                : { amount: ong.total });

        // ✅ AUTO-COMPLETE: If paid, immediately move to Completed
        if (newStatus === 'paid') {
            await autoCompleteOngoing(id);
            return;
        }

        renderOngoingTable();
        renderTable();
        showNotification(
            newStatus === 'partial'
                ? `Marked PARTIAL — ${formatPrice(partialData.amountPaid)} paid`
                : `Payment updated to ${newStatus.toUpperCase()}`,
            'success'
        );
    } catch (err) {
        showNotification('Failed: ' + err.message, 'error');
        renderOngoingTable();
    }
}

// ✅ NEW: Silent completion helper — no extra confirmation needed
// (user already confirmed the "Mark Paid & Complete" prompt)
async function autoCompleteOngoing(id) {
    const ong = ongoingTransactions.find(t => t.id === id);
    if (!ong) return;
    try {
        const completedAt = new Date().toISOString();
        const start = new Date(ong.started_at || ong.created_at);
        const dur = Math.round((new Date(completedAt) - start) / 60000);
        const upd = {
            is_ongoing: false,
            completed_at: completedAt,
            remarks: `PAID & COMPLETED in ${dur} min`
        };

        if (supabaseClient && isSupabaseConnected) {
            const { error } = await supabaseClient.from(TABLE_NAME).update(upd).eq('id', id);
            if (error) throw error;
        }

        Object.assign(ong, upd);
        const main = transactions.find(t => t.id === id);
        if (main) Object.assign(main, upd);

        // Remove from ongoing list
        ongoingTransactions = ongoingTransactions.filter(t => t.id !== id);

        await logAudit('UPDATE', `Wash auto-completed (paid): ${ong.car_model}`, {
            duration_minutes: dur,
            auto_completed: true
        });

        // Refresh both tabs
        renderOngoingTable();
        updateOngoingStats();
        await loadCompletedTransactions();
        updateTransactionTabCounts();
        renderTable();
		
		refreshBayPickerIfOpen();
        showNotification(
            `✅ ${ong.car_model || 'Wash'} is PAID & COMPLETED in ${dur} min`,
            'success',
            7000,
            [
                { text: '🖨️ Receipt', onclick: `quickReceipt(${id})` },
                { text: '📋 View Completed', onclick: `switchTransactionTab('completed'); switchPage('transactions');` }
            ]
        );
    } catch (err) {
        showNotification('Auto-complete failed: ' + err.message, 'error');
        renderOngoingTable();
    }
}

function renderOngoingTable() {
    const tb = document.getElementById('ongoingBody');
    if (!tb) return;
    const rows = getOngoingForView();
    const dateLabel = document.getElementById('ongoingDateLabel');
    if (dateLabel) dateLabel.textContent = formatDateKey(ongoingViewDate);

    if (rows.length === 0) {
        tb.innerHTML = `<tr><td colspan="11" class="empty-state" data-label="">
            <div style="padding:1rem;">
                <div style="font-size:1.5rem;margin-bottom:0.5rem;">🚿</div>
                <div>No ongoing washes ${isToday(ongoingViewDate) ? 'today' : 'for this date'}.</div>
                <button class="btn btn-sm btn-primary" onclick="openAddModal()" style="margin-top:0.75rem;">
                    <i class="fas fa-plus"></i> New Transaction
                </button>
            </div>
        </td></tr>`;
        return;
    }

    tb.innerHTML = '';
    rows.forEach((row, i) => {
        const elapsed = Math.round((new Date() - new Date(row.started_at || row.created_at)) / 60000);
        const paid = row.payment_status === 'paid';
        const statusClass = `status-${row.payment_status || 'unpaid'}`;
        const canComplete = paid && canEditTransaction(currentUser);
        const canChange = canChangeStatus(currentUser);
        const balance = getBalanceDue(row);
        const partialInfo = row.payment_status === 'partial'
            ? `<div class="partial-info-inline">💰 ${formatPrice(row.amount_paid || 0)} paid · ${formatPrice(balance)} due</div>`
            : '';

        const tr = document.createElement('tr');
        tr.className = 'ongoing-row';
        tr.innerHTML = `
            <td data-label="#">${i + 1}</td>
            <td data-label="Bay"><span class="badge badge-info">Bay ${row.bay || '—'}</span></td>
            <td data-label="Car Model"><strong>${row.car_model || '—'}</strong></td>
            <td data-label="Plate">${row.plate || '—'}</td>
            <td data-label="Services">${row.services || '—'}</td>
            <td data-label="Carwasher">${row.carwasher || '—'}</td>
            <td data-label="Started">${new Date(row.started_at || row.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td>
            <td data-label="Elapsed"><span class="ongoing-timer">⏱️ ${elapsed} min</span></td>
            <td data-label="Total" class="price-col">${formatPrice(row.total)}</td>
            <td data-label="Payment">
                <select class="status-select ${statusClass}" onchange="changeOngoingPayment(${row.id}, this.value)" ${!canChange ? 'disabled' : ''}>
                    <option value="unpaid" ${row.payment_status === 'unpaid' ? 'selected' : ''}>❌ Unpaid</option>
                    <option value="partial" ${row.payment_status === 'partial' ? 'selected' : ''}>🔄 Partial</option>
                    <option value="paid" ${row.payment_status === 'paid' ? 'selected' : ''}>✅ Paid</option>
                </select>
                ${partialInfo}
            </td>
            <td data-label="">
                <button class="btn btn-sm ${canComplete ? 'btn-success' : 'btn-outline'}" onclick="completeOngoing(${row.id})"
						title="${canComplete ? 'Mark as completed' : 'Mark paid & complete in one click'}">
					<i class="fas ${canComplete ? 'fa-check' : 'fa-check-double'}"></i>
					${canComplete ? 'Complete' : 'Pay & Complete'}
				</button>
            </td>
        `;
        tb.appendChild(tr);
    });
    enhanceTablesForMobile();
}

function updateOngoingStats() {
    const rows = getOngoingForView();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('ongoingInProgress', rows.length);
    set('ongoingRevenue', formatPrice(rows.reduce((s, t) => s + (parseFloat(t.total) || 0), 0)));
    set('baysAvailable', Math.max(0, 4 - rows.length));
    if (rows.length > 0) {
        const avg = Math.round(rows.reduce((s, t) => s + Math.round((new Date() - new Date(t.started_at || t.created_at)) / 60000), 0) / rows.length);
        set('ongoingAvgTime', avg + ' min');
    } else set('ongoingAvgTime', '0 min');
}

function setOngoingViewDate(dateKey) {
    ongoingViewDate = dateKey || getTodayKey();
    renderOngoingTable();
    updateOngoingStats();
}

function onOngoingDateChange(value) {
    setOngoingViewDate(value);
}

function jumpToToday(view) {
    if (view === 'ongoing') {
        const input = document.getElementById('ongoingDateFilter');
        if (input) input.value = getTodayKey();
        setOngoingViewDate(getTodayKey());
    } else {
        const input = document.getElementById('completedDateFilter');
        if (input) input.value = getTodayKey();
        setCompletedViewDate(getTodayKey());
    }
}

function refreshOngoing() {
    loadOngoingTransactions().then(() => {
        renderOngoingTable();
        updateOngoingStats();
        showNotification('Refreshed', 'info');
    });
}

// ============================================================
// COMPLETED
// ============================================================
function renderCompletedTable() {
    const tb = document.getElementById('completedBody');
    if (!tb) return;

    const rows = filteredCompleted.filter(t => {
        const d = t.completed_at || t.created_at;
        return toLocalDateKey(d) === completedViewDate;
    });

    const dateLabel = document.getElementById('completedDateLabel');
    if (dateLabel) dateLabel.textContent = formatDateKey(completedViewDate);

    if (rows.length === 0) {
        tb.innerHTML = `<tr><td colspan="10" class="empty-state" data-label="">
            <div style="padding:1rem;">
                <div style="font-size:1.5rem;margin-bottom:0.5rem;">📋</div>
                <div>No completed washes ${isToday(completedViewDate) ? 'today' : 'for this date'}.</div>
            </div>
        </td></tr>`;
        return;
    }

    tb.innerHTML = '';
    rows.slice(0, 100).forEach((row, i) => {
        let dur = '—';
        if (row.started_at && row.completed_at) {
            dur = Math.round((new Date(row.completed_at) - new Date(row.started_at)) / 60000) + ' min';
        }
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="#">${i + 1}</td>
            <td data-label="Time">${new Date(row.completed_at || row.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td>
            <td data-label="Car Model"><strong>${row.car_model || '—'}</strong></td>
            <td data-label="Plate">${row.plate || '—'}</td>
            <td data-label="Services">${row.services || '—'}</td>
            <td data-label="Carwasher">${row.carwasher || '—'}</td>
            <td data-label="Duration"><span class="badge badge-success">${dur}</span></td>
            <td data-label="Total" class="price-col">${formatPrice(row.total)}</td>
            <td data-label="Status"><span class="badge badge-${row.payment_status}">${(row.payment_status || '').toUpperCase()}</span></td>
            <td data-label="">
                <button class="btn btn-sm btn-info" onclick="quickReceipt(${row.id})"><i class="fas fa-receipt"></i></button>
                <button class="btn btn-sm btn-outline" onclick="openEditModal(${row.id})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteTransaction(${row.id})"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tb.appendChild(tr);
    });
    enhanceTablesForMobile();
}

function updateCompletedStats() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const rows = filteredCompleted.filter(t => {
        const d = t.completed_at || t.created_at;
        return toLocalDateKey(d) === completedViewDate;
    });
    set('completedTotal', rows.length);
    set('completedRevenue', formatPrice(rows.reduce((s, t) => s + (parseFloat(t.total) || 0), 0)));
    set('completedToday', rows.length);
    const durs = rows.filter(t => t.started_at && t.completed_at)
        .map(t => (new Date(t.completed_at) - new Date(t.started_at)) / 60000);
    set('completedAvgDuration', (durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : 0) + ' min');
}

function setCompletedViewDate(dateKey) {
    completedViewDate = dateKey || getTodayKey();
    renderCompletedTable();
    updateCompletedStats();
}

function onCompletedDateChange(value) {
    setCompletedViewDate(value);
}

function filterCompleted() {
    const q = (document.getElementById('completedSearch')?.value || '').toLowerCase();
    const st = document.getElementById('completedStatusFilter')?.value || '';
    filteredCompleted = completedTransactions.filter(t => {
        if (st && t.payment_status !== st) return false;
        if (q && ![t.car_model, t.plate, t.carwasher].join(' ').toLowerCase().includes(q)) return false;
        return true;
    });
    const c = document.getElementById('completedFilterCount');
    if (c) c.textContent = `${filteredCompleted.length} total`;
    renderCompletedTable();
    updateCompletedStats();
}

// ============================================================
// MAIN TABLE
// ============================================================
function renderAll() {
    renderSummary();
    renderRecent();
    renderTable();
    updateBadgeCount();
}

function renderTable() {
    const tb = document.getElementById('transactionsBody');
    const table = document.getElementById('transactionsTable');
    if (!tb || !table) return;
    let data = filteredTransactions.length > 0 ? filteredTransactions : transactions;
    if (sortColumn && sortDirection) {
        data = [...data].sort((a, b) => {
            let av = a[sortColumn], bv = b[sortColumn];
            if (sortColumn === 'id' || sortColumn === 'total') { av = parseFloat(av) || 0; bv = parseFloat(bv) || 0; }
            else { av = String(av || '').toLowerCase(); bv = String(bv || '').toLowerCase(); }
            if (av < bv) return sortDirection === 'asc' ? -1 : 1;
            if (av > bv) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }
    if (data.length === 0) { table.style.display = 'none'; return; }
    table.style.display = '';
    tb.innerHTML = '';
    data.slice(0, 100).forEach(row => {
        const rowStatusClass = `status-${row.payment_status}`;
        const balance = getBalanceDue(row);
        const partialInfo = row.payment_status === 'partial'
            ? `<div class="partial-info-inline">💰 ${formatPrice(row.amount_paid || 0)} paid · ${formatPrice(balance)} due</div>`
            : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label=""><input type="checkbox" onchange="toggleRow(${row.id})" ${selectedIds.has(row.id) ? 'checked' : ''}></td>
            <td data-label="#">${row.id}</td>
            <td data-label="Date">${new Date(row.created_at || row.updated_at).toLocaleDateString()}</td>
            <td data-label="Category"><span class="badge badge-${row.category}">${(row.category || '').toUpperCase()}</span></td>
            <td data-label="Item">${row.item || row.car_model || '—'}</td>
            <td data-label="Carwasher">${row.carwasher || '—'}</td>
            <td data-label="Total" class="price-col">${formatPrice(row.total)}</td>
            <td data-label="Status">
                <select class="status-select ${rowStatusClass}" onchange="changePaymentStatus(${row.id}, this.value)" ${!canChangeStatus(currentUser) ? 'disabled' : ''}>
                    <option value="unpaid" ${row.payment_status === 'unpaid' ? 'selected' : ''}>Unpaid</option>
                    <option value="partial" ${row.payment_status === 'partial' ? 'selected' : ''}>Partial</option>
                    <option value="paid" ${row.payment_status === 'paid' ? 'selected' : ''}>Paid</option>
                </select>
                ${partialInfo}
            </td>
            <td data-label="">
                <div class="row-actions">
                    <button class="btn btn-sm btn-info" onclick="quickReceipt(${row.id})" title="Receipt"><i class="fas fa-receipt"></i></button>
                    <button class="btn btn-sm btn-outline" onclick="openEditModal(${row.id})" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="deleteTransaction(${row.id})" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        tb.appendChild(tr);
    });
    const footer = document.getElementById('transactionsFooter');
    if (footer) {
        const total = data.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
        footer.innerHTML = `<tr class="total-row"><td colspan="5" data-label="">TOTAL (${data.length})</td><td data-label="">${formatPrice(total)}</td><td colspan="2" data-label=""></td></tr>`;
    }
    enhanceTablesForMobile();
}

function renderSummary() {
    if (isStaff(currentUser)) {
        const s = document.getElementById('summaryCards');
        if (s) s.style.display = 'none';
        return;
    }

    const t = transactions;
    const total = t.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);

    const carCount = t.filter(x => x.category === 'carwash').length;
    const carwashTotal = t.filter(x => x.category === 'carwash').reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
    const storeTotal = t.filter(x => x.category === 'store').reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
    const accessoriesTotal = t.filter(x => x.category === 'accessories').reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
    const drinksTotal = t.filter(x => x.category === 'drinks').reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
    const palutoTotal = t.filter(x => x.category === 'paluto').reduce((s, r) => s + (parseFloat(r.total) || 0), 0);

    // Animated values
    animateMoney(document.getElementById('incomeTotal'), total);
    animateCount(document.getElementById('carCount'), carCount);
    animateMoney(document.getElementById('carwashTotal'), carwashTotal);
    animateMoney(document.getElementById('storeTotal'), storeTotal);
    animateMoney(document.getElementById('drinksTotal'), drinksTotal);
    animateMoney(document.getElementById('palutoTotal'), palutoTotal);
    animateMoney(document.getElementById('accessoriesTotal'), accessoriesTotal);

    // Small stats elsewhere (not animated — already cheap)
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('pendingPayments', t.filter(x => x.payment_status === 'unpaid').length);
    const today = new Date().toDateString();
    set('todayEarnings', formatPrice(t.filter(x => new Date(x.created_at).toDateString() === today).reduce((s, r) => s + (parseFloat(r.total) || 0), 0)));
}
function renderRecent() {
    const tb = document.getElementById('recentBody');
    if (!tb) return;
    const recent = [...transactions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);
    if (recent.length === 0) { tb.innerHTML = '<tr><td colspan="6" class="empty-state" data-label="">No transactions yet</td></tr>'; return; }
    tb.innerHTML = '';
    recent.forEach((row, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="#">${i + 1}</td>
            <td data-label="Date">${new Date(row.created_at).toLocaleDateString()}</td>
            <td data-label="Category"><span class="badge badge-${row.category}">${(row.category || '').toUpperCase()}</span></td>
            <td data-label="Item">${row.item || row.car_model || '—'}</td>
            <td data-label="Total" class="price-col">${formatPrice(row.total)}</td>
            <td data-label="Status"><span class="badge badge-${row.payment_status}">${(row.payment_status || '').toUpperCase()}</span></td>
        `;
        tb.appendChild(tr);
    });
    enhanceTablesForMobile();
}

function updateBadgeCount() {
    const el = document.getElementById('txBadge');
    if (el) el.textContent = transactions.length;
}

// ============================================================
// FILTERS
// ============================================================
function applyFilters() {
    const q = (document.getElementById('searchInput')?.value || '').toLowerCase();
    const cat = document.getElementById('categoryFilter')?.value || '';
    const status = document.getElementById('paymentStatusFilter')?.value || '';
    filteredTransactions = transactions.filter(t => {
        if (cat && t.category !== cat) return false;
        if (status && t.payment_status !== status) return false;
        if (q) {
            const hay = [t.item, t.car_model, t.plate, t.carwasher, t.category, t.services, String(t.id)].join(' ').toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });
    const c = document.getElementById('filterCount');
    if (c) c.textContent = `${filteredTransactions.length} of ${transactions.length}`;
    renderTable();
}

function clearFilters() {
    ['searchInput', 'categoryFilter', 'paymentStatusFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    applyFilters();
}

function sortTable(col) {
    if (sortColumn === col) sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    else { sortColumn = col; sortDirection = 'asc'; }
    document.querySelectorAll('th.sortable').forEach(th => th.classList.remove('sorted-asc', 'sorted-desc'));
    const th = document.querySelector(`th.sortable[data-sort="${col}"]`);
    if (th) th.classList.add(`sorted-${sortDirection}`);
    renderTable();
}

function toggleAllCheckboxes() {
    const m = document.getElementById('selectAll');
    if (!m) return;
    if (m.checked) transactions.forEach(t => selectedIds.add(t.id));
    else selectedIds.clear();
    renderTable();
}

function toggleRow(id) {
    if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
}

// ============================================================
// DELETE / STATUS
// ============================================================
async function deleteTransaction(id) {
    if (!checkPermission('delete')) return;
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    const ok = await showConfirm({
        icon: '🗑️', title: 'Delete Transaction',
        message: 'Delete this transaction? Cannot be undone.',
        details: { transaction: tx.item || tx.car_model || '—', amount: formatPrice(tx.total), status: (tx.payment_status || '').toUpperCase() },
        buttonClass: 'btn-danger', buttonText: '<i class="fas fa-trash"></i> Delete'
    });
    if (!ok) return;
    try {
        if (supabaseClient && isSupabaseConnected) await supabaseClient.from(TABLE_NAME).delete().eq('id', id);
        transactions = transactions.filter(t => t.id !== id);
        ongoingTransactions = ongoingTransactions.filter(t => t.id !== id);
        completedTransactions = completedTransactions.filter(t => t.id !== id);
        selectedIds.delete(id);
        await logAudit('DELETE', `Deleted #${id}`, { amount: tx.total });
        applyFilters();
        renderAll();
        renderOngoingTable();
        renderCompletedTable();
        updateTransactionTabCounts();
		refreshBayPickerIfOpen();
        showNotification('Deleted', 'success');
    } catch (err) { showNotification('Delete failed: ' + err.message, 'error'); }
}

async function deleteSelected() {
    if (!checkPermission('delete')) return;
    if (selectedIds.size === 0) { showNotification('Nothing selected', 'warning'); return; }
    const ok = await showConfirm({
        icon: '🗑️', title: 'Delete Selected',
        message: `Delete ${selectedIds.size} transactions? Cannot be undone.`,
        details: { transaction: `${selectedIds.size} items`, amount: '—', status: '—' },
        buttonClass: 'btn-danger', buttonText: 'Delete All'
    });
    if (!ok) return;
    const ids = Array.from(selectedIds);
    for (const id of ids) {
        try {
            if (supabaseClient && isSupabaseConnected) await supabaseClient.from(TABLE_NAME).delete().eq('id', id);
            transactions = transactions.filter(t => t.id !== id);
            ongoingTransactions = ongoingTransactions.filter(t => t.id !== id);
            completedTransactions = completedTransactions.filter(t => t.id !== id);
        } catch (e) { console.warn(e); }
    }
    selectedIds.clear();
    await logAudit('DELETE', `Deleted ${ids.length}`, { count: ids.length });
    applyFilters();
    renderAll();
    renderOngoingTable();
    renderCompletedTable();
    updateTransactionTabCounts();
	refreshBayPickerIfOpen();
    showNotification(`Deleted ${ids.length}`, 'success');
}

async function changePaymentStatus(id, status) {
    if (!canChangeStatus(currentUser)) return;
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    let partialData = null;

    if (status === 'partial') {
        const total = parseFloat(tx.total) || 0;
        const totalEl = document.getElementById('partialTotalValue');
        if (totalEl) totalEl.value = total;
        const prefill = tx.payment_status === 'partial' ? (tx.amount_paid || '') : '';
        const paidEl = document.getElementById('partialAmountPaid');
        if (paidEl) paidEl.value = prefill;

        partialData = await promptPartialPayment({
            total,
            currentStatus: tx.payment_status,
            currentPaid: prefill,
            title: `Partial Payment — ${tx.car_model || tx.item || 'Transaction #' + id}`
        });
        if (partialData === null) { renderTable(); return; }
    } else {
        const ok = await showConfirm({
            icon: '💳',
            title: 'Change Payment Status',
            message: `Update payment status to "${status.toUpperCase()}"?`,
            details: { transaction: tx.item || tx.car_model || '—', amount: formatPrice(tx.total), status: status.toUpperCase() },
            buttonClass: 'btn-primary',
            buttonText: '<i class="fas fa-check"></i> Update'
        });
        if (!ok) { renderTable(); return; }
    }

    try {
        const update = { payment_status: status, updated_at: new Date().toISOString() };
        if (status === 'partial' && partialData) {
            update.amount_paid = partialData.amountPaid;
            update.payment_note = partialData.note;
        } else if (status === 'paid') {
            update.amount_paid = tx.total;
            update.payment_note = null;
        } else if (status === 'unpaid') {
            update.amount_paid = 0;
            update.payment_note = null;
        }

        if (supabaseClient && isSupabaseConnected) {
            const { error } = await supabaseClient.from(TABLE_NAME).update(update).eq('id', id);
            if (error) throw error;
        }

        Object.assign(tx, update);

        const auditDetail = { amount: tx.total };
        if (status === 'partial' && partialData) {
            auditDetail.partial_amount = partialData.amountPaid;
            auditDetail.note = partialData.note;
        }
        await logAudit('UPDATE', `Payment status #${id} → ${status}`, auditDetail);

        renderTable();
        renderOngoingTable();
        showNotification(
            status === 'partial'
                ? `Marked PARTIAL — ${formatPrice(partialData.amountPaid)} paid`
                : `Status updated to ${status.toUpperCase()}`,
            'success'
        );
    } catch (err) {
        showNotification('Failed: ' + err.message, 'error');
        renderTable();
    }
}

// ============================================================
// RECEIPT
// ============================================================
function quickReceipt(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) { showNotification('Not found', 'error'); return; }
    const sv = Array.isArray(tx.selected_services) ? tx.selected_services : [];
    const st = Array.isArray(tx.store_order) ? tx.store_order : [];
    const svHTML = sv.length > 0
        ? sv.map(s => `<div style="display:flex;justify-content:space-between;font-size:0.8rem;padding:2px 0;"><span>${s.service_name} (${s.size})</span><span>${formatPrice(s.price)}</span></div>`).join('')
        : (tx.services ? `<div style="font-size:0.8rem;">${tx.services}</div>` : '');
    const stHTML = st.length > 0
        ? st.map(s => `<div style="display:flex;justify-content:space-between;font-size:0.8rem;padding:2px 0;"><span>${s.name}</span><span>${formatPrice(s.price)}</span></div>`).join('')
        : '';

    const isPartial = tx.payment_status === 'partial';
    const partialHTML = isPartial ? `
        <div style="font-size:0.75rem;margin-top:0.4rem;padding:0.4rem;background:#fef3d7;border-radius:6px;border-left:3px solid #f59e0b;">
            <div style="font-weight:700;color:#92400e;">PARTIAL PAYMENT</div>
            <div style="display:flex;justify-content:space-between;"><span>Amount Paid:</span><span>${formatPrice(tx.amount_paid || 0)}</span></div>
            <div style="display:flex;justify-content:space-between;"><span>Balance Due:</span><span>${formatPrice(getBalanceDue(tx))}</span></div>
            ${tx.payment_note ? `<div style="margin-top:0.25rem;font-style:italic;">Note: ${tx.payment_note}</div>` : ''}
        </div>
    ` : '';

    const html = `
        <div id="receiptDocument">
            <div style="text-align:center;margin-bottom:0.5rem;">
                <div style="font-size:1.3rem;">🧼</div>
                <div style="font-weight:700;">MINI BOSS CARWASH</div>
                <div style="font-size:0.7rem;">Receipt #${tx.id}</div>
                <div style="font-size:0.7rem;">${new Date(tx.created_at || Date.now()).toLocaleString()}</div>
            </div>
            <hr style="border:none;border-top:1px dashed #999;">
            <div style="font-size:0.8rem;margin:0.5rem 0;">
                <div>Category: ${(tx.category || '').toUpperCase()}</div>
                ${tx.car_model ? `<div>Car: ${tx.car_model} ${tx.plate ? '(' + tx.plate + ')' : ''}</div>` : ''}
                ${tx.carwasher ? `<div>Carwasher: ${tx.carwasher}</div>` : ''}
                ${tx.item && !tx.car_model ? `<div>Item: ${tx.item}</div>` : ''}
            </div>
            <hr style="border:none;border-top:1px dashed #999;">
            ${svHTML}${stHTML}
            <hr style="border:none;border-top:1px dashed #999;">
            <div style="display:flex;justify-content:space-between;font-weight:700;font-size:0.95rem;padding:4px 0;"><span>TOTAL</span><span>${formatPrice(tx.total)}</span></div>
            <div style="font-size:0.75rem;margin-top:0.3rem;">Payment: ${tx.payment || '—'}</div>
            <div style="font-size:0.75rem;">Status: ${(tx.payment_status || '').toUpperCase()}</div>
            ${partialHTML}
            <hr style="border:none;border-top:1px dashed #999;">
            <div style="text-align:center;font-size:0.7rem;margin-top:0.5rem;">Thank you! Come again!</div>
        </div>
    `;
    document.getElementById('receiptContent').innerHTML = html;
    document.getElementById('receiptModal').classList.add('active');
}

function printReceipt() {
    const node = document.getElementById('receiptDocument');
    if (!node) return;
    const w = window.open('', '_blank', 'width=400,height=700');
    w.document.write('<html><head><title>Receipt</title></head><body>' + node.outerHTML + '</body></html>');
    w.document.close(); w.focus(); w.print(); w.close();
}

function downloadReceiptPDF() {
    const node = document.getElementById('receiptDocument');
    if (!node || !window.html2canvas || !window.jspdf) { printReceipt(); return; }
    html2canvas(node, { scale: 2 }).then(canvas => {
        const img = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ unit: 'mm', format: [80, 160] });
        pdf.addImage(img, 'PNG', 0, 0, 80, 160);
        pdf.save('receipt.pdf');
    });
}

function closeReceiptModal() { document.getElementById('receiptModal')?.classList.remove('active'); }

// ============================================================
// EXPORT
// ============================================================
function exportData() { exportRows(transactions, 'all_transactions'); }
function exportCompleted() { exportRows(completedTransactions, 'completed_carwash'); }
function exportAccessories() { exportRows(transactions.filter(t => t.category === 'accessories'), 'accessories'); }
function exportRows(rows, name) {
    if (!window.XLSX) { showNotification('XLSX not loaded', 'error'); return; }
    const data = rows.map(r => ({
        ID: r.id, Date: r.created_at, Category: r.category, Item: r.item || r.car_model,
        Carwasher: r.carwasher || '', Total: r.total, Payment: r.payment, Status: r.payment_status,
        AmountPaid: r.amount_paid || '', PaymentNote: r.payment_note || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `${name}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ============================================================
// QUICK ADD
// ============================================================
function openQuickAdd() {
    if (!checkPermission('add')) return;
    document.getElementById('quickAddForm').reset();
    document.getElementById('quickAddModal').classList.add('active');
}
function closeQuickAdd() { document.getElementById('quickAddModal')?.classList.remove('active'); }

async function saveQuickAdd(e) {
    e.preventDefault();
    if (!checkPermission('add')) return;
    const category = document.getElementById('quickCategory').value;
    const item = document.getElementById('quickItem').value.trim();
    const amount = parseFloat(document.getElementById('quickAmount').value) || 0;
    const carwasher = document.getElementById('quickCarwasher').value.trim();
    const payment = document.getElementById('quickPayment').value;
    const status = document.getElementById('quickPaymentStatus').value;
    if (!item || amount <= 0) { showNotification('Enter item and amount', 'warning'); return; }

    const ok = await showConfirm({
        icon: '💾', title: 'Save Quick Entry',
        message: 'Save this entry?',
        details: { transaction: item, amount: formatPrice(amount), status: status.toUpperCase() },
        buttonClass: 'btn-success', buttonText: '<i class="fas fa-check"></i> Save'
    });
    if (!ok) return;

    const tx = {
        category, item, car_model: category === 'carwash' ? item : '', carwasher,
        payment, payment_status: status, total: amount, unit_price: amount, quantity: 1,
        carwash_price: category === 'carwash' ? amount : 0, detailing_price: 0,
        services: '', is_ongoing: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    try {
        let saved = tx;
        if (supabaseClient && isSupabaseConnected) {
            const { data, error } = await supabaseClient.from(TABLE_NAME).insert(tx).select();
            if (error) throw error;
            if (data && data.length) saved = data[0];
        } else saved.id = Date.now();
        transactions.unshift(saved);
        await logAudit('ADD', `Quick add ${item}`, { amount });
        closeQuickAdd();
        applyFilters();
        renderAll();
        showNotification(`Added ${item} (${formatPrice(amount)})`, 'success');
    } catch (err) { showNotification('Error: ' + err.message, 'error'); }
}

// ============================================================
// ACCESSORIES
// ============================================================
function openAccessoryModal() {
    if (!checkPermission('add')) return;
    document.getElementById('accessoryForm').reset();
    document.getElementById('accessoryTotal').value = '';
    document.getElementById('accessoryModal').classList.add('active');
}
function closeAccessoryModal() { document.getElementById('accessoryModal')?.classList.remove('active'); }

function updateAccessoryPrice() {
    const sel = document.getElementById('accessoryItemSelect');
    const opt = sel.options[sel.selectedIndex];
    const price = opt.getAttribute('data-price');
    if (price) {
        document.getElementById('accessoryUnitPrice').value = price;
        document.getElementById('accessoryItemName').value = opt.value;
    }
    calculateAccessoryTotal();
}

function calculateAccessoryTotal() {
    const q = parseFloat(document.getElementById('accessoryQuantity').value) || 0;
    const p = parseFloat(document.getElementById('accessoryUnitPrice').value) || 0;
    document.getElementById('accessoryTotal').value = (q * p).toFixed(2);
}

async function saveAccessory(e) {
    e.preventDefault();
    if (!checkPermission('add')) return;
    const name = document.getElementById('accessoryItemName').value.trim() || document.getElementById('accessoryItemSelect').value;
    const qty = parseFloat(document.getElementById('accessoryQuantity').value) || 1;
    const price = parseFloat(document.getElementById('accessoryUnitPrice').value) || 0;
    const payment = document.getElementById('accessoryPayment').value;
    const status = document.getElementById('accessoryPaymentStatus').value;
    if (!name || qty <= 0 || price <= 0) { showNotification('Fill required fields', 'warning'); return; }

    const ok = await showConfirm({
        icon: '💾', title: 'Save Accessory Sale',
        message: 'Save this sale?',
        details: { transaction: name, amount: formatPrice(qty * price), status: status.toUpperCase() },
        buttonClass: 'btn-success', buttonText: '<i class="fas fa-check"></i> Save'
    });
    if (!ok) return;

    const tx = {
        category: 'accessories', item: name, quantity: qty, unit_price: price, total: qty * price,
        payment, payment_status: status, carwash_price: 0, detailing_price: 0,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    try {
        let saved = tx;
        if (supabaseClient && isSupabaseConnected) {
            const { data, error } = await supabaseClient.from(TABLE_NAME).insert(tx).select();
            if (error) throw error;
            if (data && data.length) saved = data[0];
        } else saved.id = Date.now();
        transactions.unshift(saved);
        await logAudit('ADD', `Accessory sale: ${name}`, { amount: tx.total });
        closeAccessoryModal();
        applyFilters();
        renderAll();
        renderAccessories();
        showNotification('Sale added', 'success');
    } catch (err) { showNotification('Error: ' + err.message, 'error'); }
}

async function addAccessoryTransaction(name, price) {
    if (!checkPermission('add')) return;
    const ok = await showConfirm({
        icon: '🧴', title: 'Quick Accessory Sale',
        message: `Add "${name}" for ${formatPrice(price)}?`,
        details: { transaction: name, amount: formatPrice(price), status: 'PAID' },
        buttonClass: 'btn-success', buttonText: '<i class="fas fa-plus"></i> Add'
    });
    if (!ok) return;
    const tx = {
        category: 'accessories', item: name, quantity: 1, unit_price: price, total: price,
        payment: 'CASH', payment_status: 'paid', carwash_price: 0, detailing_price: 0,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    try {
        let saved = tx;
        if (supabaseClient && isSupabaseConnected) {
            const { data, error } = await supabaseClient.from(TABLE_NAME).insert(tx).select();
            if (error) throw error;
            if (data && data.length) saved = data[0];
        } else saved.id = Date.now();
        transactions.unshift(saved);
        await logAudit('ADD', `Accessory sale: ${name}`, { amount: price });
        applyFilters();
        renderAll();
        renderAccessories();
        showNotification(`Added ${name}`, 'success');
    } catch (err) { showNotification('Error: ' + err.message, 'error'); }
}

function renderAccessories() {
    const tb = document.getElementById('accessoriesBody');
    if (!tb) return;
    const rows = transactions.filter(t => t.category === 'accessories');
    if (rows.length === 0) { tb.innerHTML = '<tr><td colspan="9" class="empty-state" data-label="">No accessory sales</td></tr>'; return; }
    tb.innerHTML = '';
    rows.slice(0, 100).forEach((row, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="#">${i + 1}</td>
            <td data-label="Date">${new Date(row.created_at).toLocaleDateString()}</td>
            <td data-label="Item">${row.item}</td>
            <td data-label="Qty">${row.quantity}</td>
            <td data-label="Unit Price">${formatPrice(row.unit_price)}</td>
            <td data-label="Total" class="price-col">${formatPrice(row.total)}</td>
            <td data-label="Payment">${row.payment || '—'}</td>
            <td data-label="Status"><span class="badge badge-${row.payment_status}">${(row.payment_status || '').toUpperCase()}</span></td>
            <td data-label="">
                <button class="btn btn-sm btn-info" onclick="quickReceipt(${row.id})"><i class="fas fa-receipt"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteTransaction(${row.id})"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tb.appendChild(tr);
    });
    const total = rows.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('totalAccessoriesSales', formatPrice(total));
    set('totalAccessoriesItems', rows.length);
    set('avgAccessorySale', formatPrice(rows.length ? total / rows.length : 0));
    enhanceTablesForMobile();
}

function filterAccessories() {
    const q = (document.getElementById('accessorySearch')?.value || '').toLowerCase();
    const st = document.getElementById('accessoryStatusFilter')?.value || '';
    let rows = transactions.filter(t => t.category === 'accessories');
    if (q) rows = rows.filter(t => (t.item || '').toLowerCase().includes(q));
    if (st) rows = rows.filter(t => t.payment_status === st);
    const tb = document.getElementById('accessoriesBody');
    if (!tb) return;
    if (rows.length === 0) { tb.innerHTML = '<tr><td colspan="9" class="empty-state" data-label="">No matching accessory sales</td></tr>'; return; }
    tb.innerHTML = '';
    rows.slice(0, 100).forEach((row, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="#">${i + 1}</td>
            <td data-label="Date">${new Date(row.created_at).toLocaleDateString()}</td>
            <td data-label="Item">${row.item}</td>
            <td data-label="Qty">${row.quantity}</td>
            <td data-label="Unit Price">${formatPrice(row.unit_price)}</td>
            <td data-label="Total" class="price-col">${formatPrice(row.total)}</td>
            <td data-label="Payment">${row.payment || '—'}</td>
            <td data-label="Status"><span class="badge badge-${row.payment_status}">${(row.payment_status || '').toUpperCase()}</span></td>
            <td data-label="">
                <button class="btn btn-sm btn-info" onclick="quickReceipt(${row.id})"><i class="fas fa-receipt"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteTransaction(${row.id})"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tb.appendChild(tr);
    });
    const c = document.getElementById('accessoryFilterCount');
    if (c) c.textContent = `${rows.length} items`;
    enhanceTablesForMobile();
}

function refreshAccessories() {
    loadData().then(() => { renderAccessories(); showNotification('Refreshed', 'info'); });
}

// ============================================================
// STORE
// ============================================================
function loadStoreData() {
    try {
        const s = localStorage.getItem('carwash_store_data');
        if (s) Object.assign(storeData, JSON.parse(s));
    } catch (e) { }
    Object.keys(storeData).forEach(k => {
        const input = document.getElementById(k + 'Input');
        if (input) input.value = storeData[k] || '';
    });
    renderStoreTotals();
}

async function updateStoreValue(key, value) {
    const oldVal = storeData[key] || 0;
    const newVal = parseFloat(value) || 0;
    if (oldVal === newVal) return;
    const ok = await showConfirm({
        icon: '📦', title: 'Update Store Value',
        message: `Update "${key}" to ${formatPrice(newVal)}?`,
        details: { transaction: key, amount: formatPrice(newVal), status: 'STORE' },
        buttonClass: 'btn-primary', buttonText: '<i class="fas fa-save"></i> Update'
    });
    if (!ok) {
        const i = document.getElementById(key + 'Input');
        if (i) i.value = oldVal || '';
        return;
    }
    storeData[key] = newVal;
    try { localStorage.setItem('carwash_store_data', JSON.stringify(storeData)); } catch (e) { }
    const s = document.getElementById(key + 'Status');
    if (s) { s.textContent = '✅'; setTimeout(() => s.textContent = '', 1500); }
    renderStoreTotals();
}

function renderStoreTotals() {
    const s = storeData;
    const storeT = (s.cigarettes || 0) + (s.snacks || 0);
    const drinksT = (s.drinksWater || 0) + (s.drinksSoda || 0) + (s.drinksCoffee || 0) + (s.drinksJuice || 0) + (s.drinksEnergy || 0);
    const palutoT = (s.palutoNoodles || 0) + (s.palutoRice || 0) + (s.palutoSoup || 0) + (s.palutoSilog || 0) + (s.palutoAppetizer || 0);
    const otherT = (s.gcashCw || 0) + (s.gcashFoods || 0) + (s.otherSales || 0) - (s.expenses || 0);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('storeCatTotal', formatPrice(storeT));
    set('drinksCatTotal', formatPrice(drinksT));
    set('palutoCatTotal', formatPrice(palutoT));
    set('otherCatTotal', formatPrice(otherT));
    set('storeItemsTotal', formatPrice(storeT));
    set('drinksTotalDisplay', formatPrice(drinksT));
    set('palutoTotalDisplay', formatPrice(palutoT));
    set('otherTotalDisplay', formatPrice(otherT));
    set('storeItemsSummary', formatPrice(storeT));
    set('totalStoreSales', formatPrice(storeT + drinksT + palutoT + otherT));
    set('totalDrinksSummary', formatPrice(drinksT));
    set('totalPalutoSummary', formatPrice(palutoT));
    set('totalOtherSummary', formatPrice(otherT));
}

function refreshStoreData() { loadStoreData(); updateStoreHistory(); showNotification('Refreshed', 'info'); }

function exportStoreData() {
    if (!window.XLSX) { showNotification('XLSX not loaded', 'error'); return; }
    const rows = Object.keys(storeData).map(k => ({ Item: k, Amount: storeData[k] }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Store');
    XLSX.writeFile(wb, `store_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function openStoreItemModal() {
    if (!checkPermission('add')) return;
    document.getElementById('storeItemForm').reset();
    updateStoreItemPrice();
    document.getElementById('storeItemModal').classList.add('active');
}
function closeStoreItemModal() { document.getElementById('storeItemModal')?.classList.remove('active'); }

function updateStoreItemPrice() {
    const cat = document.getElementById('storeItemCategory')?.value;
    const sel = document.getElementById('storeItemSelect');
    if (!sel) return;
    const presets = {
        store: [{ name: 'Cigarettes', price: 12 }, { name: 'Snacks', price: 10 }],
        drinks: [{ name: 'Water', price: 15 }, { name: 'Soft Drinks', price: 15 }, { name: 'Coffee', price: 25 }, { name: 'Juice', price: 20 }, { name: 'Energy Drinks', price: 35 }],
        paluto: [{ name: 'Noodles', price: 30 }, { name: 'Rice Meal', price: 50 }, { name: 'Soup', price: 40 }, { name: 'Silog Meals', price: 60 }, { name: 'Appetizers', price: 45 }],
        other: [{ name: 'Other Sale', price: 0 }, { name: 'GCash CW', price: 0 }, { name: 'GCash Foods', price: 0 }]
    };
    sel.innerHTML = '<option value="">Select item...</option>';
    (presets[cat] || []).forEach(item => {
        const o = document.createElement('option');
        o.value = item.name;
        o.textContent = `${item.name} - ₱${item.price}`;
        o.dataset.price = item.price;
        sel.appendChild(o);
    });
}

function calculateStoreItemTotal() {
    const q = parseFloat(document.getElementById('storeItemQuantity')?.value) || 0;
    const p = parseFloat(document.getElementById('storeItemPrice')?.value) || 0;
    const t = document.getElementById('storeItemTotal');
    if (t) t.value = (q * p).toFixed(2);
}

async function saveStoreItem(e) {
    e.preventDefault();
    if (!checkPermission('add')) return;
    const category = document.getElementById('storeItemCategory').value;
    const custom = document.getElementById('storeItemCustom').value.trim();
    const sel = document.getElementById('storeItemSelect').value;
    const item = custom || sel;
    const qty = parseFloat(document.getElementById('storeItemQuantity').value) || 1;
    const price = parseFloat(document.getElementById('storeItemPrice').value) || 0;
    const payment = document.getElementById('storeItemPayment').value;
    const status = document.getElementById('storeItemPaymentStatus').value;
    if (!item || qty <= 0 || price <= 0 || !category) { showNotification('Fill required fields', 'warning'); return; }

    const ok = await showConfirm({
        icon: '💾', title: 'Save Store Sale',
        message: 'Save this sale?',
        details: { transaction: item, amount: formatPrice(qty * price), status: status.toUpperCase() },
        buttonClass: 'btn-success', buttonText: '<i class="fas fa-check"></i> Save'
    });
    if (!ok) return;

    const tx = {
        category, item, quantity: qty, unit_price: price, total: qty * price,
        payment, payment_status: status, carwash_price: 0, detailing_price: 0,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    try {
        let saved = tx;
        if (supabaseClient && isSupabaseConnected) {
            const { data, error } = await supabaseClient.from(TABLE_NAME).insert(tx).select();
            if (error) throw error;
            if (data && data.length) saved = data[0];
        } else saved.id = Date.now();
        transactions.unshift(saved);
        await logAudit('ADD', `Store sale: ${item}`, { amount: tx.total });
        closeStoreItemModal();
        applyFilters();
        renderAll();
        renderStoreTotals();
        updateStoreHistory();
        showNotification(`Added ${item}`, 'success');
    } catch (err) { showNotification('Error: ' + err.message, 'error'); }
}

async function quickAddStoreItem(category, item, price) {
    if (!checkPermission('add')) return;
    const ok = await showConfirm({
        icon: '⚡', title: 'Quick Store Sale',
        message: `Add "${item}" for ${formatPrice(price)}?`,
        details: { transaction: item, amount: formatPrice(price), status: 'PAID' },
        buttonClass: 'btn-success', buttonText: '<i class="fas fa-plus"></i> Add'
    });
    if (!ok) return;
    const tx = {
        category, item, quantity: 1, unit_price: price, total: price,
        payment: 'CASH', payment_status: 'paid', carwash_price: 0, detailing_price: 0,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    try {
        let saved = tx;
        if (supabaseClient && isSupabaseConnected) {
            const { data, error } = await supabaseClient.from(TABLE_NAME).insert(tx).select();
            if (error) throw error;
            if (data && data.length) saved = data[0];
        } else saved.id = Date.now();
        transactions.unshift(saved);
        await logAudit('ADD', `Quick store sale: ${item}`, { amount: price });
        applyFilters();
        renderAll();
        renderStoreTotals();
        updateStoreHistory();
        showNotification(`Added ${item}`, 'success', 3000);
    } catch (err) { showNotification('Error: ' + err.message, 'error'); }
}

function updateStoreHistory() {
    const tb = document.getElementById('storeHistoryBody');
    if (!tb) return;
    const rows = transactions
        .filter(t => ['store', 'drinks', 'paluto', 'other'].includes(t.category))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 20);
    if (rows.length === 0) { tb.innerHTML = '<tr><td colspan="8" class="empty-state" data-label="">No store transactions yet</td></tr>'; return; }
    tb.innerHTML = '';
    rows.forEach((row, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="#">${i + 1}</td>
            <td data-label="Date">${new Date(row.created_at).toLocaleDateString()}</td>
            <td data-label="Item">${row.item || '—'}</td>
            <td data-label="Qty">${row.quantity || 1}</td>
            <td data-label="Amount" class="price-col">${formatPrice(row.total)}</td>
            <td data-label="Type"><span class="badge badge-${row.category}">${(row.category || '').toUpperCase()}</span></td>
            <td data-label="Status"><span class="badge badge-${row.payment_status}">${(row.payment_status || '').toUpperCase()}</span></td>
            <td data-label=""><button class="btn btn-sm btn-info" onclick="quickReceipt(${row.id})"><i class="fas fa-receipt"></i></button></td>
        `;
        tb.appendChild(tr);
    });
    enhanceTablesForMobile();
}

// ============================================================
// SALARY
// ============================================================
async function loadSalaryData() {
    if (!supabaseClient || !isSupabaseConnected) { salaryData = []; return; }
    try {
        const { data } = await supabaseClient.from(SALARY_TABLE).select('*');
        salaryData = data || [];
    } catch (e) { salaryData = []; }
}

function initializeSalaryDateRange() {
    const n = new Date();
    const f = new Date(n.setDate(n.getDate() - n.getDay()));
    salaryDateRange.fromDate = f.toISOString().slice(0, 10);
    salaryDateRange.toDate = new Date().toISOString().slice(0, 10);
    updateSalaryDateDisplay();
}

function updateSalaryDateRange() {
    const preset = document.getElementById('salaryDatePreset').value;
    salaryDateRange.preset = preset;
    const n = new Date();
    const custom = document.getElementById('salaryCustomDateRange');
    if (preset === 'custom') { if (custom) custom.style.display = 'flex'; return; }
    if (custom) custom.style.display = 'none';
    let from = new Date();
    if (preset === 'today') from = new Date();
    else if (preset === 'this-week') from.setDate(n.getDate() - n.getDay());
    else if (preset === 'last-week') from.setDate(n.getDate() - n.getDay() - 7);
    else if (preset === 'this-month') from = new Date(n.getFullYear(), n.getMonth(), 1);
    else if (preset === 'last-month') from = new Date(n.getFullYear(), n.getMonth() - 1, 1);
    else if (preset === 'all') from = new Date(0);
    salaryDateRange.fromDate = from.toISOString().slice(0, 10);
    salaryDateRange.toDate = new Date().toISOString().slice(0, 10);
    updateSalaryDateDisplay();
    calculateSalaries(true);
}

function applyCustomSalaryDateRange() {
    salaryDateRange.fromDate = document.getElementById('salaryDateFrom').value;
    salaryDateRange.toDate = document.getElementById('salaryDateTo').value;
    updateSalaryDateDisplay();
    calculateSalaries(true);
}

function updateSalaryDateDisplay() {
    const el = document.getElementById('salaryDateRangeDisplay');
    if (el) el.innerHTML = `<i class="fas fa-calendar-alt"></i> <strong>${salaryDateRange.preset}:</strong> ${salaryDateRange.fromDate} → ${salaryDateRange.toDate}`;
}

async function calculateSalaries(silent) {
    if (!silent) {
        const ok = await showConfirm({
            icon: '🧮', title: 'Calculate Salaries',
            message: `Recalculate for ${salaryDateRange.fromDate} → ${salaryDateRange.toDate}?`,
            details: { transaction: 'Salary calc', amount: '—', status: salaryDateRange.preset.toUpperCase() },
            buttonClass: 'btn-primary', buttonText: '<i class="fas fa-calculator"></i> Calculate'
        });
        if (!ok) return;
    }
    const from = new Date(salaryDateRange.fromDate);
    const to = new Date(salaryDateRange.toDate); to.setHours(23, 59, 59);
    const filtered = completedTransactions.filter(t => {
        const d = new Date(t.completed_at || t.created_at);
        return d >= from && d <= to;
    });
    const by = {};
    filtered.forEach(t => {
        const cw = t.carwasher || 'UNASSIGNED';
        if (!by[cw]) by[cw] = { count: 0, earnings: 0 };
        by[cw].count++;
        by[cw].earnings += parseFloat(t.carwash_price || t.total) || 0;
    });
    salaryData = Object.entries(by).map(([name, v], i) => ({
        id: i + 1, carwasher: name, cars_washed: v.count, total_earnings: v.earnings,
        rate: 0.5, salary: v.earnings * 0.5, status: 'pending'
    }));
    renderSalaryTable();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('totalCarwashers', salaryData.length);
    set('totalCarsWashed', salaryData.reduce((s, r) => s + r.cars_washed, 0));
    set('totalSalaryAmount', formatPrice(salaryData.reduce((s, r) => s + r.salary, 0)));
    set('salaryPaidCount', salaryData.filter(r => r.status === 'paid').length);
    set('salaryPendingCount', salaryData.filter(r => r.status !== 'paid').length);
    if (!silent) showNotification('Salaries calculated', 'success');
}

function renderSalaryTable() {
    const tb = document.getElementById('salaryBody');
    if (!tb) return;
    if (salaryData.length === 0) { tb.innerHTML = '<tr><td colspan="8" class="empty-state" data-label="">No salary data</td></tr>'; return; }
    tb.innerHTML = '';
    salaryData.forEach((row, i) => {
        const tr = document.createElement('tr');
        tr.className = 'salary-row-clickable';
        tr.setAttribute('data-carwasher', row.carwasher);
        tr.innerHTML = `
            <td data-label="#">${i + 1}</td>
            <td data-label="Carwasher">
                <strong style="color:var(--primary);cursor:pointer;">
                    <i class="fas fa-user-circle"></i> ${row.carwasher}
                </strong>
                <span style="font-size:0.65rem;color:var(--gray-400);display:block;">
                    Click for job list
                </span>
            </td>
            <td data-label="Cars">${row.cars_washed}</td>
            <td data-label="Earnings" class="price-col">${formatPrice(row.total_earnings)}</td>
            <td data-label="Rate" onclick="event.stopPropagation()">
                <input type="number" class="salary-rate-input" value="${row.rate}" step="0.01" onchange="updateSalaryRate(${i}, this.value)">
            </td>
            <td data-label="Salary" class="price-col">${formatPrice(row.salary)}</td>
            <td data-label="Status"><span class="badge badge-${row.status}">${row.status.toUpperCase()}</span></td>
            <td data-label="" onclick="event.stopPropagation()">
                <button class="btn btn-sm btn-success" onclick="markSalaryPaid(${i})" ${row.status === 'paid' ? 'disabled' : ''}>Mark Paid</button>
                <button class="btn btn-sm btn-info" onclick="viewCarwasherJobs('${row.carwasher.replace(/'/g, "\\'")}')" title="View jobs">
                    <i class="fas fa-list"></i>
                </button>
            </td>
        `;
        tr.onclick = (e) => {
            if (e.target.closest('input, button, select')) return;
            viewCarwasherJobs(row.carwasher);
        };
        tb.appendChild(tr);
    });
    const f = document.getElementById('salaryFooter');
    if (f) f.innerHTML = `<tr class="total-row"><td colspan="5" data-label="">TOTAL</td><td data-label="">${formatPrice(salaryData.reduce((s, r) => s + r.salary, 0))}</td><td colspan="2" data-label=""></td></tr>`;
    enhanceTablesForMobile();
}

function viewCarwasherJobs(carwasherName) {
    const from = new Date(salaryDateRange.fromDate);
    const to = new Date(salaryDateRange.toDate); to.setHours(23, 59, 59);

    const jobs = completedTransactions.filter(t => {
        const d = new Date(t.completed_at || t.created_at);
        if (d < from || d > to) return false;
        return (t.carwasher || 'UNASSIGNED') === carwasherName;
    }).sort((a, b) => new Date(b.completed_at || b.created_at) - new Date(a.completed_at || a.created_at));

    const modal = document.getElementById('carwasherJobsModal');
    if (!modal) return;

    document.getElementById('jobsCarwasherName').textContent = carwasherName;
    document.getElementById('jobsDateRange').textContent = `${salaryDateRange.fromDate} → ${salaryDateRange.toDate}`;
    document.getElementById('jobsCount').textContent = jobs.length;
    document.getElementById('jobsTotal').textContent = formatPrice(
        jobs.reduce((s, t) => s + (parseFloat(t.carwash_price || t.total) || 0), 0)
    );

    const tbody = document.getElementById('jobsBody');
    if (jobs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state" data-label="">No jobs in this date range</td></tr>';
    } else {
        tbody.innerHTML = '';
        jobs.forEach((j, i) => {
            const dur = (j.started_at && j.completed_at)
                ? Math.round((new Date(j.completed_at) - new Date(j.started_at)) / 60000) + ' min'
                : '—';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="#">${i + 1}</td>
                <td data-label="Date">${new Date(j.completed_at || j.created_at).toLocaleDateString()}</td>
                <td data-label="Time">${new Date(j.completed_at || j.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td>
                <td data-label="Car"><strong>${j.car_model || '—'}</strong></td>
                <td data-label="Plate">${j.plate || '—'}</td>
                <td data-label="Services">${j.services || '—'}</td>
                <td data-label="Duration"><span class="badge badge-success">${dur}</span></td>
                <td data-label="Amount" class="price-col">${formatPrice(j.carwash_price || j.total)}</td>
            `;
            tbody.appendChild(tr);
        });
    }
    modal.classList.add('active');
    enhanceTablesForMobile();
}

function closeCarwasherJobsModal() {
    document.getElementById('carwasherJobsModal')?.classList.remove('active');
}

async function updateSalaryRate(i, value) {
    if (!salaryData[i]) return;
    const old = salaryData[i].rate;
    const nv = parseFloat(value) || 0;
    if (old === nv) return;
    const ok = await showConfirm({
        icon: '📝', title: 'Update Rate',
        message: `Change rate for ${salaryData[i].carwasher} from ${old} to ${nv}?`,
        details: { transaction: salaryData[i].carwasher, amount: `${nv * 100}%`, status: 'RATE' },
        buttonClass: 'btn-primary', buttonText: '<i class="fas fa-save"></i> Update'
    });
    if (!ok) { renderSalaryTable(); return; }
    salaryData[i].rate = nv;
    salaryData[i].salary = salaryData[i].total_earnings * nv;
    renderSalaryTable();
    document.getElementById('totalSalaryAmount').textContent = formatPrice(salaryData.reduce((s, r) => s + r.salary, 0));
}

async function markSalaryPaid(i) {
    if (!salaryData[i]) return;
    const ok = await showConfirm({
        icon: '💰', title: 'Mark Paid',
        message: `Mark ${salaryData[i].carwasher} as PAID?`,
        details: { transaction: salaryData[i].carwasher, amount: formatPrice(salaryData[i].salary), status: 'PAID' },
        buttonClass: 'btn-success', buttonText: '<i class="fas fa-check"></i> Mark Paid'
    });
    if (!ok) return;
    salaryData[i].status = 'paid';
    renderSalaryTable();
    document.getElementById('salaryPaidCount').textContent = salaryData.filter(r => r.status === 'paid').length;
    document.getElementById('salaryPendingCount').textContent = salaryData.filter(r => r.status !== 'paid').length;
    logAudit('SALARY_UPDATE', `Salary paid: ${salaryData[i].carwasher}`, { amount: salaryData[i].salary });
}

async function saveSalaries() {
    if (!supabaseClient || !isSupabaseConnected) { showNotification('Offline — nothing to save', 'warning'); return; }
    const ok = await showConfirm({
        icon: '💾', title: 'Save Salaries',
        message: 'Save salary records to database?',
        details: { transaction: `${salaryData.length} records`, amount: formatPrice(salaryData.reduce((s, r) => s + r.salary, 0)), status: 'SAVE' },
        buttonClass: 'btn-success', buttonText: '<i class="fas fa-save"></i> Save'
    });
    if (!ok) return;
    try {
        for (const r of salaryData) {
            await supabaseClient.from(SALARY_TABLE).upsert({
                carwasher: r.carwasher, cars_washed: r.cars_washed,
                total_earnings: r.total_earnings, rate: r.rate, salary: r.salary,
                status: r.status, period_from: salaryDateRange.fromDate, period_to: salaryDateRange.toDate
            }, { onConflict: 'carwasher,period_from,period_to' });
        }
        showNotification('Salaries saved', 'success');
    } catch (err) { showNotification('Failed: ' + err.message, 'error'); }
}

function exportSalaries() {
    if (!window.XLSX) { showNotification('XLSX not loaded', 'error'); return; }
    const ws = XLSX.utils.json_to_sheet(salaryData.map(r => ({
        Carwasher: r.carwasher, Cars: r.cars_washed, Earnings: r.total_earnings,
        Rate: r.rate, Salary: r.salary, Status: r.status
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Salaries');
    XLSX.writeFile(wb, `salaries_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ============================================================
// REPORTS
// ============================================================
function generateReport(type) {
    const custom = document.getElementById('customDateRange');
    if (type === 'custom') { if (custom) custom.style.display = 'block'; return; }
    if (custom) custom.style.display = 'none';
    const now = new Date();
    let from, to = now;
    if (type === 'daily') from = new Date(now.setHours(0, 0, 0, 0));
    else if (type === 'weekly') from = new Date(now.setDate(now.getDate() - 7));
    else if (type === 'monthly') from = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (type === 'yearly') from = new Date(now.getFullYear(), 0, 1);
    renderReport(from, to);
}

function generateCustomReport() {
    const from = new Date(document.getElementById('reportDateFrom').value);
    const to = new Date(document.getElementById('reportDateTo').value); to.setHours(23, 59, 59);
    renderReport(from, to);
}

function renderReport(from, to) {
    reportData = transactions.filter(t => {
        const d = new Date(t.created_at);
        return d >= from && d <= to;
    });
    const tb = document.getElementById('reportBody');
    if (!tb) return;
    if (reportData.length === 0) { tb.innerHTML = '<tr><td colspan="6" class="empty-state" data-label="">No records</td></tr>'; return; }
    tb.innerHTML = '';
    reportData.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="Date">${new Date(row.created_at).toLocaleDateString()}</td>
            <td data-label="Category">${(row.category || '').toUpperCase()}</td>
            <td data-label="Item">${row.item || row.car_model || '—'}</td>
            <td data-label="Amount" class="price-col">${formatPrice(row.total)}</td>
            <td data-label="Payment">${row.payment || '—'}</td>
            <td data-label="Status"><span class="badge badge-${row.payment_status}">${(row.payment_status || '').toUpperCase()}</span></td>
        `;
        tb.appendChild(tr);
    });
    const total = reportData.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
    const f = document.getElementById('reportFooter');
    if (f) f.innerHTML = `<tr class="total-row"><td colspan="3" data-label="">TOTAL (${reportData.length})</td><td data-label="">${formatPrice(total)}</td><td colspan="2" data-label=""></td></tr>`;
    const sum = document.getElementById('reportSummary');
    if (sum) {
        const by = {};
        reportData.forEach(r => { by[r.category] = (by[r.category] || 0) + (parseFloat(r.total) || 0); });
        sum.innerHTML = `<div class="report-summary-item"><div class="label">Total</div><div class="value">${formatPrice(total)}</div></div>` +
            Object.entries(by).map(([c, v]) => `<div class="report-summary-item"><div class="label">${c}</div><div class="value">${formatPrice(v)}</div></div>`).join('');
    }
    enhanceTablesForMobile();
}

// ============================================================
// MULTI-CATEGORY REPORTS
// ============================================================
let reportState = {
    preset: 'daily',
    from: null,
    to: null,
    categories: ['carwash', 'store', 'accessories', 'drinks', 'paluto', 'other'],
    results: {}  // { carwash: [...rows], store: [...rows], ... }
};

const REPORT_CATEGORY_META = {
    carwash:     { label: 'Carwash',     icon: '🚘', color: '#2563eb' },
    store:       { label: 'Store',       icon: '🏪', color: '#16a34a' },
    accessories: { label: 'Accessories', icon: '🧴', color: '#f59e0b' },
    drinks:      { label: 'Drinks',      icon: '🥤', color: '#0ea5e9' },
    paluto:      { label: 'Paluto',      icon: '🍜', color: '#7c3aed' },
    other:       { label: 'Other',       icon: '💰', color: '#dc2626' }
};

function setReportPreset(preset) {
    reportState.preset = preset;
    document.querySelectorAll('.report-preset-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.preset === preset);
        btn.classList.toggle('btn-primary', btn.dataset.preset === preset);
        btn.classList.toggle('btn-outline', btn.dataset.preset !== preset);
    });

    const custom = document.getElementById('customDateRange');
    if (preset === 'custom') {
        if (custom) custom.style.display = 'block';
        return;
    }
    if (custom) custom.style.display = 'none';

    const now = new Date();
    let from, to = new Date(now);
    to.setHours(23, 59, 59, 999);

    if (preset === 'daily') {
        from = new Date(now); from.setHours(0, 0, 0, 0);
    } else if (preset === 'weekly') {
        from = new Date(now); from.setDate(now.getDate() - 7); from.setHours(0, 0, 0, 0);
    } else if (preset === 'monthly') {
        from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (preset === 'yearly') {
        from = new Date(now.getFullYear(), 0, 1);
    }

    reportState.from = from;
    reportState.to = to;

    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);
    const fromInput = document.getElementById('reportDateFrom');
    const toInput = document.getElementById('reportDateTo');
    if (fromInput) fromInput.value = fromStr;
    if (toInput) toInput.value = toStr;

    updateReportPeriodDisplay();
    generateMultiReports();
}

function updateReportPeriodDisplay() {
    const el = document.getElementById('reportPeriodDisplay');
    if (!el) return;
    const from = reportState.from, to = reportState.to;
    if (!from || !to) { el.innerHTML = '<i class="fas fa-clock"></i> <span>Select period</span>'; return; }
    const fLabel = from.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const tLabel = to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const days = Math.round((to - from) / (1000 * 60 * 60 * 24));
    el.innerHTML = `<i class="fas fa-clock"></i> <span><strong>${fLabel}</strong> → <strong>${tLabel}</strong> · ${days + 1} day${days !== 0 ? 's' : ''}</span>`;
    const rtb = document.getElementById('rtbPeriod');
    if (rtb) rtb.textContent = `${from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → ${to.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function selectAllCategories(checked) {
    document.querySelectorAll('.rcs-checkbox').forEach(cb => { cb.checked = checked; });
}

function getSelectedCategories() {
    const checked = [];
    document.querySelectorAll('.rcs-checkbox').forEach(cb => {
        if (cb.checked) checked.push(cb.value);
    });
    return checked;
}

function generateMultiReports() {
    // For custom preset, read dates from inputs
    if (reportState.preset === 'custom') {
        const fromVal = document.getElementById('reportDateFrom')?.value;
        const toVal = document.getElementById('reportDateTo')?.value;
        if (!fromVal || !toVal) {
            showNotification('Please select both From and To dates', 'warning');
            return;
        }
        reportState.from = new Date(fromVal + 'T00:00:00');
        reportState.to = new Date(toVal + 'T23:59:59');
        if (reportState.from > reportState.to) {
            showNotification('"From" date must be before "To" date', 'warning');
            return;
        }
        updateReportPeriodDisplay();
    }

    const selected = getSelectedCategories();
    reportState.categories = selected;

    if (selected.length === 0) {
        showNotification('Select at least one category', 'warning');
        return;
    }

    const from = reportState.from;
    const to = reportState.to;
    if (!from || !to) { showNotification('Select a period first', 'warning'); return; }

    // Filter transactions by date AND selected categories
    const inRange = transactions.filter(t => {
        const d = new Date(t.created_at);
        return d >= from && d <= to;
    });

    reportState.results = {};
    selected.forEach(cat => {
        reportState.results[cat] = inRange
            .filter(t => t.category === cat)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    });

    renderMultiReports();
}

function renderMultiReports() {
    const container = document.getElementById('reportResults');
    const totalsBar = document.getElementById('reportTotalsBar');
    if (!container) return;

    const categories = Object.keys(reportState.results);
    if (categories.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding:2rem;">No reports generated yet. Select categories and click Generate.</div>';
        if (totalsBar) totalsBar.style.display = 'none';
        return;
    }

    // Grand totals
    let grandTotal = 0;
    let grandTxCount = 0;
    categories.forEach(cat => {
        const rows = reportState.results[cat] || [];
        grandTxCount += rows.length;
        grandTotal += rows.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
    });

    // Totals bar
    if (totalsBar) {
        totalsBar.style.display = 'grid';
        document.getElementById('rtbGrand').textContent = formatPrice(grandTotal);
        document.getElementById('rtbTxCount').textContent = grandTxCount;
        document.getElementById('rtbCategories').textContent = categories.length;
    }

    // Build result cards
    container.innerHTML = '';
    categories.forEach(cat => {
        const meta = REPORT_CATEGORY_META[cat] || { label: cat, icon: '📦', color: '#64748b' };
        const rows = reportState.results[cat] || [];
        const catTotal = rows.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
        const paidCount = rows.filter(r => r.payment_status === 'paid').length;
        const unpaidCount = rows.filter(r => r.payment_status === 'unpaid').length;
        const partialCount = rows.filter(r => r.payment_status === 'partial').length;
        const itemCount = rows.reduce((s, r) => s + (parseFloat(r.quantity) || 1), 0);

        const card = document.createElement('div');
        card.className = 'report-category-card';
        card.style.setProperty('--rc-color', meta.color);

        card.innerHTML = `
            <div class="rcc-header">
                <div class="rcc-title-group">
                    <span class="rcc-icon">${meta.icon}</span>
                    <div>
                        <div class="rcc-title">${meta.label}</div>
                        <div class="rcc-count">${rows.length} transaction${rows.length !== 1 ? 's' : ''}</div>
                    </div>
                </div>
                <div class="rcc-total">${formatPrice(catTotal)}</div>
            </div>

            <div class="rcc-stats">
                <div class="rcc-stat"><span class="rcc-stat-label">Items</span><span class="rcc-stat-value">${itemCount}</span></div>
                <div class="rcc-stat"><span class="rcc-stat-label">Paid</span><span class="rcc-stat-value text-success">${paidCount}</span></div>
                <div class="rcc-stat"><span class="rcc-stat-label">Unpaid</span><span class="rcc-stat-value text-danger">${unpaidCount}</span></div>
                <div class="rcc-stat"><span class="rcc-stat-label">Partial</span><span class="rcc-stat-value text-warning">${partialCount}</span></div>
            </div>

            <div class="rcc-body">
                ${rows.length === 0
                    ? '<div class="rcc-empty">No transactions in this period</div>'
                    : `<div class="table-wrap">
                        <table class="rcc-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Date</th>
                                    <th>Item</th>
                                    ${cat === 'carwash' ? '<th>Carwasher</th>' : ''}
                                    <th>Qty</th>
                                    <th>Total</th>
                                    <th>Payment</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows.slice(0, 50).map((r, i) => `
                                    <tr>
                                        <td data-label="#">${i + 1}</td>
                                        <td data-label="Date">${new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                                        <td data-label="Item">${r.item || r.car_model || '—'}</td>
                                        ${cat === 'carwash' ? `<td data-label="Carwasher">${r.carwasher || '—'}</td>` : ''}
                                        <td data-label="Qty">${r.quantity || 1}</td>
                                        <td data-label="Total" class="price-col">${formatPrice(r.total)}</td>
                                        <td data-label="Payment">${r.payment || '—'}</td>
                                        <td data-label="Status"><span class="badge badge-${r.payment_status}">${(r.payment_status || '').toUpperCase()}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            <tfoot>
                                <tr class="total-row">
                                    <td colspan="${cat === 'carwash' ? 4 : 3}" data-label="">TOTAL (${rows.length})</td>
                                    <td data-label="">${itemCount}</td>
                                    <td data-label="">${formatPrice(catTotal)}</td>
                                    <td colspan="2" data-label=""></td>
                                </tr>
                            </tfoot>
                        </table>
                        ${rows.length > 50 ? `<div class="rcc-more">Showing 50 of ${rows.length} · Export to see all</div>` : ''}
                    </div>`
                }
            </div>

            <div class="rcc-actions">
                <button class="btn btn-sm btn-outline" onclick="exportCategoryExcel('${cat}')">
                    <i class="fas fa-file-excel"></i> Excel
                </button>
                <button class="btn btn-sm btn-outline" onclick="exportCategoryCSV('${cat}')">
                    <i class="fas fa-file-csv"></i> CSV
                </button>
                <button class="btn btn-sm btn-outline" onclick="printCategoryReport('${cat}')">
                    <i class="fas fa-print"></i> Print
                </button>
            </div>
        `;
        container.appendChild(card);
    });
    enhanceTablesForMobile();
}

// ============================================================
// EXPORT: SINGLE CATEGORY
// ============================================================
function getReportRowsForExport(cat) {
    const rows = reportState.results[cat] || [];
    return rows.map(r => ({
        ID: r.id,
        Date: new Date(r.created_at).toLocaleString(),
        Category: (r.category || '').toUpperCase(),
        Item: r.item || r.car_model || '',
        Carwasher: r.carwasher || '',
        Quantity: r.quantity || 1,
        UnitPrice: r.unit_price || r.total,
        Total: r.total,
        Payment: r.payment || '',
        Status: (r.payment_status || '').toUpperCase(),
        AmountPaid: r.amount_paid || '',
        PaymentNote: r.payment_note || ''
    }));
}

function exportCategoryExcel(cat) {
    if (!window.XLSX) { showNotification('XLSX not loaded', 'error'); return; }
    const rows = getReportRowsForExport(cat);
    if (rows.length === 0) { showNotification('No data to export', 'warning'); return; }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, cat);
    const from = reportState.from.toISOString().slice(0, 10);
    const to = reportState.to.toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${cat}_report_${from}_to_${to}.xlsx`);
    showNotification(`${cat} report exported`, 'success');
}

function exportCategoryCSV(cat) {
    const rows = getReportRowsForExport(cat);
    if (rows.length === 0) { showNotification('No data to export', 'warning'); return; }
    const headers = Object.keys(rows[0]);
    const csv = [
        headers.join(','),
        ...rows.map(r => headers.map(h => {
            const v = r[h] ?? '';
            const s = String(v).replace(/"/g, '""');
            return /[",\n]/.test(s) ? `"${s}"` : s;
        }).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cat}_report_${reportState.from.toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification(`${cat} CSV exported`, 'success');
}

function printCategoryReport(cat) {
    const meta = REPORT_CATEGORY_META[cat];
    const rows = reportState.results[cat] || [];
    const catTotal = rows.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);

    const html = `
        <html><head><title>${meta.label} Report</title>
        <style>
            body { font-family: sans-serif; padding: 20px; color: #1e293b; }
            h1 { font-size: 22px; margin-bottom: 4px; }
            .sub { color: #64748b; font-size: 12px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { background: #f1f5f9; padding: 8px 6px; text-align: left; border-bottom: 2px solid #cbd5e1; }
            td { padding: 6px; border-bottom: 1px solid #e2e8f0; }
            tfoot td { background: #f1f5f9; font-weight: bold; border-top: 2px solid #cbd5e1; }
            .price { text-align: right; font-weight: 600; }
        </style></head><body>
        <h1>${meta.icon} ${meta.label} Report</h1>
        <div class="sub">${reportState.from.toLocaleDateString()} — ${reportState.to.toLocaleDateString()} · ${rows.length} transactions · Total: ${formatPrice(catTotal)}</div>
        <table>
            <thead><tr>
                <th>#</th><th>Date</th><th>Item</th>
                ${cat === 'carwash' ? '<th>Carwasher</th>' : ''}
                <th>Qty</th><th class="price">Total</th><th>Payment</th><th>Status</th>
            </tr></thead>
            <tbody>
                ${rows.map((r, i) => `<tr>
                    <td>${i + 1}</td>
                    <td>${new Date(r.created_at).toLocaleDateString()}</td>
                    <td>${r.item || r.car_model || '—'}</td>
                    ${cat === 'carwash' ? `<td>${r.carwasher || '—'}</td>` : ''}
                    <td>${r.quantity || 1}</td>
                    <td class="price">${formatPrice(r.total)}</td>
                    <td>${r.payment || '—'}</td>
                    <td>${(r.payment_status || '').toUpperCase()}</td>
                </tr>`).join('')}
            </tbody>
            <tfoot><tr>
                <td colspan="${cat === 'carwash' ? 4 : 3}">TOTAL</td>
                <td>${rows.reduce((s, r) => s + (parseFloat(r.quantity) || 1), 0)}</td>
                <td class="price">${formatPrice(catTotal)}</td>
                <td colspan="2"></td>
            </tr></tfoot>
        </table>
        </body></html>
    `;
    const w = window.open('', '_blank', 'width=900,height=700');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 300);
}

// ============================================================
// EXPORT: ALL CATEGORIES (multi-sheet Excel)
// ============================================================
function exportAllReportsExcel() {
    if (!window.XLSX) { showNotification('XLSX not loaded', 'error'); return; }
    const categories = Object.keys(reportState.results);
    if (categories.length === 0) {
        showNotification('Generate reports first', 'warning');
        return;
    }

    const wb = XLSX.utils.book_new();
    let grandTotal = 0;
    let grandTxCount = 0;
    const summaryRows = [];

    categories.forEach(cat => {
        const rows = getReportRowsForExport(cat);
        const catTotal = rows.reduce((s, r) => s + (parseFloat(r.Total) || 0), 0);
        grandTotal += catTotal;
        grandTxCount += rows.length;

        // Summary row
        summaryRows.push({
            Category: REPORT_CATEGORY_META[cat]?.label || cat,
            Transactions: rows.length,
            Total: catTotal
        });

        // Category sheet
        if (rows.length > 0) {
            const ws = XLSX.utils.json_to_sheet(rows);
            // Sheet name max 31 chars, no special chars
            let sheetName = (REPORT_CATEGORY_META[cat]?.label || cat).replace(/[\/\\?*\[\]:]/g, '');
            if (sheetName.length > 31) sheetName = sheetName.slice(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }
    });

    // Summary sheet first
    summaryRows.push({ Category: 'GRAND TOTAL', Transactions: grandTxCount, Total: grandTotal });
    const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
    // Insert as first sheet
    wb.SheetNames.unshift('Summary');
    wb.Sheets['Summary'] = summaryWs;

    const from = reportState.from.toISOString().slice(0, 10);
    const to = reportState.to.toISOString().slice(0, 10);
    XLSX.writeFile(wb, `all_reports_${from}_to_${to}.xlsx`);
    showNotification(`Exported ${categories.length} category report(s)`, 'success');
}

// ============================================================
// EXPORT: ALL CATEGORIES (PDF)
// ============================================================
function exportAllReportsPDF() {
    if (!window.jspdf) { showNotification('PDF library not loaded', 'error'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const categories = Object.keys(reportState.results);
    if (categories.length === 0) { showNotification('Generate reports first', 'warning'); return; }

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    let y = 20;

    // Cover
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59);
    doc.text('Sales Report', 14, y);
    y += 8;
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text(
        `${reportState.from.toLocaleDateString()} — ${reportState.to.toLocaleDateString()}`,
        14, y
    );
    y += 6;
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y);
    y += 10;

    // Summary
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text('Summary', 14, y);
    y += 4;

    const summaryBody = [];
    let grandTotal = 0;
    let grandTx = 0;
    categories.forEach(cat => {
        const rows = reportState.results[cat] || [];
        const catTotal = rows.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
        grandTotal += catTotal;
        grandTx += rows.length;
        summaryBody.push([
            REPORT_CATEGORY_META[cat]?.label || cat,
            rows.length.toString(),
            formatPrice(catTotal)
        ]);
    });
    summaryBody.push([{ content: 'GRAND TOTAL', styles: { fontStyle: 'bold' } },
                      { content: grandTx.toString(), styles: { fontStyle: 'bold' } },
                      { content: formatPrice(grandTotal), styles: { fontStyle: 'bold' } }]);

    doc.autoTable({
        startY: y,
        head: [['Category', 'Transactions', 'Total']],
        body: summaryBody,
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235] },
        styles: { fontSize: 9 },
        margin: { left: 14, right: 14 }
    });

    // Per-category pages
    categories.forEach(cat => {
        const rows = reportState.results[cat] || [];
        const meta = REPORT_CATEGORY_META[cat];
        doc.addPage();
        y = 20;
        doc.setFontSize(16);
        doc.setTextColor(30, 41, 59);
        doc.text(`${meta.icon.replace(/[^\w\s]/g, '')} ${meta.label} Report`, 14, y);
        y += 5;
        const catTotal = rows.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(`${rows.length} transactions · Total: ${formatPrice(catTotal)}`, 14, y);
        y += 4;

        if (rows.length === 0) {
            doc.text('No transactions in this period.', 14, y + 5);
            return;
        }

        const body = rows.map((r, i) => [
            (i + 1).toString(),
            new Date(r.created_at).toLocaleDateString(),
            (r.item || r.car_model || '—').substring(0, 30),
            (r.quantity || 1).toString(),
            formatPrice(r.total),
            r.payment || '—',
            (r.payment_status || '').toUpperCase()
        ]);

        doc.autoTable({
            startY: y + 2,
            head: [['#', 'Date', 'Item', 'Qty', 'Total', 'Payment', 'Status']],
            body: body,
            theme: 'striped',
            headStyles: { fillColor: [37, 99, 235] },
            styles: { fontSize: 8 },
            columnStyles: { 4: { halign: 'right' } },
            margin: { left: 14, right: 14 }
        });
    });

    // Page numbers
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
            `Page ${i} of ${totalPages}`,
            pageW - 14, pageH - 8, { align: 'right' }
        );
    }

    const from = reportState.from.toISOString().slice(0, 10);
    const to = reportState.to.toISOString().slice(0, 10);
    doc.save(`all_reports_${from}_to_${to}.pdf`);
    showNotification('PDF exported', 'success');
}

// ============================================================
// PRINT: ALL REPORTS
// ============================================================
function printAllReports() {
    const categories = Object.keys(reportState.results);
    if (categories.length === 0) { showNotification('Generate reports first', 'warning'); return; }

    let html = `
        <html><head><title>All Reports</title>
        <style>
            body { font-family: sans-serif; padding: 20px; color: #1e293b; }
            h1 { font-size: 24px; margin-bottom: 4px; }
            h2 { font-size: 16px; margin-top: 24px; padding-bottom: 4px; border-bottom: 2px solid #e2e8f0; }
            .sub { color: #64748b; font-size: 12px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 6px; }
            th { background: #f1f5f9; padding: 6px 4px; text-align: left; border-bottom: 2px solid #cbd5e1; }
            td { padding: 4px; border-bottom: 1px solid #e2e8f0; }
            tfoot td { background: #f1f5f9; font-weight: bold; }
            .price { text-align: right; font-weight: 600; }
            .summary-table td, .summary-table th { font-size: 11px; }
            .page-break { page-break-after: always; }
        </style></head><body>
        <h1>All Sales Reports</h1>
        <div class="sub">${reportState.from.toLocaleDateString()} — ${reportState.to.toLocaleDateString()} · Generated ${new Date().toLocaleString()}</div>

        <h2>Summary</h2>
        <table class="summary-table">
            <thead><tr><th>Category</th><th>Transactions</th><th class="price">Total</th></tr></thead>
            <tbody>
    `;

    let grandTotal = 0;
    let grandTx = 0;
    categories.forEach(cat => {
        const rows = reportState.results[cat] || [];
        const catTotal = rows.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
        grandTotal += catTotal;
        grandTx += rows.length;
        const meta = REPORT_CATEGORY_META[cat];
        html += `<tr><td>${meta.label}</td><td>${rows.length}</td><td class="price">${formatPrice(catTotal)}</td></tr>`;
    });
    html += `<tr style="font-weight:bold;background:#f1f5f9;"><td>GRAND TOTAL</td><td>${grandTx}</td><td class="price">${formatPrice(grandTotal)}</td></tr>`;
    html += `</tbody></table>`;

    // Per-category
    categories.forEach(cat => {
        const rows = reportState.results[cat] || [];
        const meta = REPORT_CATEGORY_META[cat];
        const catTotal = rows.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
        html += `
            <div class="page-break"></div>
            <h2>${meta.label} — ${rows.length} transactions · Total: ${formatPrice(catTotal)}</h2>
            <table>
                <thead><tr><th>#</th><th>Date</th><th>Item</th>${cat === 'carwash' ? '<th>Carwasher</th>' : ''}<th>Qty</th><th class="price">Total</th><th>Status</th></tr></thead>
                <tbody>
                    ${rows.length === 0
                        ? '<tr><td colspan="7" style="text-align:center;color:#94a3b8;">No transactions</td></tr>'
                        : rows.map((r, i) => `<tr>
                            <td>${i + 1}</td>
                            <td>${new Date(r.created_at).toLocaleDateString()}</td>
                            <td>${r.item || r.car_model || '—'}</td>
                            ${cat === 'carwash' ? `<td>${r.carwasher || '—'}</td>` : ''}
                            <td>${r.quantity || 1}</td>
                            <td class="price">${formatPrice(r.total)}</td>
                            <td>${(r.payment_status || '').toUpperCase()}</td>
                        </tr>`).join('')
                    }
                </tbody>
            </table>
        `;
    });

    html += '</body></html>';

    const w = window.open('', '_blank', 'width=900,height=700');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
}


function exportReportExcel() {
    if (!window.XLSX) { showNotification('XLSX not loaded', 'error'); return; }
    const ws = XLSX.utils.json_to_sheet(reportData.map(r => ({
        Date: r.created_at, Category: r.category, Item: r.item || r.car_model,
        Amount: r.total, Payment: r.payment, Status: r.payment_status
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `report_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function exportReportPDF() {
    if (!window.jspdf) { showNotification('PDF library not loaded', 'error'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text('Sales Report', 14, 20);
    if (window.jspdf.plugins?.autotable) {
        const rows = reportData.map(r => [new Date(r.created_at).toLocaleDateString(), r.category, r.item || r.car_model, formatPrice(r.total), r.payment, r.payment_status]);
        doc.autoTable({ head: [['Date', 'Category', 'Item', 'Amount', 'Payment', 'Status']], body: rows, startY: 30 });
    }
    doc.save(`report_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ============================================================
// PRICES
// ============================================================
async function loadServicePrices() {
    try {
        if (supabaseClient && isSupabaseConnected) {
            const { data, error } = await supabaseClient.from(SERVICE_PRICES_TABLE).select('*').order('service_category');
            if (!error && data && data.length > 0) {
                servicePrices = data;
                renderPriceSettings();
                populateServiceDropdowns();
                return;
            }
        }
    } catch (e) { }
    servicePrices = getStaticServicePrices();
    renderPriceSettings();
    populateServiceDropdowns();
}

function renderPriceSettings() {
    const c = document.getElementById('priceSettingsContainer');
    if (!c) return;
    const count = document.getElementById('priceCount');
    if (count) count.textContent = servicePrices.length;
    const grouped = {};
    servicePrices.forEach((s, i) => {
        if (!grouped[s.service_category]) grouped[s.service_category] = [];
        grouped[s.service_category].push({ ...s, _idx: i });
    });
    c.innerHTML = Object.entries(grouped).map(([cat, items]) => `
        <div class="price-category">
            <div class="price-category-header">${cat} <span class="count">${items.length}</span></div>
            <div class="price-table-wrap">
                <table class="price-table">
                    <thead><tr><th>Service</th><th>Size</th><th>Price</th></tr></thead>
                    <tbody>
                        ${items.map(it => `<tr>
                            <td data-label="Service">${it.service_name}</td>
                            <td data-label="Size">${it.size_category}</td>
                            <td data-label="Price"><input type="number" class="price-input" data-idx="${it._idx}" value="${it.price}" onchange="markPriceChanged(${it._idx}, this.value)"></td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `).join('');
}

function markPriceChanged(i, v) {
    servicePrices[i].price = parseFloat(v) || 0;
    changedPrices.add(i);
    const input = document.querySelector(`.price-input[data-idx="${i}"]`);
    if (input) input.classList.add('changed');
}

async function saveAllPrices() {
    if (changedPrices.size === 0) { showNotification('No changes', 'info'); return; }
    const ok = await showConfirm({
        icon: '💾', title: 'Save Price Changes',
        message: `Save ${changedPrices.size} price change(s)?`,
        details: { transaction: `${changedPrices.size} prices`, amount: '—', status: 'SAVE' },
        buttonClass: 'btn-success', buttonText: '<i class="fas fa-save"></i> Save'
    });
    if (!ok) return;
    try {
        for (const i of changedPrices) {
            const p = servicePrices[i];
            if (supabaseClient && isSupabaseConnected) {
                await supabaseClient.from(SERVICE_PRICES_TABLE).upsert({
                    service_category: p.service_category, service_name: p.service_name,
                    size_category: p.size_category, price: p.price
                }, { onConflict: 'service_name,size_category' });
            }
        }
        const n = changedPrices.size;
        changedPrices.clear();
        document.querySelectorAll('.price-input').forEach(i => { i.classList.remove('changed'); i.classList.add('saved'); });
        await logAudit('PRICE_UPDATE', 'Prices updated', { count: n });
        showNotification('Prices saved', 'success');
        populateServiceDropdowns();
    } catch (err) { showNotification('Failed: ' + err.message, 'error'); }
}

function openAddServiceModal() {
    document.getElementById('addServiceForm').reset();
    document.getElementById('newServiceCategoryCustom').style.display = 'none';
    document.getElementById('addServiceModal').classList.add('active');
}
function closeAddServiceModal() { document.getElementById('addServiceModal')?.classList.remove('active'); }
function handleCategoryChange() {
    const cat = document.getElementById('newServiceCategory').value;
    const custom = document.getElementById('newServiceCategoryCustom');
    if (custom) custom.style.display = cat === 'Other' ? 'block' : 'none';
}

async function saveNewService(e) {
    e.preventDefault();
    let category = document.getElementById('newServiceCategory').value;
    if (category === 'Other') category = document.getElementById('newServiceCategoryCustom').value.trim() || 'Other';
    const name = document.getElementById('newServiceName').value.trim();
    const size = document.getElementById('newServiceSize').value;
    const price = parseFloat(document.getElementById('newServicePrice').value);
    const allSizes = document.getElementById('addMultipleSizes').checked;
    if (!category || !name || !size || isNaN(price)) { showNotification('Fill all fields', 'warning'); return; }
    const ok = await showConfirm({
        icon: '💾', title: 'Add Service',
        message: `Add "${name}" ${allSizes ? '(all sizes)' : `(${size})`} for ${formatPrice(price)}?`,
        details: { transaction: name, amount: formatPrice(price), status: category.toUpperCase() },
        buttonClass: 'btn-success', buttonText: '<i class="fas fa-check"></i> Add'
    });
    if (!ok) return;
    const sizes = allSizes ? ['Small', 'Medium', 'Large', 'XLarge', 'XXLarge'] : [size];
    for (const s of sizes) {
        const entry = { service_category: category, service_name: name, size_category: s, price };
        servicePrices.push(entry);
        if (supabaseClient && isSupabaseConnected) {
            try { await supabaseClient.from(SERVICE_PRICES_TABLE).insert(entry); } catch (e) { console.warn(e); }
        }
    }
    closeAddServiceModal();
    renderPriceSettings();
    populateServiceDropdowns();
    showNotification('Service added', 'success');
}

// ============================================================
// AUDIT
// ============================================================
async function loadAuditLogs() {
    try {
        if (supabaseClient && isSupabaseConnected) {
            const { data } = await supabaseClient.from(AUDIT_TABLE).select('*').order('created_at', { ascending: false }).limit(500);
            if (data) auditLogs = data;
        } else {
            const s = localStorage.getItem('carwash_audit');
            auditLogs = s ? JSON.parse(s) : [];
        }
    } catch (e) { auditLogs = []; }
    filteredAuditLogs = [...auditLogs];
    renderAuditLogs();
}

async function logAudit(action, description, details) {
    const entry = {
        action, description, details: details || {},
        username: currentUser?.username || 'system',
        user_name: currentUser?.name || 'System',
        created_at: new Date().toISOString()
    };
    auditLogs.unshift(entry);
    try { localStorage.setItem('carwash_audit', JSON.stringify(auditLogs.slice(0, 500))); } catch (e) { }
    if (supabaseClient && isSupabaseConnected) {
        try { await supabaseClient.from(AUDIT_TABLE).insert(entry); } catch (e) { console.warn(e); }
    }
    updateAuditBadge();
    renderAuditLogs();
}

function renderAuditLogs() {
    const tb = document.getElementById('auditBody');
    if (!tb) return;
    if (filteredAuditLogs.length === 0) { tb.innerHTML = '<tr><td colspan="6" class="empty-state" data-label="">No audit logs</td></tr>'; return; }
    tb.innerHTML = '';
    filteredAuditLogs.slice(0, 100).forEach((row, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="#">${i + 1}</td>
            <td data-label="Date">${new Date(row.created_at).toLocaleString()}</td>
            <td data-label="Action"><span class="badge badge-${(row.action || '').toLowerCase()}">${row.action}</span></td>
            <td data-label="User">${row.user_name || row.username || '—'}</td>
            <td data-label="Description">${row.description || '—'}</td>
            <td data-label="Details">${JSON.stringify(row.details || {})}</td>
        `;
        tb.appendChild(tr);
    });
    enhanceTablesForMobile();
}

function updateAuditBadge() {
    const el = document.getElementById('auditBadge');
    if (el) el.textContent = auditLogs.length;
}

function filterAudit() {
    const q = (document.getElementById('auditSearch')?.value || '').toLowerCase();
    const a = document.getElementById('auditActionFilter')?.value || '';
    filteredAuditLogs = auditLogs.filter(r => {
        if (a && r.action !== a) return false;
        if (q && ![r.description, r.user_name, r.username, JSON.stringify(r.details || {})].join(' ').toLowerCase().includes(q)) return false;
        return true;
    });
    renderAuditLogs();
}

function refreshAudit() { loadAuditLogs().then(() => showNotification('Refreshed', 'info')); }
function exportAuditLogs() { exportRows(auditLogs, 'audit_logs'); }
function closeAuditDetail() { document.getElementById('auditDetailModal')?.classList.remove('active'); }

// ============================================================
// BACKUP
// ============================================================
function loadBackupHistory() {
    try {
        const s = localStorage.getItem(BACKUP_HISTORY_KEY);
        backupHistory = s ? JSON.parse(s) : [];
    } catch (e) { backupHistory = []; }
}

async function createBackup() {
    const ok = await showConfirm({
        icon: '💾', title: 'Create Backup',
        message: 'Download full backup?',
        details: { transaction: `${transactions.length} transactions`, amount: '—', status: 'BACKUP' },
        buttonClass: 'btn-primary', buttonText: '<i class="fas fa-database"></i> Backup'
    });
    if (!ok) return;
    const payload = {
        timestamp: new Date().toISOString(),
        transactions, servicePrices, storeData, salaryData, auditLogs
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carwash_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    backupHistory.unshift({ timestamp: new Date().toISOString(), size: json.length });
    try { localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(backupHistory.slice(0, 10))); } catch (e) { }
    renderBackupHistory();
    await logAudit('BACKUP', 'Backup created', { size: json.length });
    showNotification('Backup downloaded', 'success');
}

async function restoreFromBackup() {
    const input = document.getElementById('restoreFileInput');
    if (!input || !input.files[0]) { showNotification('Choose a file', 'warning'); return; }
    const ok = await showConfirm({
        icon: '⚠️', title: 'Restore Backup',
        message: 'Restoring will OVERWRITE all data. Continue?',
        details: { transaction: input.files[0].name, amount: '—', status: 'RESTORE' },
        buttonClass: 'btn-danger', buttonText: '<i class="fas fa-upload"></i> Restore'
    });
    if (!ok) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.transactions) transactions = data.transactions;
            if (data.servicePrices) servicePrices = data.servicePrices;
            if (data.storeData) Object.assign(storeData, data.storeData);
            if (data.salaryData) salaryData = data.salaryData;
            if (data.auditLogs) auditLogs = data.auditLogs;
            if (supabaseClient && isSupabaseConnected && data.transactions) {
                for (const tx of data.transactions) {
                    try { await supabaseClient.from(TABLE_NAME).upsert(tx); } catch (e) { }
                }
            }
            applyFilters();
            renderAll();
            renderStoreTotals();
            renderAuditLogs();
            showNotification('Backup restored', 'success');
        } catch (err) { showNotification('Failed: ' + err.message, 'error'); }
    };
    reader.readAsText(input.files[0]);
}

function renderBackupHistory() {
    const c = document.getElementById('backupHistoryContainer');
    if (!c) return;
    if (backupHistory.length === 0) {
        c.innerHTML = `<div class="empty-state" style="padding:1rem;">
            <i class="fas fa-inbox" style="font-size:1.5rem; color:var(--gray-300);"></i>
            <p style="color:var(--gray-400);">No backups created in this session.</p>
        </div>`;
        return;
    }
    c.innerHTML = backupHistory.map(b => `
        <div style="display:flex;justify-content:space-between;padding:0.5rem;border-bottom:1px solid var(--gray-200);">
            <span>${new Date(b.timestamp).toLocaleString()}</span>
            <span style="color:var(--gray-500);">${(b.size / 1024).toFixed(1)} KB</span>
        </div>
    `).join('');
}

// ============================================================
// TOUR
// ============================================================
let tourStep = 0;
const tourSteps = [
    { title: 'Welcome!', text: 'This is your carwash management system.' },
    { title: 'Dashboard', text: 'See today\'s earnings, pending payments, and more.' },
    { title: 'Transactions', text: 'All transactions with ongoing and completed tabs.' },
    { title: 'Salary', text: 'Calculate carwasher salaries by date range.' },
    { title: 'Store', text: 'Track store inventory and sales.' },
    { title: 'Reports', text: 'Generate daily/weekly/monthly reports.' }
];

function checkFirstTimeTour() {
    if (!localStorage.getItem('carwash_tour_done')) {
        setTimeout(() => startTour(), 1200);
    }
}

function startTour() {
    tourStep = 0;
    document.getElementById('tourOverlay').style.display = 'block';
    showTourStep();
}

function showTourStep() {
    const s = tourSteps[tourStep];
    if (!s) { endTour(); return; }
    document.getElementById('tourStep').textContent = `Step ${tourStep + 1} of ${tourSteps.length}`;
    document.getElementById('tourTitle').textContent = s.title;
    document.getElementById('tourText').textContent = s.text;
    const bar = document.getElementById('tourProgressBar');
    if (bar) bar.style.width = ((tourStep + 1) / tourSteps.length * 100) + '%';
    const prev = document.getElementById('tourPrevBtn');
    if (prev) prev.disabled = tourStep === 0;
}

function nextTourStep() { tourStep++; if (tourStep >= tourSteps.length) endTour(); else showTourStep(); }
function prevTourStep() { if (tourStep > 0) { tourStep--; showTourStep(); } }
function endTour() {
    document.getElementById('tourOverlay').style.display = 'none';
    localStorage.setItem('carwash_tour_done', '1');
}

// ============================================================
// NOTIFICATIONS & CONFIRM
// ============================================================
function showNotification(message, type = 'info', duration = 4000, actions = null) {
    const c = document.getElementById('notificationContainer');
    if (!c) return;
    const cfg = {
        success: { icon: '✅', title: 'Success', cls: 'notification-success' },
        error: { icon: '❌', title: 'Error', cls: 'notification-error' },
        warning: { icon: '⚠️', title: 'Warning', cls: 'notification-warning' },
        info: { icon: 'ℹ️', title: 'Info', cls: 'notification-info' }
    }[type] || { icon: 'ℹ️', title: 'Info', cls: 'notification-info' };
    const n = document.createElement('div');
    n.className = `notification ${cfg.cls}`;
    let aHTML = '';
    if (actions && actions.length) {
        aHTML = `<div style="display:flex;gap:0.5rem;margin-top:0.75rem;">` +
            actions.map(a => `<button class="btn btn-sm" onclick="${a.onclick}" style="background:rgba(255,255,255,0.2);color:white;border:none;">${a.text}</button>`).join('') +
            `</div>`;
    }
    n.innerHTML = `
        <span class="notif-icon">${cfg.icon}</span>
        <div class="notif-content" style="flex:1;">
            <div class="notif-title">${cfg.title}</div>
            <div class="notif-message">${message}</div>
            ${aHTML}
        </div>
        <button class="notif-close" onclick="this.closest('.notification').remove()">×</button>
    `;
    c.appendChild(n);
    if (duration > 0) setTimeout(() => { if (n.parentNode) n.remove(); }, duration);
}

let confirmResolve = null;
function showConfirm(options) {
    return new Promise((resolve) => {
        const m = document.getElementById('confirmModal');
        document.getElementById('confirmIcon').textContent = options.icon || '⚠️';
        document.getElementById('confirmTitle').textContent = options.title || 'Confirm';
        document.getElementById('confirmMessage').textContent = options.message || 'Proceed?';
        if (options.details) {
            document.getElementById('confirmTransaction').textContent = options.details.transaction || '—';
            document.getElementById('confirmAmount').textContent = options.details.amount || '—';
            document.getElementById('confirmStatus').textContent = options.details.status || '—';
        }
        const b = document.getElementById('confirmBtn');
        b.className = `btn ${options.buttonClass || 'btn-danger'}`;
        b.innerHTML = options.buttonText || 'Confirm';
        confirmResolve = (res) => { closeConfirm(); resolve(res); };
        m.classList.add('active');
    });
}
function closeConfirm() { document.getElementById('confirmModal')?.classList.remove('active'); confirmResolve = null; }
function executeConfirm() { if (confirmResolve) confirmResolve(true); }

// ============================================================
// PERMISSIONS / NAVIGATION
// ============================================================
function checkPermission(action) {
    if (!currentUser) return false;
    const map = { 'add': 'canAddTransaction', 'edit': 'canEditTransaction', 'delete': 'canDeleteTransaction' };
    const f = map[action];
    if (f && typeof window[f] === 'function' && !window[f](currentUser)) {
        showNotification(`No permission to ${action}`, 'warning');
        return false;
    }
    return true;
}

function switchPage(page) {
    if (page === 'ongoing') { switchPage('transactions'); setTimeout(() => switchTransactionTab('ongoing'), 100); return; }
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    const t = document.getElementById(`page-${page}`);
    if (t) t.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const n = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (n) n.classList.add('active');
    document.getElementById('pageTitle').textContent = page.charAt(0).toUpperCase() + page.slice(1);
    if (page === 'transactions') { switchTransactionTab(currentTransactionTab || 'all'); updateTransactionTabCounts(); }
    if (page === 'accessories') {
    switchKioskMode('accessories');
    renderAccessories(); // legacy table also refreshes
}
    if (page === 'store') {
    switchKioskMode('store');
    renderStoreTotals();
    updateStoreHistory();
}if (page === 'prices') renderPriceSettings();
    if (page === 'audit') renderAuditLogs();
    if (page === 'backup') renderBackupHistory();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('active');
}

function closeModal() { document.getElementById('transactionModal')?.classList.remove('active'); }
function showLoadingState(show) {
    const el = document.getElementById('loadingSpinner');
    if (el) el.style.display = show ? 'flex' : 'none';
    const ls = document.getElementById('loadingState');
    if (ls) ls.style.display = show ? 'flex' : 'none';
    const tt = document.getElementById('transactionsTable');
    if (tt) tt.style.display = show ? 'none' : '';
}

async function refreshData() {
    const ok = await showConfirm({
        icon: '🔄', title: 'Refresh Data',
        message: 'Reload all data from database?',
        details: { transaction: 'Refresh', amount: '—', status: '—' },
        buttonClass: 'btn-primary', buttonText: '<i class="fas fa-sync"></i> Refresh'
    });
    if (!ok) return;
    showNotification('Refreshing...', 'info');
    loadData();
}

// ============================================================
// MOBILE TABLE ENHANCEMENTS
// ============================================================
function enhanceTablesForMobile() {
    if (window.innerWidth > 768) {
        document.querySelectorAll('.table-wrap.mobile-cards').forEach(w => w.classList.remove('mobile-cards'));
        return;
    }
    document.querySelectorAll('table').forEach(table => {
        const wrap = table.closest('.table-wrap');
        if (!wrap) return;
        if (table.querySelector('thead th')) {
            wrap.classList.add('mobile-cards');
        }
    });
}

window.addEventListener('resize', () => { setTimeout(enhanceTablesForMobile, 100); });

// ============================================================
// ONGOING MODAL ALIAS
// ============================================================
function openOngoingModal() { openAddModal(); }
function closeOngoingModal() { closeModal(); }

// ============================================================
// GLOBAL EXPOSURE
// ============================================================
const __globalFns = [
    'switchPage', 'toggleSidebar', 'handleLogin', 'handleLogout',
    'openAddModal', 'openEditModal', 'closeModal', 'saveTransaction',
    'switchTransactionTab', 'completeOngoing', 'changeOngoingPayment',
    'showNotification', 'deleteTransaction', 'deleteSelected', 'changePaymentStatus',
    'quickReceipt', 'printReceipt', 'downloadReceiptPDF', 'closeReceiptModal',
    'exportData', 'exportCompleted', 'exportAccessories',
    'openQuickAdd', 'closeQuickAdd', 'saveQuickAdd',
    'openAccessoryModal', 'closeAccessoryModal', 'updateAccessoryPrice',
    'calculateAccessoryTotal', 'saveAccessory', 'addAccessoryTransaction',
    'renderAccessories', 'filterAccessories', 'refreshAccessories',
    'updateStoreValue', 'refreshStoreData', 'exportStoreData',
    'openStoreItemModal', 'closeStoreItemModal', 'updateStoreItemPrice',
    'calculateStoreItemTotal', 'saveStoreItem', 'quickAddStoreItem',
    'loadServicePrices', 'markPriceChanged', 'saveAllPrices',
    'openAddServiceModal', 'closeAddServiceModal', 'handleCategoryChange',
    'saveNewService', 'calculateSalaries', 'saveSalaries', 'exportSalaries',
    'updateSalaryDateRange', 'applyCustomSalaryDateRange',
    'updateSalaryRate', 'markSalaryPaid',
    'generateReport', 'generateCustomReport', 'exportReportExcel', 'exportReportPDF',
    'refreshAudit', 'filterAudit', 'exportAuditLogs', 'closeAuditDetail',
    'createBackup', 'restoreFromBackup',
    'startTour', 'endTour', 'nextTourStep', 'prevTourStep',
    'toggleRow', 'toggleAllCheckboxes', 'sortTable', 'clearFilters', 'applyFilters',
    'filterCompleted', 'refreshOngoing', 'addDropdownItem',
    'addServiceToSelection', 'removeServiceFromSelection',
    'addCustomStoreItem', 'addStoreItemToCarwash', 'removeStoreItem',
    'toggleTransactionFields', 'calculateStoreTotal', 'calculateCarwashTotal',
    'refreshData', 'openOngoingModal', 'closeOngoingModal',
    'enhanceTablesForMobile', 'autoCompleteOngoing', 
    'promptPartialPayment', 'closePartialPaymentModal', 'confirmPartialPayment',
    'viewCarwasherJobs', 'closeCarwasherJobsModal',
	'switchKioskMode', 'filterKioskProducts', 'populateKioskCategoryFilter',
'addToCart', 'incrementCart', 'decrementCart', 'removeFromCart', 'clearCart',
'renderKioskGrid', 'renderKioskCart', 'getCartTotal', 'getCartQty',
'openProductModal', 'closeProductModal', 'saveProduct', 'editProduct',
'deleteProductConfirm', 'updateProductEmojiPreview',
'kioskCheckout', 'loadProducts', 'saveProducts',
    'getBalanceDue', 'toggleFabDock', 'openFabDock', 'closeFabDock', 'fabAction',
'animateValue', 'animateMoney', 'animateCount', 'setReportPreset', 'updateReportPeriodDisplay', 'selectAllCategories',
'generateMultiReports', 'renderMultiReports', 
'renderBayPicker', 'selectBay', 'getOccupiedBays', 'refreshBayPickerIfOpen',

'exportCategoryExcel', 'exportCategoryCSV', 'printCategoryReport',
'exportAllReportsExcel', 'exportAllReportsPDF', 'printAllReports', 
    'setOngoingViewDate', 'setCompletedViewDate',
    'onOngoingDateChange', 'onCompletedDateChange', 'jumpToToday'
];
__globalFns.forEach(name => {
    if (typeof window[name] === 'undefined' && typeof eval(name) === 'function') {
        window[name] = eval(name);
    }
});
