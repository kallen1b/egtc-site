console.log('ADMIN_TOKEN loaded:', !!process.env.ADMIN_TOKEN, 'value:', process.env.ADMIN_TOKEN);


require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool } = require('./db'); // make sure backend/db.js exists

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// routes
app.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get('/dbtest', async (_req, res) => {
  try {
    const r = await pool.query('select now() as server_time');
    res.json({ ok: true, server_time: r.rows[0].server_time });
  } catch (e) {
    console.error('DBTEST ERROR:', e); // full error to console
    res.status(500).json({ ok: false, code: e.code, message: e.message });
  }
});


app.get('/nights', async (_req, res) => {
  try {
    const r = await pool.query(`
      select id, night_date, start_time, end_time, notes
      from public.schedule_nights
      where night_date >= current_date
      order by night_date asc
      limit 14
    `);
    res.json(r.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

// start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
const { ensureMemberByEmail } = require('./lib/members');

// GET all availability for a night (admin view later can restrict)
app.get('/availability/:nightId', async (req, res) => {
  try {
    const { nightId } = req.params;
    const q = `
      select a.id, a.status, a.updated_at,
             m.id as member_id, m.email, m.full_name
      from public.availability a
      join public.members m on m.id = a.member_id
      where a.night_id = $1
      order by m.full_name nulls last, m.email
    `;
    const { rows } = await pool.query(q, [nightId]);
    res.json(rows);
  } catch (e) {
    console.error('GET /availability/:nightId', e.message);
    res.status(500).json({ error: 'DB error' });
  }
});

/**
 * POST /availability/toggle
 * Body: { email, full_name?, night_id, status }  // status = 'available' | 'unavailable'
 * Temporary email-based identity until OAuth.
 */
app.post('/availability/toggle', async (req, res) => {
  try {
    const { email, full_name, night_id, status } = req.body;
    if (!email || !night_id || !['available','unavailable'].includes(status)) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const member = await ensureMemberByEmail(email, full_name);

    const upsert = `
      insert into public.availability (member_id, night_id, status)
      values ($1, $2, $3)
      on conflict (member_id, night_id)
      do update set status = excluded.status, updated_at = now()
      returning id, member_id, night_id, status, updated_at
    `;
    const { rows } = await pool.query(upsert, [member.id, night_id, status]);
    res.json({ ok: true, availability: rows[0] });
  } catch (e) {
    console.error('POST /availability/toggle', e.message);
    res.status(500).json({ error: 'DB error' });
  }
});

/**
 * GET my availability for upcoming nights
 * Query: ?email=someone@example.com
 */
app.get('/my-availability', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'email required' });

    const member = await ensureMemberByEmail(email, null);
    const q = `
      select sn.id as night_id, sn.night_date, sn.start_time, sn.end_time, sn.notes,
             coalesce(a.status, 'unavailable') as status
      from public.schedule_nights sn
      left join public.availability a
        on a.night_id = sn.id and a.member_id = $1
      where sn.night_date >= current_date
      order by sn.night_date asc
      limit 14
    `;
    const { rows } = await pool.query(q, [member.id]);
    res.json(rows);
  } catch (e) {
    console.error('GET /my-availability', e.message);
    res.status(500).json({ error: 'DB error' });
  }
});

const { requireAdmin } = require('./middleware/admin');

// POST /nights  { night_date: 'YYYY-MM-DD', start_time: 'HH:MM', end_time: 'HH:MM', notes? }
app.post('/nights', requireAdmin, async (req, res) => {
  try {
    const { night_date, start_time, end_time, notes } = req.body || {};
    if (!night_date || !start_time || !end_time) {
      return res.status(400).json({ error: 'night_date, start_time, end_time required' });
    }
    const q = `
      insert into public.schedule_nights (night_date, start_time, end_time, notes)
      values ($1,$2,$3,$4)
      returning id, night_date, start_time, end_time, notes
    `;
    const { rows } = await pool.query(q, [night_date, start_time, end_time, notes || null]);
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error('POST /nights', e.message);
    res.status(500).json({ error: 'DB error' });
  }
});

// DELETE /nights/:id
app.delete('/nights/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('delete from public.schedule_nights where id = $1', [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /nights/:id', e.message);
    res.status(500).json({ error: 'DB error' });
  }
});

// GET /nights-with-counts  -> upcoming nights with available counts
app.get('/nights-with-counts', requireAdmin, async (_req, res) => {
  try {
    const q = `
      select sn.id, sn.night_date, sn.start_time, sn.end_time, sn.notes,
             coalesce(sum(case when a.status = 'available' then 1 else 0 end),0) as available_count,
             coalesce(sum(case when a.status = 'unavailable' then 1 else 0 end),0) as unavailable_count
      from public.schedule_nights sn
      left join public.availability a on a.night_id = sn.id
      where sn.night_date >= current_date
      group by sn.id
      order by sn.night_date asc
      limit 30
    `;
    const { rows } = await pool.query(q);
    res.json(rows);
  } catch (e) {
    console.error('GET /nights-with-counts', e.message);
    res.status(500).json({ error: 'DB error' });
  }
});

// GET /nights/:id/availability  (admin-only)
app.get('/nights/:id/availability', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const q = `
      select m.id as member_id, m.full_name, m.email, a.status, a.updated_at
      from public.members m
      join public.availability a on a.member_id = m.id
      where a.night_id = $1
      order by m.full_name nulls last, m.email
    `;
    const { rows } = await pool.query(q, [id]);
    res.json(rows);
  } catch (e) {
    console.error('GET /nights/:id/availability', e.message);
    res.status(500).json({ error: 'DB error' });
  }
});
