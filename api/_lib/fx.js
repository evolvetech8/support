// Currency conversion to USD.
// Fetches daily rates from open exchange API or falls back to an embedded reference table.

const FALLBACK_RATES_TO_USD = {
  USD: 1.0,
  EUR: 1.08,
  GBP: 1.28,
  CAD: 0.73,
  AUD: 0.65,
  JPY: 0.0067,
  VND: 0.000039,
  CNY: 0.14,
  SGD: 0.76,
  HKD: 0.13,
  KRW: 0.00072,
  TWD: 0.031,
  THB: 0.029,
  INR: 0.012,
  BRL: 0.17,
  MXN: 0.051
};

export async function getExchangeRates(base = 'USD') {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.rates) {
        // data.rates gives units of CUR per 1 USD (e.g. EUR: 0.92 means 1 EUR = 1/0.92 USD)
        const usdPerUnit = {};
        for (const [cur, rate] of Object.entries(data.rates)) {
          if (rate && Number.isFinite(rate) && rate > 0) {
            usdPerUnit[cur.toUpperCase()] = 1 / rate;
          }
        }
        usdPerUnit.USD = 1.0;
        return usdPerUnit;
      }
    }
  } catch {
    // network timeout or failure: use fallback table
  }
  return { ...FALLBACK_RATES_TO_USD };
}

export function convertAmountToUsd(amount, currency, rates = FALLBACK_RATES_TO_USD) {
  if (!amount || Number.isNaN(amount)) return 0;
  const cur = String(currency || 'USD').toUpperCase();
  if (cur === 'USD') return amount;
  const rate = rates[cur] || FALLBACK_RATES_TO_USD[cur] || 1.0;
  return Math.round(amount * rate * 10000) / 10000;
}
