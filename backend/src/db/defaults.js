// Default delivery methods (PostgreSQL) and homepage banners (MongoDB).
// Used by seed.js, and can be run on its own to add them to an existing database
// WITHOUT deleting anything:   npm run defaults
// It only inserts when the table/collection is empty, so it never overwrites admin changes.
import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';
import { pool, connectPostgres } from '../config/postgres.js';
import { connectMongo } from '../config/mongo.js';
import { Banner } from '../models/Banner.js';

export const DEFAULT_SHIPPING_METHODS = [
  { code: 'standard', name: 'Standard delivery', description: '3–5 working days', price: 0, sort_order: 0 },
  { code: 'express', name: 'Express delivery', description: '1–2 working days', price: 9.9, sort_order: 1 },
];

export const DEFAULT_BANNERS = [
  { eyebrow: 'Just dropped', title: 'Jordan Classics', text: 'The icons that changed the game — back in stock.',
    image: '/images/banners/hero-jordan.jpg', ctaLabel: 'Shop Jordan', ctaLink: '/shop?brand=Jordan', sortOrder: 0 },
  { eyebrow: 'New season', title: 'Bold colours, easy fits', text: 'Hoodies, tees and jackets for every day.',
    image: '/images/banners/hero-season.jpg', ctaLabel: 'Shop clothing', ctaLink: '/shop?category=clothing', sortOrder: 1 },
  { eyebrow: 'Limited time', title: 'Sale up to -40%', text: 'Grab your favourites before they are gone.',
    image: '/images/banners/hero-sale.jpg', ctaLabel: 'Shop sale', ctaLink: '/shop?sale=1', sortOrder: 2 },
];

export async function addDefaults() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM shipping_methods');
  if (rows[0].n === 0) {
    for (const m of DEFAULT_SHIPPING_METHODS) {
      await pool.query(
        'INSERT INTO shipping_methods (code, name, description, price, sort_order) VALUES ($1, $2, $3, $4, $5)',
        [m.code, m.name, m.description, m.price, m.sort_order]
      );
    }
    console.log(`  added ${DEFAULT_SHIPPING_METHODS.length} delivery methods`);
  }
  if ((await Banner.countDocuments()) === 0) {
    await Banner.insertMany(DEFAULT_BANNERS);
    console.log(`  added ${DEFAULT_BANNERS.length} banners`);
  }
}

// Run directly: node src/db/defaults.js
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    await connectPostgres();
    await connectMongo();
    await addDefaults();
    console.log('✔ Defaults checked');
  })()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end();
      await mongoose.disconnect();
    });
}
