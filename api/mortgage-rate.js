/**
 * api/mortgage-rate.js — Vercel serverless function.
 * --------------------------------------------------
 * Proxies the FRED series MORTGAGE30US (Freddie Mac Primary Mortgage
 * Market Survey — 30-year fixed rate) and returns the latest observation.
 *
 * Response: { "rate": 6.23, "date": "2026-08-14" }
 * Cached for 24h on Vercel's CDN (FRED publishes PMMS weekly).
 *
 * Environment: FRED_API_KEY (set in Vercel dashboard).
 */
const FRED_ENDPOINT = 'https://api.stlouisfed.org/fred/series/observations';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'FRED_API_KEY not configured' });
    return;
  }

  try {
    const params = new URLSearchParams({
      series_id: 'MORTGAGE30US',
      file_type: 'json',
      sort_order: 'desc',
      limit: '1',
      api_key: apiKey
    });
    const resp = await fetch(FRED_ENDPOINT + '?' + params.toString(), {
      headers: { 'Accept': 'application/json' }
    });
    if (!resp.ok) {
      res.status(502).json({ error: 'FRED upstream error: ' + resp.status });
      return;
    }
    const data = await resp.json();
    const obs = Array.isArray(data && data.observations) ? data.observations[0] : null;
    const rate = parseFloat(obs && obs.value);
    if (!obs || !isFinite(rate) || rate <= 0) {
      res.status(502).json({ error: 'FRED returned no usable observation' });
      return;
    }

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=86400');
    res.status(200).json({ rate, date: obs.date });
  } catch (e) {
    res.status(502).json({ error: 'Failed to fetch mortgage rate' });
  }
};
