import { neon } from '@neondatabase/serverless'

// Singleton connection
let sql

export function getDb() {
  if (!sql) {
    // fetchOptions: cache:'no-store' prevents Next.js App Router from caching
    // Neon's internal fetch() calls, which would serve stale DB results
    sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } })
  }
  return sql
}
