# Deploy the backend to Render

This deploys only the API. The Vite frontend can keep running on localhost until it is hosted separately.

## Source repository

Source repository: [tabreezsajjad/football-center](https://github.com/tabreezsajjad/football-center). Keep `server/`, `shared/`, and `render.yaml` at the repository root. Never upload `server/.env`, `.env.local`, `artifacts/`, or `node_modules`. The frontend can live in this repository too; Render's API build installs only the server dependencies.

The package can be generated with `./scripts/package-backend.ps1`. The script prints the staging folder and ZIP path under `artifacts/`. It copies an explicit list of source/configuration files and includes no credentials. Upload the contents of that staging folder to GitHub.

## Render service

Connect the GitHub repository to Render and create a Blueprint from `render.yaml`. The reviewed configuration selects a **free Node web service**, installs server production dependencies, starts the API without nodemon, and checks `/api/health`.

If creating the web service manually, use:

| Setting                 | Value                                          |
| ----------------------- | ---------------------------------------------- |
| Runtime                 | Node                                           |
| Instance                | Free                                           |
| Root directory          | Leave empty                                    |
| Build command           | `npm ci --prefix server --omit=dev`            |
| Start command           | `npm start --prefix server`                    |
| Health check            | `/api/health`                                  |
| `NODE_VERSION`          | `24.22.1`                                      |
| `NODE_ENV`              | `production`                                   |
| `HOST`                  | `0.0.0.0`                                      |
| `CLIENT_ORIGIN`         | `http://localhost:5173,http://127.0.0.1:5173`  |
| `FOOTBALL_DATA_API_KEY` | Set privately in Render's environment settings |

Render supplies `PORT`. Keep the root directory empty: server modules import `shared/crests.js` from outside `server/`. No database, disk, paid worker, or recurring job is needed. Confirm the instance is Free before creating the service. Add the deployed frontend's exact origin to `CLIENT_ORIGIN` when it is hosted, with no trailing slash.

The Blueprint requests the API key as a secret input instead of embedding it in source. Sharing that credential with Render needs the account owner's authorization; enter it in Render, never GitHub source or a frontend `VITE_` variable.

## Connect the local frontend

After Render supplies the actual service URL, create `.env.local` at this project's root:

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
