// app/api/apigateway/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerPDFApiGateway, obtenerFechaEmisionSII } from '@/lib/apigateway-service';

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
    const orderId = searchParams.get('orderId');

    if (!folio && !orderId) {
      return NextResponse.json(
        { error: 'Se requiere folio o orderId' },
        { status: 400 }
      );
    }

    let folioNumero: string | number | null = folio;
    let fechaEmision: string | null = null;

    // Si se pasa orderId, obtener el folio y la fecha de emisión de la BD
    if (orderId && !folio) {
      const boletas = await query(
        `SELECT folio, fecha_emision FROM boletas WHERE order_id = ?`,
        [orderId]
      ) as any[];

      if (boletas.length === 0) {
        return NextResponse.json(
          { error: 'No se encontró boleta para esta orden' },
          { status: 404 }
        );
      }
      folioNumero = boletas[0].folio;
      fechaEmision = boletas[0].fecha_emision;
    } else if (folio) {
      const boletas = await query(
        `SELECT folio, fecha_emision FROM boletas WHERE folio = ?`,
        [folio]
      ) as any[];

      if (boletas.length > 0) {
        fechaEmision = boletas[0].fecha_emision;
      }
    }

    if (!folioNumero) {
      return NextResponse.json(
        { error: 'No se pudo determinar el folio' },
        { status: 400 }
      );
    }

    // PRIMERO: Intentar obtener la fecha desde la BD
    let fechaFormateada: string;
    
    if (fechaEmision) {
      // Usar la fecha de la BD
      fechaFormateada = formatearFecha(fechaEmision);
      console.log('Usando fecha desde:', fechaFormateada);
    } else {
      // Si no hay fecha en BD, usar fecha actual
      fechaFormateada = new Date().toISOString().split('T')[0];
      console.log(' Usando fecha actual:', fechaFormateada);
    }

    // SEGUNDO: Intentar obtener la fecha real del SII
    console.log(`Buscando fecha real de la boleta en SII`);
    const fechaSII = await obtenerFechaEmisionSII(folioNumero);

    if (fechaSII) {
      // Usar la fecha del SII (es la correcta)
      fechaFormateada = fechaSII;
      console.log(`Usando fecha del SII: ${fechaFormateada}`);
      
      // Actualizar la fecha en la BD para futuras consultas
      try {
        await query(
          `UPDATE boletas SET fecha_emision = ? WHERE folio = ?`,
          [fechaSII, folioNumero]
        );
        console.log(`Fecha actualizada en : ${fechaSII}`);
      } catch (updateError) {
        console.warn(' No se pudo actualizar la fecha');
      }
    } else {
      console.log(` No se encontró la boleta en el SII, usando fecha de : ${fechaFormateada}`);
    }

    const pdfBuffer = await obtenerPDFApiGateway(
      folioNumero,
      fechaFormateada,
      39
    );

    const pdfUint8Array = new Uint8Array(pdfBuffer);

    return new Response(pdfUint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="boleta-${folioNumero}.pdf"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Length': pdfBuffer.length.toString()
      }
    });

  } catch (error: any) {
    console.error(' Error en pdf route:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener PDF' },
      { status: 500 }
    );
  }
}