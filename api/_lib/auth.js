import crypto from 'node:crypto';
import { getConfig } from './config.js';
import { parseCookies } from './http.js';

export const SESSION_COOKIE = 'archonic_dash';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

/**
 * HMAC key for session cookies. SESSION_SECRET is preferred; if it is not set
 * we derive one from the dashboard password so that changing the password
 * invalidates every existing session.
 */
export function sessionKey(cfg = getConfig()) {
  if (cfg.sessionSecret) return cfg.sessionSecret;
  if (!cfg.dashboardPassword) return '';
  return crypto.createHash('sha256').update(`archonic-dashboard-session:${cfg.dashboardPassword}`).digest('hex');
}

export function createSessionToken(key, nowSec = Math.floor(Date.now() / 1000)) {
  if (!key) throw new Error('Session key is not configured');
  const payload = b64url(JSON.stringify({ v: 1, iat: nowSec, exp: nowSec + SESSION_TTL_SECONDS, n: crypto.randomBytes(8).toString('hex') }));
  const sig = b64url(crypto.createHmac('sha256', key).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifySessionToken(token, key, nowSec = Math.floor(Date.now() / 1000)) {
  if (!token || !key || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = b64url(crypto.createHmac('sha256', key).update(payload).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof data.exp === 'number' && data.exp > nowSec;
  } catch {
    return false;
  }
}

export function checkPassword(candidate, cfg = getConfig()) {
  if (!cfg.dashboardPassword || typeof candidate !== 'string' || !candidate) return false;
  // Hash both sides so timingSafeEqual always compares equal-length buffers.
  const a = crypto.createHash('sha256').update(candidate).digest();
  const b = crypto.createHash('sha256').update(cfg.dashboardPassword).digest();
  return crypto.timingSafeEqual(a, b);
}

function isSecureRequest(req) {
  const proto = req.headers?.['x-forwarded-proto'];
  if (proto) return proto.split(',')[0].trim() === 'https';
  const host = req.headers?.host || '';
  // Local dev over http://localhost: browsers accept Secure cookies there, but
  // other http hosts would drop them, so only omit Secure for plain http.
  return !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
}

export function sessionCookie(token, req) {
  const attrs = [`${SESSION_COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${SESSION_TTL_SECONDS}`];
  if (isSecureRequest(req)) attrs.push('Secure');
  return attrs.join('; ');
}

export function clearedSessionCookie(req) {
  const attrs = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (isSecureRequest(req)) attrs.push('Secure');
  return attrs.join('; ');
}

export function hasValidSession(req, cfg = getConfig()) {
  const key = sessionKey(cfg);
  if (!key) return false;
  const token = parseCookies(req)[SESSION_COOKIE];
  return verifySessionToken(token, key);
}

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set. */
export function hasValidCronSecret(req, cfg = getConfig()) {
  if (!cfg.cronSecret) return false;
  const header = req.headers?.authorization || '';
  const expected = `Bearer ${cfg.cronSecret}`;
  const a = crypto.createHash('sha256').update(header).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}
