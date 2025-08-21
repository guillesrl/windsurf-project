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
    const allItems = [];
    let page = 1;
    const limit = 25; // Número de ítems por página
    let hasMorePages = true;
    
    try {
        console.log('Iniciando carga del menú...');
        
        while (hasMorePages) {
            console.log(`Solicitando página ${page} del menú...`);
            const response = await fetch(`/api/menu?page=${page}&limit=${limit}`);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Error HTTP ${response.status}: ${errorData.error || 'Error desconocido'}`);
            }
            
            const data = await response.json();
            
            // Verificar si la respuesta tiene el formato esperado
            if (data && data.items && Array.isArray(data.items)) {
                const items = data.items;
                console.log(`Página ${page}: Se encontraron ${items.length} ítems`);
                
                if (items.length === 0) {
                    console.log('No hay más ítems para cargar');
                    break;
                }
                
                // Filtrar ítems inválidos
                const validItems = items.filter(item => {
                    const isValid = item && 
                                  (item.Nombre || item['Nombre del plato']) && 
                                  item['Precio (€)'] !== undefined;
                    
                    if (!isValid) {
                        console.warn('Ítem inválido filtrado:', item);
                    }
                    
                    return isValid;
                });
                
                allItems.push(...validItems);
                
                // Verificar si hay más páginas según la respuesta de la API
                hasMorePages = data.pageInfo ? !data.pageInfo.isLastPage : items.length === limit;
                
                console.log(`Página ${page}/${data.pageInfo?.totalPages || '?'} procesada. ` +
                           `Items válidos: ${validItems.length}/${items.length}. ` +
                           `Total acumulado: ${allItems.length}`);
                
                // Si no hay más páginas, salir del bucle
                if (!hasMorePages) {
                    console.log('Se ha alcanzado la última página según la API');
                    break;
                }
                
                // Prevenir bucles infinitos
                if (page > 50) {
                    console.warn('Se alcanzó el límite de páginas (50). Deteniendo la carga.');
                    break;
                }
                
                page++;
                
            } else {
                // Si no se encuentra el formato esperado, asumir que es la última página
                console.warn('Formato de respuesta inesperado:', data);
                hasMorePages = false;
            }
        }
        
        console.log(`Carga del menú completada. Total de ítems cargados: ${allItems.length}`);
        return allItems;
        
    } catch (error) {
        console.error('Error al cargar el menú:', error);
        
        // Si hay un error, intentar cargar al menos la primera página
        try {
            console.log('Intentando cargar solo la primera página...');
            const response = await fetch('/api/menu?limit=10');
            if (response.ok) {
                const data = await response.json();
                const items = data.items || data.list || data.rows || [];
                console.log(`Se cargaron ${items.length} ítems como respaldo`);
                return Array.isArray(items) ? items : [items];
            }
        } catch (e) {
            console.error('Error al cargar la primera página del menú:', e);
        }
        
        // Si todo falla, devolver un array vacío
        console.warn('No se pudieron cargar los ítems del menú');
        return [];
    }
}

// Load menu from API
async function loadMenu() {
    const menuItems = document.getElementById('menuItems');
    
    try {
        console.log('Iniciando carga del menú...');
        menuItems.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Cargando...</span>
                </div>
                <p class="mt-2 mb-0">Cargando menú...</p>
            </div>`;
        
        // Obtener todos los platos
        const allItems = await fetchAllMenuItems();
        console.log('Total de ítems del menú recibidos:', allItems.length);
        
        if (!Array.isArray(allItems) || allItems.length === 0) {
            throw new Error('No se recibieron datos del menú');
        }
        
        // Filtrar y asegurar que no haya duplicados
        const idsVistos = new Set();
        let platosFiltrados = [];
        let itemsInvalidos = 0;
        
        platosFiltrados = allItems.filter(item => {
            if (!item) {
                itemsInvalidos++;
                return false;
            }
            
            // Verificar campos obligatorios
            const nombre = item.Nombre || item['Nombre del plato'];
            const precio = item['Precio (€)'];
            
            if (!nombre || precio === undefined) {
                console.warn('Ítem sin nombre o precio:', item);
                itemsInvalidos++;
                return false;
            }
            
            // Usar ID si existe, de lo contrario usar nombre + precio como identificador único
            const id = item.Id || `${nombre}_${precio}`.toLowerCase();
            
            if (idsVistos.has(id)) {
                console.log('Plato duplicado detectado y omitido:', nombre);
                return false;
            }
            
            idsVistos.add(id);
            return true;
        });
        
        console.log(`
            Resumen de carga del menú:
            - Total recibidos: ${allItems.length}
            - Válidos: ${platosFiltrados.length}
            - Inválidos/omitidos: ${itemsInvalidos}
            - Duplicados: ${allItems.length - itemsInvalidos - platosFiltrados.length}
        `);
        
        // Limpiar el contenedor
        menuItems.innerHTML = '';
        
        if (platosFiltrados.length > 0) {
            console.log('Mostrando platos en la interfaz:', platosFiltrados.length, 'ítems');
            
            // Crear contenedor para mejor organización
            const menuContainer = document.createElement('div');
            menuContainer.className = 'menu-container';
            
            // Renderizar cada ítem
            platosFiltrados.forEach(item => {
                const menuItem = document.createElement('div');
                menuItem.className = 'menu-item d-flex justify-content-between align-items-center py-1 px-2';
                
                // Obtener datos del ítem con valores por defecto
                const nombre = item.Nombre || item['Nombre del plato'] || 'Sin nombre';
                const descripcion = item.Descripción || item.Descripcion || '';
                const precio = formatPrice(item['Precio (€)']);
                
                // Determinar disponibilidad (solo si Stock no es null/undefined)
                const stockValue = item.Stock !== null && item.Stock !== undefined 
                    ? parseInt(item.Stock, 10) 
                    : null;
                
                let availabilityBadge = '';
                if (stockValue !== null) {
                    const isAvailable = !isNaN(stockValue) && stockValue > 0;
                    availabilityBadge = isAvailable 
                        ? '<span class="badge bg-success">✓</span>'
                        : '<span class="badge bg-danger">✗</span>';
                }
                
                console.log(`Renderizando: ${nombre} - ${precio} - Stock: ${item.Stock}`);
                
                // Construir el HTML del ítem en una sola línea
                menuItem.innerHTML = `
                    <div class="d-flex align-items-center flex-grow-1 overflow-hidden">
                        <div class="me-2">${availabilityBadge}</div>
                        <div class="text-truncate" style="max-width: 65%;">
                            <span class="fw-medium">${nombre}</span>
                            ${descripcion ? `<span class="text-muted small ms-2">${descripcion}</span>` : ''}
                        </div>
                    </div>
                    <div class="text-nowrap ms-2 fw-medium">
                        ${precio}
                    </div>
                `;

                menuContainer.appendChild(menuItem);
            });

            menuItems.appendChild(menuContainer);

            
            // Mostrar resumen de carga
            const summary = document.createElement('div');
            summary.className = 'small text-muted text-end mt-2';
            summary.textContent = `Mostrando ${platosFiltrados.length} de ${allItems.length} ítems`;
            if (itemsInvalidos > 0) {
                summary.textContent += ` (${itemsInvalidos} omitidos por falta de datos)`;
            }
            menuItems.appendChild(summary);
            
        } else {
            menuItems.innerHTML = `
                <div class="alert alert-warning mb-0">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    No se encontraron platos en el menú con los criterios actuales.
                    <div class="mt-2">
                        <button class="btn btn-sm btn-outline-primary" onclick="loadMenu()">
                            <i class="bi bi-arrow-clockwise me-1"></i> Reintentar
                        </button>
                    </div>
                </div>`;
        }
    } catch (error) {
        console.error('Error loading menu:', error);
        const menuItems = document.getElementById('menuItems');
        if (menuItems) {
            let errorMessage = 'Error al cargar el menú. ';
            
            if (error.message && error.message.includes('Failed to fetch')) {
                errorMessage += 'No se pudo conectar con el servidor. Verifique su conexión a Internet.';
            } else if (error.message) {
                errorMessage += error.message;
            }
            
            menuItems.innerHTML = `
                <div class="alert alert-danger mb-0">
                    <div class="d-flex align-items-center">
                        <i class="bi bi-exclamation-octagon-fill me-2"></i>
                        <div>
                            <div class="fw-bold">Error al cargar el menú</div>
                            <div class="mb-2">${errorMessage}</div>
                            <button class="btn btn-sm btn-outline-primary" onclick="loadMenu()">
                                <i class="bi bi-arrow-clockwise me-1"></i> Reintentar
                            </button>
                        </div>
                    </div>
                </div>`;
        }
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

// Helper function to format price
function formatPrice(price) {
    if (price === undefined || price === null) return '';
    
    // Convertir a número, manejando tanto punto como coma decimal
    const num = typeof price === 'string' 
        ? parseFloat(price.replace(',', '.')) 
        : Number(price);
        
    if (isNaN(num)) return '';
    
    // Formatear a 2 decimales y reemplazar punto por coma si es necesario
    return `$${num.toFixed(2).replace('.', ',')}`;
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
