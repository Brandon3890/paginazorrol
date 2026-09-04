import https from 'https';

interface ApiGatewayConfig {
  token: string;
  rutAuth: string;
  claveSII: string;
  rutEmisor: string;
  cdgSIISucur: number;
  ambiente: number;
}

const config: ApiGatewayConfig = {
  token: process.env.APIGATEWAY_TOKEN || '',
  rutAuth: process.env.APIGATEWAY_RUT_AUTH || '',
  claveSII: process.env.APIGATEWAY_CLAVE_SII || '',
  rutEmisor: process.env.APIGATEWAY_RUT_EMISOR || '',
  cdgSIISucur: parseInt(process.env.APIGATEWAY_CDG_SII_SUCUR || '0'),
  ambiente: parseInt(process.env.APIGATEWAY_AMBIENTE || '0')
};

// ============================================================
//  MODO DE PRUEBA por si se cae la api o para algo con la boleta
// ============================================================
// Para probar el reintento, cambia TEST_SHOULD_FAIL a true
// y luego a false para restaurar la funcionalidad normal
const TEST_SHOULD_FAIL = false; // ← CAMBIA a false PARA RESTAURAR
// const TEST_SHOULD_FAIL = true; // ← DESCOMENTA PARA PROBAR

//  RUT POR DEFECTO PARA CONSUMIDOR FINAL ANÓNIMO
const RUT_CONSUMIDOR_FINAL = '66666666-6';

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

/**
 * Simular fallo de ApiGateway para pruebas
 */
async function simulateApiFailure(): Promise<void> {
  if (TEST_SHOULD_FAIL) {
    throw new Error('🧪 [TEST] Error simulado - ApiGateway no disponible');
  }
}

// ============================================================
// 1. EMITIR BOLETA
// ============================================================

