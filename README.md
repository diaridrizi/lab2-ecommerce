# FlowShop — Lab Course 2 E-commerce Project

A full-stack e-commerce web app built for Lab Course 2.

| Layer | Technology | What it does in this project |
|---|---|---|
| Frontend | **React 18** + Vite + React Router | Shop, product pages, cart, checkout, orders, admin panel |
| Backend | **Node.js + Express** | REST API, JWT authentication, role-based access |
| SQL database | **PostgreSQL 16** | Users, categories, products, orders, order items (structured, relational data with transactions) |
| NoSQL database | **MongoDB 7** | Shopping carts and activity logs (semi-structured, frequently changing documents) |
| Local infra | **Docker Compose** | Runs PostgreSQL, MongoDB and two web UIs to inspect them |
| Version control | **Git** | See [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md) |
| Project management | Jira / Trello / GitHub Projects | See [docs/PROJECT_MANAGEMENT.md](docs/PROJECT_MANAGEMENT.md) |

Everything runs **locally** on your computer.

---

## 1. What you need to install (once)

1. **Node.js 20 or newer** — https://nodejs.org (check with `node -v`)
2. **Docker Desktop** — https://www.docker.com/products/docker-desktop (start it and wait until it says *Engine running*)
3. **Git** — https://git-scm.com
4. A code editor, e.g. **VS Code**

## 2. Start the databases

Open a terminal in the project folder (`lab2-ecommerce`) and run:

```bash
docker compose up -d
```

This starts four containers:

| Container | Address | Login |
|---|---|---|
| PostgreSQL | `localhost:5433` | user `shop`, password `shop123`, database `shopdb` |
| MongoDB | `localhost:27018` | no password (local only), database `shopdb` |
| Adminer (Postgres UI) | http://localhost:8080 | System **PostgreSQL**, Server **postgres**, user `shop`, password `shop123`, DB `shopdb` |
| Mongo Express (Mongo UI) | http://localhost:8081 | — |

> The ports are 5433 and 27018 (not the usual 5432/27017) so they don't clash with a PostgreSQL or MongoDB you may already have installed.

Check they're running: `docker compose ps` (both should say *healthy* after a few seconds).

## 3. Start the backend (API)

Open a **new terminal**:

```bash
cd backend
npm install
copy .env.example .env      # Windows — skip if backend/.env already exists
# cp .env.example .env      # macOS / Linux / Git Bash
npm run seed                # creates tables + demo data (15 products, 2 users)
npm run dev                 # starts the API on http://localhost:5000
```

Test it: open http://localhost:5000/api/health → `{"status":"ok","postgres":"up","mongo":"up"}`

## 4. Start the frontend (React)

Open **another terminal**:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** 🎉

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@shop.local` | `admin123` |
| Customer | `customer@shop.local` | `customer123` |

You can also register new customer accounts from the **Sign up** page.

---

## Features

**Customers**
- Browse products, filter by category, search, sort by price/name/newest, pagination
- Product detail page with stock info
- Register / log in (JWT, password hashed with bcrypt)
- Cart (stored in MongoDB): add, change quantity, remove — stock is checked
- Checkout with shipping details → creates an order in PostgreSQL inside a **transaction** (stock is locked and decreased atomically)
- Order history, order details, cancel a pending order (stock is returned)

**Admins**
- Dashboard: revenue, order/product/customer counts, orders by status, low-stock list (PostgreSQL) + activity stats using a **MongoDB aggregation pipeline** and recent activity feed
- Products CRUD (create, edit, hide/show, delete)
- Categories CRUD
- Orders list with status filter, order details, change status (pending → paid → shipped → delivered, or cancelled with automatic restock)

---

## Why two databases?

**PostgreSQL** holds data where correctness matters and the structure is fixed:
users, products, categories, orders and order items. It gives us foreign keys,
`CHECK` constraints (e.g. stock can never go below 0), unique emails, joins for reports
and **transactions** — at checkout we lock the product rows (`SELECT … FOR UPDATE`),
check stock, insert the order and decrease stock all-or-nothing.

**MongoDB** holds data that is document-shaped and changes often:
- `carts` — one document per user with an array of items; updated on every click,
  no joins needed.
- `activitylogs` — events like `user.login`, `product.view`, `product.search`,
  `cart.add`, `order.created`, `admin.product_updated`. Every event has a different
  `meta` shape, which a schemaless document store handles naturally. The admin
  dashboard groups them with an aggregation pipeline.

The two are linked by IDs: a Mongo cart stores `userId` and `productId` values that
point to rows in PostgreSQL. At checkout the backend reads the cart from Mongo and
writes the order to Postgres.

```
 React (5173) ──/api──▶ Express (5000) ──┬──▶ PostgreSQL (5433)  users, products, orders
                                         └──▶ MongoDB   (27018)  carts, activity logs
```

### Database schema (PostgreSQL)

```
users (id, name, email UNIQUE, password_hash, role [customer|admin], created_at)
categories (id, name UNIQUE, slug UNIQUE, created_at)
products (id, name, slug UNIQUE, description, price ≥ 0, stock ≥ 0, image_url,
          category_id → categories, is_active, created_at, updated_at)
