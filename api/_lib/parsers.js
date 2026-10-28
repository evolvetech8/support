// Pure parsing / aggregation logic for Apple's report files. No I/O here so it
// can be unit tested with fixture files.

// ---------------------------------------------------------------------------
// Generic delimited-text parsing
// ---------------------------------------------------------------------------

/** Normalises a header name: "App Apple Identifier" -> "appappleidentifier". */
export function normKey(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Parses tab- or comma-delimited text (delimiter auto-detected from the header
 * line) with RFC4180-style quoting. Returns { headers, rows } where each row is
 * an object keyed by the *normalised* header name.
 */
export function parseDelimited(text, delimiter) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  if (!src.trim()) return { headers: [], rows: [] };
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const delim = delimiter || (firstLine.includes('\t') ? '\t' : ',');

  const records = [];
  let field = '';
  let record = [];
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"' && field === '') {
      inQuotes = true;
    } else if (c === delim) {
      record.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || record.length) {
    record.push(field);
    records.push(record);
  }

  const nonEmpty = records.filter((r) => r.some((v) => v.trim() !== ''));
  if (!nonEmpty.length) return { headers: [], rows: [] };
  const headers = nonEmpty[0].map((h) => h.trim());
  const keys = headers.map(normKey);
  const rows = nonEmpty.slice(1).map((r) => {
    const obj = {};
    keys.forEach((k, idx) => {
      obj[k] = (r[idx] ?? '').trim();
    });
    return obj;
  });
  return { headers, rows };
}

