# FlowShop — Lab Course 2 E-commerce Project

A full-stack e-commerce web app built for Lab Course 2.

| Layer | Technology | What it does in this project |
|---|---|---|
| Frontend | **React 18** + Vite + React Router | Shop, product pages, cart, checkout, orders, admin panel |
| Backend | **Node.js + Express** | REST API, access + refresh token authentication, role-based access |
| Real-time | **Socket.IO** (WebSockets) | Live notifications and live order updates |
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
npm run seed                # creates tables + demo data (36 products, 2 users, banners, delivery methods, reviews)
                            # (already have data? `npm run defaults` only adds missing banners/delivery methods)
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
- Homepage with a banner slideshow, category tiles, "New arrivals" / "Sale" product rows and a brand strip
- Shop page: filter by category, brand or sale, search (name/brand/description), sort by price/name/newest, pagination
- Sale prices (old price crossed out, `-30%` badge) and "New" badges for products added in the last 14 days
- Product detail page with stock info
- Register / log in with **access + refresh tokens** (see [Authentication](#authentication-and-authorization)); Account &amp; security page
  with active sessions, "log out everywhere" and password change
- **Live notifications** (bell menu + pop-up toasts) and pages that update by themselves (see [Real-time notifications](#real-time-notifications-websockets))
- Sizes with their own stock (EU 38–46 for sneakers, XS–XXL for clothing); sold-out sizes are crossed out
- Cart (stored in MongoDB) with a slide-in mini cart: add, change quantity, remove — stock is checked per size
- Checkout: contact, shipping address (postal code, country), standard (free) or express (€9.90) delivery,
  **online card payment with Stripe** (see [Online payments](#online-payments-stripe)) or **cash on delivery**, order notes
  → creates an order in PostgreSQL inside a **transaction** (stock rows are locked and decreased atomically)
- Order history, order details with progress steps, cancel an order that hasn't shipped (stock is returned, card payments refunded)

**Admins**
- Dashboard: revenue, order/product/customer counts, orders by status, low-stock list (PostgreSQL) + activity stats using a **MongoDB aggregation pipeline** and recent activity feed
- Products CRUD (create, edit, hide/show, delete)
- Categories CRUD
- Products: manage sizes and stock per size, sale price, brand
- Orders list with status and payment filters (card / cash), payment status (unpaid / paid / refunded), full order details;
  change status and delete orders. Step order depends on payment: card = pending → paid → shipped → delivered,
  cash on delivery = pending → shipped → paid → delivered (the courier collects the money). Cancelling restocks automatically.
- Users, delivery methods, homepage banners, reviews and newsletter subscribers — all managed in the admin panel

---

## CRUD overview (9 complete CRUDs: 5 PostgreSQL + 4 MongoDB)

| # | Entity | DB | Create | Read | Update | Delete | Admin page / where in the app | Code |
|---|---|---|---|---|---|---|---|---|
| 1 | Products (+ sizes) | PostgreSQL | `POST /admin/products` | `GET /products`, `/products/:slug`, `/admin/products` | `PUT /admin/products/:id` | `DELETE /admin/products/:id` | Admin → Products | `routes/admin.js`, `routes/catalog.js` |
| 2 | Categories | PostgreSQL | `POST /admin/categories` | `GET /categories` | `PUT /admin/categories/:id` | `DELETE /admin/categories/:id` | Admin → Categories | `routes/admin.js` |
| 3 | Delivery methods | PostgreSQL | `POST /admin/shipping-methods` | `GET /shipping-methods`, `/admin/shipping-methods` | `PUT /admin/shipping-methods/:id` | `DELETE /admin/shipping-methods/:id` | Admin → Delivery, used at checkout | `routes/admin-shipping.js` |
| 4 | Orders | PostgreSQL | `POST /orders` (checkout) | `GET /orders`, `/admin/orders` | `PATCH /admin/orders/:id/status`, `POST /orders/:id/cancel` | `DELETE /admin/orders/:id` | Checkout, My orders, Admin → Orders | `routes/orders.js`, `routes/admin.js` |
| 5 | Users | PostgreSQL | `POST /admin/users` (+ `POST /auth/register`) | `GET /admin/users` | `PUT /admin/users/:id` | `DELETE /admin/users/:id` | Admin → Users | `routes/admin-users.js` |
| 6 | Cart | MongoDB | `POST /cart/items` | `GET /cart` | `PATCH /cart/items/:productId` | `DELETE /cart/items/:productId`, `DELETE /cart` | Mini cart, Cart page | `routes/cart.js`, `models/Cart.js` |
| 7 | Reviews | MongoDB | `POST /reviews` | `GET /reviews?productId=`, `/admin/reviews` | `PUT /reviews/:id`, `PUT /admin/reviews/:id` | `DELETE /reviews/:id`, `DELETE /admin/reviews/:id` | Product page, Admin → Reviews | `routes/reviews.js`, `models/Review.js` |
| 8 | Banners | MongoDB | `POST /admin/banners` | `GET /banners`, `/admin/banners` | `PUT /admin/banners/:id` | `DELETE /admin/banners/:id` | Homepage slideshow, Admin → Banners | `routes/admin-content.js`, `models/Banner.js` |
| 9 | Newsletter subscribers | MongoDB | `POST /newsletter`, `POST /admin/subscribers` | `GET /admin/subscribers` | `PUT /admin/subscribers/:id` | `DELETE /admin/subscribers/:id` | Footer form, Admin → Subscribers | `routes/admin-content.js`, `models/Subscriber.js` |

Activity logs (MongoDB, `models/ActivityLog.js`) are written automatically for every important action and shown on the admin dashboard.

---

## Authentication and authorization

Two tokens, the standard pattern for single-page apps:

| | Access token | Refresh token |
|---|---|---|
| What | Signed JWT (HS256, `iss`/`aud` checked) | 48 random bytes |
| Lifetime | **15 minutes** (`ACCESS_TOKEN_TTL`) | **7 days** (`REFRESH_TOKEN_DAYS`) |
| Where in the browser | Only in memory (a JS variable), not in localStorage | `httpOnly` + `SameSite=Strict` cookie, path `/api/auth`, `Secure` in production |
| Where on the server | Not stored | Only its **SHA-256 hash**, in the `refresh_tokens` table |
| Sent with | `Authorization: Bearer …` on every API call and on the WebSocket handshake | Only to `/api/auth/refresh` and `/api/auth/logout` |

**Flow.** Login returns an access token and sets the refresh cookie. When a request gets `401` (the access token expired),
[`api.js`](frontend/src/api.js) calls `/auth/refresh` once and retries the request, so the user never notices. On page
reload the access token is gone, so the app restores the session with one refresh call.

**Security measures**
- **Rotation + reuse detection.** Every refresh revokes the old refresh token and issues a new one in the same *family* (one family = one login).
  If an already-rotated token is used again, it must have been copied, so the whole family is revoked and the user's access tokens stop working.
  Two tabs refreshing at the same second get a 20-second grace window.
- **Instant revocation.** Every request loads the user from PostgreSQL and checks `token_version`. "Log out everywhere", a password change
  and a role change bump it, so old access tokens stop working immediately instead of after 15 minutes.
- **Role-based access control.** `requireAuth` and `requireRole('admin')` ([`middleware/auth.js`](backend/src/middleware/auth.js)).
  The role is read from the database, not trusted from the token. Customers get `403` on admin routes, and customers can only see their own orders and notifications.
- Passwords are hashed with bcrypt (cost 12) and must have at least 8 characters with a letter and a number. Logins take the same time whether or not the email exists.
- **Rate limiting:** 10 login attempts per 15 minutes per IP + email, and 10 registrations per hour per IP (`429` + `Retry-After`).
- CSRF protection: the SameSite=Strict cookie plus an `Origin` check on the cookie endpoints. The server also sends `helmet` security headers.
- **Sessions page** (*Account & security*): see every device you're logged in on, log out one device or all of them, and change your password (this logs out the other devices).

Code: [`utils/tokens.js`](backend/src/utils/tokens.js), [`routes/auth.js`](backend/src/routes/auth.js),
[`middleware/auth.js`](backend/src/middleware/auth.js), [`middleware/rateLimit.js`](backend/src/middleware/rateLimit.js).

**How to test:** log in, open DevTools → *Application → Cookies* and you'll see `refresh_token` marked HttpOnly (JavaScript can't read it).
In *Network* you'll see `POST /api/auth/refresh` when you reload the page. Log in from a second browser, open *Account & security*
and press *Log out* next to the other device. That browser is logged out at once.

---

## Real-time notifications (WebSockets)

The backend runs a **Socket.IO** server on the same port as the API ([`realtime/socket.js`](backend/src/realtime/socket.js)).
The browser connects after login with its access token. The server rejects connections without a valid token, and if the token
has expired the client refreshes it and reconnects. Each user joins the room `user:<id>`, and admins also join `admins`.

Notifications are **saved in MongoDB** (`notifications` collection, auto-deleted after 90 days), so users also see what happened
while they were offline. They are **pushed live** as a toast in the bottom-right corner plus a badge on the 🔔 bell.

| Event | Who is notified |
|---|---|
| Order placed (cash) | Customer ("Order placed") + admins ("New order #…") |
| Stripe payment confirmed | Customer ("Payment confirmed") + admins ("Payment received") |
| Admin changes status: paid / shipped / delivered / cancelled | Customer ("Your order is on its way", …) |
| Customer cancels an order | Admins |
| Stripe payment page expired → order cancelled | Customer |
| Stock of a product/size drops to ≤ 5 after an order | Admins ("Low stock") |
| New product review | Admins |
| "Log out everywhere", password reset or account deleted | All of that user's open tabs are logged out right away |

Besides notifications, **pages update live**: *My orders*, the order page, *Admin → Orders* (changed row flashes) and the admin
dashboard reload when an order changes. The dashboard also shows **"Online now"** (users connected over WebSocket).

**How to test:** open two browsers side by side, the admin (`admin@shop.local`) in one and a customer in the other.
1. As the customer, place a cash order. The admin gets a "New order" toast and the Orders list updates by itself.
2. As the admin, set the order to *shipped*. The customer immediately gets "Your order is on its way", and their order page moves to the next step without reloading.
3. Click the bell to see the list (green **LIVE** dot = connected), mark notifications read, or delete them.
4. As the customer, go to *Account & security* → *Log out everywhere*. Every other tab of that customer is logged out at once.

---

## Online payments (Stripe)

Card payments use **Stripe Checkout**: the customer enters the card on Stripe's own secure page, so card numbers never
reach our server (we only store Stripe's ids, the card brand and the last 4 digits).

1. Checkout with "Pay online with card" → the order is saved as `pending` / `unpaid` (stock reserved) and the backend
   creates a Stripe Checkout Session → the browser is redirected to Stripe.
2. After paying, Stripe redirects to `/orders/:id?session_id=…`; the order page calls `POST /payments/confirm`, the
   backend **asks Stripe** whether the session is paid and marks the order `paid` (can't be faked from the browser).
3. The webhook (`checkout.session.completed` / `expired`) does the same from Stripe's side — so the order is updated even
   if the customer closes the tab, and an unpaid order is cancelled + restocked when the 30-minute payment page expires.
4. Cancelling a paid order (customer or admin) or deleting an open one **refunds it through Stripe**.
   Admins can't move an unpaid card order forward.

Code: [`backend/src/utils/payment.js`](backend/src/utils/payment.js), [`backend/src/routes/payments.js`](backend/src/routes/payments.js).

### Set up and test (test mode — no real money)

1. Create a free account at <https://dashboard.stripe.com/register> (no business details needed for test mode).
2. Make sure **Test mode** is on, go to *Developers → API keys* and copy the **Secret key** (`sk_test_…`).
3. Put it in `backend/.env`: `STRIPE_SECRET_KEY=sk_test_...` and restart the backend (Ctrl+C, then `npm run dev`) —
   `.env` is only read at startup.
4. In the shop: add products → Checkout → *Pay online with card* → *Continue to payment*.
5. On the Stripe page use a test card, any future expiry date, any CVC, any name:

| Card number | Result |
|---|---|
| `4242 4242 4242 4242` | Payment succeeds (Visa) |
| `5555 5555 5555 4444` | Payment succeeds (Mastercard) |
| `4000 0025 0000 3155` | Asks for 3D Secure authentication — click *Complete* |
| `4000 0000 0000 9995` | Declined (insufficient funds) |
| `4000 0000 0000 0002` | Declined (generic) |

6. Check the result: the order page shows *paid* with `Visa •••• 4242`, Admin → Orders shows it, and the payment is listed
   in the Stripe dashboard under *Payments*. Cancel the order → the refund appears in Stripe too.
7. Press "← back" on the Stripe page instead of paying → the order shows *waiting for payment* with a **Pay** button.

**Optional — webhook** (install the [Stripe CLI](https://docs.stripe.com/stripe-cli)):

```bash
stripe login
stripe listen --forward-to localhost:5000/api/payments/webhook
# copy the printed whsec_... into backend/.env as STRIPE_WEBHOOK_SECRET
stripe trigger checkout.session.completed   # sends a test event
```

Without the webhook everything still works through the redirect (step 2); the webhook is the backup.

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
users (id, name, email UNIQUE, password_hash, role [customer|admin], token_version, created_at)
refresh_tokens (id, user_id → users, token_hash UNIQUE (SHA-256), family_id, expires_at, revoked_at, revoked_reason,
                user_agent, ip, created_at)
categories (id, name UNIQUE, slug UNIQUE, created_at)
products (id, name, slug UNIQUE, brand, description, price ≥ 0, compare_at_price (old price, for sales),
          stock ≥ 0, image_url,
          category_id → categories, is_active, created_at, updated_at)
product_sizes (id, product_id → products, size, stock ≥ 0, sort_order, UNIQUE(product_id, size))
orders (id, user_id → users, status, total, shipping_name, shipping_email, shipping_phone,
        shipping_address, shipping_city, shipping_postal_code, shipping_country, notes,
        shipping_method [standard|express], shipping_cost,
        payment_method [cash|card], payment_status [unpaid|paid|refunded], card_brand, card_last4,
        stripe_session_id, stripe_payment_intent, paid_at, created_at)
order_items (id, order_id → orders, product_id → products, product_name, size,
             unit_price, quantity > 0)
```

The full SQL is in [`backend/src/db/schema.sql`](backend/src/db/schema.sql). Tables are created automatically when the server starts.

### Collections (MongoDB)

```js
// carts
{ userId: 2, items: [ { productId: 4, size: "42", quantity: 2, addedAt: ISODate } ], createdAt, updatedAt }

// activitylogs
{ userId: 2, action: "order.created", meta: { orderId: 7 }, ip: "::1", userAgent: "...", createdAt }

// notifications
{ userId: 2, type: "order.shipped", title: "Your order is on its way", message: "Order #7 has been shipped", link: "/orders/7", read: false, createdAt }
```

---

## API reference

Base URL: `http://localhost:5000/api` · 🔒 = needs `Authorization: Bearer <token>` · 👑 = admin only

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Checks both databases |
| POST | `/auth/register` | `{ name, email, password }` → `{ user, accessToken }` + refresh token cookie |
| POST | `/auth/login` | `{ email, password }` → `{ user, accessToken }` + refresh token cookie (rate limited) |
| POST | `/auth/refresh` | (cookie) → `{ user, accessToken }` + a new, rotated refresh cookie |
| POST | `/auth/logout` | (cookie) ends this device's session |
| POST | `/auth/logout-all` 🔒 | Ends all sessions on all devices right away |
| GET | `/auth/me` 🔒 | Current user |
| GET | `/auth/sessions` 🔒 | My active logins (devices) |
| DELETE | `/auth/sessions/:id` 🔒 | Log out one device |
| PUT | `/auth/password` 🔒 | `{ currentPassword, newPassword }` — other devices are logged out |
| GET | `/notifications` 🔒 | `{ items, unread }` my notifications |
| PATCH | `/notifications/:id` 🔒 | `{ read }` mark read / unread |
| POST | `/notifications/read-all` 🔒 | Mark all read |
| DELETE | `/notifications/:id`, `/notifications` 🔒 | Delete one / all |
| GET | `/categories` | All categories with product counts |
| GET | `/brands` | All brands with product counts |
| GET | `/products?search=&category=&brand=&sale=1&sort=&page=&limit=` | Product list. `sort` = `newest` \| `price_asc` \| `price_desc` \| `name`. `sale=1` = only discounted products |
| GET | `/products/:slug` | One product |
| GET | `/cart` 🔒 | My cart (with live prices) |
| POST | `/cart/items` 🔒 | `{ productId, size, quantity }` add to cart (`size` required for sized products) |
| PATCH | `/cart/items/:productId?size=42` 🔒 | `{ quantity }` set quantity |
| DELETE | `/cart/items/:productId?size=42` 🔒 | Remove item |
| DELETE | `/cart` 🔒 | Empty cart |
| POST | `/orders` 🔒 | Checkout `{ shipping_name, shipping_email, shipping_phone, shipping_address, shipping_city, shipping_postal_code, shipping_country, notes?, shipping_method, payment_method: cash\|card }`. For `card` the response has `checkout_url` (Stripe payment page) |
| GET | `/orders` 🔒 | My orders |
| GET | `/orders/:id` 🔒 | Order details |
| POST | `/orders/:id/cancel` 🔒 | Cancel a pending order (Stripe payments are refunded) |
| POST | `/orders/:id/pay` 🔒 | New Stripe payment page for an unpaid card order → `{ checkout_url }` |
| GET | `/payments/config` | `{ card: true/false, testMode }` — is Stripe set up? |
| POST | `/payments/confirm` 🔒 | `{ session_id }` — checks the payment with Stripe after the redirect back |
| POST | `/payments/webhook` | Stripe events (signature checked with `STRIPE_WEBHOOK_SECRET`) |
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
│       ├── middleware/         # auth (access tokens, roles), rate limit, error handler
│       ├── realtime/           # Socket.IO server (WebSocket auth + rooms)
│       ├── routes/             # auth, catalog, cart, orders, admin
│       └── utils/helpers.js
├── frontend/
│   ├── vite.config.js          # proxies /api → localhost:5000
│   └── src/
│       ├── api.js              # fetch wrapper: access token in memory, automatic refresh on 401
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
| Product images don't show | Demo photos are stored in `frontend/public/images/` (free photos from [Unsplash](https://unsplash.com/license)). Run `npm run seed` again if your database still has the old demo products. Admins can set any image URL. |

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
