const DECIMAL_RE = /[^\d,-]/g;

const parseNumber = (value) => {
  if (value === null || value === undefined) return 0;
  const text = String(value).trim();
  if (!text) return 0;
  const normalized = text.replace(/\./g, '').replace(DECIMAL_RE, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseDateParts = (value) => {
  const text = String(value || '').trim();
  const [day, month, year] = text.split('-').map((part) => Number(part));
  if (!day || !month || !year) return null;
  return { year, month, day };
};

const toUtcTimestamp = (value) => {
  const parts = parseDateParts(value);
  if (!parts) return 0;
  return Date.UTC(parts.year, parts.month - 1, parts.day);
};

const formatIsoDate = (value) => {
  const parts = parseDateParts(value);
  if (!parts) return String(value || '');
  return `${parts.year.toString().padStart(4, '0')}-${parts.month.toString().padStart(2, '0')}-${parts.day
    .toString()
    .padStart(2, '0')}`;
};

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = '';
  let index = 0;
  let inQuotes = false;
  const source = String(text || '').replace(/^\uFEFF/, '');

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 2;
        continue;
      }
      if (char === '"') {
        inQuotes = false;
        index += 1;
        continue;
      }
      cell += char;
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      index += 1;
      continue;
    }
    if (char === ',') {
      row.push(cell);
      cell = '';
      index += 1;
      continue;
    }
    if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      index += 1;
      continue;
    }
    if (char === '\r') {
      index += 1;
      continue;
    }
    cell += char;
    index += 1;
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((currentRow) => currentRow.some((value) => String(value || '').trim() !== ''));
};

const normalizeHeader = (header) =>
  String(header || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\p{L}\p{N}_]/gu, '');

const parseTransactionsCsv = (csvText) => {
  const rows = parseCsv(csvText);
  if (!rows.length) {
    return { transactions: [], byAsset: [], summary: emptySummary() };
  }

  const headers = rows[0].map(normalizeHeader);
  const records = rows.slice(1).map((columns) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = columns[index] ?? '';
    });
    return record;
  });

  const transactions = records
    .map((record, index) => {
      const product = String(record.product || '').trim();
      const isin = String(record.isin || '').trim();
      const date = String(record.datum || '').trim();
      if (!product && !isin && !date) return null;
      const quantity = parseNumber(record.aantal);
      const totalEur = parseNumber(record.totaal_eur);
      const fee = Math.abs(parseNumber(record.transactiekostenenofkostenvanderden_eur));
      const price = parseNumber(record.koers);
      return {
        id: `${formatIsoDate(date)}-${index}`,
        date,
        sortKey: toUtcTimestamp(date) + index,
        product,
        isin,
        exchange: String(record.beurs || '').trim(),
        venue: String(record.uitvoeringsplaats || '').trim(),
        quantity,
        price,
        localCurrency: String(record.lokale_waarde || '').trim(),
        localValue: parseNumber(record.lokale_waarde),
        totalEur,
        fee,
        autoFxFee: Math.abs(parseNumber(record.autofx_kosten)),
        fxRate: parseNumber(record.wisselkoers),
        currency: String(record.wisselkoers ? record.lokale_waarde && record.lokale_waarde !== record.waarde_eur ? '' : '' : '').trim()
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sortKey - b.sortKey);

  const assets = new Map();
  for (const transaction of transactions) {
    const key = transaction.isin || transaction.product;
    if (!assets.has(key)) {
      assets.set(key, {
        key,
        isin: transaction.isin,
        product: transaction.product,
        exchange: transaction.exchange,
        quantity: 0,
        invested: 0,
        proceeds: 0,
        fees: 0,
        transactions: [],
        latestTradePrice: 0,
        latestTradeDate: ''
      });
    }

    const asset = assets.get(key);
    asset.quantity += transaction.quantity;
    asset.fees += transaction.fee + transaction.autoFxFee;
    asset.transactions.push(transaction);
    asset.latestTradePrice = transaction.price || asset.latestTradePrice;
    asset.latestTradeDate = transaction.date || asset.latestTradeDate;
    if (transaction.totalEur < 0) {
      asset.invested += Math.abs(transaction.totalEur);
    } else {
      asset.proceeds += transaction.totalEur;
    }
  }

  const byAsset = [...assets.values()]
    .map((asset) => ({
      ...asset,
      tradeCount: asset.transactions.length,
      averageBuyPrice:
        asset.quantity > 0 && asset.invested > 0 ? asset.invested / asset.quantity : 0,
      averageSellPrice:
        asset.quantity < 0 && asset.proceeds > 0 ? asset.proceeds / Math.abs(asset.quantity) : 0
    }))
    .sort((a, b) => b.quantity - a.quantity || a.product.localeCompare(b.product));

  const summary = byAsset.reduce(
    (accumulator, asset) => {
      accumulator.transactionCount += asset.tradeCount;
      accumulator.assetCount += 1;
      accumulator.invested += asset.invested;
      accumulator.proceeds += asset.proceeds;
      accumulator.fees += asset.fees;
      accumulator.netQuantity += asset.quantity;
      return accumulator;
    },
    emptySummary()
  );

  return {
    transactions,
    byAsset,
    summary,
    firstDate: transactions[0]?.date || '',
    lastDate: transactions[transactions.length - 1]?.date || ''
  };
};

const emptySummary = () => ({
  transactionCount: 0,
  assetCount: 0,
  invested: 0,
  proceeds: 0,
  fees: 0,
  netQuantity: 0
});

const formatMoney = (value, locale = 'nl-NL', currency = 'EUR') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value || 0);

