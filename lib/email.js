import nodemailer from 'nodemailer'

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })
}

export async function sendOrderConfirmationEmail({
  toEmail, customerName, orderNumber, items,
  subtotal, discountAmount, deliveryCharge, total, deliveryAddress
}) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD ||
      process.env.GMAIL_USER === 'your_gmail@gmail.com') return

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

  const transporter = getTransporter()
  await transporter.sendMail({
    from: `"FoodFi Cloud Kitchen" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: `✅ Order Confirmed #${orderNumber} — FoodFi`,
    html,
  })
}

export async function sendPasswordResetOtp(toEmail, otp) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD ||
      process.env.GMAIL_USER === 'your_gmail@gmail.com') return

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

  const transporter = getTransporter()
  await transporter.sendMail({
    from: `"FoodFi Cloud Kitchen" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: `🔐 OTP: ${otp} — FoodFi Password Reset`,
    html,
  })
}

export async function sendOrderCancelEmail({ toEmail, customerName, orderNumber, total }) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD ||
      process.env.GMAIL_USER === 'your_gmail@gmail.com') return

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

  const transporter = getTransporter()
  await transporter.sendMail({
    from: `"FoodFi Cloud Kitchen" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: `❌ Order Cancelled #${orderNumber} — FoodFi`,
    html,
  })
}
