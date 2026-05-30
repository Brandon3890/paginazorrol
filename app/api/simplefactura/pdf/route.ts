// app/api/simplefactura/pdf/route.ts

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
        {
          success: false,
          error: 'Se requiere folio o orderId'
        },
        { status: 400 }
      );

    }

    let folioNumero: number | null = null;

    // =========================
    // SI VIENE FOLIO DIRECTO
    // =========================
    if (folio) {

      const parsed = parseInt(folio);

      if (isNaN(parsed)) {

        return NextResponse.json(
          {
            success: false,
            error: 'Folio inválido'
          },
          { status: 400 }
        );

      }

      folioNumero = parsed;

    }

    // =========================
    // SI VIENE ORDER ID
    // =========================
    if (orderId && folioNumero === null) {

      const boletas = await query(
        `
        SELECT folio
        FROM boletas
        WHERE order_id = ?
        LIMIT 1
        `,
        [orderId]
      ) as any[];

      if (boletas.length === 0) {

        return NextResponse.json(
          {
            success: false,
            error: 'No se encontró boleta para esta orden'
          },
          { status: 404 }
        );

      }

      const parsed = parseInt(boletas[0].folio);

      if (isNaN(parsed)) {

        return NextResponse.json(
          {
            success: false,
            error: 'Folio inválido en base de datos'
          },
          { status: 500 }
        );

      }

      folioNumero = parsed;

    }

    // =========================
    // VALIDACIÓN FINAL TS
    // =========================
    if (folioNumero === null) {

      return NextResponse.json(
        {
          success: false,
          error: 'No se pudo determinar el folio'
        },
        { status: 400 }
      );

    }

    console.log('Obteniendo PDF folio');

    // =========================
    // OBTENER PDF
    // =========================
    const pdfUint8Array = await obtenerPDFSimpleFactura(folioNumero);

    console.log('PDF obtenido');

    // =========================
    // CONVERTIR A BUFFER
    // =========================
    const pdfBuffer = Buffer.from(pdfUint8Array);

    // =========================
    // RESPUESTA PDF
    // =========================
    return new Response(pdfBuffer, {
      status: 200,
      headers: {

        'Content-Type': 'application/pdf',

        'Content-Disposition':
          `attachment; filename="boleta-${folioNumero}.pdf"`,

        'Content-Length':
          pdfBuffer.length.toString(),

        'Cache-Control':
          'no-cache, no-store, must-revalidate',

        'Pragma':
          'no-cache',

        'Expires':
          '0'
      }
    });

  } catch (error: any) {

    console.error('❌ Error en PDF route:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error obteniendo PDF'
      },
      { status: 500 }
    );

  }

}