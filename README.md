# Football Center frontend

React/Vite dashboard connected directly to the hosted Football Center API. This folder contains only the frontend; no local server or API key is required.

## Run

Requires Node.js 22.19+.

```sh
npm install
npm run dev
```

Open http://localhost:5173. The default API URL is https://football-center-api.onrender.com/api. An optional ignored .env.local can override VITE_API_BASE_URL; .env.example contains the hosted default. Restart Vite after changing environment settings.

npm run build creates dist/. npm run preview previews the built frontend against the hosted API. There is no localhost API proxy or combined server launcher.

## Backend location

The backend lives in the sibling folder ../football-center-api on the backend branch of [the same GitHub repository](https://github.com/tabreezsajjad/football-center/tree/backend). This frontend checkout uses main. Render tracks backend, so frontend commits do not redeploy the API. Do not merge the two branch trees as an ordinary feature branch.

Backend code, secrets, nodemon, tests, deployment configuration, and upload packages live in that sibling checkout. To develop it locally, run npm run dev from ../football-center-api. Only then, if desired, override this frontend's VITE_API_BASE_URL with http://127.0.0.1:5000/api. Keep FOOTBALL_DATA_API_KEY in the backend environment only.

## Checks

```sh
npm run check
```

Runs formatting, lint, frontend API/calendar/refresh tests, and the production build. Backend tests run independently in the sibling checkout. Shared crest URL validation is a small independent copy in each checkout.

## Data updates

Visible, online match and table screens check every 5 minutes and retain their previous list during refreshes. The backend caches league fixtures for 10 minutes, standings for 15 minutes, and supplemental cup/Nations League listings for 30 minutes. Scores can be delayed. India streaming partners are manually reviewed and become unconfirmed after their review date. The UI shows source timestamps and explains this under How updates work.

Render's free service may take 50 seconds or more to wake after inactivity. The frontend allows up to 90 seconds for HTTPS API requests. The frontend itself remains local until separately hosted; any new frontend origin must be added to the backend's CLIENT_ORIGIN setting.
