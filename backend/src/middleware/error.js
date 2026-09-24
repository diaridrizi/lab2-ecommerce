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
  // MongoDB duplicate key (e.g. same email subscribed twice, second review for the same product)
  if (err.code === 11000) {
    return res.status(409).json({ message: 'A record with that value already exists' });
  }
  // Mongoose validation (e.g. rating out of range) and bad ObjectId
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: Object.values(err.errors).map((e) => e.message).join(', ') });
  }
  if (err.name === 'CastError') {
    return res.status(404).json({ message: 'Not found' });
  }
  // Stripe refused a request (wrong API key, card declined for a refund, Stripe unreachable...)
  if (err.type?.startsWith('Stripe')) {
    console.error('Stripe error:', err.type, err.message);
    return res.status(502).json({ message: `Payment provider error: ${err.message}` });
  }
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ message: status === 500 ? 'Server error' : err.message, ...(err.code && status !== 500 ? { code: err.code } : {}) });
}
