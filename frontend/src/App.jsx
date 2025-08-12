import { useEffect, useState } from 'react';
import { getNights, getMyAvailability, toggleAvailability } from './api';

export default function App() {
  const [email, setEmail] = useState(() => localStorage.getItem('email') || '');
  const [name, setName] = useState(() => localStorage.getItem('name') || '');
  const [nights, setNights] = useState([]);
  const [mine, setMine] = useState([]); // my availability rows aligned to nights
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ready = email.trim().length > 3;

  async function load() {
    setError('');
    setLoading(true);
    try {
      const [n, my] = await Promise.all([
        getNights(),
        getMyAvailability(email.trim())
      ]);
      setNights(n);
      setMine(my);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (ready) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function saveIdentity() {
    localStorage.setItem('email', email.trim());
    localStorage.setItem('name', name.trim());
    if (email.trim()) load();
  }

  async function onToggle(night) {
    setError('');
    const current = mine.find(m => m.night_id === night.id);
    const next = current?.status === 'available' ? 'unavailable' : 'available';
    try {
      await toggleAvailability({
        email: email.trim(),
        full_name: name.trim() || null,
        night_id: night.id, // UUID
        status: next
      });
      // refresh my availability
      const my = await getMyAvailability(email.trim());
      setMine(my);
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '24px auto', padding: 16, fontFamily: 'sans-serif' }}>
      <h1>EGTC Availability</h1>

      <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        <input
          placeholder="Email (used until OAuth)"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ padding: 8, fontSize: 16 }}
        />
        <input
          placeholder="Full name (optional)"
          value={name}
          onChange={e => setName(e.target.value)}
          style={{ padding: 8, fontSize: 16 }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={saveIdentity} disabled={!email.trim()} style={{ padding: '8px 12px' }}>
            Save
          </button>
          <button onClick={load} disabled={!ready} style={{ padding: '8px 12px' }}>
            Refresh
          </button>
        </div>
      </div>

      {error && <div style={{ color: 'red', marginBottom: 12 }}>Error: {error}</div>}
      {loading && <div>Loading…</div>}

      {!loading && ready && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
              <th style={{ padding: 8 }}>Date</th>
              <th style={{ padding: 8 }}>Time</th>
              <th style={{ padding: 8 }}>Notes</th>
              <th style={{ padding: 8 }}>You</th>
              <th style={{ padding: 8 }}></th>
            </tr>
          </thead>
          <tbody>
            {nights.map(n => {
              const me = mine.find(m => m.night_id === n.id);
              const status = me?.status || 'unavailable';
              const time = `${n.start_time?.slice(0,5)}–${n.end_time?.slice(0,5)}`;
              return (
                <tr key={n.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 8 }}>{n.night_date}</td>
                  <td style={{ padding: 8 }}>{time}</td>
                  <td style={{ padding: 8 }}>{n.notes || ''}</td>
                  <td style={{ padding: 8, fontWeight: 600 }}>
                    {status}
                  </td>
                  <td style={{ padding: 8 }}>
                    <button onClick={() => onToggle(n)} style={{ padding: '6px 10px' }}>
                      {status === 'available' ? 'Set Unavailable' : 'Set Available'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {!nights.length && (
              <tr>
                <td colSpan={5} style={{ padding: 8 }}>No upcoming nights.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
