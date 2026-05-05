import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'

const SECRET = process.env.JWT_SECRET

// ── Password ──────────────────────────────────────────────────────
export async function hashPassword(password) {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash)
}

// ── JWT ───────────────────────────────────────────────────────────
export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' })
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET)
  } catch {
    return null
  }
}

// ── Get current user from cookie ──────────────────────────────────
export function getCurrentUser() {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get('ck_token')?.value
    if (!token) return null
    return verifyToken(token)
  } catch {
    return null
  }
}

// ── Set auth cookie ───────────────────────────────────────────────
export function setAuthCookie(response, token) {
  response.cookies.set('ck_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/'
  })
}
