import serverless from 'serverless-http';
import { createApp } from './app.js';

function cacheSeconds(path, body, now) {
  if (body.stale) return 0;
  if (path === '/api/clubs') return 3600;
  let limit;
  let dates;
  if (/^\/api\/clubs\/\d+\/football$/.test(path)) {
    if (!body.cupCoverage?.length || body.cupCoverage.some((cup) => !cup.complete)) return 0;
    limit = 600;
    dates = [body.fetchedAt, ...(body.sources || []).map((source) => source.fetchedAt)];
  } else if (/^\/api\/standings\/[a-z0-9]+$/i.test(path)) {
    limit = 900;
    dates = [body.fetchedAt];
  } else if (path === '/api/international/nations-league') {
    if (!body.competitions?.length || body.competitions.some((cup) => !cup.covered)) return 0;
    limit = 1800;
    dates = (body.sources || []).map((source) => source.fetchedAt);
  } else return 0;
  if (!dates.length || dates.some((date) => !date || !Number.isFinite(Date.parse(date)))) return 0;
  const age = Math.max(0, (now - Math.min(...dates.map(Date.parse))) / 1000);
  return Math.max(0, Math.floor(limit - age));
}

export function createNetlifyHandler({ app, clock = Date.now } = {}) {
  const origins = process.env.CLIENT_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const handle = serverless(app || createApp(origins?.length ? { origins } : {}));
  return async (event, context) => {
    const path = (event.path || '/').replace(/^\/\.netlify\/functions\/api(?=\/|$)/, '/api');
    const response = await handle({ ...event, path }, context);
    let seconds = 0;
    if (event.httpMethod === 'GET' && response.statusCode === 200) {
      try {
        seconds = cacheSeconds(path, JSON.parse(response.body), clock());
      } catch {
        /* Non-JSON responses stay uncached. */
      }
    }
    response.headers = {
      ...response.headers,
      'x-football-runtime': 'netlify-functions',
      'netlify-vary': 'query, header=Origin',
      'netlify-cdn-cache-control':
        seconds > 0 ? 'public, durable, s-maxage=' + seconds : 'no-store',
    };
    return response;
  };
}
