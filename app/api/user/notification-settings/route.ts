import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import jwt from 'jsonwebtoken'

// Función para verificar el token manualmente
async function verifyToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('No hay token o formato incorrecto')
    return null
  }

  const token = authHeader.split(' ')[1]
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any
    console.log('Token verificado')
    return decoded
  } catch (error) {
    console.error('Error verificando token:', error)
    return null
  }
}

// Función para obtener el ID del usuario desde el token
async function getUserIdFromToken(request: NextRequest): Promise<number | null> {
  const decoded = await verifyToken(request)
  
  if (!decoded) {
    return null
  }
  
  // Si tiene id directamente
  if (decoded.id) {
    return decoded.id
  }
  
  // Si tiene email, buscar el usuario
  if (decoded.email) {
    const results = await query(
      'SELECT id FROM users WHERE email = ? AND is_active = 1',
      [decoded.email]
    ) as any[]
    
    if (results.length > 0) {
      console.log('Usuario encontrado')
      return results[0].id
    }
  }
  
  console.log('No se pudo obtener el ID del usuario')
  return null
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromToken(request)
    
    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const results = await query(
      `SELECT favorite_price_drop FROM user_notification_settings WHERE user_id = ?`,
      [userId]
    ) as any[]

    if (results.length === 0) {
      await query(
        `INSERT INTO user_notification_settings (user_id, favorite_price_drop) VALUES (?, true)`,
        [userId]
      )
      return NextResponse.json({ favoritePriceDrop: true })
    }

    return NextResponse.json({
      favoritePriceDrop: results[0].favorite_price_drop === 1
    })
  } catch (error) {
    console.error('Error GET notification settings:', error)
    return NextResponse.json(
      { error: 'Error al obtener configuración' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserIdFromToken(request)
    
    if (!userId) {
      console.log('No se pudo obtener el ID del usuario')
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    console.log(' User ID from token')
    
    const body = await request.json()
    const { favoritePriceDrop } = body

    await query(
      `INSERT INTO user_notification_settings 
       (user_id, favorite_price_drop, updated_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE
       favorite_price_drop = VALUES(favorite_price_drop),
       updated_at = NOW()`,
      [userId, favoritePriceDrop]
    )

    return NextResponse.json({
      success: true,
      message: 'Configuración actualizada'
    })
  } catch (error) {
    console.error('Error PUT notification settings:', error)
    return NextResponse.json(
      { error: 'Error al guardar configuración' },
      { status: 500 }
    )
  }
}