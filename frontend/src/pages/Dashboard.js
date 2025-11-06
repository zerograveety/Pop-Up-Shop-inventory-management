import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import './Dashboard.css';
import { adminAPI } from '../api';

const Dashboard = () => {
  const { user, isAuthenticated, isAdmin, isManager, isCashier } = useAuth();
  const [myEvents, setMyEvents] = useState([]);
  const [evtError, setEvtError] = useState('');
  const navigate = useNavigate();


  // Load manager's assigned event(s) at component level
  useEffect(() => {
    const load = async () => {
      setEvtError('');
      try {
        if (!isManager()) return;
        const id = user?.user_id || user?.id;
        if (!id) return;
        const res = await adminAPI.getUserEvents(id);
        setMyEvents(res.data.events || []);
      } catch (e) {
        setEvtError(e.response?.data?.error || 'Failed to load your event assignment');
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.user_id, user?.id]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const getDashboardContent = () => {
    if (isAdmin()) {
      return (
        <div className="dashboard-content">
          <div className="dashboard-header">
            <h1>Admin Dashboard</h1>
            <p>Complete system overview and management</p>
          </div>
          
          <div className="dashboard-grid">
            <div className="dashboard-card">
              <div className="card-icon admin">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                  <circle cx="8.5" cy="7" r="4"/>
                  <polyline points="17,11 19,13 23,9"/>
                </svg>
              </div>
              <h3>User Management</h3>
              <p>Manage users, roles, and permissions</p>
              <div className="card-actions">
                <button className="btn-primary" onClick={() => navigate('/admin/users')}>Manage Users</button>
              </div>
            </div>

            <div className="dashboard-card">
              <div className="card-icon products">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                  <polyline points="3.27,6.96 12,12.01 20.73,6.96"/>
                  <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
              </div>
              <h3>Product Management</h3>
              <p>Full product catalog control</p>
              <div className="card-actions">
                <button className="btn-primary" onClick={() => navigate('/products/manage')}>Manage Products</button>
              </div>
            </div>

            <div className="dashboard-card">
              <div className="card-icon orders">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                </svg>
              </div>
              <h3>Orders</h3>
              <p>Review and approve managers' requests</p>
              <div className="card-actions">
                <button className="btn-primary" onClick={() => navigate('/admin/orders')}>Open Orders</button>
              </div>
            </div>

            <div className="dashboard-card">
              <div className="card-icon settings">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="14" rx="2" ry="2"/>
                  <path d="M7 8h10M7 12h6"/>
                </svg>
              </div>
              <h3>Event Management</h3>
              <p>Create events and assign owners</p>
              <div className="card-actions">
                <button className="btn-primary" onClick={() => navigate('/events')}>Open Events</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (isManager()) {
      return (
        <div className="dashboard-content">
          <div className="dashboard-header">
            <h1>Manager Dashboard</h1>
            <p>Inventory and sales management</p>
          </div>
          <div className="dashboard-grid" style={{marginBottom: '1rem'}}>
            <div className="dashboard-card">
              <div className="card-icon admin">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                  <circle cx="8.5" cy="7" r="4"/>
                </svg>
              </div>
              <h3>Your Assignment</h3>
              {evtError && <p className="subtle" style={{color:'var(--danger)'}}>{evtError}</p>}
              {myEvents.length === 0 ? (
                <p className="subtle">You are not assigned to any event.</p>
              ) : (
                <div className="stack" style={{gap:6}}>
                  {myEvents.map(ev => (
                    <div key={ev.event_id} className="badge" title={ev.place || ''}>
                      {ev.event_name} {ev.place ? `— ${ev.place}` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="dashboard-grid">
            <div className="dashboard-card">
              <div className="card-icon products">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                </svg>
              </div>
              <h3>Product Management</h3>
              <p>Add, edit, and manage products</p>
              <div className="card-actions">
                <button className="btn-primary" onClick={() => navigate('/products/manage')}>Manage Products</button>
              </div>
            </div>

            <div className="dashboard-card">
              <div className="card-icon orders">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                </svg>
              </div>
              <h3>Request Stock</h3>
              <p>Request inventory from Admin</p>
              <div className="card-actions">
                <button className="btn-primary" onClick={() => navigate('/')}>Open Request</button>
              </div>
            </div>

            <div className="dashboard-card">
              <div className="card-icon inventory">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8z"/>
                  <path d="M3.27 6.96L12 12.01l8.73-5.05"/>
                  <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
              </div>
              <h3>Stock</h3>
              <p>View and adjust your shop stock</p>
              <div className="card-actions">
                <button className="btn-primary" onClick={() => navigate('/stock')}>Open Stock</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Cashier role removed; fall through to other dashboards

    return (
      <div className="dashboard-content">
        <div className="dashboard-header">
          <h1>Dashboard</h1>
          <p>Welcome to the inventory management system</p>
        </div>
        <div className="no-role-message">
          <p>No specific role assigned. Please contact an administrator.</p>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-sidebar">
        <div className="user-info">
          <div className="user-avatar">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="user-details">
            <h3>{user?.name || 'User'}</h3>
            <p>{user?.email}</p>
            <span className={`role-badge role-${user?.role?.toLowerCase()}`}>
              {user?.role}
            </span>
          </div>
        </div>
      </div>
      
      <div className="dashboard-main">
        {getDashboardContent()}
      </div>
    </div>
  );
};

export default Dashboard;