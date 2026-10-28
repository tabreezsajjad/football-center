# Netlify deployment

The backend runs on [Netlify Functions](https://football-center-api-tabreez.netlify.app/api/health), deployed automatically from the main branch of [tabreezsajjad/football-center](https://github.com/tabreezsajjad/football-center).

The frontend is hosted separately at https://endearing-kleicha-cd0f9c.netlify.app and uses this API directly. Frontend changes require a production build and upload to the existing frontend project.

See [NETLIFY.md](NETLIFY.md) for environment variables, function configuration, caching and deployment verification. netlify.toml is the only hosted deployment configuration. Local development uses npm run dev with nodemon; npm start remains available for running Express locally.

The source archive from scripts/package-backend.ps1 contains backend code and Netlify configuration only. It is for source transfer, not Netlify Drop: function deployments require the connected Git build or Netlify CLI. Never upload server/.env, node_modules or API keys.
