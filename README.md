# 🍽️ CloudKitchen — Complete Food Ordering Platform

Next.js + Neon PostgreSQL + Vercel

---

## 📁 Project Structure

```
cloudkitchen/
├── app/
│   ├── api/
│   │   ├── auth/route.js         ← Login, signup, logout (all 3 roles)
│   │   ├── menu/route.js         ← Menu CRUD
│   │   ├── orders/route.js       ← Place & manage orders
│   │   ├── admin/route.js        ← Kitchen toggle, offers, pricing, analytics
│   │   └── delivery/history/     ← Delivery boy earnings
│   ├── login/                    ← Login/Signup page (customer/admin/delivery)
│   ├── menu/                     ← Customer menu page
│   ├── cart/                     ← Cart + GPS address + checkout
│   ├── admin/                    ← Admin dashboard (all features)
│   └── delivery/                 ← Delivery boy portal
├── lib/
│   ├── db.js                     ← Neon DB connection
│   ├── auth.js                   ← JWT + password helpers
│   ├── middleware.js              ← API auth helper
│   └── utils.js                  ← Distance calc, delivery charge, offers
├── scripts/
│   └── db-setup.js               ← Creates all DB tables + seed data
└── .env.local                    ← Your secret keys (never commit!)
```

---

## 🚀 Setup (Step by Step)

### Step 1 — Install Node.js
Download from https://nodejs.org (LTS version)

### Step 2 — Create Neon Database
1. Go to https://neon.tech → Sign up (free)
2. Create new project → name it `cloudkitchen`
3. Click "Connection Details" → copy the **Connection string**
4. It looks like: `postgresql://user:pass@ep-xxx.region.aws.neon.tech/cloudkitchen?sslmode=require`

### Step 3 — Configure Environment
Edit `.env.local` file:
```
DATABASE_URL="your-neon-connection-string-here"
JWT_SECRET="any-long-random-string-like-abc123xyz456def789"
ADMIN_SECRET_KEY="choose-your-admin-key"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Step 4 — Install & Setup
```bash
# Go to project folder
cd cloudkitchen

# Install packages
npm install

# Create database tables
node scripts/db-setup.js

# Start development server
npm run dev
```

### Step 5 — Open in browser
- Customer: http://localhost:3000/login
- Admin: same page, select "Admin" tab
- Delivery Boy: same page, select "Delivery Boy" tab

---

## 👥 User Roles

| Role | Login | Access |
|------|-------|--------|
| Customer | /login → Customer tab | Menu, Cart, Orders |
| Admin | /login → Admin tab + Secret Key | Full dashboard |
| Delivery Boy | /login → Delivery Boy tab | Assigned orders, earnings |

**First admin setup:**
1. Go to /login → Admin → Sign Up
2. Enter your ADMIN_SECRET_KEY from .env.local
3. This creates your admin account

---

## ✨ Features

### Customer Side
- ✅ Signup/Login with JWT auth
- ✅ Browse menu by category
- ✅ See offers/discounts
- ✅ Add to cart with qty control
- ✅ GPS location detection (auto-fetch address)
- ✅ Apply offer codes at checkout
- ✅ Place order (COD)
- ✅ Order tracking screen

### Admin Dashboard
- ✅ Kitchen open/close toggle
- ✅ Live orders with status management
- ✅ Assign delivery boys to orders
- ✅ Add/edit menu items with photo URL, price, discount
- ✅ Toggle item availability
- ✅ Create and manage offer codes
- ✅ Add delivery boys (creates their login)
- ✅ KM-based delivery pricing
- ✅ Analytics (revenue, top items, customer count)

### Delivery Boy Portal
- ✅ See assigned orders with full customer details
- ✅ Open delivery address in Google Maps (navigation)
- ✅ Call customer directly
- ✅ Mark order as delivered
- ✅ View earnings history (today/week/month/all)
- ✅ Earnings auto-calculated (70% of delivery charge)

---

## 🌐 Deploy to Vercel

```bash
# 1. Push to GitHub
git init
git add .
git commit -m "Initial CloudKitchen"
git remote add origin https://github.com/yourusername/cloudkitchen
git push -u origin main

# 2. Go to vercel.com → New Project → Import from GitHub
# 3. Add Environment Variables (same as .env.local)
# 4. Deploy!
```

---

## 🔧 Customization

### Change kitchen name/address
Admin Dashboard → (automatically from kitchen_settings table)

### Add your kitchen GPS coordinates
In `.env.local` or in the cart page `cart/page.js`:
```js
const kitchenLat = 25.5941  // Your kitchen latitude
const kitchenLng = 85.1376  // Your kitchen longitude
```

### Change delivery boy earnings %
In `app/api/orders/route.js` find `delivery_charge * 0.7` → change 0.7 to your percentage

---

## 📞 Tech Stack
- **Frontend**: Next.js 14 (App Router)
- **Backend**: Next.js API Routes
- **Database**: Neon (PostgreSQL)
- **Auth**: JWT + bcrypt
- **Styling**: CSS Modules
- **Deploy**: Vercel
"# cloudkitchen" 
