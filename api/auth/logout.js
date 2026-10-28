import { clearedSessionCookie } from '../_lib/auth.js';
import { sendJson, methodNotAllowed, isSameOrigin } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  if (!isSameOrigin(req)) {
    return sendJson(res, 403, { error: 'invalid_origin' });
  }

  res.setHeader('Set-Cookie', clearedSessionCookie(req));
  return sendJson(res, 200, { ok: true, message: 'Logged out' });
}
