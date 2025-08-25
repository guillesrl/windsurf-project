// Dark mode toggle
function setupDarkMode() {
    const toggle = document.getElementById('darkModeToggle');
    const isDark = localStorage.getItem('darkMode') === 'true';
    
    if (isDark) {
        document.body.setAttribute('data-bs-theme', 'dark');
        toggle.innerHTML = '<i class="bi bi-sun-fill"></i> Modo Claro';
    }
    
    toggle.addEventListener('click', () => {
        const isDark = document.body.getAttribute('data-bs-theme') === 'dark';
        document.body.setAttribute('data-bs-theme', isDark ? 'light' : 'dark');
        toggle.innerHTML = isDark 
            ? '<i class="bi bi-moon-fill"></i> Modo Oscuro'
            : '<i class="bi bi-sun-fill"></i> Modo Claro';
        localStorage.setItem('darkMode', !isDark);
    });
}

// Menu toggle
function setupMenuToggle() {
    const toggle = document.getElementById('menuToggle');
    const collapse = document.getElementById('menuCollapse');
    
    if (!toggle || !collapse) return;
    
    collapse.addEventListener('show.bs.collapse', () => {
        const icon = toggle.querySelector('i');
        if (icon) icon.className = 'bi bi-chevron-up';
    });
    
    collapse.addEventListener('hide.bs.collapse', () => {
        const icon = toggle.querySelector('i');
        if (icon) icon.className = 'bi bi-chevron-down';
    });
}

// Date selector
function setupDateSelector() {
    const dateSelector = document.getElementById('dateSelector');
    if (!dateSelector) return;
    
    dateSelector.value = new Date().toISOString().split('T')[0];
    dateSelector.addEventListener('change', function() {
        if (this.value) {
            updateReservationsTitle(this.value);
            loadReservations(this.value).catch(e => console.error('Error loading reservations:', e));
        }
    });
}

