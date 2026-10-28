import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { once } from 'node:events';
import { createApp } from '../server/app.js';
import { FootballError } from '../server/football-data.js';

let server;
let base;
const calls = [];
before(async () => {
  const football = {
    configured: true,
    clubData: async (id) => {
      calls.push(id);
      return { clubId: id, fixtures: [], competitions: [] };
    },
    standings: async (code) => {
      if (code === 'PL') throw new FootballError('Try again later.', 429, 'RATE_LIMITED', 30);
      throw new Error('private provider diagnostic');
    },
  };
  server = createApp({
    football,
    cups: {
      clubFixtures: async () => ({ fixtures: [], cups: [], complete: false }),
      nationsLeague: async () => ({
        fixtures: [],
        competitions: [],
        coverageNote: 'Supplemental listings.',
      }),
    },
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (!server) return;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

test('health and config expose readiness without credentials', async () => {
  const response = await fetch(`${base}/api/config`);
  const body = await response.json();
  assert.equal(body.configured, true);
  assert.equal(body.plan, 'free');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.ok(!JSON.stringify(body).includes('API_KEY'));
});

test('Nations League route uses the supplemental service rather than club data', async () => {
  const before = calls.length;
  const response = await fetch(`${base}/api/international/nations-league`);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).fixtures, []);
  assert.equal(calls.length, before);
});

test('invalid club IDs and duplicate search parameters never reach the provider', async () => {
  const before = calls.length;
  assert.equal((await fetch(`${base}/api/clubs/not-a-number/football`)).status, 404);
  assert.equal((await fetch(`${base}/api/clubs/999/football`)).status, 404);
  assert.equal((await fetch(`${base}/api/clubs?search=a&search=b`)).status, 400);
  assert.equal(calls.length, before);
});

test('the club directory excludes the removed club and preserves other favourite IDs', async () => {
  const response = await fetch(`${base}/api/clubs`);
  const data = await response.json();
  assert.equal(data.count, 11);
  assert.ok(!data.clubs.some((club) => club.id === 6));
  assert.equal(data.clubs.find((club) => club.id === 12).name, 'AC Milan');
  assert.equal((await fetch(`${base}/api/clubs/6/football`)).status, 404);
});

test('normalizes standings codes and returns provider cooldown headers', async () => {
  const response = await fetch(`${base}/api/standings/pl`);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '30');
  assert.equal((await response.json()).code, 'RATE_LIMITED');
});

test('unexpected errors and missing routes return safe JSON', async () => {
  const response = await fetch(`${base}/api/standings/PD`);
  assert.equal(response.status, 500);
  assert.ok(!(await response.text()).includes('private provider diagnostic'));
  const missing = await fetch(`${base}/api/missing`);
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).code, 'NOT_FOUND');
});

test('rejects malformed request bodies without exposing parser diagnostics', async () => {
  const response = await fetch(`${base}/api/clubs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{invalid',
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'INVALID_JSON');
});
