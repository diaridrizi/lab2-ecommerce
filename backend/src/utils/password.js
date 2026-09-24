import { HttpError } from './helpers.js';

// Password rules: at least 8 characters with at least one letter and one number
export function validatePassword(password) {
  const p = String(password ?? '');
  if (p.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  if (p.length > 128) throw new HttpError(400, 'Password is too long');
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) throw new HttpError(400, 'Password must contain at least one letter and one number');
}
