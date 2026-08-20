#!/usr/bin/env node
/**
 * notify-search-engines.mjs
 * -------------------------
 * Notifies Google (via Search Console API) and Bing/Yandex (via IndexNow)
 * that the sitemap has been updated.
 *
 * Environment variables (set via GitHub Secrets):
 *   GOOGLE_SERVICE_ACCOUNT_JSON  – full JSON key of a GCP service account
 *                                  with Search Console API access.
 *   INDEXNOW_KEY                 – verification key for IndexNow protocol.
 *
 * Usage:
 *   node scripts/notify-search-engines.mjs
 */

const SITEMAP_URL = 'https://www.mortgage-pro-calc.com/sitemap.xml';
const SITE_URL = 'https://www.mortgage-pro-calc.com';
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

// ── helpers ──────────────────────────────────────────────────────────────────

function log(label, ok, detail = '') {
  const icon = ok ? '\u2705' : '\u274c';
  const suffix = detail ? ` — ${detail}` : '';
  console.log(`${icon} ${label}${suffix}`);
}

// ── 1. Google Search Console ─────────────────────────────────────────────────

async function notifyGoogle() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) {
    log('Google Search Console', false, 'GOOGLE_SERVICE_ACCOUNT_JSON not set — skipping');
    return;
  }

  let credentials;
  try {
    credentials = JSON.parse(json);
  } catch {
    log('Google Search Console', false, 'GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON');
    return;
  }

  try {
    // --- obtain a short-lived OAuth2 access token via JWT -------------------
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claimSet = {
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/webmasters',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };

    function base64url(obj) {
      return Buffer.from(JSON.stringify(obj))
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    }

    const signingInput = `${base64url(header)}.${base64url(claimSet)}`;
    const sign = await import('crypto').then((m) =>
      m.default.createSign('RSA-SHA256').update(signingInput).sign(credentials.private_key, 'base64'),
    );
    const jwt = `${signingInput}.${sign.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    const tokenBody = await tokenRes.json();
    if (!tokenRes.ok || !tokenBody.access_token) {
      log('Google Search Console', false, `Token exchange failed (${tokenRes.status}): ${tokenBody.error_description || tokenBody.error || 'unknown'}`);
      return;
    }

    // --- submit sitemap via sitemaps.submit (PUT, no body) -------------------
    const submitRes = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/sitemaps/${encodeURIComponent(SITEMAP_URL)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokenBody.access_token}`,
        },
      },
    );

    const submitBody = await submitRes.json().catch(() => null);
    if (submitRes.ok) {
      log('Google Search Console', true, `Sitemap submitted (${submitRes.status})`);
    } else {
      const msg = submitBody?.error?.message || JSON.stringify(submitBody) || `HTTP ${submitRes.status}`;
      log('Google Search Console', false, msg);
    }
  } catch (err) {
    const detail = [
      err.message,
      err.stack && err.stack.split('\n').slice(0, 3).join(' | '),
    ].filter(Boolean).join(' — ');
    log('Google Search Console', false, detail || 'Unknown error');
  }
}

// ── 2. IndexNow (Bing, Yandex, Naver, Seznam, ...) ──────────────────────────

async function notifyIndexNow() {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    log('IndexNow (Bing/Yandex)', false, 'INDEXNOW_KEY not set — skipping');
    return;
  }

  const host = new URL(SITE_URL).hostname;
  const payload = {
    host,
    key,
    keyLocation: `${SITE_URL}/${key}.txt`,
    urlList: [SITE_URL, SITEMAP_URL],
  };

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });

    // IndexNow returns 200 on success; 202 means "accepted, processing"
    if (res.ok || res.status === 202) {
      log('IndexNow (Bing/Yandex)', true, `Notified (${res.status})`);
    } else {
      const body = await res.text().catch(() => '');
      log('IndexNow (Bing/Yandex)', false, `HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
  } catch (err) {
    log('IndexNow (Bing/Yandex)', false, err.message);
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

console.log(`\nSitemap URL : ${SITEMAP_URL}`);
console.log(`Site URL    : ${SITE_URL}\n`);

await Promise.all([notifyGoogle(), notifyIndexNow()]);

console.log('\nDone.');
