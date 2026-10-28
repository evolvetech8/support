// Central place for reading environment variables. Secrets are only ever read
// on the server; nothing here is shipped to the browser.

export function getConfig(env = process.env) {
  return {
    databaseUrl: env.DATABASE_URL || env.POSTGRES_URL || '',
    dashboardPassword: env.DASHBOARD_PASSWORD || '',
    sessionSecret: env.SESSION_SECRET || '',
    cronSecret: env.CRON_SECRET || '',
    asc: {
      issuerId: (env.ASC_ISSUER_ID || '').trim(),
      keyId: (env.ASC_KEY_ID || '').trim(),
      privateKey: normalizePrivateKey(env.ASC_PRIVATE_KEY || ''),
      vendorNumber: (env.ASC_VENDOR_NUMBER || '').trim(),
      salesReportVersion: (env.ASC_SALES_REPORT_VERSION || '1_1').trim(),
    },
  };
}

/**
 * Accepts the .p8 contents pasted in any of the common ways:
 *  - raw multi-line PEM
 *  - PEM with literal "\n" sequences (single-line env var)
 *  - base64 of the whole PEM file
 */
export function normalizePrivateKey(raw) {
  let key = String(raw || '').trim();
  if (!key) return '';
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\\n/g, '\n');
  if (!key.includes('BEGIN')) {
    try {
      const decoded = Buffer.from(key, 'base64').toString('utf8');
      if (decoded.includes('BEGIN')) key = decoded;
    } catch {
      /* fall through */
    }
  }
  return key.trim();
}

export function missingAppleConfig(cfg) {
  const missing = [];
  if (!cfg.asc.issuerId) missing.push('ASC_ISSUER_ID');
  if (!cfg.asc.keyId) missing.push('ASC_KEY_ID');
  if (!cfg.asc.privateKey) missing.push('ASC_PRIVATE_KEY');
  if (!cfg.asc.vendorNumber) missing.push('ASC_VENDOR_NUMBER');
  return missing;
}
