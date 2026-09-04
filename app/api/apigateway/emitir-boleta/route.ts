// app/api/apigateway/emitir-boleta/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { emitirBoletaApiGateway } from '@/lib/apigateway-service';

//  RUT POR DEFECTO PARA CONSUMIDOR FINAL ANÓNIMO
const RUT_CONSUMIDOR_FINAL = '66666666-6';

function validarRUT(rut: string): boolean {
  if (rut === RUT_CONSUMIDOR_FINAL) return true;

  const rutRegex = /^[0-9]+-[0-9Kk]$/;
  if (!rutRegex.test(rut)) return false;

  const partes = rut.split('-');
  const cuerpo = partes[0];
  const digitoVerificador = partes[1].toUpperCase();

  let suma = 0;
  let multiplicador = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = suma % 11;
  const dvCalculado = 11 - resto;
  let dvEsperado = '';

  if (dvCalculado === 11) dvEsperado = '0';
  else if (dvCalculado === 10) dvEsperado = 'K';
  else dvEsperado = dvCalculado.toString();

  return dvEsperado === digitoVerificador;
}

function limpiarRUT(rut: string): string {
  if (rut === RUT_CONSUMIDOR_FINAL) return rut;

  let clean = rut.replace(/\./g, '').toUpperCase();

  if (!clean.includes('-')) {
    const cuerpo = clean.slice(0, -1);
    const digito = clean.slice(-1);
    clean = `${cuerpo}-${digito}`;
  }

  return clean;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cliente, productos, total, ordenId, ordenNumero } = body;

    if (!productos || productos.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay productos para emitir' },
        { status: 400 }
      );
    }

    // VERIFICAR SI YA EXISTE BOLETA POR ORDER_ID
    const boletaExistente = await query(
      `SELECT id, folio FROM boletas WHERE order_id = ?`,
      [ordenId]
    ) as any[];

    if (boletaExistente.length > 0) {
      console.log(' Boleta ya existe');
      return NextResponse.json({
        success: true,
        folio: boletaExistente[0].folio,
        data: { id: boletaExistente[0].id },
        message: 'Boleta ya emitida anteriormente'
      });
    }

    // VERIFICAR SI LA ORDEN YA TIENE BOLETA_ID
    const orderCheck = await query(
      `SELECT boleta_id FROM orders WHERE id = ?`,
      [ordenId]
    ) as any[];

    if (orderCheck.length > 0 && orderCheck[0].boleta_id) {
      const boleta = await query(
        `SELECT folio FROM boletas WHERE id = ?`,
        [orderCheck[0].boleta_id]
      ) as any[];

      if (boleta.length > 0) {
        console.log('Orden ya tiene boleta asociada:');
        return NextResponse.json({
          success: true,
          folio: boleta[0].folio,
          data: { id: orderCheck[0].boleta_id },
          message: 'Boleta ya asociada a la orden'
        });
      }
    }

    // ============================================================
    //  OBTENER DATOS DEL CLIENTE
    // ============================================================
    
    //  RUT: Usar el RUT del cliente si existe y es válido, sino usar 66666666-6
    let rutCliente = RUT_CONSUMIDOR_FINAL;
    if (cliente.rut && cliente.rut !== RUT_CONSUMIDOR_FINAL && validarRUT(cliente.rut)) {
      rutCliente = limpiarRUT(cliente.rut);
    }

    //  NOMBRE: Usar el nombre del cliente desde el payload
    let nombreCliente = cliente.nombre || 'Consumidor Final';
    
    //  DIRECCIÓN
    const direccion = cliente.direccion || 'Santiago';
    const comuna = cliente.comuna || 'Santiago';
    const ciudad = cliente.ciudad || 'Santiago';

    //  TELÉFONO Y EMAIL
    const telefono = cliente.telefono || undefined;
    const email = cliente.email || undefined;

    // ============================================================
    //  CONSTRUIR RECEPTOR CON TODOS LOS DATOS
    // ============================================================
    const receptor = {
      rut: rutCliente,
      nombre: nombreCliente,
      direccion: direccion,
      comuna: comuna,
      ciudad: ciudad,
      telefono: telefono,
      email: email
    };

    // ============================================================
    //  EMITIR CON APIGATEWAY
    // ============================================================
    const resultado = await emitirBoletaApiGateway(
      productos,
      receptor,
      total
    );

    const folio = resultado.data?.folio || resultado.folio;
    const montoTotal = resultado.data?.total || resultado.total || total;

    if (!folio) {
      throw new Error('No se obtuvo folio de la boleta');
    }

    const neto = Math.round(total / 1.19);
    const iva = total - neto;
    const fechaEmision = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const insertResult = await query(
      `INSERT INTO boletas (
        order_id, folio, tipo_dte, rut_emisor, rut_receptor, 
        razon_social_receptor, monto_total, iva, fecha_emision, ambiente, estado_sii
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ordenId,
        folio,
        39,
        process.env.APIGATEWAY_RUT_EMISOR,
        receptor.rut,
        receptor.nombre,
        montoTotal,
        iva,
        fechaEmision,
        'certificacion',
        'emitida'
      ]
    ) as any;

    console.log(' Boleta guardada');

    await query(
      `UPDATE orders SET boleta_id = ?, boleta_emitida = 1 WHERE id = ?`,
      [insertResult.insertId, ordenId]
    );

    return NextResponse.json({
      success: true,
      folio: folio,
      data: resultado.data || resultado,
      boletaId: insertResult.insertId
    });

  } catch (error: any) {
    console.error('Error en emitir-boleta:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}