// Función para manejar el cambio de tema
function setupDarkMode() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    
    // Verificar preferencia guardada
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.setAttribute('data-bs-theme', 'dark');
        darkModeToggle.innerHTML = '<i class="bi bi-sun-fill"></i> Modo Claro';
    }
    
    // Manejar clic en el botón
    darkModeToggle.addEventListener('click', () => {
        const isDark = document.body.getAttribute('data-bs-theme') === 'dark';
        
        if (isDark) {
            // Cambiar a modo claro
            document.body.setAttribute('data-bs-theme', 'light');
            darkModeToggle.innerHTML = '<i class="bi bi-moon-fill"></i> Modo Oscuro';
            localStorage.setItem('darkMode', 'false');
        } else {
            // Cambiar a modo oscuro
            document.body.setAttribute('data-bs-theme', 'dark');
            darkModeToggle.innerHTML = '<i class="bi bi-sun-fill"></i> Modo Claro';
            localStorage.setItem('darkMode', 'true');
        }
    });
}

// Initialize the dashboard when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM completamente cargado');
    
    // Configurar el modo oscuro
    setupDarkMode();
    
    // Load initial data
    console.log('Cargando pedidos...');
    loadOrders().catch(e => console.error('Error cargando pedidos:', e));
    
    console.log('Cargando menú...');
    loadMenu().catch(e => console.error('Error cargando menú:', e));
    
    console.log('Cargando reservas...');
    loadReservations().catch(e => console.error('Error cargando reservas:', e));
});