function updateReservationsTitle(dateString) {
    const title = document.getElementById('reservationsTitle');
    if (!title) return;
    
    const selected = new Date(dateString + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selected.setHours(0, 0, 0, 0);
    
    if (selected.getTime() === today.getTime()) {
        title.textContent = 'Reservas de hoy';
    } else {
        const formatted = selected.toLocaleDateString('es-ES', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
        title.textContent = `Reservas del ${formatted}`;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    setupDarkMode();
    setupMenuToggle();
    setupDateSelector();
    
    loadOrders().catch(e => console.error('Error loading orders:', e));
    loadMenu().catch(e => console.error('Error loading menu:', e));
    loadReservations().catch(e => console.error('Error loading reservations:', e));
});

// Load orders
async function loadOrders() {
    try {
        const response = await fetch('/api/orders');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        const table = document.getElementById('ordersTable');
        table.innerHTML = '';
        
        if (!Array.isArray(data) || data.length === 0) {
            table.innerHTML = '<div class="text-center py-2">No hay pedidos recientes</div>';
            return;
        }
        
        data.slice(0, 10).forEach((order, index) => {
            const div = document.createElement('div');
            div.className = 'px-1 py-0 mb-1 border-bottom';
            
            const foodText = order.Comida || '';
            const shortFood = foodText.length > 20 ? foodText.substring(0, 20) + '...' : foodText;
            const clientName = order.Cliente || order.client || order.customer || order.nombre || order.name || order.Client || order.Customer || order.Nombre || `Cliente ${index + 1}`;
            
            div.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center flex-grow-1">
                        <div class="fw-bold me-2">${clientName}</div>
                        <div class="text-muted flex-grow-1">
                            <span class="food-short">${shortFood}</span>
                            <span class="food-full" style="display: none;">${foodText}</span>
                            ${foodText.length > 20 ? '<button class="btn btn-sm ms-1" style="font-size: 0.7rem; padding: 0.1rem 0.3rem;" onclick="toggleFood(this)">Mostrar</button>' : ''}
                        </div>
                    </div>
                    <div class="text-end ms-2">
                        <span class="me-2">${order.Total ? `$${parseFloat(order.Total).toFixed(2)}` : ''}</span>
                        <span class="badge bg-${getStatusBadgeClass(order.Estado)}">${order.Estado || 'Pendiente'}</span>
                    </div>
                </div>
            `;
            table.appendChild(div);
        });
        
    } catch (error) {
        console.error('Error loading orders:', error);
        document.getElementById('ordersTable').innerHTML = 
            '<div class="text-center text-danger py-2">Error al cargar pedidos</div>';
    }
}

// Load menu
async function loadMenu() {
    const container = document.getElementById('menuItems');
    
    try {
        container.innerHTML = '<div class="text-center py-4"><div class="spinner-border"></div><p class="mt-2">Cargando menú...</p></div>';
        
        const items = await fetchAllMenuItems();
        if (!items.length) throw new Error('No menu items found');
        
        // Filter duplicates and invalid items
        const seen = new Set();
        const valid = items.filter(item => {
            const name = item.Nombre || item['Nombre del plato'];
            const price = item['Precio (€)'];
            if (!name || price === undefined) return false;
            
            const id = `${name}_${price}`;
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
        });
        
        container.innerHTML = '';
        
        if (valid.length > 0) {
            valid.forEach(item => {
                const div = document.createElement('div');
                div.className = 'menu-item d-flex justify-content-between align-items-center py-1 px-2';
                
                const name = item.Nombre || item['Nombre del plato'];
                const desc = item.Descripción || item.Descripcion || '';
                const price = formatPrice(item['Precio (€)']);
                const stock = item.Stock;
                
                let badge = '';
                if (stock !== null && stock !== undefined) {
                    const available = parseInt(stock, 10) > 0;
                    badge = `<span class="badge bg-${available ? 'success' : 'danger'}">${available ? '✓' : '✗'}</span>`;
                }
                
                div.innerHTML = `
                    <div class="d-flex align-items-center flex-grow-1">
                        ${badge ? `<div class="me-2">${badge}</div>` : ''}
                        <div class="text-truncate">
                            <span class="fw-medium">${name}</span>
                            ${desc ? `<span class="text-muted small ms-2">${desc}</span>` : ''}
                        </div>
                    </div>
                    <div class="text-nowrap ms-2 fw-medium">${price}</div>
                `;
                container.appendChild(div);
            });
            
        } else {
            container.innerHTML = '<div class="alert alert-warning">No hay platos disponibles</div>';
        }
        
    } catch (error) {
        console.error('Error loading menu:', error);
        container.innerHTML = '<div class="alert alert-danger">Error al cargar el menú</div>';
    }
}

async function fetchAllMenuItems() {
    const items = [];
    let page = 1;
    
    try {
        while (page <= 10) { // Limit to prevent infinite loops
            const response = await fetch(`/api/menu?page=${page}&limit=25`);
            if (!response.ok) break;
            
            const data = await response.json();
            const pageItems = data.items || [];
            
            if (!pageItems.length) break;
            items.push(...pageItems);
            
            if (!data.pageInfo || data.pageInfo.isLastPage) break;
            page++;
        }
        
        return items;
    } catch (error) {
        console.error('Error fetching menu:', error);
        return [];
    }
}

// Load reservations
async function loadReservations(selectedDate = null) {
    const table = document.getElementById('todayReservations');
    if (!table) return;
    
    try {
        const date = selectedDate || new Date().toISOString().split('T')[0];
        const response = await fetch(`/api/reservations?date=${date}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        const reservations = Array.isArray(data) ? data : [];
        
        // Horarios Restaurante
        const slots = [];
        for (let h = 12; h <= 15; h++) slots.push(`${h.toString().padStart(2, '0')}:00`);
        for (let h = 19; h <= 21; h++) slots.push(`${h.toString().padStart(2, '0')}:00`);
        
        const slotMap = new Map();
        slots.forEach(slot => {
            slotMap.set(slot, {
                time: `${slot}hs`,
                name: 'Disponible',
                description: 'Horario libre',
                available: true
            });
        });
        
        // Override with actual reservations
        reservations.forEach(res => {
            if (res.start) {
                const time = formatTime(new Date(res.start.dateTime || res.start.date));
                const slot = time.replace('hs', '');
                if (slotMap.has(slot)) {
                    slotMap.set(slot, {
                        time,
                        name: res.summary || 'Sin nombre',
                        description: res.description || '',
                        available: false
                    });
                }
            }
        });
        
        table.innerHTML = '';
        const sorted = Array.from(slotMap.entries()).sort(([a], [b]) => a.localeCompare(b));
        
        sorted.forEach(([, slot]) => {
            const div = document.createElement('div');
            div.className = 'px-1 py-0 mb-1 border-bottom';
            
            if (slot.available) {
                div.classList.add('available-slot');
                div.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="d-flex align-items-center flex-grow-1">
                            <div class="fw-bold me-2">${slot.time}</div>
                            <div class="text-muted">${slot.description}</div>
                        </div>
                        <span class="badge bg-success ms-2">${slot.name}</span>
                    </div>
                `;
            } else {
                div.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="d-flex align-items-center flex-grow-1">
                            <div class="fw-bold me-2">${slot.time}</div>
                            <div class="text-muted">${slot.description}</div>
                        </div>
                        <div class="ms-2">${slot.name}</div>
                    </div>
                `;
            }
            table.appendChild(div);
        });
        
    } catch (error) {
        console.error('Error loading reservations:', error);
        table.innerHTML = '<div class="text-center text-danger py-2">Error al cargar reservas</div>';
    }
}

// Helper functions
function formatTime(dateStr) {
    try {
        const date = new Date(dateStr);
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}hs`;
    } catch (e) {
        return '--:--';
    }
}

function formatPrice(price) {
    if (price == null) return '';
    const num = typeof price === 'string' ? parseFloat(price.replace(',', '.')) : Number(price);
    return isNaN(num) ? '' : `$${num.toFixed(2).replace('.', ',')}`;
}

// Toggle food text visibility
function toggleFood(button) {
    const cell = button.parentElement;
    const shortSpan = cell.querySelector('.food-short');
    const fullSpan = cell.querySelector('.food-full');
    
    if (shortSpan.style.display === 'none') {
        shortSpan.style.display = 'inline';
        fullSpan.style.display = 'none';
        button.textContent = 'Mostrar';
    } else {
        shortSpan.style.display = 'none';
        fullSpan.style.display = 'inline';
        button.textContent = 'Ocultar';
    }
}

// Hide/Show toggles (removed - no longer needed)

// Collapse toggles (removed - no longer needed)

function getStatusBadgeClass(status) {
    if (!status) return 'secondary';
    const map = {
        'completado': 'success',
        'en proceso': 'info',
        'pendiente': 'warning text-dark',
        'cancelado': 'danger'
    };
    return map[status.toLowerCase()] || 'secondary';
}
