import { env } from './config/env.js';
import { connectPostgres } from './config/postgres.js';
import { connectMongo } from './config/mongo.js';
import { app } from './app.js';

async function start() {
  try {
    await connectPostgres();
    await connectMongo();
  } catch (err) {
    console.error('✖ Could not connect to the databases:', err.message);
    console.error('  Is Docker running? Try: docker compose up -d  (from the project root)');
    process.exit(1);
  }
  app.listen(env.port, () => {
    console.log(`🚀 API running at http://localhost:${env.port}/api`);
  });
}

start();
