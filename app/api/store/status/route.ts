// app/api/store/status/route.ts
import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET() {
  try {
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
      { storeOpen: true, maintenanceMessage: 'La tienda está en mantenimiento' },
      { status: 500 }
    )
  }
}