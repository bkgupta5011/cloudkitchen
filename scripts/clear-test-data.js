// Run: node scripts/clear-test-data.js
// Clears all test data — keeps admins, menu items, offers, kitchen settings, km pricing

const { neon } = require('@neondatabase/serverless')
require('dotenv').config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL)

async function clearTestData() {
  console.log('🧹 Test data clear ho raha hai...\n')

  // 1. Order items (FK child — pehle delete karo)
  const { count: oi } = await sql`SELECT COUNT(*) as count FROM order_items`.then(r => r[0])
  await sql`DELETE FROM order_items`
  console.log(`✅ order_items cleared (${oi} rows)`)

  // 2. Orders
  const { count: ord } = await sql`SELECT COUNT(*) as count FROM orders`.then(r => r[0])
  await sql`DELETE FROM orders`
  console.log(`✅ orders cleared (${ord} rows)`)

  // 3. Reset order_number sequence
  await sql`ALTER SEQUENCE IF EXISTS orders_order_number_seq RESTART WITH 1`.catch(() => {})
  console.log('✅ order_number sequence reset to 1')

  // 4. Delivery boys
  const { count: db } = await sql`SELECT COUNT(*) as count FROM delivery_boys`.then(r => r[0])
  await sql`DELETE FROM delivery_boys`
  console.log(`✅ delivery_boys cleared (${db} rows)`)

  // 5. Users (customers)
  const { count: us } = await sql`SELECT COUNT(*) as count FROM users`.then(r => r[0])
  await sql`DELETE FROM users`
  console.log(`✅ users (customers) cleared (${us} rows)`)

  // 6. Phone OTPs
  await sql`DELETE FROM phone_otps`.catch(() => {})
  console.log('✅ phone_otps cleared')

  // 7. Password reset tokens
  await sql`DELETE FROM password_reset_tokens`.catch(() => {})
  console.log('✅ password_reset_tokens cleared')

  // Summary — what is KEPT
  const { count: admins } = await sql`SELECT COUNT(*) as count FROM admins`.then(r => r[0])
  const { count: menu } = await sql`SELECT COUNT(*) as count FROM menu_items`.then(r => r[0])
  const { count: offers } = await sql`SELECT COUNT(*) as count FROM offers`.then(r => r[0])

  console.log('\n✅ YE SAFE RAHA (delete nahi hua):')
  console.log(`   👤 Admins:     ${admins}`)
  console.log(`   🍽️  Menu items: ${menu}`)
  console.log(`   🎁 Offers:     ${offers}`)
  console.log(`   ⚙️  kitchen_settings, km_pricing — safe`)

  console.log('\n🎉 Done! Database production ke liye ready hai.\n')
  process.exit(0)
}

clearTestData().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
