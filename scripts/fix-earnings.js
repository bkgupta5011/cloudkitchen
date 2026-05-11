// Run: node scripts/fix-earnings.js
// Adds boy_payout column and recalculates earnings using per_km_earning * distance_km

const { neon } = require('@neondatabase/serverless')
require('dotenv').config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL)

async function fix() {
  console.log('🔧 Fixing earnings...\n')

  // 1. Add boy_payout column if missing
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS boy_payout DECIMAL(10,2)`
  console.log('✅ boy_payout column added/verified')

  // 2. Recalculate total_earnings and payment_due for all delivery boys
  //    using COALESCE(boy_payout, per_km_earning * COALESCE(distance_km, 3))
  await sql`
    UPDATE delivery_boys db SET
      total_earnings = COALESCE((
        SELECT SUM(COALESCE(o.boy_payout, db.per_km_earning * COALESCE(o.distance_km, 3)))
        FROM orders o WHERE o.delivery_boy_id = db.id AND o.status = 'delivered'
      ), 0),
      payment_due = GREATEST(0, COALESCE((
        SELECT SUM(COALESCE(o.boy_payout, db.per_km_earning * COALESCE(o.distance_km, 3)))
        FROM orders o WHERE o.delivery_boy_id = db.id AND o.status = 'delivered'
      ), 0) - COALESCE(total_paid, 0))
  `
  console.log('✅ total_earnings and payment_due recalculated for all delivery boys')

  // 3. Show updated values
  const boys = await sql`
    SELECT id, name, per_km_earning, total_earnings, total_paid, payment_due
    FROM delivery_boys ORDER BY name
  `
  console.log('\nDelivery boys updated:')
  boys.forEach(b => {
    console.log(`  ${b.name}: per_km=₹${b.per_km_earning}, earned=₹${parseFloat(b.total_earnings).toFixed(2)}, paid=₹${parseFloat(b.total_paid).toFixed(2)}, due=₹${parseFloat(b.payment_due).toFixed(2)}`)
  })

  // 4. Show order details for verification
  const orders = await sql`
    SELECT o.order_number, o.delivery_charge, o.distance_km, o.boy_payout,
           db.per_km_earning, db.name as boy_name
    FROM orders o
    JOIN delivery_boys db ON db.id = o.delivery_boy_id
    WHERE o.status = 'delivered'
    ORDER BY o.created_at DESC LIMIT 10
  `
  console.log('\nRecent delivered orders:')
  orders.forEach(o => {
    const calc = o.boy_payout
      ? parseFloat(o.boy_payout)
      : parseFloat(o.per_km_earning) * (o.distance_km ? parseFloat(o.distance_km) : 3)
    console.log(`  Order #${o.order_number}: delivery_charge=₹${o.delivery_charge}, distance=${o.distance_km||'null'}km, boy_payout=₹${calc.toFixed(2)} (${o.boy_name})`)
  })

  console.log('\n✅ Done!')
  process.exit(0)
}

fix().catch(e => { console.error(e); process.exit(1) })
