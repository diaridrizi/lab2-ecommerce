import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { pool } from './config/postgres.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/orders.js';
import paymentRoutes, { stripeWebhook } from './routes/payments.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';
import adminUserRoutes from './routes/admin-users.js';
import adminShippingRoutes from './routes/admin-shipping.js';
import adminContentRoutes from './routes/admin-content.js';
import contentRoutes from './routes/content.js';
import reviewRoutes from './routes/reviews.js';
import { notFound, errorHandler } from './middleware/error.js';

export const app = express();

app.set('trust proxy', 'loopback'); // real client IP behind the Vite dev proxy (used for rate limiting and sessions)
app.use(helmet()); // security headers (no sniffing, no framing, HSTS, ...)
app.use(cors({ origin: env.clientUrl, credentials: true })); // credentials: the refresh token cookie
// Stripe webhook must get the raw body (for its signature check), so it comes before express.json()
app.post('/api/payments/webhook', ...stripeWebhook);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
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
app.use('/api', contentRoutes);          // banners, shipping methods, newsletter
app.use('/api/reviews', reviewRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/shipping-methods', adminShippingRoutes);
app.use('/api/admin', adminContentRoutes); // banners, subscribers, reviews
app.use('/api/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);
