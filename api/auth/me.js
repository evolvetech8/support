import { getConfig, missingAppleConfig } from '../_lib/config.js';
import { hasValidSession } from '../_lib/auth.js';
import { isDbConfigured } from '../_lib/db.js';
import { sendJson, methodNotAllowed } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  const cfg = getConfig();
  const authenticated = hasValidSession(req, cfg);
  const missingApple = missingAppleConfig(cfg);

  return sendJson(res, 200, {
    authenticated,
    hasPasswordConfigured: Boolean(cfg.dashboardPassword),
    isDbConfigured: isDbConfigured(cfg),
    isAppleConfigured: missingApple.length === 0,
    missingAppleConfig: missingApple,
  });
}
