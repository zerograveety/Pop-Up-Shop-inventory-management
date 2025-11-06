import { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/navbar";
import Home from "./pages/home";
import Checkout from "./pages/checkout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ProductsManage from "./pages/ProductsManage";
import UsersManage from "./pages/UsersManage";
import EventManagement from "./pages/EventManagement";
import InventoryReport from "./pages/InventoryReport";
import SalesReport from "./pages/SalesReport";
import AdminOrders from "./pages/AdminOrders";
import Stock from "./pages/Stock";
import { ToastContainer } from "./components/Toast";
import { ThemeProvider } from "./components/ThemeProvider";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

// Main App Content Component
function AppContent() {
  const [cart, setCart] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const { isAuthenticated, user, logout } = useAuth();

  const addToast = (message, type = 'success', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const handleGlobalSearchChange = (query) => {
    setGlobalSearchQuery(query);
  };

  const handleGlobalSearchClear = () => {
    setGlobalSearchQuery("");
  };

  const addToCart = (product, qty = 1) => {
    setCart(prev => {
      const existing = prev.find(p => p.product_id === product.product_id);
      if (existing) {
        addToast(`Updated ${product.product_name} quantity in cart`, 'success', 2000);
        return prev.map(p => p.product_id === product.product_id ? { ...p, quantity: p.quantity + qty } : p);
      }
      addToast(`Added ${product.product_name} to cart`, 'success', 2000);
      return [...prev, { ...product, quantity: qty }];
    });
  };

  const updateCartItem = (product_id, quantity) => {
    setCart(prev => {
      if (quantity <= 0) return prev.filter(p => p.product_id !== product_id);
      return prev.map(p => p.product_id === product_id ? { ...p, quantity } : p);
    });
  };

  const removeCartItem = (product_id) => {
    const item = cart.find(p => p.product_id === product_id);
    if (item) {
      addToast(`Removed ${item.product_name} from cart`, 'info', 2000);
    }
    setCart(prev => prev.filter(p => p.product_id !== product_id));
  };

  const clearCart = () => {
    if (cart.length > 0) {
      addToast('Cart cleared', 'info', 2000);
    }
    setCart([]);
  };

  const handleLogout = async () => {
    const result = await logout();
    if (result.success) {
      addToast('Logged out successfully', 'info', 2000);
      clearCart(); // Clear cart on logout
    }
  };

  return (
    <Router>
      {/* Show navbar only when authenticated and not on login page */}
      {isAuthenticated && (
        <Navbar 
          cartCount={cart.length} 
          searchQuery={globalSearchQuery}
          onSearchChange={handleGlobalSearchChange}
          onSearchClear={handleGlobalSearchClear}
          user={user}
          onLogout={handleLogout}
        />
      )}

      {/* Auth Debug Bar: show only when explicitly enabled via REACT_APP_SHOW_AUTH_BANNER="true" */}
      {process.env.REACT_APP_SHOW_AUTH_BANNER === 'true' && (
        <div style={{position:'fixed',top:isAuthenticated?56:0,left:0,right:0,zIndex:9999,background:'#222',color:'#ddd',fontSize:12,padding:'4px 8px',display:'flex',gap:'12px',alignItems:'center'}}>
          <span>Auth: {isAuthenticated ? 'YES' : 'NO'}</span>
          <span>User: {user?.role || '—'}</span>
          <span>Token: {localStorage.getItem('auth_token') ? 'present' : 'none'}</span>
          {window.__DEV_AUTH_MODE && <span>Mode: {window.__DEV_AUTH_MODE}</span>}
        </div>
      )}
      
      <Routes>
        {/* Public routes */}
        <Route 
          path="/login" 
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
          } 
        />
        
        {/* Protected routes */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/" 
          element={
            <ProtectedRoute requiredRole="Manager">
              <Home 
                addToCart={addToCart} 
                searchQuery={globalSearchQuery}
                onSearchChange={handleGlobalSearchChange}
                onSearchClear={handleGlobalSearchClear}
              />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/checkout" 
          element={
            <ProtectedRoute requiredRole="Manager">
              <Checkout 
                cart={cart} 
                clearCart={clearCart} 
                updateCartItem={updateCartItem} 
                removeCartItem={removeCartItem} 
                addToast={addToast} 
              />
            </ProtectedRoute>
          } 
        />

        {/* Admin-only routes */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute requiredRole="Admin">
              <div>
                {/* Admin landing: redirect to users management by default */}
                <UsersManage />
              </div>
            </ProtectedRoute>
          } 
        />

        <Route
          path="/admin/users"
          element={
            <ProtectedRoute requiredRole="Admin">
              <UsersManage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/events"
          element={
            <ProtectedRoute requiredRole="Admin">
              <EventManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/orders"
          element={
            <ProtectedRoute requiredRole="Admin">
              <AdminOrders />
            </ProtectedRoute>
          }
        />

        {/* Manager routes */}
        <Route 
          path="/manager" 
          element={
            <ProtectedRoute requiredRole="Manager">
              <div>Manager Panel - Coming Soon</div>
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/products/manage" 
          element={
            <ProtectedRoute requiredRole="Manager">
              <ProductsManage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/stock"
          element={
            <ProtectedRoute requiredRole="Manager">
              <Stock />
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports/inventory"
          element={
            <ProtectedRoute requiredRole="Manager">
              <InventoryReport />
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports/sales"
          element={
            <ProtectedRoute requiredRole="Manager">
              <SalesReport />
            </ProtectedRoute>
          }
        />

        {/* Redirect to appropriate page based on auth status */}
        <Route 
          path="*" 
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
          } 
        />
      </Routes>
      
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </Router>
  );
}

// Main App Component with Providers
function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
