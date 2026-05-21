// app/api/simplefactura/pdf/route.ts - VERSIÓN CORREGIDA
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

    let folioNumero: number | null = folio ? parseInt(folio) : null;

    if (orderId && !folioNumero) {
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

      folioNumero = parseInt(boletas[0].folio);
    }

    if (!folioNumero || isNaN(folioNumero)) {
      return NextResponse.json(
        { error: 'Folio inválido' },
        { status: 400 }
      );
    }

    // Obtener el PDF como Uint8Array
    const pdfUint8Array = await obtenerPDFSimpleFactura(folioNumero);
    
    // Convertir a Buffer para poder obtener la longitud
    const pdfBuffer = Buffer.from(pdfUint8Array);

    // Devolver el PDF como respuesta
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="boleta-${folioNumero}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'no-cache'
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