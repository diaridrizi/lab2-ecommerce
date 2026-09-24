import { ActivityLog } from '../models/ActivityLog.js';

// Error with an HTTP status code. Throw it anywhere in a route:
//   throw new HttpError(404, 'Product not found');
// `code` is an optional machine-readable reason, e.g. 'TOKEN_EXPIRED' (the frontend refreshes the token on it)
export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Wraps async route handlers so thrown errors reach the error middleware
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// "Blue Running Shoes!" -> "blue-running-shoes"
export const slugify = (text) =>
  String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Save an event to MongoDB. Never lets a logging failure break a request.
export async function logActivity(req, action, meta = {}) {
  try {
    await ActivityLog.create({
      userId: req.user?.id ?? meta.userId ?? null,
      action,
      meta,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  } catch (err) {
    console.error('Failed to write activity log:', err.message);
  }
}

// Check that required fields exist in req.body
export function requireFields(body, fields) {
  const missing = fields.filter(
    (f) => body[f] === undefined || body[f] === null || String(body[f]).trim() === ''
  );
  if (missing.length) {
    throw new HttpError(400, `Missing required fields: ${missing.join(', ')}`);
  }
}
