import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { query } from '@/lib/db'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ valid: false }, { status: 401 })
    }

    const { payload } = await jwtVerify(token, JWT_SECRET)
    
    const users = await query(
      'SELECT * FROM users WHERE id = ? AND is_active = 1',
      [payload.userId]
    ) as any[]

    if (!users || users.length === 0) {
      return NextResponse.json({ valid: false }, { status: 401 })
    }

    const user = users[0]

    return NextResponse.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
      }
    })

  } catch (error) {
    console.error('Token verification error:', error)
    return NextResponse.json({ valid: false }, { status: 401 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ valid: false, error: 'Token no proporcionado' }, { status: 401 })
    }

    const { payload } = await jwtVerify(token, JWT_SECRET)
    
    return NextResponse.json({
      valid: true,
      user: {
        id: Number(payload.userId),
        email: payload.email,
        firstName: payload.firstName,
        lastName: payload.lastName,
        role: payload.role
      }
    })
  } catch (error) {
    console.error('Error verifying token:', error)
    return NextResponse.json({ valid: false, error: 'Token inválido' }, { status: 401 })
  }
}