import express from 'express';
import cors from 'cors';
import { clubs } from './clubs.js';
import { createFootballService, FREE_COMPETITIONS, FootballError } from './football-data.js';
import { createCupService, mergeCupFixtures } from './cup-fixtures.js';

export function createApp({
  football = createFootballService(),
  cups = createCupService(),
  origins = ['http://localhost:5173', 'http://127.0.0.1:5173'],
} = {}) {
  const app = express();
  const startedAt = new Date().toISOString();
  app.disable('x-powered-by');
  app.use(cors({ origin: origins }));
  app.use(express.json({ limit: '8kb' }));
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      app: 'Football Center',
      provider: 'football-data.org',
      configured: football.configured,
      startedAt,
    });
  });
  app.get('/api/config', (req, res) => {
    res.json({
      provider: 'football-data.org',
      configured: football.configured,
      plan: 'free',
      competitions: FREE_COMPETITIONS,
      delayed: true,
    });
  });
  app.get('/api/clubs', (req, res) => {
    if (req.query.search !== undefined && typeof req.query.search !== 'string') {
      return res
        .status(400)
        .json({ code: 'INVALID_QUERY', message: 'Search must be a single text value.' });
    }
    const query = (req.query.search || '').trim().toLowerCase();
    if (query.length > 100)
      return res
        .status(400)
        .json({ code: 'INVALID_QUERY', message: 'Search must be 100 characters or fewer.' });
    const results = clubs.filter((club) =>
      `${club.name} ${club.league} ${club.short}`.toLowerCase().includes(query),
    );
    res.json({
      source: 'local-directory',
      count: results.length,
      clubs: results.map((club) => ({ ...club, covered: true })),
    });
  });
  app.get('/api/clubs/:id/football', async (req, res) => {
    const id = /^\d{1,3}$/.test(req.params.id) ? Number(req.params.id) : NaN;
    if (!clubs.some((club) => club.id === id))
      return res.status(404).json({ code: 'NO_DATA', message: 'Club not found.' });
    if (!football.configured) return res.json(await football.clubData(id));
    const [base, supplement] = await Promise.all([
      football.clubData(id),
      cups.clubFixtures(id).catch(() => ({ fixtures: [], cups: [], complete: false })),
    ]);
    res.json(mergeCupFixtures(base, supplement));
  });
  app.get('/api/standings/:code', async (req, res) => {
    res.json(await football.standings(req.params.code.toUpperCase()));
  });
  app.get('/api/international/nations-league', async (req, res) => {
    res.json(await cups.nationsLeague());
  });
  app.use((req, res) =>
    res.status(404).json({ code: 'NOT_FOUND', message: 'Endpoint not found.' }),
  );
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof FootballError) {
      if (error.retryAfter) res.set('Retry-After', String(error.retryAfter));
      return res
        .status(error.status)
        .json({ code: error.code, message: error.message, retryAfter: error.retryAfter });
    }
    if (error.type === 'entity.parse.failed')
      return res
        .status(400)
        .json({ code: 'INVALID_JSON', message: 'Request body must be valid JSON.' });
    if (error.type === 'entity.too.large')
      return res
        .status(413)
        .json({ code: 'BODY_TOO_LARGE', message: 'Request body is too large.' });
    res.status(500).json({
      code: 'SERVER_ERROR',
      message: 'The server could not load football data. Please try again.',
    });
  });
  return app;
}
