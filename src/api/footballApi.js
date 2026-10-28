const API_BASE_URL = (
  import.meta.env?.VITE_API_BASE_URL || 'https://football-center-api.onrender.com/api'
).replace(/\/$/, '');
// Free hosts can take over a minute to wake after inactivity.
const REQUEST_TIMEOUT_MS = API_BASE_URL.startsWith('https://') ? 90000 : 20000;

function isSecureLink(value) {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isWatchInfo(value) {
  if (value == null) return true;
  return (
    typeof value === 'object' &&
    typeof value.note === 'string' &&
    typeof value.selectedMatches === 'boolean' &&
    (value.platform === null ||
      (typeof value.platform?.name === 'string' && isSecureLink(value.platform.url))) &&
    Array.isArray(value.sources) &&
    value.sources.every(
      (source) => source && typeof source.title === 'string' && isSecureLink(source.url),
    )
  );
}

async function getResource(path, { signal } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
        : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error(
      error.name === 'TimeoutError'
        ? 'The football request timed out. Please try again.'
        : 'Cannot reach the football server. Check your connection and try again.',
      { cause: error },
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(
      typeof data?.message === 'string'
        ? data.message
        : 'Football data is unavailable. Please try again.',
    );
    error.code = typeof data?.code === 'string' ? data.code : 'NETWORK_ERROR';
    const retryAfter = Number(data?.retryAfter || response.headers.get('retry-after'));
    if (Number.isFinite(retryAfter) && retryAfter > 0)
      error.retryAt = Date.now() + Math.min(retryAfter, 3600) * 1000;
    throw error;
  }
  return data;
}

export async function getFootballConfig(_key, options) {
  const data = await getResource('/config', options);
  if (
    typeof data?.configured !== 'boolean' ||
    !Array.isArray(data.competitions) ||
    data.competitions.some(
      (item) => !item || typeof item.code !== 'string' || typeof item.name !== 'string',
    )
  ) {
    throw new Error('The football server needs updating. Restart it and try again.');
  }
  return data;
}

export async function getNationsLeague(_key, options) {
  return validateFixtures(await getResource('/international/nations-league', options));
}

export async function getClubFootball(id, options) {
  return validateFixtures(await getResource(`/clubs/${encodeURIComponent(id)}/football`, options));
}

function validateFixtures(data) {
  if (
    !Array.isArray(data?.fixtures) ||
    !Array.isArray(data.competitions) ||
    data.fixtures.some(
      (item) =>
        !item ||
        !Number.isInteger(item.id) ||
        !Number.isFinite(Date.parse(item.utcDate)) ||
        !['home', 'away', 'competition', 'competitionCode', 'status'].every(
          (key) => typeof item[key] === 'string',
        ) ||
        !isWatchInfo(item.watchInIndia) ||
        ['venue', 'round'].some((key) => item[key] != null && typeof item[key] !== 'string') ||
        (item.homeAway != null && !['home', 'away'].includes(item.homeAway)) ||
        [item.score?.home, item.score?.away].some(
          (score) => score != null && !Number.isInteger(score),
        ),
    ) ||
    data.competitions.some(
      (item) =>
        !item ||
        !Number.isInteger(item.id) ||
        typeof item.name !== 'string' ||
        typeof item.covered !== 'boolean',
    )
  ) {
    throw new Error('The fixture response was incomplete. Please try again later.');
  }
  return data;
}

export async function getStandings(code, options) {
  const data = await getResource(`/standings/${encodeURIComponent(code)}`, options);
  if (
    typeof data?.competition !== 'string' ||
    !Array.isArray(data.groups) ||
    data.groups.some(
      (group) =>
        !group ||
        typeof group.name !== 'string' ||
        !Array.isArray(group.table) ||
        group.table.some(
          (row) =>
            !row ||
            typeof row.team !== 'string' ||
            ![
              'position',
              'teamId',
              'played',
              'won',
              'drawn',
              'lost',
              'goalDifference',
              'points',
            ].every((key) => Number.isInteger(row[key])),
        ),
    )
  ) {
    throw new Error('The standings response was incomplete. Please try again later.');
  }
  return data;
}

export async function getClubs({ signal } = {}) {
  const response = await fetch(`${API_BASE_URL}/clubs`, {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
      : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch clubs');
  }

  const data = await response.json();

  if (
    !data ||
    !Array.isArray(data.clubs) ||
    data.clubs.some(
      (club) =>
        !club ||
        !Number.isInteger(club.id) ||
        club.id <= 0 ||
        typeof club.name !== 'string' ||
        !club.name.trim() ||
        typeof club.league !== 'string' ||
        (club.short != null && typeof club.short !== 'string') ||
        (club.color != null && typeof club.color !== 'string'),
    ) ||
    new Set(data.clubs.map((club) => club.id)).size !== data.clubs.length
  ) {
    throw new Error('The club directory returned invalid data. Please try again.');
  }

  return data.clubs;
}
