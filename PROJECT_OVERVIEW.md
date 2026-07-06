# Zourcefy Group Buy - Project Overview

A B2B group buying and procurement pool app built for Shopify, enabling storefront customers and guest users to start and join wholesale volume discount pools natively inside your theme.

---

## 🛠️ App Architecture & Features

### 1. Storefront Widget (Product Details Page)
* **File:** [group-buy-pool.liquid](file:///e:/Dev/projects/zourcefy-group-buy/extensions/group-buy-widget/blocks/group-buy-pool.liquid)
* **How it works:**
  * Displays a card on the product detail page containing either the **Active Pool Details** (if a pool exists) or a **"Start Group Buy"** button (if no pool exists).
  * Guests can join pools by providing their email; the system automatically generates a secure guest ID (`guest_xxxx`) for database tracking.

### 2. Integrated Pool Creation Subpage
* **File:** [api.proxy.$.ts](file:///e:/Dev/projects/zourcefy-group-buy/app/routes/api.proxy.$.ts) (Splat Route)
* **How it works:**
  * When a customer clicks **"Start Group Buy"**, they are redirected to `/apps/zourcefy-pool/create`.
  * The app proxy intercepts the request and serves a custom Liquid-form.
  * Because it is served as `application/liquid`, the page renders **natively** wrapped inside your Shopify theme's header, footer, and styling.
  * Automatically pre-fills and locks the email field if the customer is signed in.
  * Redirects the browser back to the product page on successful pool creation.

### 3. Merchant Admin Dashboard
* **Files:** [app.pools._index.tsx](file:///e:/Dev/projects/zourcefy-group-buy/app/routes/app.pools._index.tsx) and [app.pools.new.tsx](file:///e:/Dev/projects/zourcefy-group-buy/app/routes/app.pools.new.tsx)
* **How it works:**
  * Merchancts can view all active and completed pools.
  * In the **New Pool** view, merchants can click "Select Product from Catalog" which opens Shopify's native **Resource Picker**. Picking a product auto-fills the product ID and title fields instantly.

---

## 💾 Database Schema (Prisma / SQLite)

Defined in [schema.prisma](file:///e:/Dev/projects/zourcefy-group-buy/prisma/schema.prisma):
* **`Pool`**: Stores product details, target volume, discount percentage, and status (`ACTIVE` or `COMPLETED`).
* **`PoolMember`**: Stores participant bindings, tracking who committed how much volume (`customerId`, `customerEmail`, `quantity`).

---

## 🚀 DevOps & 24/7 Hosting Setup

### 1. Automated GitHub Deployment (CI/CD)
* **Workflow File:** [.github/workflows/deploy.yml](file:///e:/Dev/projects/zourcefy-group-buy/.github/workflows/deploy.yml)
* **Action:** Automatically runs linter checks, type-checking compilation, and deploys the theme extension to your Shopify account every time code is pushed to `main`/`master`.

### 2. Permanent 24/7 Cloud Hosting (Render.com Setup)
* **Service:** Create a Node Web Service.
* **Build Command:** `npm run build`
* **Start Command:** `npx prisma migrate deploy && npm run start`
* **Persistent Disk:** Mount a `1 GB` disk at `/data` with the environment variable `DATABASE_URL=file:/data/dev.sqlite` to secure database records permanently across restarts.
* **Shopify Partner Dashboard:** Update App Configuration URLs to use your live public URL (e.g. `https://zourcefy-buy.onrender.com`).

---

## 🔄 App Migration Guide

To merge this code into the main Zourcefy app in the future:
1. Refer to the complete step-by-step merge blueprint located in [migration_guide.md](file:///C:/Users/josta/.gemini/antigravity-ide/brain/dd297c59-fc89-44f2-96a3-3d979e7ec9a5/migration_guide.md).
