import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getIndiaBroadcast } from '../server/india-broadcasts.js';

const now = Date.parse('2026-10-28T10:00:00Z');
const kickoff = '2026-11-05T20:00:00Z';

test('returns source-backed current India platforms by competition', () => {
  for (const [code, platform] of Object.entries({
    PL: 'JioHotstar',
    PD: 'FanCode',
    CL: 'Sony LIV',
    BL1: 'ZEE5',
    SA: 'ZEE5',
    FL1: 'JioHotstar',
  })) {
    const result = getIndiaBroadcast(code, kickoff, now);
    assert.equal(result.platform.name, platform);
    assert.equal(result.status, 'listed');
    assert.equal(result.region, 'India');
    assert.equal(result.matchListingVerified, false);
    assert.ok(result.sources.length > 0);
    assert.ok(result.platform.url.startsWith('https://'));
    assert.ok(result.sources.every((source) => source.url.startsWith('https://')));
  }
});

test('labels selected-match coverage rather than promising every Ligue 1 game', () => {
  const result = getIndiaBroadcast('FL1', kickoff, now);
  assert.equal(result.selectedMatches, true);
  assert.match(result.note, /Only selected matches/);
});

test('does not guess unknown competitions or use information outside its dates', () => {
  assert.equal(getIndiaBroadcast('UNKNOWN', kickoff, now).platform, null);
  assert.equal(getIndiaBroadcast('UNKNOWN', kickoff, now).status, 'unverified');
  assert.equal(getIndiaBroadcast('CL', '2027-08-01T20:00:00Z', now).platform, null);
  assert.equal(getIndiaBroadcast('SA', '2026-08-01T20:00:00Z', now).platform, null);
  assert.equal(getIndiaBroadcast('PL', 'invalid', now).platform, null);
  const expired = getIndiaBroadcast('PL', kickoff, Date.parse('2026-11-28T10:00:00Z'));
  assert.equal(expired.platform, null);
  assert.equal(expired.status, 'needs-review');
  assert.ok(expired.sources.length > 0);
});
