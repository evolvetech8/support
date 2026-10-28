import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDemoMetrics } from '../api/_lib/demo.js';

test('generateDemoMetrics produces consistent KPI metrics and chart series', () => {
  const metrics = generateDemoMetrics({ days: 30, appId: 'all' });
  assert.equal(metrics.isDemo, true);
  assert.equal(metrics.days, 30);
  assert.ok(metrics.totals.impressions > 0);
  assert.ok(metrics.totals.pageViews > 0);
  assert.ok(metrics.totals.totalDownloads > 0);
  assert.ok(metrics.totals.proceeds > 0);
  assert.ok(metrics.totals.sessions > 0);
  assert.ok(metrics.appBreakdown.length >= 3);
  assert.equal(metrics.chartTimeline.length, 30);
});
