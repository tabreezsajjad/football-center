# Football Center API

Backend for [football-center](https://github.com/tabreezsajjad/football-center), using main as its only active branch. The frontend remains in the sibling football-center folder for later work; its earlier source is also preserved in commit bb83850.

Frontend: https://endearing-kleicha-cd0f9c.netlify.app

Live API: https://football-center-api-tabreez.netlify.app/api
Health: https://football-center-api-tabreez.netlify.app/api/health

## Development

Requires Node.js 22.19+. Install dependencies with npm install and npm install --prefix server, then run npm run dev. Nodemon watches the backend. Local defaults use 127.0.0.1:5000. The ignored server/.env contains FOOTBALL_DATA_API_KEY; see server/.env.example for options. Never put the key in frontend code.

## Checks

Run npm run check for formatting, lint and backend tests. Tests mock upstream providers and do not consume the football quota. npm start runs the API without nodemon.

## Deployment

The API is deployed on Netlify Functions and the frontend uses it. Pushes to main deploy the API automatically. See [NETLIFY.md](NETLIFY.md) for setup, caching and verification.

Fixtures and standings use football-data.org's free coverage. ESPN public scoreboards supplement domestic cups and Nations League as best-effort listings. Requests are cached and rate-limited; source timestamps and incomplete coverage are returned with the data. India streaming information in server/india-broadcasts.js needs manual review and expires after its review deadline.
