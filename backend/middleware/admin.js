function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}
module.exports = { requireAdmin };
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  console.log('Auth header seen by server:', JSON.stringify(auth)); // debug
  const token = auth.toLowerCase().startsWith('bearer ')
    ? auth.slice(7).trim()
    : '';
  if (!token || token !== String(process.env.ADMIN_TOKEN).trim()) {
    console.log('ADMIN_TOKEN env present:', !!process.env.ADMIN_TOKEN, 'value:', process.env.ADMIN_TOKEN);
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}
module.exports = { requireAdmin };
