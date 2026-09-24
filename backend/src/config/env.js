import 'dotenv/config';

export const env = {
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || 'postgres://shop:shop123@localhost:5433/shopdb',
  mongoUrl: process.env.MONGO_URL || 'mongodb://localhost:27018/shopdb',
  isProduction: process.env.NODE_ENV === 'production',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  // Access token: short-lived JWT sent in the Authorization header (kept in memory by the frontend)
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  // Refresh token: long-lived random string in an httpOnly cookie, stored hashed in PostgreSQL
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS) || 7,
  // Stripe (test mode keys start with sk_test_ / whsec_). Without a secret key only cash on delivery is offered.
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  currency: (process.env.CURRENCY || 'eur').toLowerCase(),
};
