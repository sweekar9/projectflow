import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { initRealtime } from './realtime/io';
import { pool } from './db/pool';

async function main() {
  // Fail fast if the DB is unreachable.
  try {
    await pool.query('SELECT 1');
    console.log('Database connection OK');
  } catch (err) {
    console.error('Could not connect to the database. Is PostgreSQL running and DATABASE_URL correct?');
    throw err;
  }

  const app = createApp();
  const server = http.createServer(app);
  initRealtime(server);

  server.listen(env.port, () => {
    console.log(`ProjectFlow API listening on http://localhost:${env.port}`);
    console.log(`Realtime (socket.io) enabled. Allowed client origin: ${env.clientOrigin}`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
