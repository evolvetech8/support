import { getConfig } from '../_lib/config.js';
import { checkPassword, createSessionToken, sessionKey, sessionCookie } from '../_lib/auth.js';
import { sendJson, methodNotAllowed, readJsonBody, isSameOrigin } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  if (!isSameOrigin(req)) {
    return sendJson(res, 403, { error: 'invalid_origin' });
  }

  const cfg = getConfig();
  const body = await readJsonBody(req);
  const password = body.password || '';

  // If DASHBOARD_PASSWORD is not set in env yet, allow login with any password in development/demo mode
  const isPasswordConfigured = Boolean(cfg.dashboardPassword);
  const isValid = isPasswordConfigured ? checkPassword(password, cfg) : true;

  if (!isValid) {
    return sendJson(res, 401, { error: 'invalid_password' });
  }

  const key = sessionKey(cfg) || 'dev-fallback-session-key-archonic';
  const token = createSessionToken(key);

  res.setHeader('Set-Cookie', sessionCookie(token, req));
  return sendJson(res, 200, {
    ok: true,
    isDemoOnly: !isPasswordConfigured,
    message: isPasswordConfigured ? 'Authenticated' : 'Logged in (Set DASHBOARD_PASSWORD in Vercel to secure)',
  });
}
