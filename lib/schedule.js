import { getDb } from './db'

/**
 * Checks current IST time against kitchen open/close schedule.
 * If auto_schedule is enabled, updates is_open in DB only when state changes.
 * Safe to call on every request — DB write is conditional (only if state changes).
 */
export async function checkAndUpdateKitchenSchedule() {
  try {
    const sql = getDb()
    const [settings] = await sql`
      SELECT is_open, auto_schedule, open_time, close_time
      FROM kitchen_settings WHERE id = 1
    `
    if (!settings || !settings.auto_schedule) return

    // Current time in IST (UTC+5:30)
    const now = new Date()
    const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
    const currentMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes()

    // Parse "HH:MM" string to total minutes
    const toMinutes = (timeStr) => {
      if (!timeStr) return null
      const [h, m] = String(timeStr).split(':').map(Number)
      return isNaN(h) ? null : h * 60 + (m || 0)
    }

    const openMinutes  = toMinutes(settings.open_time)
    const closeMinutes = toMinutes(settings.close_time)
    if (openMinutes == null || closeMinutes == null) return

    // Determine if kitchen should be open right now
    let shouldBeOpen
    if (openMinutes <= closeMinutes) {
      // Normal: e.g. 09:00 to 22:00
      shouldBeOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes
    } else {
      // Overnight: e.g. 22:00 to 03:00
      shouldBeOpen = currentMinutes >= openMinutes || currentMinutes < closeMinutes
    }

    // Only write to DB if state actually needs to change
    if (shouldBeOpen !== settings.is_open) {
      await sql`UPDATE kitchen_settings SET is_open = ${shouldBeOpen} WHERE id = 1`
      console.log(`Kitchen auto-${shouldBeOpen ? 'opened' : 'closed'} by schedule`)
    }
  } catch (e) {
    console.error('Kitchen schedule check error:', e.message)
  }
}
