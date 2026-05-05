// Run: node scripts/db-setup.js
// This creates all tables in Neon PostgreSQL

const { neon } = require('@neondatabase/serverless')
require('dotenv').config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL)

async function setup() {
  console.log('🚀 Setting up CloudKitchen database...\n')

  // ── USERS (customers) ────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      phone VARCHAR(20),
      password_hash VARCHAR(255) NOT NULL,
      address TEXT,
      lat DECIMAL(10,8),
      lng DECIMAL(11,8),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  console.log('✅ users table')

  // ── ADMINS ───────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS admins (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  console.log('✅ admins table')

  // ── DELIVERY BOYS ────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS delivery_boys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      phone VARCHAR(20),
      vehicle_number VARCHAR(20),
      password_hash VARCHAR(255) NOT NULL,
      is_online BOOLEAN DEFAULT false,
      per_km_earning DECIMAL(6,2) DEFAULT 12.00,
      total_earnings DECIMAL(10,2) DEFAULT 0,
      rating DECIMAL(3,2) DEFAULT 5.0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  console.log('✅ delivery_boys table')

  // ── MENU ITEMS ───────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS menu_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(150) NOT NULL,
      description TEXT,
      price DECIMAL(8,2) NOT NULL,
      discount_percent INT DEFAULT 0,
      category VARCHAR(50) NOT NULL,
      is_veg BOOLEAN DEFAULT true,
      image_url TEXT,
      is_available BOOLEAN DEFAULT true,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  console.log('✅ menu_items table')

  // ── OFFERS ───────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS offers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(30) UNIQUE NOT NULL,
      type VARCHAR(20) NOT NULL, -- 'flat' | 'percent' | 'free_delivery'
      value DECIMAL(8,2) NOT NULL,
      min_order DECIMAL(8,2) DEFAULT 0,
      max_uses INT DEFAULT 1000,
      used_count INT DEFAULT 0,
      valid_till DATE,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  console.log('✅ offers table')

  // ── ORDERS ───────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_number SERIAL,
      user_id UUID REFERENCES users(id),
      delivery_boy_id UUID REFERENCES delivery_boys(id),
      offer_id UUID REFERENCES offers(id),
      status VARCHAR(30) DEFAULT 'pending',
        -- pending | confirmed | preparing | out_for_delivery | delivered | cancelled
      subtotal DECIMAL(10,2) NOT NULL,
      discount_amount DECIMAL(10,2) DEFAULT 0,
      delivery_charge DECIMAL(8,2) DEFAULT 0,
      total DECIMAL(10,2) NOT NULL,
      delivery_address TEXT NOT NULL,
      delivery_lat DECIMAL(10,8),
      delivery_lng DECIMAL(11,8),
      distance_km DECIMAL(6,2),
      payment_method VARCHAR(20) DEFAULT 'cod',
      payment_status VARCHAR(20) DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      delivered_at TIMESTAMPTZ
    )
  `
  console.log('✅ orders table')

  // ── ORDER ITEMS ──────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS order_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
      menu_item_id UUID REFERENCES menu_items(id),
      name VARCHAR(150) NOT NULL,
      price DECIMAL(8,2) NOT NULL,
      quantity INT NOT NULL,
      subtotal DECIMAL(10,2) NOT NULL
    )
  `
  console.log('✅ order_items table')

  // ── KITCHEN SETTINGS ─────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS kitchen_settings (
      id INT PRIMARY KEY DEFAULT 1,
      is_open BOOLEAN DEFAULT true,
      kitchen_name VARCHAR(100) DEFAULT 'CloudKitchen',
      address TEXT,
      phone VARCHAR(20),
      lat DECIMAL(10,8),
      lng DECIMAL(11,8),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  // Insert default row
  await sql`
    INSERT INTO kitchen_settings (id, is_open, kitchen_name)
    VALUES (1, true, 'CloudKitchen')
    ON CONFLICT (id) DO NOTHING
  `
  console.log('✅ kitchen_settings table')

  // ── KM PRICING ───────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS km_pricing (
      id SERIAL PRIMARY KEY,
      min_km DECIMAL(6,2) NOT NULL,
      max_km DECIMAL(6,2),
      base_charge DECIMAL(8,2) NOT NULL,
      per_km_charge DECIMAL(8,2) DEFAULT 0
    )
  `
  // Default pricing
  await sql`
    INSERT INTO km_pricing (min_km, max_km, base_charge, per_km_charge)
    VALUES
      (0, 2, 20, 0),
      (2, 5, 30, 5),
      (5, 10, 50, 8),
      (10, NULL, 80, 10)
    ON CONFLICT DO NOTHING
  `
  console.log('✅ km_pricing table')

  // ── SEED: Sample menu items ──────────────────────────────────────
  await sql`
    INSERT INTO menu_items (name, description, price, discount_percent, category, is_veg, sort_order)
    VALUES
      ('Butter Chicken', 'Creamy tomato-based chicken curry', 280, 0, 'Non-Veg', false, 1),
      ('Dal Makhani', 'Slow-cooked black lentils in rich buttery gravy', 180, 10, 'Veg', true, 2),
      ('Hyderabadi Biryani', 'Fragrant basmati rice with spiced mutton', 350, 0, 'Non-Veg', false, 3),
      ('Paneer Tikka', 'Grilled cottage cheese with mint chutney', 220, 15, 'Veg', true, 4),
      ('Chole Bhature', 'Spiced chickpeas with fluffy fried bread', 150, 0, 'Veg', true, 5),
      ('Gulab Jamun', 'Soft milk dumplings in rose sugar syrup', 80, 20, 'Dessert', true, 6),
      ('Mango Lassi', 'Chilled yoghurt mango smoothie', 80, 0, 'Drinks', true, 7)
    ON CONFLICT DO NOTHING
  `
  console.log('✅ Sample menu items seeded')

  // ── SEED: Sample offer ───────────────────────────────────────────
  await sql`
    INSERT INTO offers (code, type, value, min_order, max_uses)
    VALUES ('WELCOME50', 'flat', 50, 200, 500)
    ON CONFLICT DO NOTHING
  `
  console.log('✅ Sample offer seeded')

  console.log('\n🎉 Database setup complete! Sab tables ready hain.\n')
  process.exit(0)
}

setup().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
