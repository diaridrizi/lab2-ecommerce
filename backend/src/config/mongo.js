// MongoDB connection (NoSQL database: shopping carts + activity logs)
import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectMongo() {
  await mongoose.connect(env.mongoUrl);
  console.log('✔ MongoDB connected');
}
