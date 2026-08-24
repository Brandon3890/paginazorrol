// app/api/admin/store/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth-utils'

export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar que el usuario es admin
    const users = await query(
      `SELECT role FROM users WHERE id = ?`,
      [userId]
    ) as any[]

    const user = users.length > 0 ? users[0] : null
    
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'No tienes permisos' }, { status: 403 })
    }

    const body = await request.json()
    const { storeOpen, maintenanceMessage } = body

    // Actualizar store_open
    await query(
      `INSERT INTO store_settings (setting_key, setting_value) 
       VALUES ('store_open', ?) 
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [storeOpen ? 'true' : 'false']
    )

    // Actualizar mensaje de mantenimiento si se proporciona
    if (maintenanceMessage) {
      await query(
        `INSERT INTO store_settings (setting_key, setting_value) 
         VALUES ('store_maintenance_message', ?) 
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [maintenanceMessage]
      )
    }

    return NextResponse.json({ 
      success: true, 
      storeOpen,
      message: storeOpen ? 'Tienda abierta' : 'Tienda cerrada por mantenimiento'
    })

  } catch (error) {
    console.error('Error updating store status:', error)
    return NextResponse.json(
      { error: 'Error al actualizar el estado de la tienda' },
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

    const users = await query(
      `SELECT role FROM users WHERE id = ?`,
      [userId]
    ) as any[]

    const user = users.length > 0 ? users[0] : null
    
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'No tienes permisos' }, { status: 403 })
    }

    const results = await query(
      `SELECT setting_key, setting_value FROM store_settings 
       WHERE setting_key IN ('store_open', 'store_maintenance_message')`
    ) as any[]

    const settings: Record<string, string> = {}
    results.forEach((row: any) => {
      settings[row.setting_key] = row.setting_value
    })

    return NextResponse.json({
      storeOpen: settings.store_open === 'true',
      maintenanceMessage: settings.store_maintenance_message || 'La tienda está en mantenimiento. Por favor, vuelve más tarde.'
    })

  } catch (error) {
    console.error('Error fetching store status:', error)
    return NextResponse.json(
      { error: 'Error al obtener el estado de la tienda' },
      { status: 500 }
    )
  }
}