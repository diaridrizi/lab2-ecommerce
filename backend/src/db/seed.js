// Fills both databases with demo data.
// Run with: npm run seed   (WARNING: deletes existing data first)
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { pool, connectPostgres } from '../config/postgres.js';
import { connectMongo } from '../config/mongo.js';
import { Cart } from '../models/Cart.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { slugify } from '../utils/helpers.js';

const categories = ['Electronics', 'Clothing', 'Home & Kitchen', 'Books', 'Sports'];

// [name, category, price, stock, description]
const products = [
  ['Wireless Headphones', 'Electronics', 79.99, 25, 'Over-ear Bluetooth headphones with 30h battery and noise cancelling.'],
  ['Smartwatch Pro', 'Electronics', 149.0, 12, 'Fitness tracking, heart-rate monitor and notifications on your wrist.'],
  ['USB-C Charger 65W', 'Electronics', 29.5, 60, 'Fast charger for laptops and phones, foldable plug.'],
  ['Mechanical Keyboard', 'Electronics', 89.9, 3, 'Hot-swappable switches, RGB backlight, aluminium frame.'],
  ['Classic Denim Jacket', 'Clothing', 59.0, 18, 'Timeless blue denim jacket, regular fit.'],
  ['Cotton T-Shirt', 'Clothing', 14.99, 100, '100% organic cotton, available in many colours.'],
  ['Running Sneakers', 'Clothing', 99.0, 20, 'Lightweight running shoes with breathable mesh.'],
  ['Espresso Machine', 'Home & Kitchen', 229.0, 7, '15-bar pump espresso maker with milk frother.'],
  ['Non-stick Pan Set', 'Home & Kitchen', 49.9, 30, 'Three pans (20/24/28 cm), induction compatible.'],
  ['Scented Candle', 'Home & Kitchen', 12.0, 45, 'Vanilla & sandalwood soy candle, 40h burn time.'],
  ['JavaScript: The Good Parts', 'Books', 24.99, 15, 'A classic guide to the best features of JavaScript.'],
  ['Clean Code', 'Books', 32.5, 10, 'A handbook of agile software craftsmanship.'],
  ['Yoga Mat', 'Sports', 25.0, 40, 'Non-slip 6 mm mat with carrying strap.'],
  ['Adjustable Dumbbells', 'Sports', 139.0, 5, 'Pair of dumbbells adjustable from 2 to 24 kg.'],
  ['Football', 'Sports', 19.99, 50, 'Size 5 match ball, hand-stitched.'],
];

async function seed() {
  await connectPostgres();
  await connectMongo();

  console.log('Clearing old data...');
  await pool.query('TRUNCATE order_items, orders, products, categories, users RESTART IDENTITY CASCADE');
  await Cart.deleteMany({});
  await ActivityLog.deleteMany({});

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
  for (const [name, cat, price, stock, description] of products) {
    const slug = slugify(name);
    await pool.query(
      `INSERT INTO products (name, slug, description, price, stock, image_url, category_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [name, slug, description, price, stock, `https://picsum.photos/seed/${slug}/600/450`, catIds[cat]]
    );
  }

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