// Load orders from API
async function loadOrders() {
    try {
        const response = await fetch('/api/orders');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const ordersTable = document.getElementById('ordersTable');
        ordersTable.innerHTML = '';
        
        // Check if data is an array and has items
        if (!Array.isArray(data) || data.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="4" class="text-center py-2">No hay pedidos recientes</td>';
            ordersTable.appendChild(row);
            return;
        }
        
        // Show only the 10 most recent orders
        const recentOrders = data.slice(0, 10);
        
        recentOrders.forEach(order => {
            try {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${order.Nombre || 'N/A'}</td>
                    <td>${order.Comida || ''}</td>
                    <td class="text-end">${order.Total ? `$${parseFloat(order.Total).toFixed(2)}` : ''}</td>
                    <td><span class="badge bg-${getStatusBadgeClass(order.Estado || '')}">${order.Estado || 'Pendiente'}</span></td>
                `;
                ordersTable.appendChild(row);
            } catch (error) {
                console.error('Error processing order:', order, error);
            }
        });
        
    } catch (error) {
        console.error('Error loading orders:', error);
        const ordersTable = document.getElementById('ordersTable');
        if (ordersTable) {
            ordersTable.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-danger py-2">
                        Error al cargar los pedidos. Por favor, intente recargar la página.
                    </td>
                </tr>`;
        }
    }
}

// Función para obtener todos los platos del menú con paginación
async function fetchAllMenuItems() {
    let allItems = [];
    let page = 1;
    let hasMorePages = true;
    const maxPages = 5; // Aumentado para asegurar que se carguen todas las páginas
    const itemsPerPage = 25; // Aumentar el número de ítems por página
    
    try {
        while (hasMorePages && page <= maxPages) {
            console.log(`Solicitando página ${page} del menú...`);
            const response = await fetch(`/api/menu?page=${page}&limit=${itemsPerPage}`);
            
            if (!response.ok) {
                throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`Página ${page} recibida:`, data);
            
            // Verificar si la respuesta es un array directo o tiene un formato específico
            const items = Array.isArray(data) ? data : (data.list || data.rows || []);
            console.log(`Ítems extraídos:`, items);
            
            allItems = [...allItems, ...items];
            
            // Verificar si hay más páginas basándonos en la respuesta de la API
            if (data.pageInfo) {
                // Usar la información de paginación de la API si está disponible
                const totalPages = Math.ceil(data.pageInfo.totalRows / itemsPerPage);
                hasMorePages = page < totalPages;
                console.log(`Página ${page} de ${totalPages} (${data.pageInfo.totalRows} ítems en total)`);
            } else if (data.pagination) {
                // Formato alternativo de paginación
                hasMorePages = data.pagination.page < data.pagination.pageCount;
                console.log(`Paginación: página ${data.pagination.page} de ${data.pagination.pageCount}`);
            } else {
                // Si no hay información de paginación, asumir que es la última página si recibimos menos ítems de los solicitados
                hasMorePages = items.length === itemsPerPage;
                console.log(`Recibidos ${items.length} ítems. ${hasMorePages ? 'Posiblemente hay más páginas' : 'Última página'}`);
            }
            
            page++;
        }
        
        console.log(`Se cargaron ${allItems.length} ítems del menú`);
        return allItems;
    } catch (error) {
        console.error('Error al cargar el menú:', error);
        // Si hay un error, intentar cargar al menos la primera página
        try {
            console.log('Intentando cargar solo la primera página...');
            const response = await fetch('/api/menu?limit=10');
            if (response.ok) {
                const data = await response.json();
                return Array.isArray(data) ? data : (data.list || data.rows || []);
            }
        } catch (e) {
            console.error('Error al cargar la primera página del menú:', e);
        }
        return [];
    }
}

// Load menu from API
async function loadMenu() {
    try {
        console.log('Cargando menú...');
        const menuItems = document.getElementById('menuItems');
        menuItems.innerHTML = '<div class="text-center py-3">Cargando menú...</div>';
        
        // Obtener todos los platos
        const allItems = await fetchAllMenuItems();
        console.log('Total de ítems del menú recibidos:', allItems.length);
        
        // Filtrar y asegurar que no haya duplicados
        const platosUnicos = [];
        const idsVistos = new Set();
        
        const platosFiltrados = allItems.filter(item => {
            if (!item || item['Precio (€)'] === undefined) return false;
            
            // Usar ID si existe, de lo contrario usar nombre + precio como identificador único
            const id = item.Id || `${item.Nombre}_${item['Precio (€)']}`;
            if (idsVistos.has(id)) {
                console.log('Plato duplicado detectado y omitido:', item.Nombre || 'Sin nombre');
                return false;
            }
            
            idsVistos.add(id);
            return true;
        });
        
        console.log(`Platos únicos después de filtrar: ${platosFiltrados.length}`);
        
        // Limpiar el contenedor
        menuItems.innerHTML = '';
        
        if (platosFiltrados.length > 0) {
            console.log('Mostrando platos en la interfaz:', platosFiltrados);
            platosFiltrados.forEach((item, index) => {
                const menuItem = document.createElement('div');
                menuItem.className = 'mb-2';
                
                console.log(`Procesando plato ${index + 1}:`, item);

                // Determine availability status and corresponding badge
                let availabilityBadge = ''; // Default to no badge
                if (item.Stock !== null && typeof item.Stock !== 'undefined') {
                    const stockValue = parseInt(item.Stock, 10);
                    const isAvailable = !isNaN(stockValue) && stockValue > 0;
                    console.log(`Stock para ${item.Nombre || 'sin nombre'}:`, item.Stock, 'Disponible:', isAvailable);
                    availabilityBadge = isAvailable 
                        ? '<span class="badge bg-success">Disponible</span>' 
                        : '<span class="badge bg-danger">No Disponible</span>';
                }

                menuItem.innerHTML = `
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            ${item.Nombre || 'Sin nombre'}
                        </div>
                        <div class="text-end">
                            <span class="text-primary fw-bold">${item['Precio (€)'] ? `$${parseFloat(item['Precio (€)'].replace(',', '.')).toFixed(2)}` : ''}</span>
                            ${availabilityBadge ? ` ${availabilityBadge}` : ''}
                        </div>
                    </div>
                `;
                menuItems.appendChild(menuItem);
            });
        }
    } catch (error) {
        console.error('Error loading menu:', error);
    }
}

// Load reservations for today
async function loadReservations() {
    const reservationsTable = document.getElementById('todayReservations');
    if (!reservationsTable) return;
    
    try {
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(`/api/reservations?date=${today}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        reservationsTable.innerHTML = '';
        
        // Check if data is an array and has items
        if (!Array.isArray(data) || data.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="3" class="text-center py-2">No hay reservas para hoy</td>';
            reservationsTable.appendChild(row);
            return;
        }
        
        // Process each reservation
        console.log('Processing reservations:', data); // Debug log
        data.forEach(reservation => {
            console.log('Processing reservation:', reservation); // Debug log
            try {
                const row = document.createElement('tr');
                const time = reservation.start ? formatTime(new Date(reservation.start.dateTime || reservation.start.date)) : '--:--';
                const name = reservation.summary || 'Sin nombre';
                const description = reservation.description || '';
                
                // Creamos el contenido HTML de la fila
                row.innerHTML = `
                    <td class="text-nowrap">${time}</td>
                    <td>${name}</td>
                    <td>${description}</td>
                `;
                
                reservationsTable.appendChild(row);
            } catch (error) {
                console.error('Error processing reservation:', reservation, error);
            }
        });
        
    } catch (error) {
        console.error('Error loading reservations:', error);
        reservationsTable.innerHTML = `
            <tr>
                <td colspan="3" class="text-center text-danger py-2">
                    Error al cargar las reservas. Por favor, intente recargar la página.
                </td>
            </tr>`;
    }
}

// Helper function to format time in 24h format
function formatTime(dateStr) {
    try {
        const date = new Date(dateStr);
        // Formato 24 horas con ceros a la izquierda
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}hs`;
    } catch (e) {
        console.error('Error formatting time:', e);
        return '--:--';
    }
}

// Helper function to get badge class based on status
function getStatusBadgeClass(status) {
    if (!status) return 'secondary';
    
    const statusMap = {
        'completado': 'success',
        'en proceso': 'info',
        'pendiente': 'warning text-dark',  // Amarillo oscuro con texto oscuro
        'cancelado': 'danger'
    };
    return statusMap[status.toLowerCase()] || 'secondary';
}
