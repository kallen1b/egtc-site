const API = import.meta.env.VITE_API_URL;

export async function getNights() {
  const r = await fetch(`${API}/nights`);
  if (!r.ok) throw new Error('Failed to load nights');
  return r.json();
}

export async function getMyAvailability(email) {
  const r = await fetch(`${API}/my-availability?email=${encodeURIComponent(email)}`);
  if (!r.ok) throw new Error('Failed to load my availability');
  return r.json();
}

export async function toggleAvailability({ email, full_name, night_id, status }) {
  const r = await fetch(`${API}/availability/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, full_name, night_id, status }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message || 'Toggle failed');
  }
  return r.json();
}
