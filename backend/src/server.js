import http from 'node:http';
import { env } from './config/env.js';
import { connectPostgres } from './config/postgres.js';
import { connectMongo } from './config/mongo.js';
import { app } from './app.js';
import { initRealtime } from './realtime/socket.js';
import { cleanupRefreshTokens } from './utils/tokens.js';

async function start() {
  try {
    await connectPostgres();
    await connectMongo();
  } catch (err) {
    console.error('✖ Could not connect to the databases:', err.message);
    console.error('  Is Docker running? Try: docker compose up -d  (from the project root)');
    process.exit(1);
  }
  // One HTTP server for both the REST API (Express) and the WebSockets (Socket.IO)
  const server = http.createServer(app);
  initRealtime(server);
  server.listen(env.port, () => {
    console.log(`🚀 API running at http://localhost:${env.port}/api  (WebSockets on the same port)`);
  });

  // Delete expired/revoked refresh tokens once an hour
  const cleanup = () => cleanupRefreshTokens().catch((err) => console.error('Token cleanup failed:', err.message));
  cleanup();
  setInterval(cleanup, 60 * 60 * 1000).unref();
}

start();
