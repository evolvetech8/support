(function () {
  'use strict';

  let currentRange = '30d';
  let currentApp = 'all';
  let currentChartType = 'area';
  let chartInstance = null;
  let cachedMetrics = null;

  const APP_COLORS = [
    { border: '#FD7528', bg: 'rgba(253, 117, 40, 0.28)' },
    { border: '#FFA51D', bg: 'rgba(255, 165, 29, 0.22)' },
    { border: '#EA4033', bg: 'rgba(234, 64, 51, 0.22)' },
    { border: '#22D3EE', bg: 'rgba(34, 211, 238, 0.22)' },
    { border: '#A855F7', bg: 'rgba(168, 85, 247, 0.22)' },
  ];

  function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    return Number(num).toLocaleString('en-US');
  }

  function formatUsd(amount) {
    if (amount === undefined || amount === null) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  function formatPercent(val) {
    return `${val > 0 ? '+' : ''}${val}%`;
  }

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.hasPasswordConfigured && !data.authenticated) {
        showLoginModal(true);
      } else {
        showLoginModal(false);
      }
    } catch {
      // Offline or network error: proceed
    }
  }

  function showLoginModal(visible) {
    const modal = document.getElementById('login-modal');
    if (!modal) return;
    if (visible) {
      modal.classList.remove('hidden');
    } else {
      modal.classList.add('hidden');
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    const input = document.getElementById('login-password');
    const errEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    if (!input) return;
    const password = input.value;
    errEl.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Verifying...';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showLoginModal(false);
        input.value = '';
        loadMetrics();
      } else {
        errEl.textContent = data.message || 'Invalid password. Please try again.';
      }
    } catch {
      errEl.textContent = 'Connection error. Please try again.';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In to Dashboard';
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    window.location.reload();
  }

  let toastTimer = null;
  function showToast(message, type = 'info') {
    const toast = document.getElementById('dash-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `dash-toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  }

  async function handleSync() {
    const btn = document.getElementById('btn-sync');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Syncing with Apple...';
    }

    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        showToast('✓ Sync completed successfully! Real data updated.', 'success');
        loadMetrics();
      } else {
        showToast(data.message || data.instructions || 'Sync notice: credentials required.', 'error');
      }
    } catch (err) {
      showToast('Sync request error: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '⚡ Sync Now';
      }
    }
  }

  async function loadMetrics() {
    try {
      const res = await fetch(`/api/metrics?range=${currentRange}&app=${encodeURIComponent(currentApp)}`);
      if (res.status === 401) {
        showLoginModal(true);
        return;
      }
      if (!res.ok) throw new Error('Failed to load metrics');
      const data = await res.json();
      cachedMetrics = data;
      renderMetrics(data);
    } catch (err) {
      console.error('Metrics loading error:', err);
    }
  }

  function renderMetrics(data) {
    // 1. Status Pill
    const pill = document.getElementById('status-pill');
    if (pill) {
      if (data.isDemo) {
        pill.className = 'status-pill demo';
        pill.innerHTML = '<span class="status-dot"></span> Demo Mode';
      } else {
        pill.className = 'status-pill live';
        pill.innerHTML = '<span class="status-dot"></span> Live Data';
      }
    }

    // 2. Setup Notice Banner
    const notice = document.getElementById('setup-notice');
    if (notice) {
      if (data.isDemo && (!data.dbConfigured || !data.appleConfigured)) {
        notice.style.display = 'flex';
        const missing = [];
        if (!data.dbConfigured) missing.push('Neon Postgres (DATABASE_URL)');
        if (!data.appleConfigured) missing.push('App Store API Key');
        document.getElementById('notice-missing').textContent = missing.join(' & ');
      } else {
        notice.style.display = 'none';
      }
    }

    // 3. App Picker options
    const select = document.getElementById('app-select');
    if (select && data.apps && select.options.length <= 1) {
      for (const a of data.apps) {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = a.name;
        select.appendChild(opt);
      }
    }

    // 4. KPI Cards
    const t = data.totals || {};
    const comp = data.comparisons || {};

    setCardValue('kpi-impressions', formatNumber(t.impressions));
    setCardDelta('delta-impressions', comp.impressionsChange);

    setCardValue('kpi-pageviews', formatNumber(t.pageViews));
    setCardDelta('delta-pageviews', comp.pageViewsChange);

    setCardValue('kpi-downloads', formatNumber(t.totalDownloads));
    setCardDelta('delta-downloads', comp.downloadsChange);

    setCardValue('kpi-conversion', `${t.conversionRate || 0}%`);
    setCardDelta('delta-conversion', comp.conversionChange, '% pt');

    setCardValue('kpi-proceeds', formatUsd(t.proceeds));
    setCardDelta('delta-proceeds', comp.proceedsChange);

    const minSec = t.avgSessionDuration ? `${Math.floor(t.avgSessionDuration / 60)}m ${t.avgSessionDuration % 60}s` : '0m';
    setCardValue('kpi-sessions', formatNumber(t.sessions));
    const sessionSub = document.getElementById('kpi-sessions-sub');
    if (sessionSub) {
      sessionSub.textContent = `Avg duration: ${minSec} (Opt-in users)`;
    }

    // 5. Chart
    renderChart(data.chartTimeline, data.apps);

    // 6. Breakdown
    renderBreakdown(data.appBreakdown);
  }

  function setCardValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function setCardDelta(id, delta, unit = '%') {
    const el = document.getElementById(id);
    if (!el) return;
    if (delta === undefined || delta === null) {
      el.textContent = 'vs prev';
      el.className = 'delta-badge';
      return;
    }
    const isUp = delta >= 0;
    el.className = `delta-badge ${isUp ? 'up' : 'down'}`;
    el.textContent = `${isUp ? '↑ +' : '↓ '}${delta}${unit}`;
  }

  function renderChart(timeline, apps) {
    const ctx = document.getElementById('proceeds-chart');
    if (!ctx || !window.Chart) return;

    if (chartInstance) {
      chartInstance.destroy();
    }

    if (!timeline || !timeline.length) {
      return;
    }

    const labels = timeline.map((item) => {
      const parts = item.date.split('-');
      return `${parts[1]}/${parts[2]}`;
    });

    const datasets = [];

    if (currentApp === 'all' && apps && apps.length > 0) {
      apps.forEach((app, idx) => {
        const color = APP_COLORS[idx % APP_COLORS.length];
        const data = timeline.map((item) => item.byApp?.[app.name] || 0);

        datasets.push({
          label: app.name,
          data,
          borderColor: color.border,
          backgroundColor: currentChartType === 'area' ? color.bg : color.border,
          fill: currentChartType === 'area',
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
        });
      });
    } else {
      const data = timeline.map((item) => item.totalProceeds || 0);
      datasets.push({
        label: 'Proceeds (USD)',
        data,
        borderColor: '#FD7528',
        backgroundColor: currentChartType === 'area' ? 'rgba(253, 117, 40, 0.25)' : '#FD7528',
        fill: currentChartType === 'area',
        tension: 0.35,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 5,
      });
    }

    const chartConfigType = currentChartType === 'bar' ? 'bar' : 'line';

    chartInstance = new window.Chart(ctx, {
      type: chartConfigType,
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: currentApp === 'all',
            position: 'top',
            labels: { color: '#c9b4a4', font: { size: 12, weight: 'bold' }, boxWidth: 12 },
          },
          tooltip: {
            backgroundColor: 'rgba(22, 15, 11, 0.95)',
            titleColor: '#fff',
            bodyColor: '#c9b4a4',
            borderColor: 'rgba(253, 117, 40, 0.4)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: function (context) {
                return ` ${context.dataset.label}: ${formatUsd(context.parsed.y)}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 165, 29, 0.06)' },
            ticks: { color: '#8a7363', maxTicksLimit: 12 },
          },
          y: {
            grid: { color: 'rgba(255, 165, 29, 0.08)' },
            ticks: {
              color: '#8a7363',
              callback: function (val) {
                return '$' + val;
              },
            },
          },
        },
      },
    });
  }

  function renderBreakdown(breakdown) {
    const container = document.getElementById('breakdown-list');
    if (!container) return;
    container.innerHTML = '';

    if (!breakdown || !breakdown.length) {
      container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.88rem;">No sales data available for this range.</p>';
      return;
    }

    breakdown.forEach((item, idx) => {
      const color = APP_COLORS[idx % APP_COLORS.length];
      const div = document.createElement('div');
      div.className = 'breakdown-item';
      div.innerHTML = `
        <div class="breakdown-meta">
          <span class="breakdown-app-name" style="color: ${color.border}">
            ${item.appName}
          </span>
          <div class="breakdown-numbers">
            <span>${formatNumber(item.downloads)} downloads</span>
            <span><strong>${formatUsd(item.proceeds)}</strong></span>
            <span class="breakdown-share">${item.sharePercent}%</span>
          </div>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${item.sharePercent}%; background: ${color.border}"></div>
        </div>
      `;
      container.appendChild(div);
    });
  }

  function setupEventListeners() {
    // Range filter buttons
    document.querySelectorAll('.btn-filter[data-range]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-filter[data-range]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentRange = btn.getAttribute('data-range');
        loadMetrics();
      });
    });

    // Chart toggles (Line / Area / Bar)
    document.querySelectorAll('.btn-filter[data-chart]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-filter[data-chart]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentChartType = btn.getAttribute('data-chart');
        if (cachedMetrics) {
          renderChart(cachedMetrics.chartTimeline, cachedMetrics.apps);
        }
      });
    });

    // App selector
    const appSelect = document.getElementById('app-select');
    if (appSelect) {
      appSelect.addEventListener('change', (e) => {
        currentApp = e.target.value;
        loadMetrics();
      });
    }

    // Buttons
    const syncBtn = document.getElementById('btn-sync');
    if (syncBtn) syncBtn.addEventListener('click', handleSync);

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkAuth();
    loadMetrics();
  });
})();
