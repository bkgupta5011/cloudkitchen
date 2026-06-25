export const metadata = {
  title: 'Delete Your Account | FoodFi',
  description: 'How to request deletion of your FoodFi account and associated data.',
  alternates: { canonical: 'https://foodfi.in/delete-account' },
}

const UPDATED = '25 June 2026'

export default function DeleteAccount() {
  return (
    <div style={{ minHeight: '100vh', background: '#faf9f7' }}>
      <div style={{ background: 'linear-gradient(135deg,#7c2d12,#ea580c)', color: '#fff', padding: '34px 20px 28px', textAlign: 'center' }}>
        <div style={{ fontSize: 26, fontWeight: 800 }}>🗑️ Delete Your Account</div>
        <div style={{ fontSize: 13, opacity: 0.92, marginTop: 6 }}>FoodFi — account & data deletion</div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '26px 18px 70px', color: '#3f3a36', fontSize: 15, lineHeight: 1.7 }}>
        <p style={{ color: '#78716c', fontSize: 13 }}>Last updated: {UPDATED}</p>

        <p>
          This page explains how to request deletion of your <b>FoodFi</b> account and the personal
          data associated with it. FoodFi is operated for the FoodFi Cloud Kitchen
          (<a href="https://foodfi.in" style={linkStyle}>foodfi.in</a>).
        </p>

        <Section title="How to request account deletion">
          <p>To delete your FoodFi account and associated data, follow these steps:</p>
          <ol style={olStyle}>
            <li>Send an email to <a href="mailto:bkgupta5011@gmail.com" style={linkStyle}>bkgupta5011@gmail.com</a> from any email, with the subject <b>&quot;Delete my FoodFi account&quot;</b>.</li>
            <li>In the email, include the <b>registered mobile number</b> (and email, if any) used for your FoodFi account, so we can identify it.</li>
            <li>We will verify the request and delete your account. You will receive a confirmation once it is done.</li>
          </ol>
          <p>Your request will be processed within <b>7 working days</b>.</p>
        </Section>

        <Section title="What data is deleted">
          <ul style={ulStyle}>
            <li>Your account profile — name, phone number, email address, and saved delivery addresses.</li>
            <li>Your saved location coordinates.</li>
            <li>Your login credentials.</li>
            <li>Push-notification tokens linked to your account.</li>
          </ul>
        </Section>

        <Section title="What data may be kept (and for how long)">
          <p>
            For legal, tax, and accounting reasons, basic <b>order and transaction records</b>
            (such as order number, items, and amount) may be retained for up to <b>5 years</b> as
            required by Indian law, after which they are deleted. These records are kept separate
            from your deleted account profile and are not used to contact you.
          </p>
        </Section>

        <Section title="Need help?">
          <p>
            For any questions about deleting your account or data, contact us:<br />
            📧 <a href="mailto:bkgupta5011@gmail.com" style={linkStyle}>bkgupta5011@gmail.com</a><br />
            📞 +91 75469 83536
          </p>
        </Section>

        <p style={{ marginTop: 28, fontSize: 13, color: '#78716c' }}>
          हिंदी: अपना FoodFi अकाउंट और डेटा हटाने के लिए ऊपर दिए ईमेल
          (bkgupta5011@gmail.com) पर &quot;Delete my FoodFi account&quot; विषय के साथ अपना रजिस्टर्ड
          मोबाइल नंबर भेजें। 7 कार्यदिवस में अकाउंट हटा दिया जाएगा।
        </p>
      </div>
    </div>
  )
}

const linkStyle = { color: '#ea580c', textDecoration: 'underline', fontWeight: 600 }
const ulStyle = { margin: '8px 0', paddingLeft: 22, display: 'grid', gap: 6 }
const olStyle = { margin: '8px 0', paddingLeft: 22, display: 'grid', gap: 8 }

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 26 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: '#7c2d12', marginBottom: 8 }}>{title}</h2>
      {children}
    </div>
  )
}
