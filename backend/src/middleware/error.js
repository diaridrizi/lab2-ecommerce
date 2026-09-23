export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  // Postgres unique violation (e.g. email already used)
  if (err.code === '23505') {
    return res.status(409).json({ message: 'A record with that value already exists' });
  }
  // Postgres check violation (e.g. negative stock)
  if (err.code === '23514') {
    return res.status(400).json({ message: 'Invalid value: ' + (err.constraint || err.message) });
  }
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ message: status === 500 ? 'Server error' : err.message });
}