export async function emitirBoletaApiGateway(
  productos: Array<{ nombre: string; cantidad: number; precio: number }>,
  receptor: {
    rut: string;
    nombre: string;
    direccion: string;
    comuna: string;
    ciudad: string;
    telefono?: string;
    email?: string;
  },
  total: number
): Promise<any> {
  return new Promise((resolve, reject) => {
    //  SIMULAR FALLO EN MODO PRUEBA (si está activado)
    if (TEST_SHOULD_FAIL) {
      console.log('🧪 [TEST] Simulando fallo de ApiGateway');
      reject(new Error('🧪 [TEST] Error simulado - ApiGateway no disponible'));
      return;
    }

    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    let detalles;
    if (productos.length === 1) {
      detalles = productos.map((prod) => ({
        NmbItem: prod.nombre,
        QtyItem: prod.cantidad,
        PrcItem: Math.round(prod.precio)
      }));
    } else {
      const nombreConsolidado = productos.length <= 3 
        ? productos.map(p => p.nombre).join(' + ')
        : `${productos.length} productos`;
      
      const cantidadTotal = productos.reduce((sum, p) => sum + p.cantidad, 0);
      const precioPromedio = Math.round(total / cantidadTotal);
      
      detalles = [{
        NmbItem: nombreConsolidado,
        QtyItem: cantidadTotal,
        PrcItem: precioPromedio
      }];
    }

    //  CONSTRUIR PAYLOAD CON TODOS LOS DATOS DEL RECEPTOR
    const payload = {
      auth: {
        pass: {
          rut: config.rutAuth,
          clave: config.claveSII
        }
      },
      dte: {
        vendedor: config.rutAuth,
        Encabezado: {
          IdDoc: {
            TipoDTE: 39,
            MedioPago: 2
          },
          Emisor: {
            RUTEmisor: config.rutEmisor,
            CdgSIISucur: config.cdgSIISucur
          },
          Receptor: {
            RUTRecep: receptor.rut || RUT_CONSUMIDOR_FINAL,
            RznSocRecep: receptor.nombre || "Consumidor Final",
            DirRecep: receptor.direccion || "Santiago",
            ...(receptor.telefono && { TelefonoRecep: receptor.telefono }),
            ...(receptor.email && { CorreoRecep: receptor.email })
          }
        },
        Detalle: detalles
      }
    };


    const postData = JSON.stringify(payload);

    const options = {
      method: 'POST',
      hostname: 'app.apigateway.cl',
      path: '/api/v2/sii/eboleta/emitidas/emitir',
      headers: {
        'Authorization': `Token ${config.token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {

        if (res.statusCode !== 200) {
          try {
            const errorResponse = JSON.parse(data);
            reject(new Error(errorResponse.message || errorResponse.error || `Error ${res.statusCode}`));
          } catch (err) {
            reject(new Error(`Error ${res.statusCode}: ${data.substring(0, 100)}`));
          }
          return;
        }

        try {
          const response = JSON.parse(data);
          
          if (response.data && response.data.folio) {
            resolve(response);
          } else {
            reject(new Error('Respuesta inválida: falta el campo data.folio'));
          }
        } catch (err) {
          const error = err as Error;
          reject(new Error(`Error al parsear: ${error.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Error de conexión: ${err.message}`));
    });

    req.write(postData);
    req.end();
  });
}

// ============================================================
// 2. CONSULTAR ESTADO DE BOLETA 
// ============================================================

export async function consultarEstadoBoleta(
  folio: string | number,
  fecha: string,
  tipoDTE: number = 39
): Promise<{ estado: string; anulado: boolean; pdf?: string }> {
  try {
    const fechaActual = new Date();
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - 90);

    const dateFrom = fechaInicio.toISOString().split('T')[0];
    const dateTo = fechaActual.toISOString().split('T')[0];

    const result = await listarDocumentosApiGateway(dateFrom, dateTo, 1, 100);

    if (result.data && Array.isArray(result.data)) {
      const boleta = result.data.find((doc: any) => 
        Number(doc.folio) === Number(folio) && doc.dte === tipoDTE
      );

      if (boleta) {
        console.log(` Boleta ${folio} encontrada`);
        
        return {
          estado: boleta.estado_boleta || 'desconocido',
          anulado: boleta.anulado || false,
          pdf: boleta.pdf || undefined
        };
      }
    }

    console.log(`Boleta ${folio} no encontrada en el listado`);
    return {
      estado: 'no_encontrada',
      anulado: false,
      pdf: undefined
    };

  } catch (error: any) {
    console.error(` Error consultando estado:`, error.message);
    throw new Error(`Error consultando estado: ${error.message}`);
  }
}

// ============================================================
// 3. OBTENER PDF DE BOLETA
// ============================================================

export async function obtenerPDFApiGateway(
  folio: string | number,
  fecha: string,
  tipoDTE: number = 39
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const fechaFormateada = formatearFecha(fecha);
    const rutContribuyente = config.rutEmisor.replace(/-\d$/, '');

    const payload = {
      auth: {
        pass: {
          rut: config.rutAuth,
          clave: config.claveSII
        }
      },
      contribuyente: rutContribuyente,
      folio: typeof folio === 'string' ? parseInt(folio) : folio,
      dte: tipoDTE,
      fecha: fechaFormateada
    };

    const postData = JSON.stringify(payload);

    const options = {
      method: 'POST',
      hostname: 'app.apigateway.cl',
      path: '/api/v2/sii/eboleta/emitidas/pdf',
      headers: {
        'Authorization': `Token ${config.token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      const chunks: Uint8Array[] = [];

      res.on('data', (chunk) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.length;
        }

        if (result.length > 4 &&
          result[0] === 0x25 && result[1] === 0x50 &&
          result[2] === 0x44 && result[3] === 0x46) {
          resolve(Buffer.from(result));
        } else {
          try {
            const text = new TextDecoder().decode(result);
            console.error(' Error PDF:', text.substring(0, 200));
            
            try {
              const errorResponse = JSON.parse(text);
              reject(new Error(errorResponse.detail || errorResponse.message || 'Error al obtener PDF'));
            } catch (parseErr) {
              reject(new Error(`Error al obtener PDF: ${text.substring(0, 100)}`));
            }
          } catch (err) {
            const error = err as Error;
            reject(new Error(`La respuesta no es un PDF válido: ${error.message}`));
          }
        }
      });
    });

    req.on('error', (err) => {
      console.error(' Error de conexión PDF:', err);
      reject(new Error(`Error de conexión: ${err.message}`));
    });

    req.write(postData);
    req.end();
  });
}

