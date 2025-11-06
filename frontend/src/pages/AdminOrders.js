import React, { useEffect, useState } from 'react';
import { adminAPI } from '../api';
import { useAuth } from '../contexts/AuthContext';

export default function AdminOrders() {
  const { isAdmin } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('requested');
  const [busyId, setBusyId] = useState(null);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getStockOrders(statusFilter);
      setOrders(res.data?.orders || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin()) return;
    loadOrders();
  }, [statusFilter]);

  const approve = async (id) => {
    try {
      setBusyId(id);
      await adminAPI.approveStockOrder(id);
      await loadOrders();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to approve');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id) => {
    try {
      setBusyId(id);
      await adminAPI.rejectStockOrder(id);
      await loadOrders();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to reject');
    } finally {
      setBusyId(null);
    }
  };

  const fulfill = async (id) => {
    try {
      setBusyId(id);
      await adminAPI.fulfillStockOrder(id);
      await loadOrders();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to fulfill');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="container" style={{ padding: 'var(--space-6)' }}>
      <h1 className="heading-xl">Orders</h1>
      <p className="subtle">View and manage managers' stock requests.</p>

      {error && <div className="alert error" style={{ marginTop: '1rem' }}>{error}</div>}

      <div className="panel" style={{ marginTop: '1rem' }}>
        <div style={{display:'flex',gap:12,alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'}}>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <label>Status:</label>
            <select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}>
              <option value="requested">Requested</option>
              <option value="approved">Approved</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="rejected">Rejected</option>
              <option value="">All</option>
            </select>
          </div>
          <button className="btn" onClick={loadOrders} disabled={loading}>Refresh</button>
        </div>
      </div>

      <div className="panel" style={{ marginTop: '1rem' }}>
        {loading ? <p>Loading...</p> : (
          orders.length === 0 ? <p className="subtle">No orders found.</p> : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Event</th>
                    <th>Manager</th>
                    <th>Status</th>
                    <th>Items</th>
                    <th style={{width:240}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id}>
                      <td>#{o.id}</td>
                      <td>{o.event_name || '-'}</td>
                      <td>{o.manager_name || '-'}</td>
                      <td><span className={`badge status-${o.status}`}>{o.status}</span></td>
                      <td>
                        <ul style={{margin:0,paddingLeft:18}}>
                          {(o.items || []).map(it => (
                            <li key={it.id}>{it.product_name} × {it.quantity}</li>
                          ))}
                        </ul>
                      </td>
                      <td>
                        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                          {o.status === 'requested' && (
                            <>
                              <button className="btn small" disabled={busyId===o.id} onClick={()=>approve(o.id)}>
                                {busyId===o.id? 'Approving...' : 'Approve'}
                              </button>
                              <button className="btn small danger" disabled={busyId===o.id} onClick={()=>reject(o.id)}>
                                {busyId===o.id? 'Rejecting...' : 'Reject'}
                              </button>
                            </>
                          )}
                          {o.status === 'approved' && (
                            <button className="btn small primary" disabled={busyId===o.id} onClick={()=>fulfill(o.id)}>
                              {busyId===o.id? 'Fulfilling...' : 'Fulfill'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