const formatPercent = (value, locale = 'nl-NL') =>
  new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value || 0);

const formatDate = (value, locale = 'nl-NL') => {
  const parts = parseDateParts(value);
  if (!parts) return String(value || '');
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
};

const buildPortfolioView = ({ csvText, currentPrices = {} }) => {
  const parsed = parseTransactionsCsv(csvText);
  const holdings = parsed.byAsset.map((asset) => {
    const price = Number(currentPrices[asset.isin || asset.key]) || asset.latestTradePrice || 0;
    const marketValue = asset.quantity * price;
    const costBasis = asset.invested - asset.proceeds;
    const pnl = marketValue - costBasis - asset.fees;
    const returnPct = costBasis > 0 ? pnl / costBasis : 0;
    return {
      ...asset,
      price,
      marketValue,
      costBasis,
      pnl,
      returnPct
    };
  });

  const totalValue = holdings.reduce((sum, item) => sum + item.marketValue, 0);
  const totalCostBasis = holdings.reduce((sum, item) => sum + item.costBasis, 0);
  const totalPnl = holdings.reduce((sum, item) => sum + item.pnl, 0);
  const totalFees = parsed.summary.fees;

  const timeline = parsed.transactions.reduce((accumulator, transaction) => {
    const last = accumulator[accumulator.length - 1];
    const nextCash = (last?.cash || 0) + transaction.totalEur;
    accumulator.push({
      date: transaction.date,
      label: formatDate(transaction.date),
      cash: nextCash,
      cumulativeInvested: (last?.cumulativeInvested || 0) + (transaction.totalEur < 0 ? Math.abs(transaction.totalEur) : 0),
      cumulativeProceeds: (last?.cumulativeProceeds || 0) + (transaction.totalEur > 0 ? transaction.totalEur : 0)
    });
    return accumulator;
  }, []);

  return {
    ...parsed,
    holdings,
    metrics: {
      totalValue,
      totalCostBasis,
      totalPnl,
      totalFees,
      returnPct: totalCostBasis > 0 ? totalPnl / totalCostBasis : 0
    },
    timeline
  };
};

export {
  buildPortfolioView,
  formatDate,
  formatMoney,
  formatPercent,
  parseCsv,
  parseTransactionsCsv
};
