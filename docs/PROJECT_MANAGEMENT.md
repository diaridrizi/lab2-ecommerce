# Project management

Use a board tool (**Jira**, **Trello**, or **GitHub Projects**) to split work, assign
tasks and track progress. Suggested columns:

`Backlog → To Do → In Progress → In Review (PR open) → Done`

Each card = one task, with an **assignee**, **estimate** and a link to its Git branch / PR.

## Suggested epics and tasks

Ticket keys (SHOP-1, SHOP-2, …) can be used in branch names: `feature/SHOP-7-cart-api`.

### Epic 1 — Setup & infrastructure
| Key | Task | Status |
|---|---|---|
| SHOP-1 | Create Git repo, `.gitignore`, README | ✅ Done |
| SHOP-2 | Docker Compose with PostgreSQL + MongoDB | ✅ Done |
| SHOP-3 | Express project skeleton, env config, error handling | ✅ Done |
| SHOP-4 | React + Vite skeleton, routing, API proxy | ✅ Done |

### Epic 2 — Database design
| Key | Task | Status |
|---|---|---|
| SHOP-5 | PostgreSQL schema: users, categories, products, orders, order_items | ✅ Done |
| SHOP-6 | MongoDB models: carts, activity logs | ✅ Done |
| SHOP-7 | Seed script with demo data | ✅ Done |

### Epic 3 — Authentication
| Key | Task | Status |
|---|---|---|
| SHOP-8 | Register / login API with bcrypt + JWT | ✅ Done |
| SHOP-9 | Auth context, login & register pages, protected routes | ✅ Done |
| SHOP-10 | Admin role + admin-only routes | ✅ Done |

### Epic 4 — Catalog
| Key | Task | Status |
|---|---|---|
| SHOP-11 | Products API with search, filter, sort, pagination | ✅ Done |
| SHOP-12 | Home page with product grid, category chips, search | ✅ Done |
| SHOP-13 | Product detail page | ✅ Done |

### Epic 5 — Cart & checkout
| Key | Task | Status |
|---|---|---|
| SHOP-14 | Cart API (MongoDB) with stock checks | ✅ Done |
| SHOP-15 | Cart page + cart badge in navbar | ✅ Done |
| SHOP-16 | Checkout API with PostgreSQL transaction | ✅ Done |
| SHOP-17 | Checkout page, order history, order detail, cancel | ✅ Done |

### Epic 6 — Admin panel
| Key | Task | Status |
|---|---|---|
| SHOP-18 | Dashboard stats (SQL + Mongo aggregation) | ✅ Done |
| SHOP-19 | Products CRUD page | ✅ Done |
| SHOP-20 | Categories CRUD page | ✅ Done |
| SHOP-21 | Orders management + status changes | ✅ Done |

### Ideas for extra work (Backlog)
| Key | Task |
|---|---|
| SHOP-22 | Product reviews & ratings (MongoDB) |
| SHOP-23 | Wishlist (MongoDB) |
| SHOP-24 | Image upload instead of image URL |
| SHOP-25 | Automated tests (Jest + Supertest for the API) |
| SHOP-26 | Discount codes |
| SHOP-27 | Email order confirmation |

## Team split example (3 people)

| Member | Area |
|---|---|
| A | Backend: auth, orders, PostgreSQL |
| B | Backend: cart, activity logs, MongoDB, admin API |
| C | Frontend: all pages + styling |

Hold a short weekly meeting: what was done, what's next, what's blocking.
