const { pool } = require('../db');

/**
 * Ensure a member exists for the given email. Returns { id, email, full_name, is_admin }.
 * Temporary approach until OAuth is added.
 */
async function ensureMemberByEmail(email, fullName = null) {
  const upsertSql = `
    insert into public.members (email, full_name)
    values ($1, $2)
    on conflict (email) do update set full_name = coalesce(excluded.full_name, public.members.full_name)
    returning id, email, full_name, is_admin
  `;
  const { rows } = await pool.query(upsertSql, [email, fullName]);
  return rows[0];
}

module.exports = { ensureMemberByEmail };
