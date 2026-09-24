// Access + refresh tokens.
//
// Access token  = signed JWT, valid 15 minutes, sent as "Authorization: Bearer ...". Never stored by the server.
// Refresh token = 48 random bytes, valid 7 days, sent only as an httpOnly cookie (JavaScript can't read it, so XSS
//                 can't steal it). The database keeps only its SHA-256 hash.
//
// Every refresh ROTATES the refresh token (old one revoked, new one issued in the same "family").
// Using an already-rotated token again means it was copied, so the whole family (that login) is revoked.
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query, withTransaction } from '../config/postgres.js';
import { HttpError } from './helpers.js';

const JWT_OPTIONS = { issuer: 'flowshop-api', audience: 'flowshop-web' };
// Two tabs refreshing at the same moment both send the same token. The second one inside this window
// is not treated as theft: it just gets a new access token (the browser already has the new cookie).
const ROTATION_GRACE_MS = 20_000;

if (env.isProduction && env.jwtSecret === 'dev-secret') {
  throw new Error('JWT_SECRET must be set in production');
}

export function signAccessToken(user) {
  return jwt.sign(
    { type: 'access', role: user.role, name: user.name, ver: user.token_version ?? 0 },
    env.jwtSecret,
    { ...JWT_OPTIONS, subject: String(user.id), expiresIn: env.accessTokenTtl, algorithm: 'HS256' }
  );
}

// Returns { id, role, name, ver } or throws HttpError 401 with a code the frontend understands
export function verifyAccessToken(token) {
  try {
    const p = jwt.verify(token, env.jwtSecret, { ...JWT_OPTIONS, algorithms: ['HS256'] });
    if (p.type !== 'access') throw new Error('wrong token type');
    return { id: Number(p.sub), role: p.role, name: p.name, ver: p.ver };
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw new HttpError(401, 'Access token expired', 'TOKEN_EXPIRED');
    throw new HttpError(401, 'Invalid access token', 'INVALID_TOKEN');
  }
}

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const refreshExpiry = () => new Date(Date.now() + env.refreshTokenDays * 24 * 60 * 60 * 1000);
const clientInfo = (req) => [String(req.get('user-agent') || '').slice(0, 255), String(req.ip || '').slice(0, 64)];

// Creates a refresh token. A new login starts a new family; a rotation continues the old one.
export async function issueRefreshToken(userId, req, { familyId = crypto.randomUUID(), db = { query } } = {}) {
  const token = crypto.randomBytes(48).toString('base64url');
  const [userAgent, ip] = clientInfo(req);
  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at, user_agent, ip)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, hashToken(token), familyId, refreshExpiry(), userAgent, ip]
  );
  return token;
}

const SESSION_ENDED = () => new HttpError(401, 'Your session has ended, please log in again', 'SESSION_ENDED');

// Checks a refresh token and swaps it for a new one.
// Returns { user, refreshToken } - refreshToken is null inside the grace window (keep the current cookie).
export async function rotateRefreshToken(token, req) {
  if (!token) throw SESSION_ENDED();
  return withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE', [hashToken(token)]);
    const row = rows[0];
    if (!row) throw SESSION_ENDED();

    let refreshToken = null;
    if (row.revoked_at) {
      // Logged out / revoked on purpose: simply not valid anymore
      if (row.revoked_reason !== 'rotated') throw SESSION_ENDED();
      const justRotated = Date.now() - new Date(row.revoked_at).getTime() < ROTATION_GRACE_MS;
      if (!justRotated) {
        // Reuse of an old token: someone may have stolen it. End this whole login.
        await client.query(
          `UPDATE refresh_tokens SET revoked_at = NOW(), revoked_reason = 'reuse_detected'
           WHERE family_id = $1 AND revoked_at IS NULL`,
          [row.family_id]
        );
        req.tokenReuse = { userId: row.user_id, familyId: row.family_id };
        return { reuse: true };
      }
    } else {
      if (new Date(row.expires_at) < new Date()) throw SESSION_ENDED();
      await client.query(`UPDATE refresh_tokens SET revoked_at = NOW(), revoked_reason = 'rotated' WHERE id = $1`, [row.id]);
      refreshToken = await issueRefreshToken(row.user_id, req, { familyId: row.family_id, db: client });
    }

    const { rows: users } = await client.query('SELECT id, name, email, role, token_version FROM users WHERE id = $1', [row.user_id]);
    if (!users[0]) throw SESSION_ENDED();
    return { user: users[0], refreshToken, familyId: row.family_id };
  }).then((result) => {
    // Thrown after the transaction committed, so the family stays revoked
    if (result.reuse) throw SESSION_ENDED();
    return result;
  });
}

// The family of the refresh token in the cookie (= "this device"), or null
export async function familyOf(token) {
  if (!token) return null;
  const { rows } = await query('SELECT family_id FROM refresh_tokens WHERE token_hash = $1', [hashToken(token)]);
  return rows[0]?.family_id ?? null;
}

export async function revokeFamily(familyId, reason, userId = null) {
  const { rowCount } = await query(
    `UPDATE refresh_tokens SET revoked_at = NOW(), revoked_reason = $2
     WHERE family_id = $1 AND revoked_at IS NULL ${userId ? 'AND user_id = $3' : ''}`,
    userId ? [familyId, reason, userId] : [familyId, reason]
  );
  return rowCount;
}

// Ends every session of a user right away: refresh tokens revoked and current access tokens refused
// (token_version is checked on every request). `exceptFamily` keeps one login alive (e.g. after a password change).
export async function revokeAllSessions(userId, reason, { exceptFamily = null } = {}) {
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW(), revoked_reason = $2
     WHERE user_id = $1 AND revoked_at IS NULL AND ($3::uuid IS NULL OR family_id <> $3::uuid)`,
    [userId, reason, exceptFamily]
  );
  await bumpTokenVersion(userId);
}

// Makes all access tokens of a user invalid (they must refresh, which re-reads the role from the database)
export const bumpTokenVersion = (userId) => query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [userId]);

// Active logins of a user (one row per family = one device/browser)
export async function listSessions(userId) {
  const { rows } = await query(
    `SELECT DISTINCT ON (family_id) id, family_id, user_agent, ip, created_at AS last_used_at, expires_at
     FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
     ORDER BY family_id, created_at DESC`,
    [userId]
  );
  // When each login started = the first token of the family
  const { rows: starts } = await query(
    'SELECT family_id, MIN(created_at) AS signed_in_at FROM refresh_tokens WHERE user_id = $1 GROUP BY family_id',
    [userId]
  );
  const startedAt = new Map(starts.map((s) => [s.family_id, s.signed_in_at]));
  return rows
    .map((r) => ({ ...r, signed_in_at: startedAt.get(r.family_id) }))
    .sort((a, b) => new Date(b.last_used_at) - new Date(a.last_used_at));
}

// Removes old rows now and then, so the table doesn't grow forever
export const cleanupRefreshTokens = () =>
  query("DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL '1 day' OR revoked_at < NOW() - INTERVAL '7 days'");
