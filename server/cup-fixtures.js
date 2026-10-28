import { getIndiaBroadcast } from './india-broadcasts.js';
import { crestUrl } from '../shared/crests.js';

// Public ESPN scoreboards are a best-effort supplement, not a contracted API.
// Only fixture fields are used; advertising, odds and foreign broadcasts are discarded.
const CUPS = {
  EFL_CUP: { slug: 'eng.league_cup', name: 'Carabao Cup' },
  FA_CUP: { slug: 'eng.fa', name: 'FA Cup' },
  COPA_DEL_REY: { slug: 'esp.copa_del_rey', name: 'Copa del Rey' },
  DFB_POKAL: { slug: 'ger.dfb_pokal', name: 'DFB-Pokal' },
  COPPA_ITALIA: { slug: 'ita.coppa_italia', name: 'Coppa Italia' },
  COUPE_DE_FRANCE: { slug: 'fra.coupe_de_france', name: 'Coupe de France' },
  UNL: { slug: 'uefa.nations', name: 'UEFA Nations League' },
};
const CLUBS = {
  1: { names: ['Manchester City'], cups: ['EFL_CUP', 'FA_CUP'] },
  2: { names: ['Barcelona', 'FC Barcelona'], cups: ['COPA_DEL_REY'] },
  3: { names: ['Real Madrid'], cups: ['COPA_DEL_REY'] },
  4: { names: ['Bayern Munich', 'Bayern München'], cups: ['DFB_POKAL'] },
  5: { names: ['Paris Saint-Germain', 'Paris Saint Germain'], cups: ['COUPE_DE_FRANCE'] },
  7: { names: ['Arsenal'], cups: ['EFL_CUP', 'FA_CUP'] },
  8: { names: ['Liverpool'], cups: ['EFL_CUP', 'FA_CUP'] },
  9: { names: ['Chelsea'], cups: ['EFL_CUP', 'FA_CUP'] },
  10: { names: ['Juventus'], cups: ['COPPA_ITALIA'] },
  11: { names: ['Borussia Dortmund', 'Dortmund'], cups: ['DFB_POKAL'] },
  12: { names: ['AC Milan', 'Milan'], cups: ['COPPA_ITALIA'] },
};
const normalize = (name) =>
  typeof name === 'string'
    ? name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
    : '';
const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

function fixtureFields(event) {
  const game = event.competitions[0];
  const status = game?.status?.type || event.status?.type || {};
  return {
    id: event.id,
    date: event.date,
    season: { slug: event.season?.slug },
    competitions: game
      ? [
          {
            timeValid: game.timeValid,
            status: {
              type: { name: status.name, state: status.state, completed: status.completed },
            },
            venue: { fullName: game.venue?.fullName },
            competitors: Array.isArray(game.competitors)
              ? game.competitors.map((item) => ({
                  homeAway: item?.homeAway,
                  score: item?.score,
                  team: { displayName: item?.team?.displayName, logo: crestUrl(item?.team?.logo) },
                }))
              : null,
          },
        ]
      : [],
  };
}

function monthKeys(from, to) {
  const month = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
  const keys = [];
  while (month.toISOString().slice(0, 10) <= to) {
    keys.push(month.toISOString().slice(0, 7).replace('-', ''));
    month.setUTCMonth(month.getUTCMonth() + 1);
  }
  return keys;
}

function eventStatus(event, competition) {
  const status = competition.status?.type || event.status?.type || {};
  if (status.completed || status.state === 'post') return 'FINISHED';
  const name = typeof status.name === 'string' ? status.name : '';
  if (name.includes('CANCELED') || name.includes('CANCELLED')) return 'CANCELLED';
  if (name.includes('POSTPONED')) return 'POSTPONED';
  if (name.includes('SUSPENDED')) return 'SUSPENDED';
  if (name.includes('HALFTIME')) return 'PAUSED';
  if (status.state === 'in') return 'IN_PLAY';
  return competition.timeValid === false ? 'SCHEDULED' : 'TIMED';
}

