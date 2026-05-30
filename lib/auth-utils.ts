import { jwtVerify } from 'jose'
import { NextRequest } from 'next/server'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

export async function getUserIdFromRequest(request: NextRequest): Promise<number | null> {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value

    if (!token) {
      console.log('No token found in request')
      return null
    }

    const { payload } = await jwtVerify(token, JWT_SECRET)
    
    if (!payload.userId) {
      console.log('No user Id in token payload')
      return null
    }

    const userId = Number(payload.userId)
    return userId

  } catch (error) {
    console.error('Error verifying token:', error)
    return null
  }
}