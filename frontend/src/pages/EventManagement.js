import React, { useEffect, useState } from 'react';
import { adminAPI } from '../api';
import { useAuth } from '../contexts/AuthContext';

export default function EventManagement() {
  const { isAdmin } = useAuth();

  const [events, setEvents] = useState([]);
  const [eventUserCounts, setEventUserCounts] = useState({});
  const [eventAssignedMap, setEventAssignedMap] = useState({}); // { [eventId]: string[] }
  const [assignedUserIds, setAssignedUserIds] = useState(new Set()); // global assigned set
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  // Create Event inline form
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ event_name: '', place: '' });
  const [creating, setCreating] = useState(false);

  // Assign single owner modal
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState(null);
  const [assignedIds, setAssignedIds] = useState([]); // string[] of user ids
  const [loadingAssigned, setLoadingAssigned] = useState(false);
  const [filterLeft, setFilterLeft] = useState('');

  const loadEvents = async () => {
    try {
      const res = await adminAPI.getEvents();
      const evts = res.data.events || [];
      setEvents(evts);
      // Preload counts
      const counts = {};
      const assignedMap = {};
      const globalAssigned = new Set();
      for (const ev of evts) {
        try {
          const r = await adminAPI.getEventUsers(ev.event_id);
          const list = (r.data.users || []);
          counts[ev.event_id] = list.length;
          const ids = list.map(u => String(u.user_id || u.id));
          assignedMap[ev.event_id] = ids;
          ids.forEach(id => globalAssigned.add(id));
        } catch (_) { /* ignore */ }
      }
      setEventUserCounts(counts);
      setEventAssignedMap(assignedMap);
      setAssignedUserIds(globalAssigned);
    } catch (e) {
      console.error('[EventManagement] loadEvents error:', e);
      setError(e.response?.data?.error || 'Failed to load events');
    }
  };

  const loadUsers = async () => {
    try {
      const res = await adminAPI.getUsers();
      setUsers(res.data.users || []);
    } catch (e) {
      console.error('[EventManagement] loadUsers error:', e);
      setError(e.response?.data?.error || 'Failed to load users');
    }
  };

  useEffect(() => {
    loadEvents();
    loadUsers();
  }, []);

  const openAssignModal = async (ev) => {
    setActiveEvent(ev);
    setIsAssignOpen(true);
    try {
      setLoadingAssigned(true);
      const res = await adminAPI.getEventUsers(ev.event_id);
      const ids = (res.data.users || []).map(u => String(u.user_id || u.id));
      setAssignedIds(ids.slice(0,1)); // single owner enforced
      // Ensure local maps reflect latest for this event as well
      setEventAssignedMap(m => ({ ...m, [ev.event_id]: ids }));
    } catch (e) {
      console.error('[EventManagement] Load event users error:', e);
      setError(e.response?.data?.error || 'Failed to load event users');
    } finally {
      setLoadingAssigned(false);
    }
  };

  const closeAssignModal = () => {
    setIsAssignOpen(false);
    setActiveEvent(null);
    setAssignedIds([]);
    setFilterLeft('');
  };

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
      <h1 className="heading-xl">Event Management</h1>
      {error && <div className="alert error">{error}</div>}

      <div className="panel" style={{ padding: 'var(--space-6)', marginBottom: '1rem' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <div>
            <h3 className="heading-md">Events</h3>
            <p className="subtle">Create and manage pop-up events. Assign a single owner for each event.</p>
          </div>
          <button className="btn" onClick={()=> setIsCreateOpen(v=>!v)}>{isCreateOpen ? 'Close' : 'New Event'}</button>
        </div>

        {isCreateOpen && (
          <div className="panel" style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', border:'1px solid var(--border)', borderRadius:'var(--radius)' }}>
            <h4 className="heading-sm" style={{marginBottom:8}}>Create new event</h4>
            <div className="stack" style={{gap:8, marginBottom:8}}>
              <input placeholder="Event name" value={createForm.event_name} onChange={e=> setCreateForm({...createForm, event_name: e.target.value})} />
              <input placeholder="Place" value={createForm.place} onChange={e=> setCreateForm({...createForm, place: e.target.value})} />
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn btn-secondary" onClick={()=> { setIsCreateOpen(false); setCreateForm({event_name:'', place:''}); }}>Cancel</button>
              <button className="btn" disabled={creating || !createForm.event_name}
                onClick={async ()=>{
                  try {
                    setCreating(true);
                    await adminAPI.createEvent({ event_name: createForm.event_name, place: createForm.place });
                    setCreateForm({ event_name: '', place: '' });
                    setIsCreateOpen(false);
                    await loadEvents();
                  } catch (err) {
                    console.error('Create event error', err);
                    setError(err.response?.data?.error || 'Failed to create event');
                  } finally {
                    setCreating(false);
                  }
                }}>{creating ? 'Creating...' : 'Create Event'}</button>
            </div>
          </div>
        )}

        <div className="grid" style={{ marginTop: 'var(--space-6)' }}>
          {events.map(ev => (
            <div key={ev.event_id} className="card" style={{ border:'1px solid var(--border)', borderRadius: 'var(--radius-lg)'}}>
              <div className="card-body">
                <h3 style={{marginBottom:4}}>{ev.event_name || `Event ${ev.event_id}`}</h3>
                <p className="subtle" style={{marginBottom:8}}>{ev.place || '—'}</p>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                  <span className="subtle">Assigned: {eventUserCounts[ev.event_id] ?? '—'}</span>
                  <button className="btn btn-secondary" onClick={()=> openAssignModal(ev)}>Manage Users</button>
                </div>
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <div className="subtle">No events yet. Click "New Event" to create one.</div>
          )}
        </div>
      </div>

      {/* Assign Users Modal */}
      {isAssignOpen && (
        <div className="modal-portal">
          <div className="modal-backdrop" onClick={closeAssignModal} />
          <div className="modal" style={{ maxWidth: 900 }}>
            <div className="modal-body">
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
                <div>
                  <h3 className="heading-md">Assign a user — {activeEvent?.event_name}</h3>
                  <p className="subtle">Pick exactly one user for this event, or leave empty to unassign.</p>
                </div>
                <span className="subtle">Assigned: {assignedIds.length === 1 ? '1 user' : 'None'}</span>
              </div>
              <div className="panel" style={{padding:'var(--space-4)'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                  <strong>Managers</strong>
                  <div style={{display:'flex', gap:8, alignItems:'center'}}>
                    <input placeholder="Search" value={filterLeft} onChange={e=> setFilterLeft(e.target.value)} style={{maxWidth:200}} />
                    <button className="btn btn-secondary" onClick={()=> setAssignedIds([])}>Clear</button>
                  </div>
                </div>
                <div style={{border:'1px solid var(--border)', borderRadius:'var(--radius)', maxHeight:320, overflow:'auto'}}>
                  {loadingAssigned ? <div className="subtle" style={{padding:8}}>Loading...</div> : (
                    <ul className="list" style={{listStyle:'none', margin:0, padding:8}}>
                      {users.filter(u=>{
                        // Only managers
                        const isManager = (parseInt(u.role_id) === 2) || (u.role_name === 'Manager');
                        if (!isManager) return false;
                        // Exclude already-assigned users to other events, but allow the one assigned to this active event
                        const id = String(u.user_id || u.id);
                        const assignedHere = (eventAssignedMap[activeEvent?.event_id] || []).includes(id);
                        if (!assignedHere && assignedUserIds && assignedUserIds.has && assignedUserIds.has(id)) {
                          return false;
                        }
                        const q = filterLeft.trim().toLowerCase();
                        if (!q) return true;
                        return (u.name||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q);
                      }).map(u => {
                        const id = String(u.user_id || u.id);
                        const checked = assignedIds.includes(id);
                        return (
                          <li key={id} className="list-item" style={{padding:'8px 10px'}}>
                            <label style={{display:'flex', gap:8, alignItems:'center', width:'100%'}}>
                              <input type="radio" name="eventOwner" checked={checked} onChange={()=> setAssignedIds([id])} />
                              <span style={{flex:1}}>{u.name} — <span className="subtle">{u.email}</span></span>
                              {checked && <span className="badge">Selected</span>}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginTop:16}}>
                <button className="btn btn-secondary" onClick={closeAssignModal}>Cancel</button>
                <button className="btn" onClick={async ()=>{
                  try {
                    await adminAPI.setEventUsers(activeEvent.event_id, assignedIds);
                    // Refresh all events/assignments to update filters and counts
                    await loadEvents();
                    closeAssignModal();
                  } catch (err) {
                    console.error('Save event users error', err);
                    setError(err.response?.data?.error || 'Failed to save event users');
                  }
                }}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