export function createCupService({ fetchImpl = fetch, clock = Date.now } = {}) {
  const cache = new Map();
  const pending = new Map();
  let sent = [];
  let blockedUntil = 0;

  async function load(cup, month) {
    const key = `${cup.slug}/${month}`;
    const now = clock();
    const saved = cache.get(key);
    if (saved && saved.expires > now) return saved;
    if (pending.has(key)) return pending.get(key);
    const task = (async () => {
      sent = sent.filter((time) => time > now - 60000);
      if (sent.length >= 30 || blockedUntil > now) throw new Error('Cup feed cooldown');
      sent.push(now);
      const response = await fetchImpl(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${cup.slug}/scoreboard?dates=${month}&limit=1000`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (response.status === 429) {
        blockedUntil = clock() + 60000;
        throw new Error('Cup feed cooldown');
      }
      if (!response.ok) throw new Error('Cup feed unavailable');
      const data = await response.json();
      if (
        !Array.isArray(data?.events) ||
        data.events.some((event) => !event || !Array.isArray(event.competitions))
      )
        throw new Error('Incomplete cup feed');
      const result = {
        events: data.events.map(fixtureFields),
        fetchedAt: new Date(clock()).toISOString(),
        expires: clock() + 30 * 60000,
        stale: false,
      };
      if (cache.size >= 96 && !cache.has(key)) cache.delete(cache.keys().next().value);
      cache.set(key, result);
      return result;
    })().catch(() => {
      const usable = saved && now - Date.parse(saved.fetchedAt) < 24 * 60 * 60000;
      const result = {
        events: usable ? saved.events : [],
        fetchedAt: usable ? saved.fetchedAt : null,
        expires: clock() + 60000,
        stale: true,
      };
      cache.set(key, result);
      return result;
    });
    pending.set(key, task);
    try {
      return await task;
    } finally {
      pending.delete(key);
    }
  }

  async function fixturesFor(club) {
    if (!club) return { fixtures: [], cups: [], complete: false };
    const from = new Date(clock()).toISOString().slice(0, 10);
    const end = new Date(clock());
    end.setUTCDate(end.getUTCDate() + 30);
    const to = end.toISOString().slice(0, 10);
    const aliases = new Set((club.names || []).map(normalize));
    const fixtures = new Map();
    const cups = await Promise.all(
      club.cups.map(async (code) => {
        const cup = CUPS[code];
        const results = await Promise.all(monthKeys(from, to).map((month) => load(cup, month)));
        let malformed = false;
        for (const result of results)
          for (const event of result.events) {
            const competition = event.competitions[0];
            const competitors = competition?.competitors;
            if (!Array.isArray(competitors)) {
              malformed = true;
              continue;
            }
            const selected = competitors.find((item) =>
              aliases.has(normalize(item?.team?.displayName)),
            );
            if (club.names && !selected) continue;
            const home = competitors.find((item) => item?.homeAway === 'home');
            const away = competitors.find((item) => item?.homeAway === 'away');
            const date = text(event.date);
            const eventId = Number(event.id);
            if (
              !date ||
              !Number.isFinite(Date.parse(date)) ||
              !Number.isSafeInteger(eventId) ||
              eventId <= 0 ||
              !text(home?.team?.displayName) ||
              !text(away?.team?.displayName)
            ) {
              malformed = true;
              continue;
            }
            const day = new Date(date).toISOString().slice(0, 10);
            if (day < from || day > to) continue;
            const status = eventStatus(event, competition);
            const score = (item) =>
              status === 'FINISHED' || status === 'IN_PLAY' || status === 'PAUSED'
                ? item.score != null && item.score !== '' && Number.isFinite(Number(item.score))
                  ? Number(item.score)
                  : null
                : null;
            const round = text(event.season?.slug)?.replaceAll('-', ' ');
            fixtures.set(eventId, {
              id: -eventId,
              source: 'ESPN',
              sourceUrl: `https://www.espn.com/soccer/match/_/gameId/${eventId}`,
              utcDate: date,
              status,
              competition: cup.name,
              competitionCode: code,
              home: home.team.displayName,
              away: away.team.displayName,
              homeCrest: home.team.logo,
              awayCrest: away.team.logo,
              homeAway: ['home', 'away'].includes(selected?.homeAway) ? selected.homeAway : null,
              venue: text(competition.venue?.fullName),
              round,
              score: { home: score(home), away: score(away) },
              watchInIndia: getIndiaBroadcast(code, date, clock()),
            });
          }
        return {
          code,
          name: cup.name,
          complete:
            !malformed && results.every((result) => !result.stale && result.events.length < 1000),
          fetchedAt:
            results
              .map((result) => result.fetchedAt)
              .filter(Boolean)
              .sort()[0] || null,
          sourceUrl: `https://www.espn.com/soccer/scoreboard/_/league/${cup.slug}`,
        };
      }),
    );
    return {
      fixtures: [...fixtures.values()],
      cups,
      complete: cups.every((cup) => cup.complete),
    };
  }
  return {
    clubFixtures(id) {
      return fixturesFor(CLUBS[id]);
    },
    async nationsLeague() {
      const result = await fixturesFor({ cups: ['UNL'] });
      const coverage = result.cups[0];
      return {
        fixtures: result.fixtures.sort((a, b) => Date.parse(a.utcDate) - Date.parse(b.utcDate)),
        competitions: [
          { id: -7, code: 'UNL', name: 'UEFA Nations League', covered: result.complete },
        ],
        coverageNote: result.complete
          ? 'Supplemental Nations League listings. Schedules may change.'
          : 'Nations League listings are unavailable or outdated. Matches may be missing.',
        sources: [
          { name: 'ESPN scoreboards', url: coverage.sourceUrl, fetchedAt: coverage.fetchedAt },
        ],
      };
    },
  };
}

