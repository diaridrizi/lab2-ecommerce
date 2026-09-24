// Authentication (who are you?) and authorization (what may you do?)
import { query } from '../config/postgres.js';
import { HttpError } from '../utils/helpers.js';
import { verifyAccessToken } from '../utils/tokens.js';

// Loads the user of an access token from the database.
// The role comes from the database, not from the token, so a changed role counts right away.
// token_version must match: it is increased on "log out everywhere", password and role changes.
export async function userFromAccessToken(token) {
  const payload = verifyAccessToken(token);
  const { rows } = await query('SELECT id, name, email, role, token_version FROM users WHERE id = $1', [payload.id]);
  const user = rows[0];
  if (!user || user.token_version !== payload.ver) {
    throw new HttpError(401, 'Your session has ended, please log in again', 'SESSION_REVOKED');
  }
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

// Requires a valid "Authorization: Bearer <access token>" header
export async function requireAuth(req, _res, next) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) return next(new HttpError(401, 'Please log in', 'NO_TOKEN'));
  try {
    req.user = await userFromAccessToken(token);
    next();
  } catch (err) {
    next(err);
  }
}

// Role-based access control. Use after requireAuth:  router.use(requireAuth, requireRole('admin'))
export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, 'Please log in', 'NO_TOKEN'));
  if (!roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have permission to do this', 'FORBIDDEN'));
  next();
};

export const requireAdmin = requireRole('admin');
