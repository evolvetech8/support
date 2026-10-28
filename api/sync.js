import { getConfig, missingAppleConfig } from './_lib/config.js';
import { hasValidSession, hasValidCronSecret } from './_lib/auth.js';
import { getDb, isDbConfigured, initSchema } from './_lib/db.js';
import { generateAscJwt, fetchAscApps, fetchDailySalesReport } from './_lib/asc.js';
import { aggregateSales, convertToUsd } from './_lib/parsers.js';
import { getExchangeRates } from './_lib/fx.js';
import { sendJson, methodNotAllowed } from './_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return methodNotAllowed(res, ['POST', 'GET']);
  }

  const cfg = getConfig();

  // Verify auth: valid user session OR valid Vercel Cron header
  const isCron = hasValidCronSecret(req, cfg);
  const isSession = hasValidSession(req, cfg);
  const isPasswordConfigured = Boolean(cfg.dashboardPassword);

  if (isPasswordConfigured && !isCron && !isSession) {
    return sendJson(res, 401, { error: 'unauthorized', message: 'Authentication required to run sync' });
  }

  const missingApple = missingAppleConfig(cfg);
  const isDb = isDbConfigured(cfg);

  // If credentials are not yet configured in Vercel env, return helpful status
  if (!isDb || missingApple.length > 0) {
    return sendJson(res, 200, {
      ok: false,
      message: 'Sync skipped: credentials not yet configured.',
      configured: {
        database: isDb,
        appleApi: missingApple.length === 0,
        missingAppleKeys: missingApple,
      },
      instructions: 'Add DATABASE_URL, ASC_ISSUER_ID, ASC_KEY_ID, ASC_PRIVATE_KEY, and ASC_VENDOR_NUMBER to Vercel Environment Variables.',
    });
  }

  const db = getDb(cfg);

  try {
    // 1. Ensure database tables exist
    await initSchema(db);

    // 2. Authenticate with Apple App Store Connect
    const jwt = generateAscJwt({
      issuerId: cfg.asc.issuerId,
      keyId: cfg.asc.keyId,
      privateKey: cfg.asc.privateKey,
    });

    // 3. Fetch list of apps
    const apps = await fetchAscApps(jwt);
    for (const app of apps) {
      await db`
        INSERT INTO apps (id, name, sku, bundle_id)
        VALUES (${app.id}, ${app.name}, ${app.sku}, ${app.bundleId})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          sku = EXCLUDED.sku,
          bundle_id = EXCLUDED.bundle_id;
      `;
    }

    const skuToAppId = {};
    for (const a of apps) {
      if (a.sku) skuToAppId[a.sku] = a.id;
    }

    // 4. Get currency exchange rates
    const fxRates = await getExchangeRates('USD');

    // 5. Fetch sales reports for the last 5 days
    const now = new Date();
    const syncedDays = [];

    for (let i = 1; i <= 5; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);

      try {
        const report = await fetchDailySalesReport({
          jwt,
          vendorNumber: cfg.asc.vendorNumber,
          date: dateStr,
          reportVersion: cfg.asc.salesReportVersion,
        });

        if (report && report.parsedRows && report.parsedRows.length > 0) {
          const { byApp } = aggregateSales(report.parsedRows, skuToAppId);

          for (const [appId, agg] of byApp.entries()) {
            const { usd } = convertToUsd(agg.proceedsLocal, fxRates);

            await db`
              INSERT INTO daily_sales (
                date, app_id, downloads, redownloads, updates, iap_units, proceeds_usd, proceeds_local
              ) VALUES (
                ${dateStr}, ${appId}, ${agg.downloads}, ${agg.redownloads}, ${agg.updates}, ${agg.iapUnits}, ${usd}, ${JSON.stringify(agg.proceedsLocal)}
              )
              ON CONFLICT (date, app_id) DO UPDATE SET
                downloads = EXCLUDED.downloads,
                redownloads = EXCLUDED.redownloads,
                updates = EXCLUDED.updates,
                iap_units = EXCLUDED.iap_units,
                proceeds_usd = EXCLUDED.proceeds_usd,
                proceeds_local = EXCLUDED.proceeds_local;
            `;
          }
          syncedDays.push(dateStr);
        }
      } catch (err) {
        console.warn(`Sync failed for date ${dateStr}:`, err.message);
      }
    }

    // 6. Record sync log
    await db`
      INSERT INTO sync_logs (source, status, details, finished_at)
      VALUES (
        ${isCron ? 'cron' : 'manual'},
        'success',
        ${JSON.stringify({ appsCount: apps.length, syncedDays })},
        NOW()
      );
    `;

    return sendJson(res, 200, {
      ok: true,
      message: 'Sync completed successfully',
      appsCount: apps.length,
      syncedDays,
    });
  } catch (err) {
    console.error('Sync error:', err);
    if (db) {
      try {
        await db`
          INSERT INTO sync_logs (source, status, details, finished_at)
          VALUES (${isCron ? 'cron' : 'manual'}, 'error', ${JSON.stringify({ error: err.message })}, NOW());
        `;
      } catch {}
    }
    return sendJson(res, 500, { ok: false, error: err.message });
  }
}
