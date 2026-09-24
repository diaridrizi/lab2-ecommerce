// Fills both databases with demo data.
// Run with: npm run seed   (WARNING: deletes existing data first)
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { pool, connectPostgres } from '../config/postgres.js';
import { connectMongo } from '../config/mongo.js';
import { Cart } from '../models/Cart.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { slugify } from '../utils/helpers.js';
import { categories, products, SIZE_RUNS } from './catalog-data.js';
import { addDefaults } from './defaults.js';
import { Banner } from '../models/Banner.js';
import { Review } from '../models/Review.js';
import { Subscriber } from '../models/Subscriber.js';

// Tiny seeded random generator so every seed run gives the same size stock
function seededRandom(seed) {
  let s = seed >>> 0; // mulberry32
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Spread `total` units over the sizes; middle sizes get more, some sizes may end up sold out
function spreadStock(total, sizes, seed) {
  const rand = seededRandom(seed);
  const weights = sizes.map((_, i) => {
    const middle = 1 - Math.abs(i - (sizes.length - 1) / 2) / sizes.length;
    return middle * (0.3 + rand());
  });
  const stock = sizes.map(() => 0);
  for (let unit = 0; unit < total; unit++) {
    let r = rand() * weights.reduce((a, b) => a + b, 0);
    let i = 0;
    while (i < sizes.length - 1 && r > weights[i]) r -= weights[i++];
    stock[i] += 1;
  }
  return stock;
}

async function seed() {
  await connectPostgres();
  await connectMongo();

  console.log('Clearing old data...');
  await pool.query(
    'TRUNCATE order_items, orders, product_sizes, products, categories, shipping_methods, users RESTART IDENTITY CASCADE'
  );
  await Promise.all([
    Cart.deleteMany({}), ActivityLog.deleteMany({}), Banner.deleteMany({}), Review.deleteMany({}), Subscriber.deleteMany({}),
  ]);

  console.log('Creating users...');
  const adminHash = await bcrypt.hash('admin123', 10);
  const customerHash = await bcrypt.hash('customer123', 10);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES
     ('Admin', 'admin@shop.local', $1, 'admin'),
     ('Demo Customer', 'customer@shop.local', $2, 'customer')`,
    [adminHash, customerHash]
  );

  console.log('Creating categories and products...');
  const catIds = {};
  for (const name of categories) {
    const { rows } = await pool.query('INSERT INTO categories (name, slug) VALUES ($1, $2) RETURNING id', [
      name,
      slugify(name),
    ]);
    catIds[name] = rows[0].id;
  }
  let sizeRows = 0;
  for (const [index, p] of products.entries()) {
    const slug = slugify(p.name);
    const { rows } = await pool.query(
      `INSERT INTO products (name, slug, brand, description, price, compare_at_price, stock, image_url,
                             category_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() - make_interval(days => $10), NOW() - make_interval(days => $10))
       RETURNING id`,
      [p.name, slug, p.brand, p.description, p.price, p.compareAt, p.stock, `/images/products/${slug}.jpg`,
        catIds[p.category], p.daysAgo]
    );

    const sizes = p.sizes ?? SIZE_RUNS[p.category];
    if (sizes) {
      const stock = spreadStock(p.stock, sizes, index + 1);
      for (const [i, size] of sizes.entries()) {
        await pool.query('INSERT INTO product_sizes (product_id, size, stock, sort_order) VALUES ($1, $2, $3, $4)', [
          rows[0].id, size, stock[i], i,
        ]);
        sizeRows++;
      }
    }
  }
  console.log(`  ${products.length} products, ${sizeRows} sizes`);

  console.log('Creating delivery methods, banners, reviews and subscribers...');
  await addDefaults();
  // A few demo reviews by the demo customer (user id 2)
  const demoReviews = [
    ['air-jordan-1-retro-high-og-bred', 5, 'An absolute classic', 'True to size, the leather feels premium. Worth every cent.'],
    ['nike-air-max-90', 4, 'Super comfy', 'Great for walking all day. Runs slightly small, so maybe go half a size up.'],
    ['club-fleece-hoodie', 5, 'My new favourite hoodie', 'Soft, warm and it kept its shape after washing.'],
  ];
  for (const [slug, rating, title, body] of demoReviews) {
    const { rows } = await pool.query('SELECT id FROM products WHERE slug = $1', [slug]);
    await Review.create({ productId: rows[0].id, userId: 2, userName: 'Demo Customer', rating, title, body });
  }
  await Subscriber.create({ email: 'customer@shop.local', name: 'Demo Customer', source: 'footer' });

  await ActivityLog.create({ action: 'system.seed', meta: { products: products.length } });

  console.log('\n✔ Done! Log in with:');
  console.log('   admin@shop.local    / admin123     (admin)');
  console.log('   customer@shop.local / customer123  (customer)');
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
    await mongoose.disconnect();
  });
