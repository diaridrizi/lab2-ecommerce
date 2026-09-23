import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { pool } from './config/postgres.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/orders.js';
import adminRoutes from './routes/admin.js';
import { notFound, errorHandler } from './middleware/error.js';

export const app = express();

app.use(cors({ origin: env.clientUrl }));
app.use(express.json());
app.use(morgan('dev'));

// GET /api/health  -> quick check that both databases are reachable
app.get('/api/health', async (_req, res) => {
  let postgres = 'down';
  try {
    await pool.query('SELECT 1');
    postgres = 'up';
  } catch { /* stays down */ }
  const mongo = mongoose.connection.readyState === 1 ? 'up' : 'down';
  const ok = postgres === 'up' && mongo === 'up';
  res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'degraded', postgres, mongo });
});

app.use('/api/auth', authRoutes);
app.use('/api', catalogRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);
