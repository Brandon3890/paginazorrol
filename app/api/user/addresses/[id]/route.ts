// app/api/user/addresses/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const resolvedParams = await params
    const addressId = parseInt(resolvedParams.id)

    const addresses = await query(
      `SELECT * FROM user_addresses WHERE id = ? AND user_id = ?`,
      [addressId, userId]
    )

    if ((addresses as any[]).length === 0) {
      return NextResponse.json({ error: 'Dirección no encontrada' }, { status: 404 })
    }

    const address = (addresses as any[])[0]
    
    const formattedAddress = {
      id: address.id,
      title: address.title,
      street: address.street,
      hasNoNumber: Boolean(address.has_no_number),
      regionIso: address.region_iso,
      regionName: address.region_name,
      communeName: address.commune_name,
      postalCode: address.postal_code,
      department: address.department,
      deliveryInstructions: address.delivery_instructions,
      isDefault: Boolean(address.is_default),
      createdAt: address.created_at,
      updatedAt: address.updated_at
    }

    return NextResponse.json(formattedAddress)
  } catch (error) {
    console.error('Error fetching address:', error)
    return NextResponse.json(
      { error: 'Error al obtener la dirección' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const resolvedParams = await params
    const addressId = parseInt(resolvedParams.id)

    const existingAddresses = await query(
      `SELECT * FROM user_addresses WHERE id = ? AND user_id = ?`,
      [addressId, userId]
    )

    if ((existingAddresses as any[]).length === 0) {
      return NextResponse.json({ error: 'Dirección no encontrada' }, { status: 404 })
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

    if (!title || !street || !regionIso || !communeName) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    if (isDefault) {
      await query(
        `UPDATE user_addresses SET is_default = FALSE WHERE user_id = ?`,
        [userId]
      )
    }

    await query(
      `UPDATE user_addresses SET 
        title = ?,
        street = ?,
        has_no_number = ?,
        region_iso = ?,
        region_name = ?,
        commune_name = ?,
        postal_code = ?,
        department = ?,
        delivery_instructions = ?,
        is_default = ?,
        updated_at = NOW()
      WHERE id = ? AND user_id = ?`,
      [
        title,
        street,
        hasNoNumber ? 1 : 0,
        regionIso,
        regionName,
        communeName,
        postalCode,
        department,
        deliveryInstructions,
        isDefault ? 1 : 0,
        addressId,
        userId
      ]
    )

    const updatedAddresses = await query(
      `SELECT * FROM user_addresses WHERE id = ?`,
      [addressId]
    )

    const updatedAddress = (updatedAddresses as any[])[0]
    
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
    console.error('Error updating address:', error)
    return NextResponse.json(
      { error: 'Error al actualizar la dirección' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const resolvedParams = await params
    const addressId = parseInt(resolvedParams.id)

    const existingAddresses = await query(
      `SELECT * FROM user_addresses WHERE id = ? AND user_id = ?`,
      [addressId, userId]
    )

    if ((existingAddresses as any[]).length === 0) {
      return NextResponse.json({ error: 'Dirección no encontrada' }, { status: 404 })
    }

    const address = (existingAddresses as any[])[0]

    await query(
      `DELETE FROM user_addresses WHERE id = ? AND user_id = ?`,
      [addressId, userId]
    )

    if (address.is_default) {
      const remainingAddresses = await query(
        `SELECT id FROM user_addresses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
        [userId]
      )

      if ((remainingAddresses as any[]).length > 0) {
        const newDefaultId = (remainingAddresses as any[])[0].id
        await query(
          `UPDATE user_addresses SET is_default = TRUE WHERE id = ?`,
          [newDefaultId]
        )
      }
    }

    return NextResponse.json(
      { message: 'Dirección eliminada correctamente' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting address:', error)
    return NextResponse.json(
      { error: 'Error al eliminar la dirección' },
      { status: 500 }
    )
  }
}