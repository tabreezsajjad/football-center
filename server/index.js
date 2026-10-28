import process from 'node:process';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

config({ path: fileURLToPath(new URL('.env', import.meta.url)), quiet: true });
const port = Number(process.env.PORT || 5000);
const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT must be an integer between 1 and 65535.');
  process.exit(1);
}
const origins = process.env.CLIENT_ORIGIN?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const app = createApp({ ...(origins?.length ? { origins } : {}) });
const server = app.listen(port, host, () => {
  console.log(`Football Center API ready at http://${host}:${port}`);
});
server.on('error', (error) => {
  console.error(
    error.code === 'EADDRINUSE'
      ? `Port ${port} is already in use. Stop the older API before starting another instance.`
      : `API startup failed (${error.code || 'UNKNOWN'}).`,
  );
  process.exitCode = 1;
});
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log('Stopping Football Center API...');
  const timeout = setTimeout(() => {
    server.closeAllConnections();
    process.exit(1);
  }, 5000).unref();
  server.close(() => {
    clearTimeout(timeout);
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
