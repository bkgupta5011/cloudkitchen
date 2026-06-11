const FROM = 'FoodFi Cloud Kitchen <noreply@foodfi.in>'

async function sendEmail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY
  if (!key || key === 'your_resend_key') return

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Resend error: ${res.status}`)
  }
}

// ── Order Confirmation ───────────────────────────────────────────
export async function sendOrderConfirmationEmail({
  toEmail, customerName, orderNumber, items,
  subtotal, discountAmount, deliveryCharge, total, deliveryAddress
}) {
  const rows = items.map(i =>
    `<tr>
      <td style="padding:6px 4px;font-size:13px;color:#374151;">${i.name}</td>
      <td style="padding:6px 4px;text-align:center;font-size:13px;">×${i.quantity}</td>
      <td style="padding:6px 4px;text-align:right;font-size:13px;font-weight:600;">₹${Math.round(i.subtotal)}</td>
    </tr>`
  ).join('')

  const discountRow = discountAmount > 0
    ? `<tr>
        <td colspan="2" style="padding:6px 4px;font-size:13px;color:#16a34a;">Discount</td>
        <td style="text-align:right;font-size:13px;color:#16a34a;">−₹${Math.round(discountAmount)}</td>
       </tr>` : ''

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;background:#fff;">
      <div style="text-align:center;margin-bottom:20px;">
        <h2 style="color:#e85d04;margin:0;font-size:24px;">🍽️ FoodFi Cloud Kitchen</h2>
      </div>
      <p style="font-size:16px;color:#1f2937;">Namaste ${customerName || 'Customer'}! 🙏</p>
      <p style="color:#374151;">Aapka order confirm ho gaya hai. Neeche aapke order ki details hain:</p>
      <div style="background:#fff7ed;border-radius:10px;padding:14px 18px;margin:16px 0;">
        <p style="margin:0;font-size:15px;font-weight:700;color:#e85d04;">Order #${orderNumber}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">📍 ${deliveryAddress || ''}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <thead>
          <tr style="border-bottom:2px solid #f3f4f6;">
            <th style="text-align:left;padding:8px 4px;font-size:12px;color:#9ca3af;font-weight:600;">ITEM</th>
            <th style="text-align:center;padding:8px 4px;font-size:12px;color:#9ca3af;font-weight:600;">QTY</th>
            <th style="text-align:right;padding:8px 4px;font-size:12px;color:#9ca3af;font-weight:600;">AMOUNT</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="border-top:1px solid #f3f4f6;">
            <td colspan="2" style="padding:6px 4px;font-size:13px;color:#6b7280;">Subtotal</td>
            <td style="text-align:right;font-size:13px;">₹${Math.round(subtotal)}</td>
          </tr>
          ${discountRow}
          <tr>
            <td colspan="2" style="padding:6px 4px;font-size:13px;color:#6b7280;">Delivery Charge</td>
            <td style="text-align:right;font-size:13px;">₹${Math.round(deliveryCharge)}</td>
          </tr>
          <tr style="border-top:2px solid #f3f4f6;">
            <td colspan="2" style="padding:10px 4px;font-size:15px;font-weight:700;color:#1f2937;">TOTAL (Cash on Delivery)</td>
            <td style="text-align:right;font-size:15px;font-weight:700;color:#e85d04;">₹${Math.round(total)}</td>
          </tr>
        </tfoot>
      </table>
      <p style="color:#374151;font-size:13px;text-align:center;">Aapka order 30-45 minutes mein pahunch jayega. 🛵</p>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;">Shukriya aapke order ke liye! 🙏</p>
    </div>
  `

  await sendEmail({ to: toEmail, subject: `✅ Order Confirmed #${orderNumber} — FoodFi`, html })
}

// ── Order Cancellation ───────────────────────────────────────────
export async function sendOrderCancelEmail({ toEmail, customerName, orderNumber, total }) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;background:#fff;">
      <div style="text-align:center;margin-bottom:20px;">
        <h2 style="color:#e85d04;margin:0;font-size:24px;">🍽️ FoodFi Cloud Kitchen</h2>
      </div>
      <p style="font-size:16px;color:#1f2937;">Namaste ${customerName || 'Customer'}!</p>
      <div style="background:#fef2f2;border-radius:10px;padding:14px 18px;margin:16px 0;border-left:4px solid #dc2626;">
        <p style="margin:0;font-size:15px;font-weight:700;color:#dc2626;">❌ Order #${orderNumber} Cancel Ho Gaya</p>
        <p style="margin:6px 0 0;font-size:13px;color:#6b7280;">Amount: ₹${Math.round(total)}</p>
      </div>
      <p style="color:#374151;font-size:13px;">Aapka order successfully cancel ho gaya hai. Cash on Delivery tha isliye koi refund nahi hai.</p>
      <p style="color:#374151;font-size:13px;">Dubara order karne ke liye app visit karein.</p>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;">FoodFi Cloud Kitchen 🍽️</p>
    </div>
  `

  await sendEmail({ to: toEmail, subject: `❌ Order Cancelled #${orderNumber} — FoodFi`, html })
}

