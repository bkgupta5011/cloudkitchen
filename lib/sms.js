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

// ── Order Confirmed ───────────────────────────────────────────────
export async function sendOrderConfirmedSms(phone, orderNumber, total) {
  return sendSms(
    phone,
    `FoodFi: Aapka order #${orderNumber} confirm ho gaya! Rs.${Math.round(total)} ka khana taiyar ho raha hai. 30-45 min mein deliver hoga. Dhanyawad! -FoodFi Cloud Kitchen Patna`
  )
}

// ── Order Delivered ───────────────────────────────────────────────
export async function sendOrderDeliveredSms(phone, orderNumber) {
  return sendSms(
    phone,
    `FoodFi: Order #${orderNumber} deliver ho gaya! Khana enjoy karein. Hamari service pasand aaye toh apne doston ko bhi batayein. Shukriya! -FoodFi Cloud Kitchen Patna`
  )
}
