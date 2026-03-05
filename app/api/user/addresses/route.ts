import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  
  try {
    const userId = await getUserIdFromRequest(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    
    const {
      title,
      street,
      hasNoNumber = false,
      regionIso,
      regionName,
      communeName,
      postalCode = '',
      department = '',
      deliveryInstructions = '',
      isDefault = false
    } = body

    // Validar campos requeridos
    if (!title || !street || !regionIso || !communeName) {
      return NextResponse.json(
        { 
          error: 'Faltan campos requeridos',
          details: {
            title: !title ? 'Requerido' : 'OK',
            street: !street ? 'Requerido' : 'OK', 
            regionIso: !regionIso ? 'Requerido' : 'OK',
            communeName: !communeName ? 'Requerido' : 'OK'
          }
        },
        { status: 400 }
      )
    }


    // Si esta dirección será la predeterminada, quitar predeterminada de las demás
    if (isDefault) {
      await query(
        `UPDATE user_addresses SET is_default = FALSE WHERE user_id = ?`,
        [userId]
      )
    }

    // Verificar si el usuario ya tiene direcciones para determinar si esta debe ser predeterminada
    const existingAddresses = await query(
      `SELECT COUNT(*) as count FROM user_addresses WHERE user_id = ?`,
      [userId]
    )
    
    const addressCount = (existingAddresses as any)[0].count
    const shouldBeDefault = isDefault || addressCount === 0
    

    const result = await query(
      `INSERT INTO user_addresses (
        user_id, title, street, has_no_number, region_iso, region_name, 
        commune_name, postal_code, department, delivery_instructions, is_default
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        title,
        street,
        hasNoNumber ? 1 : 0,
        regionIso,
        regionName,
        communeName,
        postalCode,
        department,
        deliveryInstructions,
        shouldBeDefault ? 1 : 0
      ]
    )


    const newAddressResult = await query(
      `SELECT * FROM user_addresses WHERE id = ?`,
      [(result as any).insertId]
    )

    const newAddress = (newAddressResult as any)[0]
    
    // Mapear los nombres de campos de la base de datos al formato esperado por el frontend
    const formattedAddress = {
      id: newAddress.id,
      title: newAddress.title,
      street: newAddress.street,
      hasNoNumber: Boolean(newAddress.has_no_number),
      regionIso: newAddress.region_iso,
      regionName: newAddress.region_name,
      communeName: newAddress.commune_name,
      postalCode: newAddress.postal_code,
      department: newAddress.department,
      deliveryInstructions: newAddress.delivery_instructions,
      isDefault: Boolean(newAddress.is_default),
      createdAt: newAddress.created_at,
      updatedAt: newAddress.updated_at
    }


    return NextResponse.json(formattedAddress)
  } catch (error) {
    console.error('💥 Error creating address:', error)
    return NextResponse.json(
      { 
        error: 'Error interno del servidor al crear la dirección',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const addresses = await query(
      `SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC`,
      [userId]
    )

    // Mapear los resultados al formato esperado por el frontend
    const formattedAddresses = (addresses as any[]).map(addr => ({
      id: addr.id,
      title: addr.title,
      street: addr.street,
      hasNoNumber: Boolean(addr.has_no_number),
      regionIso: addr.region_iso,
      regionName: addr.region_name,
      communeName: addr.commune_name,
      postalCode: addr.postal_code,
      department: addr.department,
      deliveryInstructions: addr.delivery_instructions,
      isDefault: Boolean(addr.is_default),
      createdAt: addr.created_at,
      updatedAt: addr.updated_at
    }))

    return NextResponse.json(formattedAddresses)
  } catch (error) {
    console.error('Error fetching addresses:', error)
    return NextResponse.json(
      { error: 'Error al obtener las direcciones' },
      { status: 500 }
    )
  }
}