import { Link, useLocation } from "react-router-dom";
import { ThemeToggle } from "./ThemeProvider";
import SearchBar from "./SearchBar";

export default function Navbar({ cartCount, searchQuery, onSearchChange, onSearchClear, user, onLogout }) {
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  return (
    <div className="navbar">
      <div className="navbar-inner container">
        <Link to="/dashboard" className="nav-brand">
          <span>�</span>
          <span style={{ color: "var(--text)" }}>Inventory Management</span>
        </Link>
        
        {/* Global search - only show on home page on mobile, always on desktop */}
        {isHomePage && (
          <div className="navbar-search">
            <SearchBar
              value={searchQuery}
              onChange={onSearchChange}
              onClear={onSearchClear}
              placeholder="Search products..."
              className="navbar-search-bar"
            />
          </div>
        )}
        
        <div className="nav-links">
          <Link to="/dashboard" className="nav-link">Dashboard</Link>
          
          {/* POS/Request page - Manager only */}
          {user && user.role === 'Manager' && (
            <Link to="/" className="nav-link">Request Stock</Link>
          )}
          
          {/* Cart - Manager only */}
            {user && user.role === 'Manager' && (
            <Link to="/checkout" className="nav-link cart-link" aria-label={`Cart with ${cartCount} items`}>
              <span className="cart-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
              </span>
              <span className="badge" aria-label="cart items">{cartCount}</span>
            </Link>
          )}

          {/* Manage Products link for Manager/Admin */}
          {user && ['Manager', 'Admin'].includes(user.role) && (
            <Link to="/products/manage" className="nav-link">Manage Products</Link>
          )}

          {/* Stock (Manager) - view warehouse vs shop and request */}
          {user && user.role === 'Manager' && (
            <Link to="/stock" className="nav-link">Stock</Link>
          )}

          {/* Event Management - Admin only */}
          {user && user.role === 'Admin' && (
            <Link to="/events" className="nav-link">Event Management</Link>
          )}

          {/* Orders - Admin only */}
          {user && user.role === 'Admin' && (
            <Link to="/admin/orders" className="nav-link">Orders</Link>
          )}

          {/* User info and logout */}
          {user && (
            <div className="user-menu">
              <span className="user-info">
                <span className="user-name">{user.name}</span>
                <span className={`user-role role-${user.role.toLowerCase()}`}>{user.role}</span>
              </span>
              <button 
                onClick={onLogout} 
                className="nav-link logout-btn"
                aria-label="Logout"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16,17 21,12 16,7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          )}
          
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}