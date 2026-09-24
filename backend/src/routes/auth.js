// Authentication: register, login, refresh (token rotation), logout, sessions, password change
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { query } from '../config/postgres.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { asyncHandler, HttpError, logActivity, requireFields } from '../utils/helpers.js';
import { validatePassword } from '../utils/password.js';
import {
  bumpTokenVersion, familyOf, issueRefreshToken, listSessions, revokeAllSessions, revokeFamily,
  rotateRefreshToken, signAccessToken,
} from '../utils/tokens.js';
import { disconnectUser } from '../realtime/socket.js';

const router = Router();

const COOKIE = 'refresh_token';
// httpOnly: JavaScript can't read it. SameSite=Strict: not sent by other websites (CSRF).
// path: only sent to /api/auth, not with every API call. secure: HTTPS only in production.
const cookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'strict',
  path: '/api/auth',
  maxAge: env.refreshTokenDays * 24 * 60 * 60 * 1000,
};
const setRefreshCookie = (res, token) => res.cookie(COOKIE, token, cookieOptions);
const clearRefreshCookie = (res) => res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined });

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

// Starts a new login: refresh token in the cookie, access token in the response body
async function startSession(req, res, user) {
  setRefreshCookie(res, await issueRefreshToken(user.id, req));
  return { user: publicUser(user), accessToken: signAccessToken(user), expiresIn: env.accessTokenTtl };
}

// Cookie-based endpoints only accept requests from our own frontend (extra CSRF protection)
function sameOrigin(req, _res, next) {
  const origin = req.get('origin');
  if (origin && origin !== env.clientUrl) return next(new HttpError(403, 'Request from an unknown origin', 'BAD_ORIGIN'));
  next();
}

// 10 login attempts per 15 minutes for the same IP + email, 10 new accounts per hour per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000, max: 10,
  key: (req) => `${req.ip}:${String(req.body?.email || '').toLowerCase()}`,
  message: 'Too many login attempts. Please wait 15 minutes and try again.',
});
const registerLimiter = rateLimit({ windowMs: 60 * 60_000, max: 10, message: 'Too many accounts created. Try again later.' });
const refreshLimiter = rateLimit({ windowMs: 60_000, max: 30 });

// Compared against when the email doesn't exist, so the response takes as long as a real check
// (attackers can't find out which emails are registered by measuring time)
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// POST /api/auth/register  { name, email, password }
router.post(
  '/register',
  registerLimiter,
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['name', 'email', 'password']);
    const { name, email, password } = req.body;
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Email address is not valid');
    validatePassword(password);

    const hash = await bcrypt.hash(password, 12);
    // New accounts are always customers. Admins are created by an admin (Admin → Users) or the seed script.
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash) VALUES ($1, LOWER($2), $3)
       RETURNING id, name, email, role, token_version`,
      [name.trim(), email.trim(), hash]
    );
    const user = rows[0];
    await logActivity(req, 'user.register', { userId: user.id });
    res.status(201).json(await startSession(req, res, user));
  })
);

// POST /api/auth/login  { email, password }
router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['email', 'password']);
    const { rows } = await query('SELECT * FROM users WHERE email = LOWER($1)', [req.body.email.trim()]);
    const user = rows[0];
    const ok = await bcrypt.compare(String(req.body.password), user?.password_hash ?? DUMMY_HASH);
    if (!user || !ok) {
      await logActivity(req, 'user.login_failed', { email: req.body.email });
      throw new HttpError(401, 'Wrong email or password', 'BAD_CREDENTIALS');
    }
    await logActivity(req, 'user.login', { userId: user.id });
    res.json(await startSession(req, res, user));
  })
);

// POST /api/auth/refresh  (refresh token cookie) -> new access token + new refresh token cookie
router.post(
  '/refresh',
  sameOrigin,
  refreshLimiter,
  asyncHandler(async (req, res) => {
    try {
      const { user, refreshToken } = await rotateRefreshToken(req.cookies[COOKIE], req);
      if (refreshToken) setRefreshCookie(res, refreshToken);
      res.json({ user: publicUser(user), accessToken: signAccessToken(user), expiresIn: env.accessTokenTtl });
    } catch (err) {
      clearRefreshCookie(res);
      if (req.tokenReuse) {
        // An old refresh token was used again: that login was ended for safety
        await logActivity(req, 'security.token_reuse', { userId: req.tokenReuse.userId, familyId: req.tokenReuse.familyId });
        await bumpTokenVersion(req.tokenReuse.userId);
        disconnectUser(req.tokenReuse.userId, 'token_reuse');
      }
      throw err;
    }
  })
);

// POST /api/auth/logout  -> ends this device's session
router.post(
  '/logout',
  sameOrigin,
  asyncHandler(async (req, res) => {
    const familyId = await familyOf(req.cookies[COOKIE]);
    if (familyId) await revokeFamily(familyId, 'logout');
    clearRefreshCookie(res);
    await logActivity(req, 'user.logout', {});
    res.status(204).end();
  })
);

// POST /api/auth/logout-all  -> ends every session of this user, on all devices, right now
router.post(
  '/logout-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    await revokeAllSessions(req.user.id, 'logout_all');
    clearRefreshCookie(res);
    disconnectUser(req.user.id, 'logout_all');
    await logActivity(req, 'user.logout_all', {});
    res.status(204).end();
  })
);

// GET /api/auth/me
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT id, name, email, role, created_at FROM users WHERE id = $1', [req.user.id]);
    res.json({ user: rows[0] });
  })
);

// GET /api/auth/sessions  -> my active logins (devices)
router.get(
  '/sessions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const current = await familyOf(req.cookies[COOKIE]);
    const sessions = await listSessions(req.user.id);
    res.json(sessions.map((s) => ({
      id: s.family_id, user_agent: s.user_agent, ip: s.ip, signed_in_at: s.signed_in_at,
      last_used_at: s.last_used_at, expires_at: s.expires_at, current: s.family_id === current,
    })));
  })
);

// DELETE /api/auth/sessions/:id  -> log out one device
router.delete(
  '/sessions/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) throw new HttpError(404, 'Session not found');
    const count = await revokeFamily(req.params.id, 'logout', req.user.id);
    if (!count) throw new HttpError(404, 'Session not found');
    if (req.params.id === (await familyOf(req.cookies[COOKIE]))) clearRefreshCookie(res);
    await logActivity(req, 'user.session_revoked', { familyId: req.params.id });
    res.status(204).end();
  })
);

// PUT /api/auth/password  { currentPassword, newPassword }  -> other devices are logged out
router.put(
  '/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['currentPassword', 'newPassword']);
    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!(await bcrypt.compare(String(req.body.currentPassword), rows[0].password_hash))) {
      throw new HttpError(400, 'Current password is wrong', 'BAD_CREDENTIALS');
    }
    validatePassword(req.body.newPassword);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(req.body.newPassword, 12), req.user.id]);
    // Keep this device logged in, end all others
    await revokeAllSessions(req.user.id, 'password_changed', { exceptFamily: await familyOf(req.cookies[COOKIE]) });
    disconnectUser(req.user.id); // this tab reconnects with a fresh token
    await logActivity(req, 'user.password_changed', {});
    res.status(204).end();
  })
);

export default router;
