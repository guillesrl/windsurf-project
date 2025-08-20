// Initialize the dashboard when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Load initial data
    loadOrders();
    loadMenu();
    loadReservations();
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

// Load menu from API
async function loadMenu() {
    try {
        const response = await fetch('/api/menu');
        const data = await response.json();
        const menuItems = document.getElementById('menuItems');
        menuItems.innerHTML = '';
        
        if (data.list && Array.isArray(data.list)) {
            data.list.forEach(item => {
                const menuItem = document.createElement('div');
                menuItem.className = 'mb-2';

                // Determine availability status and corresponding badge
                let availabilityBadge = ''; // Default to no badge
                if (item.Stock !== null && typeof item.Stock !== 'undefined') {
                    const isAvailable = parseInt(item.Stock, 10) > 0;
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
                            <span class="text-primary fw-bold">${item.Precio ? `$${parseFloat(item.Precio).toFixed(2)}` : ''}</span>
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
        data.forEach(reservation => {
            try {
                const row = document.createElement('tr');
                const time = reservation.start ? formatTime(new Date(reservation.start.dateTime || reservation.start.date)) : '--:--';
                const name = reservation.summary || 'Sin nombre';
                const description = reservation.description || '';
                
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

// Helper function to format time
function formatTime(dateStr) {
    try {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
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
        'en proceso': 'warning',
        'pendiente': 'secondary',
        'cancelado': 'danger'
    };
    return statusMap[status.toLowerCase()] || 'secondary';
}
