import React, { useEffect, useState } from 'react';
import { adminAPI } from '../api';
import { useAuth } from '../contexts/AuthContext';

export default function UsersManage() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role_id: 2 });
  const [saving, setSaving] = useState(false);
  const [userEvents, setUserEvents] = useState({}); // { [userId]: [eventRows] }
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getUsers();
      setUsers(res.data.users || []);
    } catch (e) {
      console.error('[UsersManage] Load users error:', e);
      setError(e.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    const loadAllUserEvents = async () => {
      if (!users || users.length === 0) {
        setUserEvents({});
        return;
      }
      try {
        setLoadingAssignments(true);
        const map = {};
        for (const u of users) {
          const id = String(u.user_id || u.id);
          try {
            const res = await adminAPI.getUserEvents(u.user_id || u.id);
            map[id] = res.data.events || [];
          } catch (_e) {
            map[id] = [];
          }
        }
        setUserEvents(map);
      } finally {
        setLoadingAssignments(false);
      }
    };
    loadAllUserEvents();
  }, [users]);

  if (!isAdmin()) {
    return (
      <div className="container" style={{ padding: 'var(--space-6)' }}>
        <h2>Access Denied</h2>
        <p>You must be an admin to view this page.</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: 'var(--space-6)' }}>
      <h1 className="heading-xl">User Management</h1>
      {error && <div className="alert error">{error}</div>}

      <div style={{ marginTop: '1rem' }}>
        {/* Quick Create User */}
        <div className="panel" style={{ marginBottom: '1rem', padding: 'var(--space-6)' }}>
          <h3 className="heading-md">Create new user</h3>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            setError('');
            try {
              const payload = {
                name: form.name,
                email: form.email,
                password: form.password || undefined,
                role_id: Number(form.role_id)
              };
              await adminAPI.createUser(payload);
              setForm({ name: '', email: '', password: '', role_id: 2 });
              await loadUsers();
            } catch (err) {
              console.error('[UsersManage] Create user error:', err);
              setError(err.response?.data?.error || 'Failed to create user');
            } finally {
              setSaving(false);
            }
          }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
              <input type="email" placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
              <input type="password" placeholder="Password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
              <select value={form.role_id} onChange={e => setForm({...form, role_id: e.target.value})}>
                <option value={1}>Admin</option>
                <option value={2}>Manager</option>
              </select>
              <button className="btn primary" type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create User'}</button>
            </div>
          </form>
        </div>

        {loading ? (
          <p>Loading users...</p>
        ) : (
          <div className="panel" style={{ padding: 'var(--space-6)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Events</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '1rem' }}>No users found.</td>
                  </tr>
                )}
                {users.map(u => {
                  const id = String(u.user_id || u.id);
                  const assigned = userEvents[id] || [];
                  return (
                    <tr key={id}>
                      <td>{id}</td>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>{u.role_name || (u.role || '—')}</td>
                      <td>
                        {loadingAssignments ? (
                          <span className="subtle">Loading…</span>
                        ) : assigned.length === 0 ? (
                          <span className="subtle">No event</span>
                        ) : (
                          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                            {assigned.map(ev => (
                              <span key={`${id}-${ev.event_id}`} className="badge" title={ev.place ? `Place: ${ev.place}` : ''}>
                                {ev.event_name || ev.name || `Event ${ev.event_id}`}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>{u.created_at ? new Date(u.created_at).toLocaleString() : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
