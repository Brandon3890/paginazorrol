// app/api/apigateway/documentos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { listarDocumentosApiGateway } from '@/lib/apigateway-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date_from, date_to, page, items_per_page, estado } = body;

    if (!date_from || !date_to) {
      return NextResponse.json(
        { error: 'Se requiere date_from y date_to' },
        { status: 400 }
      );
    }

    const result = await listarDocumentosApiGateway(
      date_from,
      date_to,
      page || 1,
      items_per_page || 20,
      estado || 'aceptada,rechazada,en_proceso'
    );

    return NextResponse.json({
      success: true,
      data: result.data,
      metadata: result.metadata
    });

  } catch (error: any) {
    console.error(' Error listando documentos:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error al listar documentos' },
      { status: 500 }
    );
  }
}