import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { getClubs, getClubFootball } from '../src/api/footballApi.js';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('loads clubs using a same-origin request', async () => {
  const clubs = [{ id: 1, name: 'Arsenal', league: 'Premier League' }];
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/clubs');
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json({ clubs });
  };
  assert.deepEqual(await getClubs(), clubs);
});

test('rejects failed HTTP responses', async () => {
  globalThis.fetch = async () => new Response('', { status: 503 });
  await assert.rejects(getClubs(), /Failed to fetch/);
});

test('rejects malformed records before they crash rendering', async () => {
  const club = { id: 1, name: 'Arsenal', league: 'Premier League' };
  for (const data of [
    null,
    {},
    { clubs: {} },
    { clubs: [null] },
    { clubs: [{ ...club, name: null }] },
    { clubs: [{ ...club, id: '1' }] },
    { clubs: [{ ...club, short: {} }] },
    { clubs: [club, club] },
  ]) {
    globalThis.fetch = async () => Response.json(data);
    await assert.rejects(getClubs(), /invalid data/);
  }
});

test('allows an empty directory', async () => {
  globalThis.fetch = async () => Response.json({ clubs: [] });
  assert.deepEqual(await getClubs(), []);
});

test('supports cancellation and network failures', async () => {
  const controller = new AbortController();
  controller.abort();
  globalThis.fetch = async (_url, { signal }) => {
    signal.throwIfAborted();
  };
  await assert.rejects(getClubs({ signal: controller.signal }), { name: 'AbortError' });
  globalThis.fetch = async () => {
    throw new TypeError('Network unavailable');
  };
  await assert.rejects(getClubs(), /Network unavailable/);
});

test('accepts official streaming links and rejects unsafe streaming URLs', async () => {
  const fixture = {
    id: 1,
    utcDate: '2026-11-01T20:00:00Z',
    home: 'Arsenal',
    away: 'Chelsea',
    status: 'TIMED',
    competition: 'Premier League',
    competitionCode: 'PL',
    watchInIndia: {
      note: 'Check the match listing.',
      selectedMatches: false,
      platform: { name: 'JioHotstar', url: 'https://www.hotstar.com/in' },
      sources: [],
    },
  };
  globalThis.fetch = async () => Response.json({ fixtures: [fixture], competitions: [] });
  assert.equal((await getClubFootball(7)).fixtures[0].watchInIndia.platform.name, 'JioHotstar');
  fixture.watchInIndia.platform.url = 'javascript:alert(1)';
  await assert.rejects(getClubFootball(7), /incomplete/);
});
