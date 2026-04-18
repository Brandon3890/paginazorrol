// app/api/simplefactura/pdf/route.ts - Versión CORREGIDA
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerPDFSimpleFactura } from '@/lib/simplefactura-service';

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

    if (orderId && !folio) {
      const boletas = await query(
        `SELECT folio FROM boletas WHERE order_id = ?`,
        [orderId]
      ) as any[];
      
      if (boletas.length === 0) {
        return NextResponse.json(
          { error: 'No se encontró boleta para esta orden' },
          { status: 404 }
        );
      }
      folioNumero = boletas[0].folio;
    }

    if (!folioNumero) {
      return NextResponse.json(
        { error: 'No se pudo determinar el folio' },
        { status: 400 }
      );
    }

    console.log('📄 Descargando PDF para folio:', folioNumero);

    // Obtener PDF como Buffer
    const pdfBuffer = await obtenerPDFSimpleFactura(folioNumero);

    // CORRECCIÓN: Convertir Buffer a Uint8Array que es compatible con BodyInit
    const pdfUint8Array = new Uint8Array(pdfBuffer);

    // Usar Response con Uint8Array
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
    console.error('❌ Error en pdf route:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener PDF' },
      { status: 500 }
    );
  }
}