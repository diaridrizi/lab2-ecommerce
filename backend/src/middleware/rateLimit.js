// Simple in-memory rate limiter (enough for one server). Slows down password guessing.
//   router.post('/login', rateLimit({ windowMs: 15 * 60_000, max: 10, key: (req) => req.ip }), ...)
import { HttpError } from '../utils/helpers.js';

export function rateLimit({ windowMs, max, key = (req) => req.ip, message = 'Too many attempts, please try again later' }) {
  const hits = new Map(); // key -> { count, resetAt }

  // Forget old entries every minute
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, 60_000).unref();

  return (req, res, next) => {
    const k = key(req);
    const now = Date.now();
    let entry = hits.get(k);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(k, entry);
    }
    entry.count++;
    res.set('RateLimit-Limit', String(max));
    res.set('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return next(new HttpError(429, message, 'RATE_LIMITED'));
    }
    next();
  };
}
