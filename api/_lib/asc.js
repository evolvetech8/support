import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { parseSalesReport, aggregateSales } from './parsers.js';

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

/**
 * Generates an ES256 signed JWT for App Store Connect API.
 * Apple requires:
 * - header: { alg: "ES256", kid: keyId, typ: "JWT" }
 * - payload: { iss: issuerId, iat: now, exp: now + 20min, aud: "appstoreconnect-v1" }
 */
export function generateAscJwt({ issuerId, keyId, privateKey, nowSec = Math.floor(Date.now() / 1000) }) {
  if (!issuerId || !keyId || !privateKey) {
    throw new Error('Missing ASC credentials (issuerId, keyId, or privateKey)');
  }

  const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      iss: issuerId,
      iat: nowSec,
      exp: nowSec + 20 * 60, // 20 minutes max valid duration
      aud: 'appstoreconnect-v1',
    })
  );

  const signTarget = `${header}.${payload}`;
  const sig = crypto.sign('sha256', Buffer.from(signTarget), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363', // produces standard 64-byte raw R||S
  });

  return `${signTarget}.${b64url(sig)}`;
}

export async function fetchAscApps(jwt) {
  const res = await fetch('https://api.appstoreconnect.apple.com/v1/apps?limit=50', {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch apps from App Store Connect (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const apps = (data.data || []).map((item) => ({
    id: item.id,
    name: item.attributes?.name || item.id,
    sku: item.attributes?.sku || null,
    bundleId: item.attributes?.bundleId || null,
  }));

  return apps;
}

export async function fetchDailySalesReport({ jwt, vendorNumber, date, reportVersion = '1_1' }) {
  const url = new URL('https://api.appstoreconnect.apple.com/v1/salesReports');
  url.searchParams.set('filter[frequency]', 'DAILY');
  url.searchParams.set('filter[reportDate]', date); // YYYY-MM-DD
  url.searchParams.set('filter[reportSubType]', 'SUMMARY');
  url.searchParams.set('filter[reportType]', 'SALES');
  url.searchParams.set('filter[vendorNumber]', vendorNumber);
  url.searchParams.set('filter[version]', reportVersion);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/a-gzip, application/json',
    },
  });

  if (res.status === 404) {
    // Report not generated yet by Apple
    return null;
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Sales report error for ${date} (${res.status}): ${errText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Decompress gzip
  let tsvText;
  try {
    tsvText = zlib.gunzipSync(buffer).toString('utf8');
  } catch {
    tsvText = buffer.toString('utf8');
  }

  const parsedRows = parseSalesReport(tsvText);
  return { date, rawTsv: tsvText, parsedRows };
}
