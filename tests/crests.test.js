import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crestUrl } from '../shared/crests.js';

test('crest URLs accept provider assets and discard untrusted or malformed images', () => {
  assert.equal(
    crestUrl('https://crests.football-data.org/65.png'),
    'https://crests.football-data.org/65.png',
  );
  assert.equal(
    crestUrl('https://a.espncdn.com/i/teamlogos/countries/500/cyp.png'),
    'https://a.espncdn.com/i/teamlogos/countries/500/cyp.png',
  );
  for (const value of [
    null,
    {},
    'javascript:alert(1)',
    'http://crests.football-data.org/65.png',
    'https://crests.football-data.org.attacker.example/x.png',
    'https://user:password@a.espncdn.com/a.png',
  ]) {
    assert.equal(crestUrl(value), null);
  }
});
