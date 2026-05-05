const { neon } = require('@neondatabase/serverless')
require('dotenv').config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL)

async function run() {
  await sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(150) NOT NULL,
      token UUID DEFAULT gen_random_uuid(),
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  console.log('✅ password_reset_tokens table ready')
  process.exit(0)
}

run().catch(err => { console.error('❌', err.message); process.exit(1) })
