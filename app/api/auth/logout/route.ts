import { NextResponse } from 'next/server'
import { serialize } from 'cookie'

export async function POST() {
  try {
    const cookie = serialize('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: -1,
      path: '/',
    })

    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    })

    response.headers.set('Set-Cookie', cookie)
    return response

  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { success: false, message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}