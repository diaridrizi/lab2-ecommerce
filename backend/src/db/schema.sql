-- PostgreSQL schema: structured, relational data.
-- Safe to run many times (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'customer'
                CHECK (role IN ('customer', 'admin')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  slug       VARCHAR(120) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200)   NOT NULL,
  slug        VARCHAR(220)   NOT NULL UNIQUE,
  description TEXT           NOT NULL DEFAULT '',
  price       NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  stock       INTEGER        NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url   TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  is_active   BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

-- Added later: brand, and compare_at_price = the old "was" price shown crossed out
-- when a product is on sale. `price` is always what the customer actually pays.
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS compare_at_price NUMERIC(10, 2)
  CHECK (compare_at_price >= 0);

CREATE TABLE IF NOT EXISTS orders (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled')),
  total            NUMERIC(10, 2) NOT NULL,
  shipping_name    VARCHAR(100) NOT NULL,
  shipping_address VARCHAR(255) NOT NULL,
  shipping_city    VARCHAR(100) NOT NULL,
  shipping_phone   VARCHAR(40)  NOT NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);

-- Name and price are copied into the order item, so old orders stay
-- correct even if the product is later edited or deleted.
CREATE TABLE IF NOT EXISTS order_items (
  id           SERIAL PRIMARY KEY,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(200)   NOT NULL,
  unit_price   NUMERIC(10, 2) NOT NULL,
  quantity     INTEGER        NOT NULL CHECK (quantity > 0)
);

-- Sizes with their own stock (e.g. EU 42 for sneakers, M for a hoodie).
-- Products without rows here are "one size" and use products.stock directly.
-- For sized products, products.stock is always kept equal to the sum of its sizes.
CREATE TABLE IF NOT EXISTS product_sizes (
  id         SERIAL PRIMARY KEY,
  product_id INTEGER     NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size       VARCHAR(20) NOT NULL,
  stock      INTEGER     NOT NULL DEFAULT 0 CHECK (stock >= 0),
  sort_order INTEGER     NOT NULL DEFAULT 0,
  UNIQUE (product_id, size)
);

-- The size that was bought (copied as text, like the product name)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS size VARCHAR(20);

-- Extra checkout details
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_email       VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_postal_code VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_country     VARCHAR(80);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes                TEXT;
-- Delivery methods are managed by the admin (see shipping_methods below).
-- The order keeps a copy of the code, name and price, so old orders stay correct if a method changes.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_method VARCHAR(40) NOT NULL DEFAULT 'standard';
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_shipping_method_check; -- older versions only allowed standard/express
ALTER TABLE orders ALTER COLUMN shipping_method TYPE VARCHAR(40);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_method_name VARCHAR(100);
-- Orders from before delivery methods were editable: fill in a readable name ("express" -> "Express delivery")
UPDATE orders SET shipping_method_name = INITCAP(shipping_method) || ' delivery' WHERE shipping_method_name IS NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10, 2) NOT NULL DEFAULT 0;
-- Payment: cash on delivery or card. For cards we only keep the brand and last 4 digits,
-- never the full number or CVC.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'cash'
  CHECK (payment_method IN ('cash', 'card'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid'
  CHECK (payment_status IN ('unpaid', 'paid', 'refunded'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_brand VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_last4 VARCHAR(4);
-- Online payments go through Stripe Checkout: we keep Stripe's ids (for looking up and refunding) and when it was paid
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_session_id     VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at               TIMESTAMPTZ;

-- Login sessions. Each row is one refresh token (only its SHA-256 hash is stored, never the token itself).
-- Tokens are rotated: every refresh revokes the old row and creates a new one in the same `family_id`.
-- If a revoked token is used again (stolen/replayed), the whole family (= that login) is revoked.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   CHAR(64)     NOT NULL UNIQUE,
  family_id    UUID         NOT NULL,
  expires_at   TIMESTAMPTZ  NOT NULL,
  revoked_at   TIMESTAMPTZ,
  revoked_reason VARCHAR(30),                -- rotated | logout | logout_all | reuse_detected | admin
  user_agent   VARCHAR(255),
  ip           VARCHAR(64),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()   -- newest row of a family = when that session was last used
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family_id);
-- Bumped when a user's access must end now (role changed, "log out everywhere"): older access tokens are refused
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

-- Delivery options shown at checkout (admin CRUD). Default rows are created by the seed script.
CREATE TABLE IF NOT EXISTS shipping_methods (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(40)    NOT NULL UNIQUE,  -- stored on orders, e.g. 'express'
  name        VARCHAR(100)   NOT NULL,         -- 'Express delivery'
  description VARCHAR(200)   NOT NULL DEFAULT '', -- '1–2 working days'
  price       NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  is_active   BOOLEAN        NOT NULL DEFAULT TRUE,
  sort_order  INTEGER        NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