export function parseNumber(value) {
  if (value === undefined || value === null) return 0;
  const cleaned = String(value).replace(/[\s,]/g, '');
  if (cleaned === '' || cleaned === '-') return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Accepts YYYY-MM-DD, MM/DD/YYYY or YYYYMMDD; returns YYYY-MM-DD or null. */
export function normalizeDate(value) {
  const s = String(value || '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

function pick(row, ...names) {
  for (const n of names) {
    const v = row[normKey(n)];
    if (v !== undefined && v !== '') return v;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Sales and Trends — Sales Summary (daily)
// ---------------------------------------------------------------------------

// Apple "Product Type Identifier" groups.
// https://developer.apple.com/help/app-store-connect/reference/product-type-identifiers
const FIRST_TIME_DOWNLOAD = new Set(['1', '1F', '1T', '1E', '1EP', '1EU', 'F1']);
const REDOWNLOAD = new Set(['3', '3F', '3T', 'F3']);
const UPDATE = new Set(['7', '7F', '7T', 'F7']);

export function classifyProductType(raw) {
  const t = String(raw || '').trim().toUpperCase();
  if (FIRST_TIME_DOWNLOAD.has(t)) return 'download';
  if (REDOWNLOAD.has(t)) return 'redownload';
  if (UPDATE.has(t)) return 'update';
  if (t.startsWith('IA') || t.startsWith('FI')) return 'iap';
  if (t.endsWith('-B')) return 'bundle';
  return 'other';
}

export function parseSalesReport(text) {
  const { rows } = parseDelimited(text, '\t');
  return rows
    .map((r) => ({
      sku: pick(r, 'SKU'),
      title: pick(r, 'Title'),
      productType: pick(r, 'Product Type Identifier'),
      units: parseNumber(pick(r, 'Units')),
      developerProceeds: parseNumber(pick(r, 'Developer Proceeds')),
      proceedsCurrency: pick(r, 'Currency of Proceeds').toUpperCase(),
      appleId: pick(r, 'Apple Identifier'),
      parentId: pick(r, 'Parent Identifier'),
      beginDate: normalizeDate(pick(r, 'Begin Date')),
      countryCode: pick(r, 'Country Code'),
    }))
    .filter((r) => r.productType || r.appleId);
}

/**
 * Aggregates parsed Sales Summary rows per app.
 *
 * App resolution:
 *  - App rows (downloads/redownloads/updates/bundles) use their Apple Identifier.
 *  - In-app purchase / subscription rows carry the *parent app's SKU* in
 *    "Parent Identifier"; it is resolved via `skuToAppId` (from /v1/apps) and
 *    via SKUs of app rows in the same report. Unresolvable parents are kept
 *    under a synthetic "sku:<parent>" id so no proceeds are dropped.
 *
 * Proceeds per row = Units × Developer Proceeds (per-unit, in Currency of
 * Proceeds). Refund rows have negative units and so subtract naturally.
 */
export function aggregateSales(rows, skuToAppId = {}) {
  const skuMap = { ...skuToAppId };
  for (const r of rows) {
    const kind = classifyProductType(r.productType);
    if (kind !== 'iap' && r.sku && r.appleId && !skuMap[r.sku]) skuMap[r.sku] = r.appleId;
  }

  const byApp = new Map();
  const discoveredApps = new Map();
  const ensure = (appId) => {
    if (!byApp.has(appId)) {
      byApp.set(appId, { appId, downloads: 0, redownloads: 0, updates: 0, iapUnits: 0, proceedsLocal: {} });
    }
    return byApp.get(appId);
  };

  for (const r of rows) {
    const kind = classifyProductType(r.productType);
    let appId;
    if (kind === 'iap') {
      appId = (r.parentId && skuMap[r.parentId]) || (r.parentId ? `sku:${r.parentId}` : `iap:${r.appleId}`);
    } else {
      appId = r.appleId || (r.sku && skuMap[r.sku]) || `sku:${r.sku}`;
      if (r.appleId && kind !== 'bundle' && !discoveredApps.has(r.appleId)) {
        discoveredApps.set(r.appleId, { id: r.appleId, name: r.title || r.sku || r.appleId, sku: r.sku || null });
      }
    }
    const agg = ensure(appId);
    if (kind === 'download') agg.downloads += r.units;
    else if (kind === 'redownload') agg.redownloads += r.units;
    else if (kind === 'update') agg.updates += r.units;
    else if (kind === 'iap') agg.iapUnits += r.units;

    const amount = r.units * r.developerProceeds;
    if (amount !== 0) {
      const cur = r.proceedsCurrency || 'USD';
      agg.proceedsLocal[cur] = round6((agg.proceedsLocal[cur] || 0) + amount);
    }
  }
  return { byApp, discoveredApps: [...discoveredApps.values()] };
}

/**
 * Converts { CUR: amount } to USD using `rates` = { CUR: usdPerUnit }.
 * Currencies without a rate are reported in `unconverted` instead of being
 * silently treated as zero.
 */
export function convertToUsd(proceedsLocal, rates) {
  let usd = 0;
  const unconverted = {};
  for (const [cur, amount] of Object.entries(proceedsLocal || {})) {
    if (!amount) continue;
    const rate = cur === 'USD' ? 1 : rates?.[cur];
    if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) usd += amount * rate;
    else unconverted[cur] = amount;
  }
  return { usd: round6(usd), unconverted };
}

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

// ---------------------------------------------------------------------------
// Analytics Reports API — "App Store Discovery and Engagement" and "App Sessions"
// ---------------------------------------------------------------------------

function appIdOf(row, fallbackAppId) {
  return pick(row, 'App Apple Identifier', 'Apple Identifier', 'App ID') || fallbackAppId || '';
}

/**
 * Sums Counts / Unique Counts per (date, app) for Impression and Page view
 * events. Note: "Unique Counts" summed across dimension rows (territory,
 * source type, ...) over-counts distinct devices; Apple does not expose a
 * de-duplicated total in the standard report.
 */
export function aggregateEngagement(text, fallbackAppId) {
  const { rows } = parseDelimited(text);
  const out = new Map();
  for (const r of rows) {
    const date = normalizeDate(pick(r, 'Date'));
    const appId = appIdOf(r, fallbackAppId);
    if (!date || !appId) continue;
    const event = pick(r, 'Event').toLowerCase().trim();
    let kind = null;
    if (event === 'impression' || event === 'impressions') kind = 'impressions';
    else if (event === 'page view' || event === 'page views' || event === 'product page view') kind = 'pageViews';
    if (!kind) continue;
    const key = `${date}|${appId}`;
    if (!out.has(key)) out.set(key, { date, appId, impressions: 0, impressionsUnique: 0, pageViews: 0, pageViewsUnique: 0 });
    const agg = out.get(key);
    agg[kind] += parseNumber(pick(r, 'Counts', 'Count'));
    agg[`${kind}Unique`] += parseNumber(pick(r, 'Unique Counts', 'Unique Count', 'Unique Devices'));
  }
  return [...out.values()];
}

export function aggregateSessions(text, fallbackAppId) {
  const { rows } = parseDelimited(text);
  const out = new Map();
  for (const r of rows) {
    const date = normalizeDate(pick(r, 'Date'));
    const appId = appIdOf(r, fallbackAppId);
    if (!date || !appId) continue;
    const key = `${date}|${appId}`;
    if (!out.has(key)) out.set(key, { date, appId, sessions: 0, totalDurationSec: 0, uniqueDevices: 0 });
    const agg = out.get(key);
    agg.sessions += parseNumber(pick(r, 'Sessions'));
    agg.totalDurationSec += parseNumber(pick(r, 'Total Session Duration', 'Session Duration'));
    agg.uniqueDevices += parseNumber(pick(r, 'Unique Devices'));
  }
  return [...out.values()];
}
