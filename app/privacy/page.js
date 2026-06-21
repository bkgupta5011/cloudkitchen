export const metadata = {
  title: 'Privacy Policy | FoodFi',
  description: 'How FoodFi collects, uses, and protects your personal information.',
  alternates: { canonical: 'https://foodfi.in/privacy' },
}

const UPDATED = '22 June 2026'

export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: '100vh', background: '#faf9f7' }}>
      <div style={{ background: 'linear-gradient(135deg,#7c2d12,#ea580c)', color: '#fff', padding: '34px 20px 28px', textAlign: 'center' }}>
        <div style={{ fontSize: 27, fontWeight: 800 }}>🔒 Privacy Policy</div>
        <div style={{ fontSize: 13, opacity: 0.92, marginTop: 6 }}>FoodFi — your data, kept safe 🧡</div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '26px 18px 70px', color: '#3f3a36', fontSize: 15, lineHeight: 1.7 }}>
        <p style={{ color: '#78716c', fontSize: 13 }}>Last updated: {UPDATED}</p>

        <p>
          FoodFi (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the FoodFi website
          (<a href="https://foodfi.in" style={linkStyle}>foodfi.in</a>) and the FoodFi mobile
          application (together, the &quot;Service&quot;). This Privacy Policy explains what
          information we collect, how we use it, and the choices you have. By using the Service
          you agree to this policy.
        </p>

        <Section title="1. Information We Collect">
          <p>We collect the following information so we can take and deliver your food orders:</p>
          <ul style={ulStyle}>
            <li><b>Account details</b> — your name, phone number, and (optionally) email address.</li>
            <li><b>Delivery details</b> — your delivery address and, with your permission, your
              current location (GPS) to help you select an accurate delivery point.</li>
            <li><b>Order information</b> — items ordered, order history, and amounts.</li>
            <li><b>Delivery partner details</b> (for delivery partners only) — name, phone, vehicle
              number, and documents submitted during registration.</li>
            <li><b>Device &amp; notification data</b> — a push-notification token and basic device
              information used to send you order updates and offers.</li>
          </ul>
          <p>We do <b>not</b> collect or store your card, bank, or UPI credentials. Payments are
            handled at delivery (Cash on Delivery) or through trusted payment providers.</p>
        </Section>

        <Section title="2. How We Use Your Information">
          <ul style={ulStyle}>
            <li>To create and manage your account and log you in.</li>
            <li>To process, prepare, and deliver your orders.</li>
            <li>To show your current location on the map for accurate delivery.</li>
            <li>To send order status updates and, occasionally, offers via push notification.</li>
            <li>To verify your phone number using a one-time password (OTP).</li>
            <li>To provide customer support and improve the Service.</li>
          </ul>
        </Section>

        <Section title="3. Location Permission">
          <p>
            The app requests location access <b>only</b> when you choose &quot;use current
            location&quot; while placing an order. This helps fill your delivery address
            accurately. You can deny or revoke this permission at any time in your phone
            settings — the app will still work and you can enter your address manually.
          </p>
        </Section>

        <Section title="4. Notification Permission">
          <p>
            With your permission, we send push notifications about your orders and offers. You can
            turn notifications off anytime from your phone settings.
          </p>
        </Section>

        <Section title="5. How We Share Information">
          <p>We do not sell your personal data. We share information only with:</p>
          <ul style={ulStyle}>
            <li><b>Delivery partners</b> — your name, address, and phone, so your order can be delivered.</li>
            <li><b>Service providers</b> that help us run the Service, including:
              <ul style={ulStyle}>
                <li>Google Firebase — push notifications and phone-number verification.</li>
                <li>SMS/OTP providers (e.g. 2Factor, Twilio) — to send verification codes.</li>
                <li>Hosting &amp; database providers (e.g. Vercel, Neon) — to run the website securely.</li>
              </ul>
            </li>
            <li><b>Legal reasons</b> — if required by law or to protect our rights and users.</li>
          </ul>
        </Section>

        <Section title="6. Data Security">
          <p>
            We protect your account with secure password hashing and encrypted connections (HTTPS).
            Login sessions are stored using secure, HTTP-only cookies. While we take reasonable
            steps to protect your data, no method of transmission over the internet is 100% secure.
          </p>
        </Section>

        <Section title="7. Data Retention">
          <p>
            We keep your information for as long as your account is active or as needed to provide
            the Service and meet legal obligations. You can ask us to delete your account and data
            at any time (see Contact below).
          </p>
        </Section>

        <Section title="8. Your Rights">
          <ul style={ulStyle}>
            <li>Access or update your account information from your profile.</li>
            <li>Request a copy or deletion of your data by contacting us.</li>
            <li>Revoke location and notification permissions from your phone settings.</li>
          </ul>
        </Section>

        <Section title="9. Children">
          <p>The Service is not directed to children under 13, and we do not knowingly collect their data.</p>
        </Section>

        <Section title="10. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. The &quot;Last updated&quot; date
            above shows the latest revision. Continued use of the Service means you accept the
            updated policy.
          </p>
        </Section>

        <Section title="11. Contact Us">
          <p>
            For any questions, data requests, or account deletion, contact us at:<br />
            📧 <a href="mailto:csakassociates@gmail.com" style={linkStyle}>csakassociates@gmail.com</a><br />
            📞 +91 75469 83536<br />
            🏠 FoodFi, East Laxmi Nagar, Patna, Bihar, India
          </p>
        </Section>

        <p style={{ marginTop: 30, fontSize: 13, color: '#78716c' }}>
          हिंदी: हम आपका नाम, फ़ोन, पता और (अनुमति से) लोकेशन सिर्फ़ ऑर्डर डिलीवरी के लिए लेते हैं।
          आपका डेटा बेचा नहीं जाता। अकाउंट या डेटा हटाने के लिए ऊपर दिए ईमेल पर संपर्क करें।
        </p>
      </div>
    </div>
  )
}

const linkStyle = { color: '#ea580c', textDecoration: 'underline', fontWeight: 600 }
const ulStyle = { margin: '8px 0', paddingLeft: 22, display: 'grid', gap: 6 }

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 26 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: '#7c2d12', marginBottom: 8 }}>{title}</h2>
      {children}
    </div>
  )
}
