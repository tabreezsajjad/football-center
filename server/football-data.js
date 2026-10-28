import process from 'node:process';
import { getIndiaBroadcast } from './india-broadcasts.js';
import { crestUrl } from '../shared/crests.js';

// Restrict requests to the free plan even if a paid token is supplied.
export const FREE_COMPETITIONS = [
  { code: 'PL', name: 'Premier League' },
  { code: 'PD', name: 'La Liga' },
  { code: 'BL1', name: 'Bundesliga' },
  { code: 'FL1', name: 'Ligue 1' },
  { code: 'SA', name: 'Serie A' },
  { code: 'CL', name: 'Champions League' },
  { code: 'PPL', name: 'Primeira Liga' },
  { code: 'DED', name: 'Eredivisie' },
  { code: 'ELC', name: 'Championship' },
  { code: 'BSA', name: 'Brazilian Série A' },
  { code: 'WC', name: 'World Cup' },
  { code: 'EC', name: 'European Championship' },
];
const freeCodes = new Set(FREE_COMPETITIONS.map(({ code }) => code));
const competitionNames = new Map(FREE_COMPETITIONS.map(({ code, name }) => [code, name]));
const TEAM_IDS = { 1: 65, 2: 81, 3: 86, 4: 5, 5: 524, 7: 57, 8: 64, 9: 61, 10: 109, 11: 4, 12: 98 };

