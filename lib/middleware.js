import { NextResponse } from 'next/server'
import { verifyToken } from './auth'

export function withAuth(handler, allowedRoles = []) {
  return async (request, context) => {
    const token = request.cookies.get('ck_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    request.user = user
    return handler(request, context)
  }
}

export function apiResponse(data, status = 200) {
  return NextResponse.json(data, { status })
}

export function apiError(message, status = 400) {
  return NextResponse.json({ error: message }, { status })
}
