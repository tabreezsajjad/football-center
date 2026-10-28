# Render fallback deployment

The active backend now runs on [Netlify Functions](https://football-center-api-tabreez.netlify.app/api/health). See [NETLIFY.md](NETLIFY.md). The Render service below remains available as a fallback; the frontend uses Netlify.

This deploys only the API. The Vite frontend can keep running on localhost until it is hosted separately.

## Current deployment

Frontend: https://endearing-kleicha-cd0f9c.netlify.app (manual Netlify upload).

- API base URL: `https://football-center-api.onrender.com/api`
- Health: [public health check](https://football-center-api.onrender.com/api/health)
- Render: [football-center-api](https://dashboard.render.com/web/srv-dbgondqfngtc73ck9e5g)
- Source: `main` in [tabreezsajjad/football-center](https://github.com/tabreezsajjad/football-center)
- Instance: Free, Singapore. Auto-deploy on commits is enabled.

The frontend remains untouched in the sibling football-center folder for later work. This backend checkout uses main. The API key stays in server/.env locally and in Render environment settings online.

## Source repository

Source repository: [tabreezsajjad/football-center, main branch](https://github.com/tabreezsajjad/football-center/tree/main). Keep `server/`, `shared/`, and `render.yaml` at the repository root. Never upload `server/.env`, `.env.local`, `artifacts/`, or `node_modules`. Render must track main, which contains only the backend. Earlier frontend source is preserved in commit bb83850 and the separate local frontend folder.

The package can be generated with `./scripts/package-backend.ps1`. The script prints the staging folder and ZIP path under `artifacts/`. It copies an explicit list of source/configuration files and includes no credentials. Upload the contents of that staging folder to GitHub.

## Render service

Connect the GitHub repository to Render and create a Blueprint from `render.yaml`. The reviewed configuration selects a **free Node web service**, installs server production dependencies, starts the API without nodemon, and checks `/api/health`.

If creating the web service manually, use:

| Setting                 | Value                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| Runtime                 | Node                                                                                       |
| Instance                | Free                                                                                       |
| Root directory          | Leave empty                                                                                |
| Build command           | `npm ci --prefix server --omit=dev`                                                        |
| Start command           | `npm start --prefix server`                                                                |
| Health check            | `/api/health`                                                                              |
| `NODE_VERSION`          | `24.22.1`                                                                                  |
| `NODE_ENV`              | `production`                                                                               |
| `HOST`                  | `0.0.0.0`                                                                                  |
| `CLIENT_ORIGIN`         | `http://localhost:5173,http://127.0.0.1:5173,https://endearing-kleicha-cd0f9c.netlify.app` |
| `FOOTBALL_DATA_API_KEY` | Set privately in Render's environment settings                                             |

Render supplies `PORT`. Keep the root directory empty: server modules import `shared/crests.js` from outside `server/`. No database, disk, paid worker, or recurring job is needed. Confirm the instance is Free before creating the service. Add the deployed frontend's exact origin to `CLIENT_ORIGIN` when it is hosted, with no trailing slash.

The Blueprint requests the API key as a secret input instead of embedding it in source. Sharing that credential with Render needs the account owner's authorization; enter it in Render, never GitHub source or a frontend `VITE_` variable.

## Connect the local frontend

After Render supplies the actual service URL, create `.env.local` at the frontend project's root (the sibling `football-center` folder):

```dotenv
VITE_API_BASE_URL=https://YOUR-ACTUAL-SERVICE.onrender.com/api
```

Restart Vite. The frontend uses that public API instead of the local proxy. HTTPS API requests allow up to 90 seconds for a sleeping free service to wake. Free services can still be unavailable or exceed that timeout; retry if necessary. Do not add a keep-alive job to defeat the host's idle policy.

## Verify before calling the deployment complete

1. Open the actual service's `/api/health`; it should return `status: "ok"` and `configured: true`.
2. Open `/api/clubs`; confirm it returns the club directory.
3. Check `/api/clubs/1/football` and `/api/international/nations-league`; confirm valid fixture responses, source timestamps, and coverage notices.
4. Check the frontend from its permitted origin; confirm fixtures, crests, and manual update controls work.

The API is public. CORS permits browser origins; it is not authentication. The server retains the existing shared provider request budget and caching. Its in-memory caches reset on restarts or idle shutdown. Streaming rights remain manually reviewed.

Official references: [Render free services](https://render.com/docs/free), [web services and port binding](https://render.com/docs/web-services), [Blueprint specification](https://render.com/docs/blueprint-spec).
