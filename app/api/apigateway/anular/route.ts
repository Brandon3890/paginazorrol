// app/api/apigateway/anular/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { anularBoletaApiGateway } from '@/lib/apigateway-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { folio } = body;

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

    const fechaEmision = boletas[0].fecha_emision.split(' ')[0];

    console.log('Anulando boleta folio:', folio, 'fecha:', fechaEmision);

    const resultado = await anularBoletaApiGateway(
      Number(folio),
      fechaEmision
    );

    // Actualizar estado en la base de datos
    await query(
      `UPDATE boletas SET estado_sii = 'anulada' WHERE folio = ?`,
      [folio]
    );

    return NextResponse.json({
      success: true,
      data: resultado
    });

  } catch (error: any) {
    console.error('Error anulando boleta:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error al anular' },
      { status: 500 }
    );
  }
}