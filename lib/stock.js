import { getDb } from './db'
import { sendPushToRole } from './push'

// Default stock per category
function getDefaultStock(category) {
  if (!category) return 5
  const c = category.toLowerCase()
  if (c.includes('rice')) return 10
  return 5
}

export { getDefaultStock }

// Daily stock reset — runs once per day
export async function checkAndResetDailyStock() {
  try {
    const sql = getDb()

    // Ensure columns exist
    try {
      await sql`ALTER TABLE kitchen_settings ADD COLUMN IF NOT EXISTS stock_reset_date DATE DEFAULT NULL`
      await sql`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS stock_default INT DEFAULT NULL`
    } catch {}

    const [settings] = await sql`SELECT stock_reset_date FROM kitchen_settings WHERE id = 1`
    if (!settings) return

    // IST date
    const now = new Date()
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
    const today = ist.toISOString().slice(0, 10)

    const lastReset = settings.stock_reset_date
      ? new Date(settings.stock_reset_date).toISOString().slice(0, 10)
      : null

    if (lastReset === today) return // Already reset today

    // Reset all items to their stock_default (or category default)
    const items = await sql`SELECT id, category, stock_default FROM menu_items`
    for (const item of items) {
      const qty = item.stock_default ?? getDefaultStock(item.category)
      await sql`
        UPDATE menu_items
        SET stock_count = ${qty},
            stock_default = COALESCE(stock_default, ${qty})
        WHERE id = ${item.id}
      `
    }

    await sql`UPDATE kitchen_settings SET stock_reset_date = ${today}::DATE WHERE id = 1`
    console.log(`✅ Stock daily reset done: ${today}`)
  } catch (e) {
    console.error('Stock reset error:', e.message)
  }
}

// Send push notification when stock is low or finished
export async function notifyLowStock(itemName, newStock) {
  try {
    if (newStock === 0) {
      await sendPushToRole('admin',
        `❌ Stock Khatam: ${itemName}`,
        `${itemName} bilkul khatam ho gaya! Ab order block ho jayega.`
      )
    } else if (newStock <= 2) {
      await sendPushToRole('admin',
        `⚠️ Low Stock: ${itemName}`,
        `${itemName} ka stock sirf ${newStock} bacha hai — jaldi refill karo!`
      )
    }
  } catch (e) {
    console.error('Low stock notify error:', e.message)
  }
}
