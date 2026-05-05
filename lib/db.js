import { neon } from '@neondatabase/serverless'

// Singleton connection
let sql

export function getDb() {
  if (!sql) {
    sql = neon(process.env.DATABASE_URL)
  }
  return sql
}
