import 'dotenv/config';

export const env = {
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || 'postgres://shop:shop123@localhost:5433/shopdb',
  mongoUrl: process.env.MONGO_URL || 'mongodb://localhost:27018/shopdb',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
};