orders (id, user_id → users, status, total, shipping_name, shipping_address,
        shipping_city, shipping_phone, created_at)
order_items (id, order_id → orders, product_id → products, product_name,
             unit_price, quantity > 0)
```

The full SQL is in [`backend/src/db/schema.sql`](backend/src/db/schema.sql). Tables are created automatically when the server starts.

### Collections (MongoDB)

```js
// carts
{ userId: 2, items: [ { productId: 4, quantity: 2, addedAt: ISODate } ], createdAt, updatedAt }

// activitylogs
{ userId: 2, action: "order.created", meta: { orderId: 7 }, ip: "::1", userAgent: "...", createdAt }
```

---

## API reference

Base URL: `http://localhost:5000/api` · 🔒 = needs `Authorization: Bearer <token>` · 👑 = admin only

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Checks both databases |
| POST | `/auth/register` | `{ name, email, password }` → `{ user, token }` |
| POST | `/auth/login` | `{ email, password }` → `{ user, token }` |
| GET | `/auth/me` 🔒 | Current user |
| GET | `/categories` | All categories with product counts |
| GET | `/products?search=&category=&sort=&page=&limit=` | Product list. `sort` = `newest` \| `price_asc` \| `price_desc` \| `name` |
| GET | `/products/:slug` | One product |
| GET | `/cart` 🔒 | My cart (with live prices) |
| POST | `/cart/items` 🔒 | `{ productId, quantity }` add to cart |
| PATCH | `/cart/items/:productId` 🔒 | `{ quantity }` set quantity |
| DELETE | `/cart/items/:productId` 🔒 | Remove item |
| DELETE | `/cart` 🔒 | Empty cart |
| POST | `/orders` 🔒 | Checkout `{ shipping_name, shipping_address, shipping_city, shipping_phone }` |
| GET | `/orders` 🔒 | My orders |
| GET | `/orders/:id` 🔒 | Order details |
| POST | `/orders/:id/cancel` 🔒 | Cancel a pending order |
| GET | `/admin/stats` 👑 | Dashboard numbers |
| GET | `/admin/activity?action=&limit=` 👑 | Activity log (MongoDB) |
| GET/POST | `/admin/products` 👑 | List all / create product |
| PUT/DELETE | `/admin/products/:id` 👑 | Update / delete product |
| POST | `/admin/categories` 👑 | Create category |
| PUT/DELETE | `/admin/categories/:id` 👑 | Rename / delete category |
| GET | `/admin/orders?status=` 👑 | All orders |
| GET | `/admin/orders/:id` 👑 | Any order's details |
| PATCH | `/admin/orders/:id/status` 👑 | `{ status }` |

---

## Project structure

```
lab2-ecommerce/
├── docker-compose.yml          # PostgreSQL, MongoDB, Adminer, Mongo Express
├── backend/
│   ├── .env.example
│   └── src/
│       ├── server.js           # connects DBs, starts Express
│       ├── app.js              # middleware + routes
│       ├── config/             # env, postgres pool, mongo connection
│       ├── db/                 # schema.sql, seed.js
│       ├── models/             # Mongoose models: Cart, ActivityLog
│       ├── middleware/         # JWT auth, error handler
│       ├── routes/             # auth, catalog, cart, orders, admin
│       └── utils/helpers.js
├── frontend/
│   ├── vite.config.js          # proxies /api → localhost:5000
│   └── src/
│       ├── api.js              # fetch wrapper with JWT
│       ├── context/            # AuthContext, CartContext
│       ├── components/         # Navbar, ProductCard, ProtectedRoute, StatusBadge
│       └── pages/              # Home, ProductDetail, Cart, Checkout, Orders, Login, ...
│           └── admin/          # Dashboard, Products, Categories, Orders
└── docs/
    ├── GIT_WORKFLOW.md
    └── PROJECT_MANAGEMENT.md
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `Could not connect to the databases` | Docker Desktop isn't running, or containers are stopped → `docker compose up -d` |
| `port is already allocated` | Something else uses 5433/27018/8080/8081. Change the left number in `docker-compose.yml` (e.g. `"5434:5432"`) and in `backend/.env` |
| Frontend shows `Request failed (500)` / network errors | The backend isn't running — start it with `npm run dev` in `backend/` |
| Want a fresh start | `docker compose down -v` (deletes DB data), `docker compose up -d`, then `npm run seed` |
| Product images don't show | They load from picsum.photos — needs internet. Admins can set any image URL. |

## Useful commands

```bash
docker compose up -d        # start databases
docker compose ps           # status
docker compose logs -f      # database logs
docker compose down         # stop (data kept)
docker compose down -v      # stop and delete all data

# open a SQL shell inside the Postgres container
docker exec -it shop-postgres psql -U shop -d shopdb
#   \dt                          list tables
#   SELECT * FROM orders;

# open a Mongo shell inside the Mongo container
docker exec -it shop-mongo mongosh shopdb
#   show collections
#   db.activitylogs.find().sort({createdAt:-1}).limit(5)
```
