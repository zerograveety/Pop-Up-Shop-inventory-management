# Pop-Up Shop Inventory Management

A DBMS project for managing inventory across pop-up shops. Node.js/Express + PostgreSQL backend with a React (CRA) frontend.

## Features
- Role-based access: **Admin** (users, events, warehouse, stock orders) and **Manager** (products, orders, reports, shop stock)
- JWT authentication (login / register)
- Shop stock requests & admin approval/fulfillment workflow
- Popup events with manager assignment
- POS sales, orders, and refunds
- Inventory & sales reports, low-stock alerts

## Tech Stack
- Backend: Express 5, PostgreSQL (`pg`), JWT (`jsonwebtoken`), bcrypt
- Frontend: React 19 (Create React App)

## Setup

Choose one of the two database options below.

### Option A — Quick start with Docker (recommended for trying it out)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
# 1. Start the database (auto-creates the schema & demo users)
docker compose up -d

# 2. Use the matching env file
cp .env.docker.example .env
```

Skip ahead to **Step 3 (Install & run)** below.

### Option B — Use your own PostgreSQL install

### B1. Environment variables
Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Then edit `.env` with your local PostgreSQL credentials and a strong `JWT_SECRET`.

### B2. Database schema
Create a database (e.g. `InventoryManagement`), then apply the schema:

```bash
createdb InventoryManagement
psql -d InventoryManagement -f database/schema.sql
```

The schema seeds three demo accounts (all password `admin123`):
- **Admin**: `admin@popup.com`
- **Admin**: `admin@inventory.com`
- **Manager**: `manager@inventory.com`

(Change these passwords after first login.)

### 3. Install & run the backend
```bash
npm install
npm run start:server   # runs node server_auth.js on port 8080
```

### 4. Run the frontend
```bash
cd frontend
npm install
npm start              # serves on http://localhost:3000
```

> Note: on newer Node.js versions the frontend needs `NODE_OPTIONS=--openssl-legacy-provider` (already set in the `start` script). Run `nvm install 18 && nvm use 18` if you prefer an older, more compatible Node.

Open http://localhost:3000 and log in.

## Default accounts
Seeded by `database/schema.sql`. All demo users use password `admin123`:
- `admin@popup.com` — Admin
- `admin@inventory.com` — Admin
- `manager@inventory.com` — Manager

## API
All routes are mounted under `/api`:
- `/api/auth` — register / login / verify / logout
- `/api/products` — product listing (public GET) and Manager/Admin CRUD
- `/api/orders` — Manager/Admin order management
- `/api/sales` — Manager/Admin sales
- `/api/admin/*` — Admin-only (users, events, warehouse stock, stock orders)
- `/api/manager/*` — Manager/Admin (products, reports, shop stock, stock orders)
- `/api/cashier/*` — Manager/Admin (POS order creation, refunds, daily sales)
- `/api/users` — Admin-only user management

Health check: http://localhost:8080/health
