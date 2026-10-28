import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFootballService } from '../server/football-data.js';

const instant = Date.parse('2026-10-28T10:00:00Z');
const metadata = {
  id: 65,
  runningCompetitions: [
    { id: 2021, code: 'PL', name: 'Premier League', type: 'LEAGUE' },
    { id: 2055, code: 'FAC', name: 'FA Cup', type: 'CUP' },
  ],
};
const game = {
  id: 100,
  utcDate: '2026-10-30T18:00:00Z',
  status: 'TIMED',
  competition: { code: 'PL', name: 'Premier League' },
  homeTeam: { id: 65, name: 'Manchester City', crest: 'https://crests.football-data.org/65.png' },
  awayTeam: { id: 57, name: 'Arsenal', crest: 'https://crests.football-data.org/57.png' },
  score: { fullTime: { home: null, away: null } },
};
const row = {
  position: 1,
  team: { id: 65, name: 'Manchester City' },
  playedGames: 10,
  won: 8,
  draw: 1,
  lost: 1,
  points: 25,
  goalDifference: 15,
};
const table = {
  competition: { name: 'Premier League' },
  season: { startDate: '2026-08-01', endDate: '2027-05-30' },
  standings: [
    { type: 'TOTAL', group: null, stage: 'REGULAR_SEASON', table: [row] },
    { type: 'HOME', table: [row] },
  ],
};

test('requires a free token and rejects unsupported coverage without contacting provider', async () => {
  const service = createFootballService({
    apiKey: '',
    fetchImpl: () => assert.fail('Unexpected provider call'),
  });
  assert.equal(service.configured, false);
  await assert.rejects(service.clubData(1), { code: 'SETUP_REQUIRED' });
  await assert.rejects(service.clubData(6), { code: 'NOT_COVERED' });
  await assert.rejects(service.standings('MLS'), { code: 'NOT_COVERED' });
});

test('keeps club favourites IDs, filters paid fixtures, and reports uncovered competitions', async () => {
  const paths = [];
  const service = createFootballService({
    apiKey: 'private-token',
    clock: () => instant,
    fetchImpl: async (url, options) => {
      paths.push(url);
      assert.equal(options.headers['X-Auth-Token'], 'private-token');
      assert.ok(!url.includes('private-token'));
      return Response.json(
        url.includes('/matches?')
          ? { matches: [game, { ...game, id: 101, competition: { code: 'FAC', name: 'FA Cup' } }] }
          : metadata,
      );
    },
  });
  const result = await service.clubData(1);
  assert.equal(result.clubId, 1);
  assert.equal(result.fixtures.length, 1);
  assert.equal(result.fixtures[0].homeCrest, game.homeTeam.crest);
  assert.equal(result.fixtures[0].awayCrest, game.awayTeam.crest);
  assert.equal(result.fixtures[0].watchInIndia.platform.name, 'JioHotstar');
  assert.equal(result.fixtures[0].watchInIndia.matchListingVerified, false);
  assert.equal(result.competitions[1].covered, false);
  assert.equal(result.dateFrom, '2026-10-28');
  assert.equal(result.dateTo, '2026-11-27');
  assert.ok(paths.some((url) => url.includes('/teams/65/matches?')));
  assert.ok(!JSON.stringify(result).includes('private-token'));
});

test('shares simultaneous requests and caches fixtures separately from metadata', async () => {
  let time = instant;
  let calls = 0;
  const service = createFootballService({
    apiKey: 'token',
    clock: () => time,
    fetchImpl: async (url) => {
      calls++;
      return Response.json(url.includes('/matches?') ? { matches: [game] } : metadata);
    },
  });
  await Promise.all([service.clubData(1), service.clubData(1)]);
  assert.equal(calls, 2);
  await service.clubData(1);
  assert.equal(calls, 2);
  time += 11 * 60 * 1000;
  await service.clubData(1);
  assert.equal(calls, 3);
});

test('normalizes overall standings and ignores home-only tables', async () => {
  const service = createFootballService({
    apiKey: 'token',
    fetchImpl: async () => Response.json(table),
  });
  const result = await service.standings('PL');
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].table[0].points, 25);
  assert.equal(result.groups[0].table[0].drawn, 1);
  assert.equal(result.season.start, '2026-08-01');
});

