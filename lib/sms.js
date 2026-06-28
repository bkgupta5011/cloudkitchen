// ── Fast2SMS Utility ─────────────────────────────────────────────
// Used for order status SMS notifications to customers

async function sendSms(phone, message) {
  const key = process.env.FAST2SMS_API_KEY
  if (!key) { console.error('[SMS] FAST2SMS_API_KEY missing'); return null }

  // Normalize phone — remove +91 prefix, keep only 10 digits
  const number = String(phone).replace(/^\+91/, '').replace(/^91/, '').replace(/[^0-9]/g, '')
  if (number.length !== 10) { console.error('[SMS] Invalid phone after normalize:', number); return null }

  try {
    const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'authorization': key,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({
        route: 'q',
        message,
        language: 'english',
        flash: 0,
        numbers: number,
      }),
    })
    const data = await res.json()
    // Log full response so we can debug any Fast2SMS errors
    if (data?.return === false) {
      console.error('[SMS] Fast2SMS rejected:', JSON.stringify(data))
    } else {
      console.log('[SMS] Sent to', number, '| response:', JSON.stringify(data))
    }
    return data
  } catch (e) {
    console.error('[SMS] Send failed:', e.message)
    return null
  }
}

// ── New-order alert to kitchen/owner via 2Factor OTP (used as a signal) ──
// No DLT template needed — 2Factor AUTOGEN uses its own OTP template.
// Each number receives an OTP SMS; the kitchen treats it as "naya order aaya".
const KITCHEN_ALERT_NUMBERS = ['9264155346', '7546983536', '7549266347']

export async function sendNewOrderSignal() {
  const key = process.env.TWOFACTOR_API_KEY
  if (!key) { console.error('[OrderSignal] TWOFACTOR_API_KEY missing'); return }
  await Promise.all(KITCHEN_ALERT_NUMBERS.map(async (num) => {
    try {
      const res = await fetch(`https://2factor.in/API/V1/${key}/SMS/${num}/AUTOGEN`)
      const data = await res.json().catch(() => ({}))
      if (data?.Status !== 'Success') console.error('[OrderSignal] 2Factor failed for', num, JSON.stringify(data))
    } catch (e) {
      console.error('[OrderSignal] Send failed for', num, e.message)
    }
  }))
}

// ── Order Confirmed ───────────────────────────────────────────────
export async function sendOrderConfirmedSms(phone, orderNumber, total) {
  return sendSms(
    phone,
    `FoodFi: Your order #${orderNumber} is confirmed! Your Rs.${Math.round(total)} order is being prepared and will arrive in 30-45 min. Thank you! -FoodFi Cloud Kitchen Patna`
  )
}

// ── Order Delivered ───────────────────────────────────────────────
export async function sendOrderDeliveredSms(phone, orderNumber) {
  return sendSms(
    phone,
    `FoodFi: Order #${orderNumber} has been delivered! Enjoy your meal. If you liked our service, please tell your friends too. Thank you! -FoodFi Cloud Kitchen Patna`
  )
}