// ── New Customer Alert (to admin) ───────────────────────────────
export async function sendNewCustomerAlert({ customerName, email, phone, address }) {
  const adminEmail = process.env.ADMIN_ALERT_EMAIL
  if (!adminEmail) return

  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;background:#fff;">
      <div style="text-align:center;margin-bottom:16px;">
        <h2 style="color:#e85d04;margin:0;font-size:22px;">🍽️ FoodFi Cloud Kitchen</h2>
      </div>

      <div style="background:#f0fdf4;border-left:4px solid #16a34a;border-radius:10px;padding:14px 18px;margin-bottom:20px;">
        <p style="margin:0;font-size:16px;font-weight:700;color:#15803d;">🎉 Naya Customer Join Kiya!</p>
        <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">${now} (IST)</p>
      </div>

      <table style="width:100%;border-collapse:collapse;">
        <tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:10px 4px;font-size:13px;color:#6b7280;width:35%;">👤 Naam</td>
          <td style="padding:10px 4px;font-size:14px;font-weight:700;color:#1f2937;">${customerName || '—'}</td>
        </tr>
        <tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:10px 4px;font-size:13px;color:#6b7280;">📧 Email</td>
          <td style="padding:10px 4px;font-size:13px;color:#1f2937;">${email || '—'}</td>
        </tr>
        <tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:10px 4px;font-size:13px;color:#6b7280;">📱 Phone</td>
          <td style="padding:10px 4px;font-size:13px;color:#1f2937;">${phone || '—'}</td>
        </tr>
        <tr>
          <td style="padding:10px 4px;font-size:13px;color:#6b7280;">📍 Address</td>
          <td style="padding:10px 4px;font-size:13px;color:#1f2937;">${address || '—'}</td>
        </tr>
      </table>

      <div style="text-align:center;margin-top:24px;">
        <a href="https://foodfi.in/admin" style="background:#e85d04;color:#fff;padding:11px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
          🔐 Admin Panel Kholo
        </a>
      </div>
      <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:20px;">FoodFi Cloud Kitchen · foodfi.in</p>
    </div>
  `

  await sendEmail({ to: adminEmail, subject: `🎉 Naya Customer: ${customerName || 'Unknown'} — FoodFi`, html })
}

// ── Password Reset OTP ───────────────────────────────────────────
export async function sendPasswordResetOtp(toEmail, otp) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px;background:#fff;">
      <div style="text-align:center;margin-bottom:20px;">
        <h2 style="color:#e85d04;margin:0;font-size:22px;">🍽️ FoodFi Cloud Kitchen</h2>
      </div>
      <p style="font-size:15px;color:#1f2937;">Namaste! 🙏</p>
      <p style="color:#374151;font-size:13px;">Aapne password reset ki request ki hai. Neeche OTP use karein:</p>
      <div style="background:#fff7ed;border:2px dashed #f97316;border-radius:14px;padding:24px;text-align:center;margin:20px 0;">
        <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Your OTP</p>
        <div style="font-size:42px;font-weight:800;letter-spacing:12px;color:#e85d04;font-family:monospace;">${otp}</div>
        <p style="margin:10px 0 0;font-size:12px;color:#6b7280;">10 minutes mein expire ho jayega</p>
      </div>
      <p style="color:#6b7280;font-size:12px;">Agar aapne yeh request nahi ki toh is email ko ignore karein.</p>
      <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:20px;">FoodFi Cloud Kitchen 🍽️</p>
    </div>
  `

  await sendEmail({ to: toEmail, subject: `🔐 OTP: ${otp} — FoodFi Password Reset`, html })
}

// ── Password Reset Link (existing flow) ─────────────────────────
export async function sendPasswordResetLink(toEmail, resetLink) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h2 style="color:#e85d04;margin:0;font-size:22px;">🍽️ FoodFi</h2>
        <h3 style="color:#1e293b;margin:4px 0 0;font-size:18px;">Cloud Kitchen</h3>
      </div>
      <p style="font-size:16px;color:#1f2937;">Namaste! 🙏</p>
      <p style="color:#374151;">Aapne password reset request ki hai. Neeche button pe click karke naya password set karein:</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${resetLink}" style="background:#e85d04;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">
          🔑 Reset Password
        </a>
      </div>
      <p style="color:#6b7280;font-size:13px;">Yeh link <strong>1 ghante</strong> mein expire ho jayega.</p>
      <p style="color:#6b7280;font-size:13px;">Agar aapne yeh request nahi ki, toh is email ko ignore karein.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
      <p style="color:#9ca3af;font-size:12px;text-align:center;">FoodFi &bull; foodfi.in</p>
    </div>
  `

  await sendEmail({ to: toEmail, subject: '🔐 Password Reset - FoodFi Cloud Kitchen', html })
}