// ============================================================
// 4. OBTENER FECHA DE EMISIÓN DESDE EL SII
// ============================================================

export async function obtenerFechaEmisionSII(
  folio: string | number,
  tipoDTE: number = 39
): Promise<string | null> {
  try {
    const fechaActual = new Date();
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - 90);

    const dateFrom = fechaInicio.toISOString().split('T')[0];
    const dateTo = fechaActual.toISOString().split('T')[0];

    console.log(` Buscando boleta folio ${folio} entre ${dateFrom} y ${dateTo}`);

    const result = await listarDocumentosApiGateway(dateFrom, dateTo, 1, 100);

    if (result.data && Array.isArray(result.data)) {
      const boleta = result.data.find((doc: any) => 
        Number(doc.folio) === Number(folio) && doc.dte === tipoDTE
      );

      if (boleta) {
        const fechaISO = boleta.fecha;
        if (fechaISO) {
          const fechaFormateada = fechaISO.split('T')[0];
          console.log(` Fecha encontrada para folio ${folio}: ${fechaFormateada}`);
          return fechaFormateada;
        }
      }
    }

    console.log(`No se encontró la boleta folio ${folio} en el SII`);
    return null;
  } catch (error) {
    console.error(` Error obteniendo fecha de emisión:`, error);
    return null;
  }
}

// ============================================================
// 5. LISTAR DOCUMENTOS EMITIDOS
// ============================================================

export async function listarDocumentosApiGateway(
  dateFrom: string,
  dateTo: string,
  page: number = 1,
  itemsPerPage: number = 100,
  estado: string = 'aceptada,rechazada,en_proceso'
): Promise<any> {
  return new Promise((resolve, reject) => {
    const rutContribuyente = config.rutEmisor.replace(/-\d$/, '');

    const payload = {
      auth: {
        pass: {
          rut: config.rutAuth,
          clave: config.claveSII
        }
      },
      contribuyente: rutContribuyente,
      date_from: dateFrom,
      date_to: dateTo,
      page: page,
      items_per_page: itemsPerPage,
      estado: estado
    };

    console.log(' Listando documentos');

    const postData = JSON.stringify(payload);

    const options = {
      method: 'POST',
      hostname: 'app.apigateway.cl',
      path: '/api/v2/sii/eboleta/emitidas/documentos',
      headers: {
        'Authorization': `Token ${config.token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      console.log(` Documentos Status Code: ${res.statusCode}`);

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode === 200) {
            resolve(response);
          } else {
            reject(new Error(response.message || 'Error al listar documentos'));
          }
        } catch (err) {
          const error = err as Error;
          reject(new Error(`Error al parsear: ${error.message}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error(' Error de conexión documentos:', err);
      reject(new Error(`Error de conexión: ${err.message}`));
    });

    req.write(postData);
    req.end();
  });
}

// ============================================================
// 6. ANULAR BOLETA
// ============================================================

export async function anularBoletaApiGateway(
  folio: string | number,
  fecha: string,
  tipoDTE: number = 39
): Promise<any> {
  return new Promise((resolve, reject) => {
    const fechaFormateada = formatearFecha(fecha);
    const rutContribuyente = config.rutEmisor.replace(/-\d$/, '');

    const payload = {
      auth: {
        pass: {
          rut: config.rutAuth,
          clave: config.claveSII
        }
      },
      contribuyente: rutContribuyente,
      folio: typeof folio === 'string' ? parseInt(folio) : folio,
      dte: tipoDTE,
      fecha: fechaFormateada
    };

    const postData = JSON.stringify(payload);

    const options = {
      method: 'POST',
      hostname: 'app.apigateway.cl',
      path: '/api/v2/sii/eboleta/emitidas/anular',
      headers: {
        'Authorization': `Token ${config.token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode === 200) {
            resolve(response);
          } else {
            reject(new Error(response.message || 'Error al anular boleta'));
          }
        } catch (err) {
          const error = err as Error;
          reject(new Error(`Error al parsear: ${error.message}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error(' Error de conexión anular:', err);
      reject(new Error(`Error de conexión: ${err.message}`));
    });

    req.write(postData);
    req.end();
  });
}