export function mergeCupFixtures(base, supplement) {
  const cups = supplement.cups || [];
  const competitions = base.competitions.map((competition) => {
    const name = normalize(competition.name);
    const match = cups.find(
      (cup) =>
        normalize(cup.name) === name ||
        (cup.code === 'EFL_CUP' && /^(footballleaguecup|eflcup|englishleaguecup)$/.test(name)),
    );
    return match
      ? {
          ...competition,
          code: match.code,
          name: match.name,
          covered: match.complete,
          supplemental: true,
        }
      : competition;
  });
  for (const cup of cups)
    if (
      supplement.fixtures.some((fixture) => fixture.competitionCode === cup.code) &&
      !competitions.some(
        (competition) =>
          normalize(competition.name) === normalize(cup.name) ||
          (cup.code === 'EFL_CUP' && normalize(competition.name) === 'footballleaguecup'),
      )
    ) {
      competitions.push({
        id: -Object.keys(CUPS).indexOf(cup.code) - 1,
        code: cup.code,
        name: cup.name,
        type: 'CUP',
        covered: cup.complete,
        supplemental: true,
      });
    }
  return {
    ...base,
    competitions,
    fixtures: [...base.fixtures, ...supplement.fixtures].sort(
      (a, b) => Date.parse(a.utcDate) - Date.parse(b.utcDate),
    ),
    cupCoverage: cups,
    coverageNote: supplement.complete
      ? 'League fixtures plus supplemental domestic cup listings. Other competitions may still be missing.'
      : 'Some cup listings could not be refreshed. The match list may be incomplete.',
    sources: [
      {
        name: 'football-data.org',
        url: 'https://www.football-data.org/',
        fetchedAt: base.fetchedAt,
      },
      {
        name: 'ESPN cup scoreboards',
        url: 'https://www.espn.com/soccer/scoreboard',
        fetchedAt:
          cups
            .map((cup) => cup.fetchedAt)
            .filter(Boolean)
            .sort()[0] || null,
      },
    ],
  };
}
