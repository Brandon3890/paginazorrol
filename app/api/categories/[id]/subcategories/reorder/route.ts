import { NextRequest, NextResponse } from 'next/server'
import pool, { queryRows } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // ← Nota: params es una Promise
) {
  console.log('=== REORDER SUBCATEGORIES API CALLED ===')
  
  try {
    // ✅ CORRECCIÓN: Esperar a que params se resuelva
    const { id } = await params
    const categoryId = parseInt(id)
    
    if (isNaN(categoryId)) {
      return NextResponse.json(
        { error: 'Invalid category ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const orderedIds = body.ordered_ids || body.orderedIds

    if (!Array.isArray(orderedIds)) {
      return NextResponse.json(
        { error: 'ordered_ids must be an array' },
        { status: 400 }
      )
    }

    console.log('Subcategory IDs to reorder:', orderedIds)

    const connection = await pool.getConnection()
    
    try {
      await connection.beginTransaction()

      // Actualizar display_order de cada subcategoría
      for (let i = 0; i < orderedIds.length; i++) {
        const subcategoryId = orderedIds[i]
        console.log(`Updating subcategory ${subcategoryId} with display_order ${i}`)
        
        const [result]: any = await connection.execute(
          'UPDATE subcategories SET display_order = ?, updated_at = NOW() WHERE id = ? AND category_id = ?',
          [i, subcategoryId, categoryId]
        )

        if (result.affectedRows === 0) {
          throw new Error(`Subcategoría ${subcategoryId} no encontrada o no pertenece a la categoría`)
        }
      }

      await connection.commit()
      console.log('Transaction committed')
      
      return NextResponse.json({ 
        success: true,
        message: 'Subcategorías reordenadas correctamente' 
      })

    } catch (error) {
      await connection.rollback()
      console.error('Error during transaction:', error)
      throw error
    } finally {
      connection.release()
    }

  } catch (error) {
    console.error('Fatal error:', error)
    return NextResponse.json(
      { error: 'Error al reordenar las subcategorías' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}