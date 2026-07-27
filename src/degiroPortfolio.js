import { buildPortfolioView, formatDate, formatMoney, formatPercent, parseTransactionsCsv } from './lib/degiro/portfolio.js';

const state = {
  csvText: '',
  fileName: '',
  portfolio: null,
  prices: {}
};

const els = {};

const qs = (selector) => document.querySelector(selector);

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const readPrices = () => {
  const rows = els.priceTableBody.querySelectorAll('tr');
  const nextPrices = {};
  rows.forEach((row) => {
    const isin = row.dataset.isin;
    const input = row.querySelector('input[data-price-input]');
    const value = Number(String(input.value).replace(',', '.'));
    nextPrices[isin] = Number.isFinite(value) ? value : 0;
  });
  return nextPrices;
};

const renderAllocationChart = (holdings) => {
  const width = 360;
  const height = 260;
  const radius = 84;
  const cx = 140;
  const cy = 130;
  const total = holdings.reduce((sum, item) => sum + Math.abs(item.marketValue), 0) || 1;
  let cursor = -90;
  const slices = holdings.map((item, index) => {
    const share = Math.abs(item.marketValue) / total;
    const sweep = Math.max(share * 360, item.marketValue ? 1 : 0);
    const start = cursor;
    const end = cursor + sweep;
    cursor = end;
    const startRad = (Math.PI / 180) * start;
    const endRad = (Math.PI / 180) * end;
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    const largeArc = sweep > 180 ? 1 : 0;
    return {
      color: `hsl(${(index * 47) % 360} 70% 52%)`,
      d: `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      name: item.product,
      value: item.marketValue,
      share
    };
  });

  const legend = holdings
    .map(
      (item, index) => `
        <div class="legend-item">
          <span class="legend-swatch" style="background:${slices[index]?.color || '#cbd5e1'}"></span>
          <span>${escapeHtml(item.product)}</span>
          <strong>${formatMoney(item.marketValue)}</strong>
        </div>`
    )
    .join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart">
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#e2e8f0" stroke-width="28"></circle>
      ${slices
        .map(
          (slice) => `
          <path d="${slice.d}" fill="none" stroke="${slice.color}" stroke-width="28" stroke-linecap="butt"></path>`
        )
        .join('')}
      <text x="${cx}" y="${cy - 8}" text-anchor="middle" class="chart-center-label">Totale waarde</text>
      <text x="${cx}" y="${cy + 22}" text-anchor="middle" class="chart-center-value">${formatMoney(
        holdings.reduce((sum, item) => sum + item.marketValue, 0)
      )}</text>
    </svg>
    <div class="legend">${legend || '<div class="empty-inline">Geen posities gevonden.</div>'}</div>
  `;
};

const renderTimelineChart = (timeline) => {
  const width = 760;
  const height = 280;
  const padding = 36;
  const values = timeline.flatMap((point) => [point.cumulativeInvested, point.cash]);
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const span = max - min || 1;
  const xStep = timeline.length > 1 ? (width - padding * 2) / (timeline.length - 1) : 0;

  const buildPath = (key) =>
    timeline
      .map((point, index) => {
        const x = padding + index * xStep;
        const y = height - padding - ((point[key] - min) / span) * (height - padding * 2);
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');

  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart chart-wide">
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="axis"></line>
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" class="axis"></line>
      <path d="${buildPath('cumulativeInvested')}" fill="none" stroke="#2563eb" stroke-width="3"></path>
      <path d="${buildPath('cash')}" fill="none" stroke="#16a34a" stroke-width="3"></path>
      ${timeline
        .map((point, index) => {
          const x = padding + index * xStep;
          const investedY = height - padding - ((point.cumulativeInvested - min) / span) * (height - padding * 2);
          const cashY = height - padding - ((point.cash - min) / span) * (height - padding * 2);
          return `
            <circle cx="${x}" cy="${investedY}" r="3.5" fill="#2563eb"></circle>
            <circle cx="${x}" cy="${cashY}" r="3.5" fill="#16a34a"></circle>`;
        })
        .join('')}
    </svg>
    <div class="chart-legend">
      <span><i style="background:#2563eb"></i>Geaccumuleerde inleg</span>
      <span><i style="background:#16a34a"></i>Netto kasstroom</span>
    </div>
  `;
};

const renderPortfolio = () => {
  if (!state.csvText) return;
  state.portfolio = buildPortfolioView({ csvText: state.csvText, currentPrices: state.prices });
  const { holdings, summary, metrics, transactions, timeline, firstDate, lastDate } = state.portfolio;

  els.fileMeta.textContent = state.fileName ? `Bestand: ${state.fileName}` : 'Nog geen bestand geladen.';
  els.importSummary.innerHTML = `
    <div class="stat-card"><div class="stat-label">Posities</div><div class="stat-value">${summary.assetCount}</div></div>
    <div class="stat-card"><div class="stat-label">Transacties</div><div class="stat-value">${summary.transactionCount}</div></div>
    <div class="stat-card"><div class="stat-label">Geïnvesteerd</div><div class="stat-value">${formatMoney(summary.invested)}</div></div>
    <div class="stat-card"><div class="stat-label">Huidige waarde</div><div class="stat-value">${formatMoney(metrics.totalValue)}</div></div>
    <div class="stat-card"><div class="stat-label">Resultaat</div><div class="stat-value ${metrics.totalPnl >= 0 ? 'positive' : 'negative'}">${formatMoney(
      metrics.totalPnl
    )}</div></div>
    <div class="stat-card"><div class="stat-label">Rendement</div><div class="stat-value ${metrics.returnPct >= 0 ? 'positive' : 'negative'}">${formatPercent(
      metrics.returnPct
    )}</div></div>
  `;

  els.rangeSummary.textContent = firstDate && lastDate ? `${formatDate(firstDate)} — ${formatDate(lastDate)}` : 'Geen datum beschikbaar';
  els.charts.innerHTML = `
    <section class="panel">
      <h2>Portefeuilleverdeling</h2>
      ${renderAllocationChart(holdings)}
    </section>
    <section class="panel">
      <h2>Inleg en kasstroom</h2>
      ${renderTimelineChart(timeline)}
    </section>
  `;

  els.holdingsBody.innerHTML = holdings
    .map((item) => {
      const inputValue = state.prices[item.isin || item.key] ?? item.latestTradePrice ?? 0;
      return `
        <tr data-isin="${escapeHtml(item.isin || item.key)}">
          <td>
            <div class="primary">${escapeHtml(item.product)}</div>
            <div class="muted">${escapeHtml(item.isin || 'Onbekende ISIN')} · ${escapeHtml(item.exchange || '—')}</div>
          </td>
          <td>${formatNumber(item.quantity)}</td>
          <td><input data-price-input type="number" step="0.0001" value="${escapeHtml(inputValue)}" /></td>
          <td>${formatMoney(item.marketValue)}</td>
          <td>${formatMoney(item.costBasis)}</td>
          <td class="${item.pnl >= 0 ? 'positive' : 'negative'}">${formatMoney(item.pnl)}</td>
          <td>${formatPercent(item.returnPct)}</td>
        </tr>
      `;
    })
    .join('');

  els.transactionsBody.innerHTML = transactions
    .map(
      (item) => `
        <tr>
          <td>${formatDate(item.date)}</td>
          <td>${escapeHtml(item.product)}</td>
          <td>${escapeHtml(item.isin || '')}</td>
          <td>${formatNumber(item.quantity)}</td>
          <td>${formatMoney(item.price * Math.abs(item.quantity))}</td>
          <td class="${item.totalEur >= 0 ? 'positive' : 'negative'}">${formatMoney(item.totalEur)}</td>
          <td>${formatMoney(item.fee + item.autoFxFee)}</td>
        </tr>
      `
    )
    .join('');
  updatePriceInputs();
};

const formatNumber = (value) =>
  new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 6 }).format(value || 0);

const updatePriceInputs = () => {
  els.priceTableBody.querySelectorAll('input[data-price-input]').forEach((input) => {
    input.addEventListener('input', () => {
      state.prices = readPrices();
      renderPortfolio();
    });
  });
};

const handleFile = async (file) => {
  if (!file) return;
  const text = await file.text();
  state.csvText = text;
  state.fileName = file.name;
  state.prices = {};
  renderPortfolio();
};

const init = () => {
  els.fileInput = qs('#fileInput');
  els.csvTextarea = qs('#csvTextarea');
  els.loadButton = qs('#loadButton');
  els.sampleButton = qs('#sampleButton');
  els.importSummary = qs('#importSummary');
  els.fileMeta = qs('#fileMeta');
  els.charts = qs('#charts');
  els.holdingsBody = qs('#holdingsBody');
  els.transactionsBody = qs('#transactionsBody');
  els.priceTableBody = qs('#holdingsBody');
  els.rangeSummary = qs('#rangeSummary');

  els.fileInput.addEventListener('change', (event) => handleFile(event.target.files?.[0]));
  els.loadButton.addEventListener('click', async () => {
    const text = els.csvTextarea.value.trim();
    if (!text) return;
    state.csvText = text;
    state.fileName = 'Plaktekst';
    state.prices = {};
    renderPortfolio();
  });
  els.sampleButton.addEventListener('click', () => {
    els.csvTextarea.value = '';
  });

  const dropZone = qs('#dropZone');
  dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', async (event) => {
    event.preventDefault();
    dropZone.classList.remove('dragover');
    const file = event.dataTransfer.files?.[0];
    await handleFile(file);
  });

  els.csvTextarea.placeholder = 'Plak hier de CSV-inhoud als je geen bestand wilt uploaden.';
};

document.addEventListener('DOMContentLoaded', init);
