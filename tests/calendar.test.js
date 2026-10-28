import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildMatchCalendar } from '../src/api/calendar.js';

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
