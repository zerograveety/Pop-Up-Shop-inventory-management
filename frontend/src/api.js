import axios from "axios";

const API_BASE_URL = 'http://localhost:8080';

// Create axios instance with default config
const API = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor: attach JWT token from localStorage if present
API.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (_) { /* ignore */ }
  return config;
}, (error) => Promise.reject(error));

// Response interceptor: on 401, clear expired token (client-side)
API.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    if (status === 401) {
      if (!url.includes('/auth/login') && !url.includes('/auth/register')) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    }
    if (status === 403) console.error('Access forbidden:', url);
    if (status === 404) console.error('Resource not found:', url);
    if (status >= 500) console.error('Server error:', url);
    return Promise.reject(error);
  }
);

// Authentication API endpoints
export const authAPI = {
  login: (credentials) => API.post('/api/auth/login', credentials),
  register: (userData) => API.post('/api/auth/register', userData),
  verify: () => API.get('/api/auth/verify'),
  logout: () => API.post('/api/auth/logout')
};

// Product API endpoints
export const productAPI = {
  getAll: () => API.get('/api/products'),
  getById: (id) => API.get(`/api/products/${id}`),
  create: (productData) => API.post('/api/products', productData),
  update: (id, productData) => API.put(`/api/products/${id}`, productData),
  delete: (id) => API.delete(`/api/products/${id}`),
  search: (query) => API.get(`/api/products/search?q=${query}`)
};

// Admin API endpoints
export const adminAPI = {
  getDashboard: () => API.get('/api/admin/dashboard'),
  getUsers: () => API.get('/api/admin/users'),
  createUser: (userData) => API.post('/api/admin/users', userData),
  updateUser: (id, userData) => API.put(`/api/admin/users/${id}`, userData),
  deleteUser: (id) => API.delete(`/api/admin/users/${id}`),
  updateUserRole: (id, role) => API.put(`/api/admin/users/${id}/role`, { role_id: Number(role) }),
  // Warehouse/Main stock
  getWarehouseStock: () => API.get('/api/admin/warehouse/stock'),
  setWarehouseStock: (productId, quantity) => API.put(`/api/admin/warehouse/stock/${productId}`, { quantity }),
  adjustWarehouseStock: (productId, delta) => API.put(`/api/admin/warehouse/stock/${productId}`, { delta }),
  // Stock orders queue
  getStockOrders: (status) => API.get('/api/admin/stock-orders', { params: status ? { status } : {} }),
  approveStockOrder: (id) => API.post(`/api/admin/stock-orders/${id}/approve`),
  rejectStockOrder: (id) => API.post(`/api/admin/stock-orders/${id}/reject`),
  fulfillStockOrder: (id) => API.post(`/api/admin/stock-orders/${id}/fulfill`),
  // Popup events and user assignments
  getEvents: () => API.get('/api/admin/events'),
  createEvent: (eventData) => API.post('/api/admin/events', eventData),
  getEventUsers: (eventId) => API.get(`/api/admin/events/${eventId}/users`),
  // Set single owner for an event. Accepts either an array (uses first element), a number/string, or null/undefined to unassign.
  setEventUsers: (eventId, userIds) => {
    let payload = {};
    if (Array.isArray(userIds)) {
      if (userIds.length === 0) {
        payload = { user_id: null };
      } else {
        payload = { user_id: Number(userIds[0]) };
      }
    } else if (userIds === null || userIds === undefined || userIds === '') {
      payload = { user_id: null };
    } else {
      payload = { user_id: Number(userIds) };
    }
    return API.put(`/api/admin/events/${eventId}/users`, payload);
  },
  getUserEvents: (userId) => API.get(`/api/admin/users/${userId}/events`),
  assignUserToEvent: (userId, eventId) => API.post(`/api/admin/users/${userId}/events`, { event_id: Number(eventId) }),
  removeUserFromEvent: (userId, eventId) => API.delete(`/api/admin/users/${userId}/events/${eventId}`),
  getSettings: () => API.get('/api/admin/settings'),
  updateSettings: (settings) => API.put('/api/admin/settings', settings)
};

// Manager API endpoints
export const managerAPI = {
  getDashboard: () => API.get('/api/manager/dashboard'),
  getProducts: () => API.get('/api/manager/products'),
  createProduct: (productData) => API.post('/api/manager/products', productData),
  updateProduct: (id, productData) => API.put(`/api/manager/products/${id}`, productData),
  deleteProduct: (id) => API.delete(`/api/manager/products/${id}`),
  // Updated paths to align with backend routes (/reports/inventory, /reports/sales)
  getInventoryReport: (params) => API.get('/api/manager/reports/inventory', { params }),
  getSalesReport: (params) => API.get('/api/manager/reports/sales', { params }),
  // Stock visibility & ordering
  getShopStock: () => API.get('/api/manager/shop/stock'),
  getCombinedStock: () => API.get('/api/manager/stock/combined'),
  getStockOrders: () => API.get('/api/manager/stock-orders'),
  createStockOrder: (payload) => API.post('/api/manager/stock-orders', payload),
  setShopStock: (productId, quantity) => API.put(`/api/manager/shop/stock/${productId}`, { quantity }),
  adjustShopStock: (productId, delta) => API.put(`/api/manager/shop/stock/${productId}`, { delta }),
  // Low stock alerts (populated by DB trigger)
  getLowStockAlerts: () => API.get('/api/manager/alerts/low-stock')
};

// Cashier API endpoints
export const cashierAPI = {
  getDashboard: () => API.get('/api/cashier/dashboard'),
  createOrder: (orderData) => API.post('/api/cashier/orders', orderData),
  getOrder: (id) => API.get(`/api/cashier/orders/${id}`),
  getDailySales: (date) => API.get(`/api/cashier/sales/daily?date=${date}`),
  searchProducts: (query) => API.get(`/api/cashier/products/search?q=${query}`),
  processRefund: (orderId, reason) => API.post(`/api/cashier/orders/${orderId}/refund`, { reason })
};

export default API;