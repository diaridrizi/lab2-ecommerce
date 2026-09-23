import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../utils/helpers.js';

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

// Requires a valid "Authorization: Bearer <token>" header
export function requireAuth(req, _res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new HttpError(401, 'Please log in'));
  }
  try {
    req.user = jwt.verify(token, env.jwtSecret); // { id, role, name }
    next();
  } catch {
    next(new HttpError(401, 'Session expired, please log in again'));
  }
}

// Use after requireAuth
export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') {
    return next(new HttpError(403, 'Admins only'));
  }
  next();
}