export class FootballError extends Error {
  constructor(message, status = 502, code = 'PROVIDER_ERROR', retryAfter = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

function invalidData() {
  throw new FootballError(
    'The football provider returned incomplete data. Please try again later.',
  );
}
const integer = (value) => Number.isInteger(value);
const nameOf = (team) =>
  [team?.shortName, team?.name].find((name) => typeof name === 'string' && name.trim()) ||
  'To be confirmed';
const staleLimit = 24 * 60 * 60 * 1000;

function validateTeam(data, id) {
  if (
    data.id !== id ||
    !Array.isArray(data.runningCompetitions) ||
    data.runningCompetitions.some(
      (item) =>
        !item ||
        !integer(item.id) ||
        typeof item.name !== 'string' ||
        (item.code != null && typeof item.code !== 'string'),
    )
  )
    invalidData();
}
function validateMatches(data) {
  if (
    !Array.isArray(data.matches) ||
    data.matches.some(
      (match) =>
        !match ||
        !integer(match.id) ||
        !Number.isFinite(Date.parse(match.utcDate)) ||
        typeof match.status !== 'string' ||
        typeof match.competition?.name !== 'string' ||
        typeof match.competition?.code !== 'string' ||
        [match.score?.fullTime?.home, match.score?.fullTime?.away].some(
          (score) => score != null && !integer(score),
        ),
    )
  )
    invalidData();
}
function validateStandings(data) {
  if (
    !Array.isArray(data.standings) ||
    typeof data.competition?.name !== 'string' ||
    data.standings.some(
      (group) =>
        !group ||
        typeof group.type !== 'string' ||
        !Array.isArray(group.table) ||
        (group.group != null && typeof group.group !== 'string') ||
        (group.stage != null && typeof group.stage !== 'string') ||
        group.table.some(
          (row) =>
            !row ||
            !integer(row.position) ||
            !integer(row.team?.id) ||
            typeof row.team?.name !== 'string' ||
            !['playedGames', 'won', 'draw', 'lost', 'points', 'goalDifference'].every((key) =>
              integer(row[key]),
            ),
        ),
    )
  )
    invalidData();
}

export function createFootballService({
  apiKey = process.env.FOOTBALL_DATA_API_KEY,
  fetchImpl = fetch,
  clock = Date.now,
} = {}) {
  const cache = new Map();
  const pending = new Map();
  let requestTimes = [];
  let blockedUntil = 0;

  async function request(path, ttl, validate) {
    if (!apiKey?.trim())
      throw new FootballError(
        'Connect a free football-data.org account to load fixtures and standings.',
        503,
        'SETUP_REQUIRED',
      );
    const time = clock();
    const saved = cache.get(path);
    if (saved && saved.expiresAt > time) return saved;
    const fallback = (error) => {
      if (
        saved &&
        time - saved.expiresAt < staleLimit &&
        (error.code === 'RATE_LIMITED' ||
          error.code === 'NETWORK_ERROR' ||
          error.code === 'PROVIDER_ERROR')
      ) {
        return { ...saved, stale: true, staleReason: error.message };
      }
      throw error;
    };
    if (pending.has(path)) return pending.get(path);
    requestTimes = requestTimes.filter((sent) => sent > time - 60000);
    if (blockedUntil > time || requestTimes.length >= 10) {
      const readyAt = Math.max(
        blockedUntil,
        requestTimes.length >= 10 ? requestTimes[0] + 60000 : time,
      );
      const wait = Math.max(1, Math.ceil((readyAt - time) / 1000));
      return fallback(
        new FootballError(
          `Free API request limit reached. Try again in ${wait} seconds.`,
          429,
          'RATE_LIMITED',
          wait,
        ),
      );
    }
    requestTimes.push(time);
    const task = (async () => {
      let response;
      try {
        response = await fetchImpl(`https://api.football-data.org/v4${path}`, {
          headers: { 'X-Auth-Token': apiKey.trim() },
          signal: AbortSignal.timeout(15000),
        });
      } catch {
        throw new FootballError(
          'Cannot reach the football provider. Please try again later.',
          502,
          'NETWORK_ERROR',
        );
      }
      if (!response.ok) {
        if (response.status === 429) {
          const raw = response.headers.get('retry-after');
          const seconds =
            raw && /^\d+$/.test(raw) ? Number(raw) : Math.ceil((Date.parse(raw) - clock()) / 1000);
          const wait = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 3600) : 60;
          blockedUntil = clock() + wait * 1000;
          throw new FootballError(
            `Free API request limit reached. Try again in ${wait} seconds.`,
            429,
            'RATE_LIMITED',
            wait,
          );
        }
        if (response.status === 401)
          throw new FootballError(
            'The football API token was rejected. Check the token in your server settings.',
            502,
            'INVALID_TOKEN',
          );
        if (response.status === 400)
          throw new FootballError(
            'The provider rejected this football data request. Please try again later.',
            502,
            'INVALID_REQUEST',
          );
        if (response.status === 403)
          throw new FootballError(
            'This data is not available with your football API account. Only free coverage is enabled.',
            403,
            'NOT_COVERED',
          );
        if (response.status === 404)
          throw new FootballError(
            'The provider has no data for this club or competition right now.',
            404,
            'NO_DATA',
          );
        throw new FootballError(
          'The football provider is temporarily unavailable. Try again later.',
        );
      }
      let data;
      try {
        data = await response.json();
      } catch {
        invalidData();
      }
      if (!data || typeof data !== 'object' || data.errorCode) invalidData();
      validate(data);
      for (const [key, entry] of cache)
        if (clock() - entry.expiresAt >= staleLimit) cache.delete(key);
      if (cache.size >= 128 && !cache.has(path)) cache.delete(cache.keys().next().value);
      const result = {
        data,
        fetchedAt: new Date(clock()).toISOString(),
        expiresAt: clock() + ttl,
        stale: false,
      };
      cache.set(path, result);
      return result;
    })().catch(fallback);
    pending.set(path, task);
    try {
      return await task;
    } finally {
      pending.delete(path);
    }
  }

  return {
    configured: Boolean(apiKey?.trim()),
    async clubData(id) {
      const teamId = TEAM_IDS[id];
      if (!teamId)
        throw new FootballError(
          'This club is not available in the club directory.',
          403,
          'NOT_COVERED',
        );
      const date = new Date(clock());
      // Include all of today's matches; the browser displays local kickoff times.
      const from = date.toISOString().slice(0, 10);
      date.setUTCDate(date.getUTCDate() + 30);
      const to = date.toISOString().slice(0, 10);
      const [team, games] = await Promise.all([
        request(`/teams/${teamId}`, 6 * 60 * 60 * 1000, (data) => validateTeam(data, teamId)),
        request(
          `/teams/${teamId}/matches?dateFrom=${from}&dateTo=${to}&limit=100`,
          10 * 60 * 1000,
          validateMatches,
        ),
      ]);
      if (
        team.data.id !== teamId ||
        !Array.isArray(team.data.runningCompetitions) ||
        !Array.isArray(games.data.matches)
      )
        invalidData();
      const competitions = team.data.runningCompetitions.map((item) => {
        if (!integer(item.id) || typeof item.name !== 'string') invalidData();
        return {
          id: item.id,
          code: item.code || null,
          name: competitionNames.get(item.code) || item.name,
          type: item.type || 'UNKNOWN',
          covered: freeCodes.has(item.code),
        };
      });
      const fixtures = games.data.matches
        .filter((match) => freeCodes.has(match?.competition?.code))
        .map((match) => {
          if (
            !integer(match.id) ||
            !Number.isFinite(Date.parse(match.utcDate)) ||
            typeof match.status !== 'string'
          )
            invalidData();
          return {
            id: match.id,
            utcDate: match.utcDate,
            status: match.status,
            competition: competitionNames.get(match.competition.code) || match.competition.name,
            competitionCode: match.competition.code,
            watchInIndia: getIndiaBroadcast(match.competition.code, match.utcDate, clock()),
            home: nameOf(match.homeTeam),
            away: nameOf(match.awayTeam),
            homeCrest: crestUrl(match.homeTeam?.crest),
            awayCrest: crestUrl(match.awayTeam?.crest),
            homeId: match.homeTeam?.id,
            awayId: match.awayTeam?.id,
            source: 'football-data.org',
            homeAway:
              match.homeTeam?.id === teamId
                ? 'home'
                : match.awayTeam?.id === teamId
                  ? 'away'
                  : null,
            venue:
              typeof match.venue === 'string'
                ? match.venue
                : match.homeTeam?.id === teamId && typeof team.data.venue === 'string'
                  ? team.data.venue
                  : null,
            round:
              match.stage &&
              !['REGULAR_SEASON', 'LEAGUE_STAGE', 'GROUP_STAGE'].includes(match.stage)
                ? match.stage.replaceAll('_', ' ').toLowerCase()
                : Number.isInteger(match.matchday)
                  ? `Matchday ${match.matchday}`
                  : null,
            score: {
              home: match.score?.fullTime?.home ?? null,
              away: match.score?.fullTime?.away ?? null,
            },
          };
        })
        .sort((a, b) => Date.parse(a.utcDate) - Date.parse(b.utcDate));
      return {
        source: 'football-data.org',
        clubId: id,
        competitions,
        fixtures,
        dateFrom: from,
        dateTo: to,
        stale: team.stale || games.stale,
        staleReason: team.staleReason || games.staleReason || null,
        fetchedAt: games.fetchedAt,
        competitionsFetchedAt: team.fetchedAt,
        coverageNote:
          'Some domestic cup matches are not available. Scores and schedules may be delayed.',
      };
    },
    async standings(code) {
      if (!freeCodes.has(code))
        throw new FootballError('This competition is outside the free plan.', 403, 'NOT_COVERED');
      const result = await request(
        `/competitions/${code}/standings`,
        15 * 60 * 1000,
        validateStandings,
      );
      const data = result.data;
      if (!Array.isArray(data.standings) || typeof data.competition?.name !== 'string')
        invalidData();
      const groups = data.standings
        .filter((group) => group.type === 'TOTAL')
        .map((group) => {
          if (!Array.isArray(group.table)) invalidData();
          return {
            name: group.group || group.stage || 'League table',
            table: group.table.map((row) => {
              if (
                !integer(row.position) ||
                !integer(row.team?.id) ||
                typeof row.team?.name !== 'string' ||
                !['playedGames', 'won', 'draw', 'lost', 'points', 'goalDifference'].every((key) =>
                  integer(row[key]),
                )
              )
                invalidData();
              return {
                position: row.position,
                teamId: row.team.id,
                team: nameOf(row.team),
                crest: crestUrl(row.team?.crest),
                played: row.playedGames,
                won: row.won,
                drawn: row.draw,
                lost: row.lost,
                points: row.points,
                goalDifference: row.goalDifference,
              };
            }),
          };
        });
      return {
        source: 'football-data.org',
        code,
        competition: competitionNames.get(code) || data.competition.name,
        season: { start: data.season?.startDate || null, end: data.season?.endDate || null },
        fetchedAt: result.fetchedAt,
        stale: result.stale,
        staleReason: result.staleReason || null,
        groups,
      };
    },
  };
}
