import { neon } from '@neondatabase/serverless';
import { getConfig } from './config.js';

let cachedSql = null;

export function isDbConfigured(cfg = getConfig()) {
  return Boolean(cfg.databaseUrl && cfg.databaseUrl.trim());
}

export function getDb(cfg = getConfig()) {
  if (!isDbConfigured(cfg)) return null;
  if (!cachedSql) {
    cachedSql = neon(cfg.databaseUrl);
  }
  return cachedSql;
}

export async function initSchema(sql) {
  if (!sql) return;

  await sql`
    CREATE TABLE IF NOT EXISTS apps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sku TEXT,
      bundle_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS daily_sales (
      date DATE NOT NULL,
      app_id TEXT NOT NULL,
      downloads INT DEFAULT 0,
      redownloads INT DEFAULT 0,
      updates INT DEFAULT 0,
      iap_units INT DEFAULT 0,
      proceeds_usd NUMERIC(14,4) DEFAULT 0,
      proceeds_local JSONB DEFAULT '{}',
      PRIMARY KEY (date, app_id)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS daily_engagement (
      date DATE NOT NULL,
      app_id TEXT NOT NULL,
      impressions INT DEFAULT 0,
      impressions_unique INT DEFAULT 0,
      page_views INT DEFAULT 0,
      page_views_unique INT DEFAULT 0,
      PRIMARY KEY (date, app_id)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS daily_sessions (
      date DATE NOT NULL,
      app_id TEXT NOT NULL,
      sessions INT DEFAULT 0,
      duration_seconds INT DEFAULT 0,
      unique_devices INT DEFAULT 0,
      PRIMARY KEY (date, app_id)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS fx_rates (
      date DATE NOT NULL,
      base_currency TEXT NOT NULL DEFAULT 'USD',
      rates JSONB NOT NULL,
      PRIMARY KEY (date, base_currency)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sync_logs (
      id SERIAL PRIMARY KEY,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      details JSONB DEFAULT '{}',
      started_at TIMESTAMPTZ DEFAULT NOW(),
      finished_at TIMESTAMPTZ
    );
  `;
}

export async function queryMetricsFromDb(sql, { startDate, endDate, appId }) {
  if (!sql) return null;

  const appFilterSales = appId && appId !== 'all' ? sql`AND s.app_id = ${appId}` : sql``;
  const appFilterEngage = appId && appId !== 'all' ? sql`AND e.app_id = ${appId}` : sql``;
  const appFilterSessions = appId && appId !== 'all' ? sql`AND ss.app_id = ${appId}` : sql``;

  const salesRows = await sql`
    SELECT 
      s.date,
      s.app_id,
      COALESCE(a.name, s.app_id) AS app_name,
      s.downloads,
      s.redownloads,
      s.updates,
      s.iap_units,
      s.proceeds_usd::float AS proceeds_usd
    FROM daily_sales s
    LEFT JOIN apps a ON s.app_id = a.id
    WHERE s.date >= ${startDate} AND s.date <= ${endDate}
    ${appFilterSales}
    ORDER BY s.date ASC;
  `;

  const engageRows = await sql`
    SELECT 
      e.date,
      e.app_id,
      e.impressions,
      e.impressions_unique,
      e.page_views,
      e.page_views_unique
    FROM daily_engagement e
    WHERE e.date >= ${startDate} AND e.date <= ${endDate}
    ${appFilterEngage}
    ORDER BY e.date ASC;
  `;

  const sessionRows = await sql`
    SELECT 
      ss.date,
      ss.app_id,
      ss.sessions,
      ss.duration_seconds,
      ss.unique_devices
    FROM daily_sessions ss
    WHERE ss.date >= ${startDate} AND ss.date <= ${endDate}
    ${appFilterSessions}
    ORDER BY ss.date ASC;
  `;

  const appsList = await sql`
    SELECT id, name, sku, bundle_id FROM apps ORDER BY name ASC;
  `;

  return { salesRows, engageRows, sessionRows, appsList };
}
