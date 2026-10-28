# Football Center

Football fixtures, club competitions, and league tables using football-data.org's free plan.

The backend is hosted at [football-center-api.onrender.com](https://football-center-api.onrender.com/api/health) on Render's free plan. Backend hosting instructions and the Render configuration are in [DEPLOYMENT.md](DEPLOYMENT.md).

## Start the whole app

Requires Node.js 22.19+ and the free token already stored in `server/.env`.

```sh
npm install
npm install --prefix server
npm run dev
```

Open http://localhost:5173. This starts Vite and the API together. Stop older development sessions first; ports 5173 and 5000 are reserved for this project. Ctrl+C stops the combined session.

## Start only the API

Nodemon is installed directly in the server package:

```sh
cd server
npm install
npm run dev
```

The terminal should show `[nodemon] starting` and `Football Center API ready at http://127.0.0.1:5000`.

`server/nodemon.json` watches server JavaScript, `.env`, and `package.json`. Saving one restarts the API automatically. `npm start` runs the API without a watcher.

From the project root, `npm run dev:server` starts the same server command; `npm run dev:client` starts only Vite.

## Configuration

```dotenv
FOOTBALL_DATA_API_KEY=your_free_token
```

The API reads `server/.env` regardless of the terminal's working directory. Never put the token in frontend code. Environment files are excluded from Git and formatting.

Optional settings are documented in `server/.env.example`: `HOST`, `PORT`, and `CLIENT_ORIGIN`. Defaults keep the API on loopback port 5000. If changing that port, also change the Vite proxy target in `vite.config.js`.

## Project layout

- `src/App.jsx`: dashboard layout and navigation.
- `src/FootballPanel.jsx`: fixture and standings views.
- `src/hooks/`: favourites persistence and cancellable request state.
- `src/api/footballApi.js`: browser API requests and response validation.
- `server/index.js`: configuration, startup, and shutdown.
- `server/app.js`: Express routes and safe error responses.
- `server/football-data.js`: provider requests, validation, cache, and quota handling.
- `server/clubs.js`: stable club IDs that preserve favourites.
- `tests/`: mocked provider and local HTTP integration tests.

## Checks and formatting

```sh
npm run format
npm run check
```

`check` runs formatting verification, frontend/backend linting, tests, and a production build. Tests do not use the real provider or consume its quota. `npm run preview` previews the production build while the API is running.

## Reliability and coverage

Provider requests time out after 15 seconds. Identical requests share an in-flight response. Validated data is cached for 6 hours (club metadata), 10 minutes (fixtures), or 15 minutes (standings). A rolling budget of 10 provider calls per minute and Retry-After handling protect the free allowance.

On a temporary outage, cached data can be shown for up to 24 hours beyond expiry with a visible warning. Invalid responses are never cached. Authentication errors remain visible. Open match and table screens check every 5 minutes while visible and online. Returning to a tab after that interval also checks; hidden tabs and offline browsers do not poll. Requests never overlap and automatic retries respect provider cooldowns. Switching screens aborts the previous request. Refreshing retains the last successful list, including on network failure.

The footer distinguishes the last successful app check from each provider's data-fetch timestamp. “Check for updates” requests the current server copy; it does not bypass cache lifetimes or free-plan limits. India broadcast rights remain manually reviewed and expire at the stated review date; polling does not verify those rights. Logos follow provider images and browser HTTP caching. The UI explains these rules under “How updates work”.

Fixtures cover the next 30 days and show kickoff times in the browser's timezone. Scores and schedules can be delayed. Some domestic cups are excluded from the free plan; unavailable fixtures are labelled rather than replaced with invented matches. Competition lists describe participation during the season, including competitions a club may have exited.

Data and current coverage: https://www.football-data.org/coverage.

## Watching in India

Match cards include an expandable Watch in India guide with official platform links, source citations, and a last-checked date. This is manually reviewed competition-level information, not a live match-listing feed. Ligue 1 is explicitly marked as selected-match coverage. Unknown competitions, fixtures outside a rights window, and entries past their review date do not receive an asserted streaming platform.

Maintain the source-backed entries and review dates in server/india-broadcasts.js. The current review deadline is 27 November 2026. No paid broadcast-data API or automatic external searches are used. The guide does not include streaming subscriptions or guarantee that a fixture is in a viewer's plan.

## Domestic cup supplement

Carabao Cup, FA Cup, Copa del Rey, DFB-Pokal, Coppa Italia, and Coupe de France listings are supplemented from publicly accessible ESPN monthly scoreboards. This is a best-effort, undocumented public feed, not a contracted API or a promise of complete coverage. It requires no key or billing. The existing football-data.org league feed remains independent.

Cup requests are cached for 30 minutes and shared across clubs. Failures back off for a minute and may use a copy less than 24 hours old; the UI marks incomplete cup feeds. Only fixture fields are retained; odds, advertisements, ticket offers, and foreign broadcast listings are excluded. Fixtures are matched to the selected club, filtered to the 30-day window, and deduplicated using source-specific IDs.

Club and competition buttons replace dropdowns. Match cards include home/away, round, and venue where supplied. Add to calendar downloads a UTC .ics event with a planned 150-minute block; import it into your calendar and confirm schedule changes before matchday.

## Nations League

Matches → Nations League shows national-team fixtures for the next 30 days, separately from clubs. It uses the same cached ESPN scoreboard adapter with the `uefa.nations` competition slug and requires no API token. `/api/international/nations-league` exposes validated fixtures, source timestamps, and a coverage notice. Empty schedules and unavailable feeds are distinguished; India streaming platforms remain unconfirmed unless sourced separately. This adds fixtures, not Nations League standings.

Example public JSON source: https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.nations/scoreboard?dates=202611&limit=1000. The domestic cup adapter uses the same URL pattern with slugs such as `eng.league_cup` and `eng.fa`. These publicly accessible feeds are undocumented and may change or disappear.
