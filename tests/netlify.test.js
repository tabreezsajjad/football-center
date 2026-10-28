import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../server/app.js';
import { createNetlifyHandler } from '../server/netlify-handler.js';
import { FootballError } from '../server/football-data.js';

const now = Date.parse('2026-10-28T12:00:00Z');
function fixture({ stale = false } = {}) {
  return createNetlifyHandler({
    clock: () => now,
    app: createApp({
      origins: ['https://endearing-kleicha-cd0f9c.netlify.app'],
      football: {
        configured: true,
        standings: async (code) => {
          if (code === 'ERR') throw new FootballError('Try again later.', 429, 'RATE_LIMITED', 30);
          return { standings: [], fetchedAt: new Date(now - 60000).toISOString(), stale };
        },
      },
    }),
  });
}
function event(path, method = 'GET', query = {}) {
  return {
    httpMethod: method,
    path,
    headers: { host: 'test.netlify.app', origin: 'https://endearing-kleicha-cd0f9c.netlify.app' },
    queryStringParameters: query,
    body: null,
    isBase64Encoded: false,
    requestContext: { identity: { sourceIp: '127.0.0.1' } },
  };
}
test('Netlify serves both public and direct function routes with CORS', async () => {
  const handle = fixture();
  for (const path of ['/api/clubs', '/.netlify/functions/api/clubs']) {
    const response = await handle(event(path), {});
    assert.equal(response.statusCode, 200);
    assert.equal(
      response.headers['access-control-allow-origin'],
      'https://endearing-kleicha-cd0f9c.netlify.app',
    );
    assert.equal(response.headers['netlify-cdn-cache-control'], 'public, durable, s-maxage=3600');
    assert.equal(response.headers['netlify-vary'], 'query, header=Origin');
    assert.ok(JSON.parse(response.body).clubs.length > 0);
  }
});
test('CDN caching subtracts the existing source age', async () => {
  const response = await fixture()(event('/api/standings/PL'), {});
  assert.equal(response.headers['netlify-cdn-cache-control'], 'public, durable, s-maxage=840');
  assert.equal(response.headers['cache-control'], 'no-store');
});
test('Stale data, health and errors are never cached; Retry-After survives', async () => {
  const stale = await fixture({ stale: true })(event('/api/standings/PL'), {});
  assert.equal(stale.headers['netlify-cdn-cache-control'], 'no-store');
  const health = await fixture()(event('/api/health'), {});
  assert.equal(health.headers['netlify-cdn-cache-control'], 'no-store');
  const error = await fixture()(event('/api/standings/ERR'), {});
  assert.equal(error.statusCode, 429);
  assert.equal(error.headers['retry-after'], '30');
  assert.equal(error.headers['netlify-cdn-cache-control'], 'no-store');
});
test('Search queries reach Express and HEAD returns no body', async () => {
  const handle = fixture();
  const response = await handle(event('/api/clubs', 'GET', { search: 'Manchester' }), {});
  assert.equal(response.statusCode, 200);
  assert.ok(JSON.parse(response.body).clubs.every((club) => /manchester/i.test(club.name)));
  const head = await handle(event('/api/clubs', 'HEAD'), {});
  assert.equal(head.statusCode, 200);
  assert.equal(head.body, '');
  assert.equal(head.headers['netlify-cdn-cache-control'], 'no-store');
});
