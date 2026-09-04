// app/api/apigateway/consultar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { consultarEstadoBoleta, obtenerFechaEmisionSII } from '@/lib/apigateway-service';

/**
 * Formatear fecha a YYYY-MM-DD
 */
function formatearFecha(fecha: string | Date): string {
  if (!fecha) {
    return new Date().toISOString().split('T')[0];
  }
  
  if (typeof fecha === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return fecha;
    }
    if (fecha.includes(' ')) {
      return fecha.split(' ')[0];
    }
    if (fecha.includes('T')) {
      return fecha.split('T')[0];
    }
    if (fecha.includes('Z')) {
      return fecha.replace('Z', '').split('T')[0];
    }
    try {
      const parsed = new Date(fecha);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    } catch (e) {
      return new Date().toISOString().split('T')[0];
    }
    return fecha;
  }
  
  if (fecha instanceof Date) {
    return fecha.toISOString().split('T')[0];
  }
  
  return new Date().toISOString().split('T')[0];
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const folio = searchParams.get('folio');

    if (!folio) {
      return NextResponse.json(
        { error: 'Se requiere el folio de la boleta' },
        { status: 400 }
      );
    }

    // Obtener la fecha de emisión de la BD
    const boletas = await query(
      `SELECT folio, fecha_emision FROM boletas WHERE folio = ?`,
      [folio]
    ) as any[];

    if (boletas.length === 0) {
      return NextResponse.json(
        { error: 'Boleta no encontrada en la base de datos' },
        { status: 404 }
      );
    }

    //  Formatear fecha correctamente
    let fechaEmision = boletas[0].fecha_emision;
    const fechaFormateada = formatearFecha(fechaEmision);

    console.log(' Consultando estado de boleta ');

    //  Usar consultarEstadoBoleta
    const resultado = await consultarEstadoBoleta(
      Number(folio),
      fechaFormateada
    );

    // También podemos intentar obtener la fecha real del SII
    const fechaSII = await obtenerFechaEmisionSII(Number(folio));
    if (fechaSII && fechaSII !== fechaFormateada) {
      
      // Actualizar la fecha en la BD si es diferente
      try {
        await query(
          `UPDATE boletas SET fecha_emision = ? WHERE folio = ?`,
          [fechaSII, folio]
        );
      } catch (updateError) {
        console.warn(' No se pudo actualizar la fecha');
      }
    }

    return NextResponse.json({
      success: true,
      data: resultado,
      fecha_usada: fechaFormateada
    });

  } catch (error: any) {
    console.error(' Error consultando boleta:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error al consultar' },
      { status: 500 }
    );
  }
}