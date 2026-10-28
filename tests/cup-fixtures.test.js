import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCupService, mergeCupFixtures } from '../server/cup-fixtures.js';
import { buildMatchCalendar } from '../src/api/calendar.js';

const now = Date.parse('2026-10-28T10:00:00Z');
const event = {
  id: '12345',
  date: '2026-10-28T19:30:00Z',
  season: { slug: 'fourth-round' },
  competitions: [
    {
      timeValid: true,
      status: { type: { state: 'pre', name: 'STATUS_SCHEDULED' } },
      venue: { fullName: 'Etihad Stadium' },
      competitors: [
        {
          homeAway: 'home',
          team: {
            displayName: 'Manchester City',
            logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/382.png',
          },
        },
        { homeAway: 'away', team: { displayName: 'Brighton & Hove Albion' } },
      ],
      broadcasts: [{ names: ['An overseas service'] }],
    },
  ],
};

test('adds real cup fixtures with venue, round, home/away and distinct IDs', async () => {
  let calls = 0;
  const service = createCupService({
    clock: () => now,
    fetchImpl: async (url) => {
      calls++;
      return Response.json({
        events: url.includes('eng.league_cup') && url.includes('202610') ? [event] : [],
      });
    },
  });
  const result = await service.clubFixtures(1);
  assert.equal(result.fixtures.length, 1);
  const fixture = result.fixtures[0];
  assert.equal(fixture.competition, 'Carabao Cup');
  assert.equal(fixture.id, -12345);
  assert.equal(fixture.homeAway, 'home');
  assert.equal(fixture.homeCrest, event.competitions[0].competitors[0].team.logo);
  assert.equal(fixture.venue, 'Etihad Stadium');
  assert.equal(fixture.round, 'fourth round');
  assert.equal(fixture.watchInIndia.platform.name, 'FanCode');
  assert.equal(fixture.watchInIndia.matchListingVerified, false);
  assert.ok(!JSON.stringify(result).includes('An overseas service'));
  assert.equal(result.complete, true);
  await service.clubFixtures(7);
  assert.equal(calls, 4, 'monthly feeds are shared across clubs');
});

test('cup failures preserve existing league games and show incomplete coverage', async () => {
  const service = createCupService({
    clock: () => now,
    fetchImpl: async () => new Response('', { status: 503 }),
  });
  const cup = await service.clubFixtures(1);
  const merged = mergeCupFixtures(
    { fixtures: [{ id: 1, utcDate: '2026-10-31T20:00Z' }], competitions: [] },
    cup,
  );
  assert.equal(merged.fixtures.length, 1);
  assert.ok(merged.cupCoverage.some((item) => !item.complete));
  assert.match(merged.coverageNote, /incomplete/);
});

test('deduplicates events and ignores dates outside the requested window', async () => {
  const service = createCupService({
    clock: () => now,
    fetchImpl: async (url) =>
      Response.json({
        events: url.includes('eng.league_cup')
          ? [event, { ...event, id: '23456', date: '2026-12-28T20:00Z' }]
          : [],
      }),
  });
  const result = await service.clubFixtures(1);
  assert.equal(result.fixtures.length, 1);
});

test('calendar export uses UTC, escapes text, and refuses unconfirmed kickoffs', () => {
  const match = {
    id: 1,
    home: 'City, FC',
    away: 'United',
    utcDate: '2026-10-28T19:30Z',
    status: 'TIMED',
    competition: 'Carabao Cup',
    venue: 'Etihad Stadium',
  };
  const calendar = buildMatchCalendar(match);
  assert.match(calendar, /DTSTART:20261028T193000Z/);
  assert.match(calendar, /SUMMARY:City\\, FC vs United/);
  assert.match(calendar, /LOCATION:Etihad Stadium/);
  assert.throws(() => buildMatchCalendar({ ...match, status: 'POSTPONED' }), /confirmed kickoff/);
});

test('Nations League lists national teams without a club filter and shares cached feeds', async () => {
  let calls = 0;
  const international = structuredClone(event);
  international.date = '2026-11-12T17:00:00Z';
  international.season.slug = 'league-phase';
  international.competitions[0].competitors[0].team.displayName = 'Armenia';
  international.competitions[0].competitors[1].team.displayName = 'Cyprus';
  const service = createCupService({
    clock: () => now,
    fetchImpl: async (url) => {
      calls++;
      assert.ok(url.includes('/uefa.nations/'));
      return Response.json({ events: url.includes('202611') ? [international] : [] });
    },
  });
  const result = await service.nationsLeague();
  assert.equal(result.fixtures.length, 1);
  assert.equal(result.fixtures[0].competitionCode, 'UNL');
  assert.equal(result.fixtures[0].home, 'Armenia');
  assert.equal(result.fixtures[0].homeAway, null);
  assert.equal(result.competitions[0].covered, true);
  assert.match(result.sources[0].url, /uefa.nations/);
  await service.nationsLeague();
  assert.equal(calls, 2);
});

test('Nations League flags an outage rather than claiming no matches exist', async () => {
  const service = createCupService({
    clock: () => now,
    fetchImpl: async () => {
      throw new Error('offline');
    },
  });
  const result = await service.nationsLeague();
  assert.deepEqual(result.fixtures, []);
  assert.equal(result.competitions[0].covered, false);
  assert.match(result.coverageNote, /unavailable/);
});
