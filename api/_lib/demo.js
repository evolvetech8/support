// Generates realistic demo analytics for Archonic apps.
// Used when real App Store credentials or Neon database are not yet connected.

export const DEMO_APPS = [
  { id: 'app_smartkind', name: 'SmartKind', sku: 'SMARTKIND_IOS', bundleId: 'com.evolvetech.smartkind', color: '#FD7528' },
  { id: 'app_chocon', name: 'Cho Con', sku: 'CHOCON_APP_2026', bundleId: 'com.evolvetech.chocon', color: '#FFA51D' },
  { id: 'app_sotinhnghia', name: 'SoTInhNghia', sku: 'SOTINHNGHIA_APP', bundleId: 'com.evolvetech.sotinhnghia', color: '#EA4033' },
];

function pseudoRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function generateDemoMetrics({ days = 30, appId = 'all' } = {}) {
  const now = new Date();
  const selectedApps = appId && appId !== 'all' 
    ? DEMO_APPS.filter((a) => a.id === appId || a.name.toLowerCase() === appId.toLowerCase())
    : DEMO_APPS;

  const currentTimeline = [];
  const previousTimeline = [];

  // Generate current period days and previous period days for comparisons
  for (let i = days - 1; i >= 0; i--) {
    const curDate = new Date(now);
    curDate.setDate(curDate.getDate() - i);
    const dateStr = curDate.toISOString().slice(0, 10);
    const dayOfWeek = curDate.getDay(); // 0 is Sunday, 6 is Saturday
    const weekendMultiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 1.35 : 1.0;

    for (const app of selectedApps) {
      const seed = i * 17 + app.name.charCodeAt(0) * 31;
      const noise = 0.85 + pseudoRandom(seed) * 0.3;

      let baseImpressions = 1200;
      let basePrice = 2.99;
      let iapRate = 0.08;

      if (app.id === 'app_smartkind') {
        baseImpressions = 2400;
        basePrice = 4.99;
        iapRate = 0.12;
      } else if (app.id === 'app_chocon') {
        baseImpressions = 1600;
        basePrice = 3.99;
        iapRate = 0.09;
      }

      const impressions = Math.round(baseImpressions * weekendMultiplier * noise);
      const impressionsUnique = Math.round(impressions * 0.78);
      const pageViews = Math.round(impressions * 0.28 * noise);
      const pageViewsUnique = Math.round(pageViews * 0.82);

      // Conversion rate ~ 3.2% - 4.5% of unique impressions
      const conversionRate = 0.035 * noise;
      const firstTimeDownloads = Math.max(1, Math.round(impressionsUnique * conversionRate));
      const redownloads = Math.round(firstTimeDownloads * 0.22);
      const totalDownloads = firstTimeDownloads + redownloads;

      // In-app purchase proceeds
      const payingUsers = Math.round(totalDownloads * iapRate);
      const proceeds = Math.round(payingUsers * basePrice * 0.85 * 100) / 100; // after Apple's cut

      // Sessions (Apple opt-in ~ 32% of users)
      const optInUsers = Math.round(totalDownloads * 0.32);
      const sessions = Math.round(optInUsers * (2.8 + pseudoRandom(seed + 1) * 1.5));
      const avgDurationSec = Math.round(180 + pseudoRandom(seed + 2) * 120);

      currentTimeline.push({
        date: dateStr,
        appId: app.id,
        appName: app.name,
        color: app.color,
        impressions,
        impressionsUnique,
        pageViews,
        pageViewsUnique,
        downloads: firstTimeDownloads,
        redownloads,
        totalDownloads,
        proceeds,
        sessions,
        avgDurationSec,
      });
    }
  }

  // Aggregate totals for current period
  const totals = {
    impressions: 0,
    impressionsUnique: 0,
    pageViews: 0,
    totalDownloads: 0,
    proceeds: 0,
    sessions: 0,
    totalDurationSec: 0,
    conversionRate: 0,
  };

  const appBreakdownMap = new Map();

  for (const item of currentTimeline) {
    totals.impressions += item.impressions;
    totals.impressionsUnique += item.impressionsUnique;
    totals.pageViews += item.pageViews;
    totals.totalDownloads += item.totalDownloads;
    totals.proceeds += item.proceeds;
    totals.sessions += item.sessions;
    totals.totalDurationSec += item.sessions * item.avgDurationSec;

    if (!appBreakdownMap.has(item.appId)) {
      appBreakdownMap.set(item.appId, {
        appId: item.appId,
        appName: item.appName,
        color: item.color,
        downloads: 0,
        proceeds: 0,
        pageViews: 0,
        impressions: 0,
      });
    }
    const b = appBreakdownMap.get(item.appId);
    b.downloads += item.totalDownloads;
    b.proceeds += item.proceeds;
    b.pageViews += item.pageViews;
    b.impressions += item.impressions;
  }

  totals.proceeds = Math.round(totals.proceeds * 100) / 100;
  totals.conversionRate = totals.impressionsUnique > 0 
    ? Math.round((totals.totalDownloads / totals.impressionsUnique) * 1000) / 10 
    : 0;
  totals.avgSessionDuration = totals.sessions > 0 
    ? Math.round(totals.totalDurationSec / totals.sessions) 
    : 0;

  // Comparison changes vs previous period (realistic +8% to +18% growth)
  const comparisons = {
    impressionsChange: 12.4,
    pageViewsChange: 14.8,
    downloadsChange: 9.6,
    conversionChange: 0.4,
    proceedsChange: 16.2,
    sessionsChange: 11.5,
  };

  // Compute percentage share per app for breakdown
  const appBreakdown = Array.from(appBreakdownMap.values()).map((item) => {
    const share = totals.proceeds > 0 ? Math.round((item.proceeds / totals.proceeds) * 1000) / 10 : 0;
    const conv = item.impressions > 0 ? Math.round((item.downloads / (item.impressions * 0.78)) * 1000) / 10 : 0;
    return {
      ...item,
      proceeds: Math.round(item.proceeds * 100) / 100,
      sharePercent: share,
      conversionRate: conv,
    };
  });

  // Sort by proceeds descending
  appBreakdown.sort((a, b) => b.proceeds - a.proceeds);

  // Group chart timeline by date
  const chartDatesMap = new Map();
  for (const item of currentTimeline) {
    if (!chartDatesMap.has(item.date)) {
      chartDatesMap.set(item.date, { date: item.date, totalProceeds: 0, byApp: {} });
    }
    const d = chartDatesMap.get(item.date);
    d.totalProceeds = Math.round((d.totalProceeds + item.proceeds) * 100) / 100;
    d.byApp[item.appName] = item.proceeds;
  }

  const chartTimeline = Array.from(chartDatesMap.values());

  return {
    isDemo: true,
    lastSync: new Date().toISOString(),
    days,
    apps: DEMO_APPS,
    totals,
    comparisons,
    appBreakdown,
    chartTimeline,
  };
}
