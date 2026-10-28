// Small, dependency-free HTTP helpers that work both inside Vercel's Node
// runtime (which pre-parses req.body / req.query / req.cookies) and with a
// plain Node http.IncomingMessage (used by the local dev server and tests).

export function sendJson(res, status, payload, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  res.end(JSON.stringify(payload));
}

export function methodNotAllowed(res, allowed) {
  sendJson(res, 405, { error: 'method_not_allowed' }, { Allow: allowed.join(', ') });
}

export function getQuery(req) {
  if (req.query && typeof req.query === 'object') return req.query;
  const url = new URL(req.url || '/', 'http://localhost');
  return Object.fromEntries(url.searchParams.entries());
}

export function parseCookies(req) {
  if (req.cookies && typeof req.cookies === 'object') return req.cookies;
  const header = req.headers?.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

const MAX_BODY_BYTES = 16 * 1024;

export async function readJsonBody(req) {
  // Vercel already parsed it.
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
    const text = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body);
    return safeParse(text);
  }
  if (typeof req.on !== 'function') return {};
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('Body too large'), { status: 413 });
    chunks.push(chunk);
  }
  return safeParse(Buffer.concat(chunks).toString('utf8'));
}

function safeParse(text) {
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Basic CSRF defence for cookie-authenticated POSTs. The session cookie is
 * SameSite=Strict already; this additionally rejects requests whose Origin
 * header is present and does not match the Host.
 */
export function isSameOrigin(req) {
  const origin = req.headers?.origin;
  if (!origin) return true; // same-origin fetches from some browsers / curl
  const host = req.headers?.['x-forwarded-host'] || req.headers?.host;
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