test('handles empty fixtures and knockout competitions without fabricating data', async () => {
  const service = createFootballService({
    apiKey: 'token',
    clock: () => instant,
    fetchImpl: async (url) => {
      if (url.endsWith('/standings')) return Response.json({ ...table, standings: [] });
      return Response.json(url.includes('/matches?') ? { matches: [] } : metadata);
    },
  });
  assert.deepEqual((await service.clubData(1)).fixtures, []);
  assert.deepEqual((await service.standings('CL')).groups, []);
});

test('enforces the local free request budget and recovers after a minute', async () => {
  let time = instant;
  let calls = 0;
  const service = createFootballService({
    apiKey: 'token',
    clock: () => time,
    fetchImpl: async () => {
      calls++;
      return new Response('', { status: 503 });
    },
  });
  for (let i = 0; i < 10; i++)
    await assert.rejects(service.standings('PL'), { code: 'PROVIDER_ERROR' });
  await assert.rejects(service.standings('PL'), { code: 'RATE_LIMITED', retryAfter: 60 });
  assert.equal(calls, 10);
  time += 61000;
  await assert.rejects(service.standings('PL'), { code: 'PROVIDER_ERROR' });
  assert.equal(calls, 11);
});

test('honours provider cooldown and never exposes provider error bodies', async () => {
  let calls = 0;
  const service = createFootballService({
    apiKey: 'token',
    clock: () => instant,
    fetchImpl: async () => {
      calls++;
      return new Response('secret provider diagnostics', {
        status: 429,
        headers: { 'Retry-After': '120' },
      });
    },
  });
  await assert.rejects(service.standings('PL'), { code: 'RATE_LIMITED', retryAfter: 120 });
  await assert.rejects(service.standings('PD'), { code: 'RATE_LIMITED' });
  assert.equal(calls, 1);
});

test('rejects malformed provider records before they reach rendering', async () => {
  const service = createFootballService({
    apiKey: 'token',
    fetchImpl: async () =>
      Response.json({
        ...table,
        standings: [{ type: 'TOTAL', table: [{ ...row, points: 'unknown' }] }],
      }),
  });
  await assert.rejects(service.standings('PL'), { code: 'PROVIDER_ERROR' });
});

test('does not cache malformed responses and recovers on the next request', async () => {
  let calls = 0;
  const service = createFootballService({
    apiKey: 'token',
    fetchImpl: async () => {
      calls++;
      return Response.json(
        calls === 1 ? { competition: { name: 'Premier League' }, standings: [null] } : table,
      );
    },
  });
  await assert.rejects(service.standings('PL'), { code: 'PROVIDER_ERROR' });
  assert.equal((await service.standings('PL')).groups[0].table[0].points, 25);
  assert.equal(calls, 2);
});

test('uses labelled stale data during a temporary outage, then recovers', async () => {
  let time = instant;
  let available = true;
  const service = createFootballService({
    apiKey: 'token',
    clock: () => time,
    fetchImpl: async () => (available ? Response.json(table) : new Response('', { status: 503 })),
  });
  const first = await service.standings('PL');
  time += 16 * 60 * 1000;
  available = false;
  const stale = await service.standings('PL');
  assert.equal(stale.stale, true);
  assert.equal(stale.fetchedAt, first.fetchedAt);
  assert.equal(stale.groups[0].table[0].points, 25);
  available = true;
  const recovered = await service.standings('PL');
  assert.equal(recovered.stale, false);
  assert.notEqual(recovered.fetchedAt, first.fetchedAt);
});

test('never serves an indefinitely old saved copy or hides authentication failures', async () => {
  let time = instant;
  let status = 200;
  const service = createFootballService({
    apiKey: 'token',
    clock: () => time,
    fetchImpl: async () => (status === 200 ? Response.json(table) : new Response('', { status })),
  });
  await service.standings('PL');
  time += 16 * 60 * 1000;
  status = 401;
  await assert.rejects(service.standings('PL'), { code: 'INVALID_TOKEN' });
  time += 25 * 60 * 60 * 1000;
  status = 503;
  await assert.rejects(service.standings('PL'), { code: 'PROVIDER_ERROR' });
});

test('preserves a short provider cooldown instead of extending it to a minute', async () => {
  const service = createFootballService({
    apiKey: 'token',
    clock: () => instant,
    fetchImpl: async () => new Response('', { status: 429, headers: { 'Retry-After': '10' } }),
  });
  await assert.rejects(service.standings('PL'), { retryAfter: 10 });
  await assert.rejects(service.standings('PD'), { retryAfter: 10 });
});
