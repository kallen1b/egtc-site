import { useEffect, useMemo, useState } from 'react';
import { getNights, getMyAvailability, toggleAvailability } from './api';
import Admin from './Admin';

/**
 * Small helper to safely read from localStorage (avoids errors in odd environments)
 */
function getLS(key, fallback = '') {
  try {
    const v = localStorage.getItem(key);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Format "HH:MM:SS" → "HH:MM"
 */
function hhmm(t) {
  return (t || '').slice(0, 5);
}

export default function App() {
  // ------------------------------------------------------------
  // Identity (temporary until OAuth): stored locally so users only enter once
  // ------------------------------------------------------------
  const [email, setEmail] = useState(() => getLS('email', ''));
  const [name, setName] = useState(() => getLS('name', ''));

  // ------------------------------------------------------------
  // Data state
  // nights: list of upcoming schedule nights from API
  // mine:   the current user's availability mapped by night
  // ------------------------------------------------------------
  const [nights, setNights] = useState([]);
  const [mine, setMine] = useState([]);

  // ------------------------------------------------------------
  // UI/UX state
  // ------------------------------------------------------------
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');       // show a single error banner
  const [showAdmin, setShowAdmin] = useState(false);

  // Ready to load = user has entered an email
  const ready = useMemo(() => email.trim().length > 3, [email]);

  /**
   * Persist identity and trigger a reload
   */
  function saveIdentity() {
    const e = email.trim();
    const n = name.trim();
    try {
      localStorage.setItem('email', e);
      localStorage.setItem('name', n);
    } catch {}
    if (e) load(); // refresh data immediately
  }

  /**
   * Fetch nights + my availability together
   * Keeps one place responsible for the loading/error flags
   */
  async function load() {
    setError('');
    setLoading(true);
    try {
      const [n, my] = await Promise.all([
        getNights(),
        getMyAvailability(email.trim()),
      ]);
      setNights(n);
      setMine(my);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  /**
   * Initial/whenever-ready load
   * Runs when `ready` flips from false→true (user has entered an email)
   */
  useEffect(() => {
    if (ready) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  /**
   * Toggle my availability for a given night
   * - Computes the next state (available ↔ unavailable)
   * - Calls API
   * - Refreshes my availability after the write
   */
  async function onToggle(night) {
    if (!ready) return;
    setError('');
    const current = mine.find((m) => m.night_id === night.id);
    const next = current?.status === 'available' ? 'unavailable' : 'available';
    try {
      await toggleAvailability({
        email: email.trim(),
        full_name: name.trim() || null,
        night_id: night.id, // UUID
        status: next,
      });
      // pull a fresh copy of "my" availability so the UI is in sync
      const my = await getMyAvailability(email.trim());
      setMine(my);
    } catch (e) {
      setError(String(e?.message || e));
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '24px auto', padding: 16, fontFamily: 'sans-serif' }}>
      <h1>EGTC Availability</h1>

      {/* Identity (temporary until OAuth) */}
      <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        <input
          aria-label="Email"
          placeholder="Email (temporary until OAuth login)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 8, fontSize: 16 }}
        />
        <input
          aria-label="Full name"
          placeholder="Full name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: 8, fontSize: 16 }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={saveIdentity} disabled={!email.trim()} style={{ padding: '8px 12px' }}>
            Save
          </button>
          <button onClick={load} disabled={!ready || loading} style={{ padding: '8px 12px' }}>
            Refresh
          </button>
        </div>
      </div>

      {/* Admin tools (token-protected on the API; this just shows/hides the panel) */}
      <button
        onClick={() => setShowAdmin((s) => !s)}
        style={{ padding: '8px 12px', marginBottom: 12 }}
        aria-expanded={showAdmin}
      >
        {showAdmin ? 'Hide Admin' : 'Show Admin'}
      </button>
      {showAdmin && <Admin />}

      {/* Error + Loading banners */}
      {error && <div style={{ color: 'red', marginBottom: 12 }}>Error: {error}</div>}
      {loading && <div>Loading…</div>}

      {/* Nights table */}
      {!loading && ready && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
              <th style={{ padding: 8 }}>Date</th>
              <th style={{ padding: 8 }}>Time</th>
              <th style={{ padding: 8 }}>Notes</th>
              <th style={{ padding: 8 }}>You</th>
              <th style={{ padding: 8 }} />
            </tr>
          </thead>
          <tbody>
            {nights.map((n) => {
              const me = mine.find((m) => m.night_id === n.id);
              const status = me?.status || 'unavailable';
              const time = `${hhmm(n.start_time)}–${hhmm(n.end_time)}`;

              return (
                <tr key={n.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 8 }}>{n.night_date}</td>
                  <td style={{ padding: 8 }}>{time}</td>
                  <td style={{ padding: 8 }}>{n.notes || ''}</td>
                  <td style={{ padding: 8, fontWeight: 600 }}>{status}</td>
                  <td style={{ padding: 8 }}>
                    <button
                      onClick={() => onToggle(n)}
                      disabled={!ready || loading}
                      style={{ padding: '6px 10px' }}
                      aria-label={`Toggle your availability for ${n.night_date}`}
                    >
                      {status === 'available' ? 'Set Unavailable' : 'Set Available'}
                    </button>
                  </td>
                </tr>
              );
            })}

            {!nights.length && (
              <tr>
                <td colSpan={5} style={{ padding: 8 }}>
                  No upcoming nights.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* If user hasn’t entered an email yet, give a gentle prompt */}
      {!ready && (
        <div style={{ marginTop: 8, color: '#555' }}>
          Enter your email above and click Save to see and set your availability.
        </div>
      )}
    </div>
  );
}
