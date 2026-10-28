# Netlify API deployment

Live API: https://football-center-api-tabreez.netlify.app/api

Project: https://app.netlify.com/projects/football-center-api-tabreez

Verified: health/configuration, 11 clubs, club fixtures, Premier League standings, 52 Nations League fixtures, allowed-origin CORS, blocked unrelated-origin CORS, and Netlify Edge cache hits. The existing frontend now uses this API. Timings vary with connection, cold starts and provider response times.

Import tabreezsajjad/football-center into a separate Netlify project using branch main. Leave the base directory empty. netlify.toml supplies the build command, public placeholder directory and Express function routing. The existing frontend is a different Netlify project and must not be replaced by this repository.

Set these environment variables privately in the API project before deploying:

- FOOTBALL_DATA_API_KEY: the existing football-data.org key, scoped to Functions/runtime. Never use a VITE_ prefix.
- CLIENT_ORIGIN: http://localhost:5173,http://127.0.0.1:5173,https://endearing-kleicha-cd0f9c.netlify.app
- NODE_ENV: production

Node 24 is selected for builds and the function runtime. /api/* routes to the api function without starting an Express listener. Local development still uses nodemon via npm run dev.

Successful directory, fixtures and standings responses use Netlify durable CDN caching. Query strings and Origin vary the cache. Fixture and standings TTLs subtract the existing source age; errors, health checks, stale and incomplete results are not cached. Provider caches and request budgets inside Express are per warm function instance, not a global distributed quota limiter. Upstream limits still apply when concurrent instances fetch uncached data.

After deployment verify /api/health (configured true), /api/clubs, club fixtures, Nations League, standings and frontend CORS. Check repeated requests and Cache-Status to confirm CDN behavior. Only then change the frontend VITE_API_BASE_URL and its default URL, build and upload the new dist ZIP to the existing frontend project.

Git pushes to main deploy the API automatically once connected to Netlify. The frontend currently uses manual uploads and needs rebuilding after frontend changes. Keep keys out of source, build archives and logs.

Official references: [Express on Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/express/), [function configuration](https://docs.netlify.com/build/functions/configuration/), [CDN caching](https://docs.netlify.com/build/caching/caching-overview/).
