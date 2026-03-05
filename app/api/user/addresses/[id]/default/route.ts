import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth-utils'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromRequest(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const addressId = parseInt(params.id)

    // Verificar que la dirección pertenece al usuario
    const existingAddresses = await query(
      `SELECT * FROM user_addresses WHERE id = ? AND user_id = ?`,
      [addressId, userId]
    )

    if ((existingAddresses as any).length === 0) {
      return NextResponse.json({ error: 'Dirección no encontrada' }, { status: 404 })
    }

    // Quitar predeterminada de todas las direcciones
    await query(
      `UPDATE user_addresses SET is_default = FALSE WHERE user_id = ?`,
      [userId]
    )

    // Establecer esta dirección como predeterminada
    await query(
      `UPDATE user_addresses SET is_default = TRUE WHERE id = ? AND user_id = ?`,
      [addressId, userId]
    )

    const updatedAddressResult = await query(
      `SELECT * FROM user_addresses WHERE id = ?`,
      [addressId]
    )

    const updatedAddress = (updatedAddressResult as any)[0]
    
    const formattedAddress = {
      id: updatedAddress.id,
      title: updatedAddress.title,
      street: updatedAddress.street,
      hasNoNumber: Boolean(updatedAddress.has_no_number),
      regionIso: updatedAddress.region_iso,
      regionName: updatedAddress.region_name,
      communeName: updatedAddress.commune_name,
      postalCode: updatedAddress.postal_code,
      department: updatedAddress.department,
      deliveryInstructions: updatedAddress.delivery_instructions,
      isDefault: Boolean(updatedAddress.is_default),
      createdAt: updatedAddress.created_at,
      updatedAt: updatedAddress.updated_at
    }

    return NextResponse.json(formattedAddress)
  } catch (error) {
    console.error('Error setting default address:', error)
    return NextResponse.json(
      { error: 'Error al establecer dirección predeterminada' },
      { status: 500 }
    )
  }
}