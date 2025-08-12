import { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL;
const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN;

async function fetchCounts() {
  const r = await fetch(`${API}/nights-with-counts`, {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }
  });
  if (!r.ok) throw new Error('Failed to load counts');
  return r.json();
}

async function fetchAttendees(id) {
  const r = await fetch(`${API}/nights/${id}/availability`, {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }
  });
  if (!r.ok) throw new Error('Failed to load attendees');
  return r.json();
}

async function createNight(payload) {
  const r = await fetch(`${API}/nights`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ADMIN_TOKEN}`
    },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error('Failed to create night');
  return r.json();
}

async function deleteNight(id) {
  const r = await fetch(`${API}/nights/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }
  });
  if (!r.ok) throw new Error('Failed to delete night');
  return r.json();
}

export default function Admin() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    night_date: '',
    start_time: '19:00',
    end_time: '21:00',
    notes: ''
  });

  const [selected, setSelected] = useState(null); // selected night row
  const [attendees, setAttendees] = useState([]);
  const [loadingAtt, setLoadingAtt] = useState(false);

  async function load() {
    setError('');
    try {
      const data = await fetchCounts();
      setRows(data);
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  useEffect(() => { load(); }, []);

  async function onCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await createNight(form);
      setForm({ night_date: '', start_time: '19:00', end_time: '21:00', notes: '' });
      await load();
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  async function onDelete(id) {
    if (!confirm('Delete this night?')) return;
    setError('');
    try {
      await deleteNight(id);
      if (selected?.id === id) {
        setSelected(null);
        setAttendees([]);
      }
      await load();
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  async function onView(r) {
    setSelected(r);
    setLoadingAtt(true);
    setAttendees([]);
    setError('');
    try {
      const list = await fetchAttendees(r.id);
      setAttendees(list);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoadingAtt(false);
    }
  }

  return (
    <div style={{ border: '1px solid #ddd', padding: 16, borderRadius: 8, marginTop: 24 }}>
      <h2>Admin</h2>
      {error && <div style={{ color: 'red', marginBottom: 8 }}>Error: {error}</div>}

      <form onSubmit={onCreate} style={{ display: 'grid', gap: 8, marginBottom: 16, maxWidth: 520 }}>
        <div>
          <label>Date (YYYY-MM-DD)</label><br />
          <input
            value={form.night_date}
            onChange={e => setForm({ ...form, night_date: e.target.value })}
            style={{ padding: 8, width: 220 }}
            required
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div>
            <label>Start</label><br />
            <input
              value={form.start_time}
              onChange={e => setForm({ ...form, start_time: e.target.value })}
              style={{ padding: 8, width: 120 }}
              required
            />
          </div>
          <div>
            <label>End</label><br />
            <input
              value={form.end_time}
              onChange={e => setForm({ ...form, end_time: e.target.value })}
              style={{ padding: 8, width: 120 }}
              required
            />
          </div>
        </div>
        <div>
          <label>Notes</label><br />
          <input
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            style={{ padding: 8, width: 360 }}
          />
        </div>
        <button type="submit" style={{ padding: '8px 12px', width: 160 }}>Add Night</button>
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
            <th style={{ padding: 8 }}>Date</th>
            <th style={{ padding: 8 }}>Time</th>
            <th style={{ padding: 8 }}>Notes</th>
            <th style={{ padding: 8 }}>Available</th>
            <th style={{ padding: 8 }}>Unavailable</th>
            <th style={{ padding: 8 }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const time = `${String(r.start_time).slice(0,5)}–${String(r.end_time).slice(0,5)}`;
            return (
              <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: 8 }}>{r.night_date}</td>
                <td style={{ padding: 8 }}>{time}</td>
                <td style={{ padding: 8 }}>{r.notes || ''}</td>
                <td style={{ padding: 8 }}>{r.available_count}</td>
                <td style={{ padding: 8 }}>{r.unavailable_count}</td>
                <td style={{ padding: 8 }}>
                  <button onClick={() => onView(r)} style={{ padding: '6px 10px', marginRight: 6 }}>
                    View
                  </button>
                  <button onClick={() => onDelete(r.id)} style={{ padding: '6px 10px' }}>
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
          {!rows.length && (
            <tr><td colSpan={6} style={{ padding: 8 }}>No upcoming nights</td></tr>
          )}
        </tbody>
      </table>

      {selected && (
        <div style={{ marginTop: 16, borderTop: '1px solid #ddd', paddingTop: 12 }}>
          <h3>
            Night: {selected.night_date}{' '}
            {String(selected.start_time).slice(0,5)}–{String(selected.end_time).slice(0,5)}
          </h3>
          {loadingAtt ? (
            <div>Loading attendees…</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                  <th style={{ padding: 8 }}>Name</th>
                  <th style={{ padding: 8 }}>Email</th>
                  <th style={{ padding: 8 }}>Status</th>
                  <th style={{ padding: 8 }}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {attendees.map(a => (
                  <tr key={a.member_id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: 8 }}>{a.full_name || ''}</td>
                    <td style={{ padding: 8 }}>{a.email}</td>
                    <td style={{ padding: 8, fontWeight: 600 }}>{a.status}</td>
                    <td style={{ padding: 8 }}>{a.updated_at?.replace('T',' ').slice(0,16)}</td>
                  </tr>
                ))}
                {!attendees.length && (
                  <tr><td colSpan={4} style={{ padding: 8 }}>No responses yet.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
