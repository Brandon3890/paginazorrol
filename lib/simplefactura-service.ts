// lib/simplefactura-service.ts - CORREGIDO USANDO LA ESTRUCTURA QUE FUNCIONA
import https from 'https';

interface SimpleFacturaConfig {
  token: string;
  rutEmisor: string;
  razonSocial: string;
  giro: string;
  direccion: string;
  comuna: string;
  ciudad: string;
  sucursal: string;
  ambiente: number;
}

const config: SimpleFacturaConfig = {
  token: process.env.SIMPLEFACTURA_TOKEN || '',
  rutEmisor: process.env.SIMPLEFACTURA_RUT_EMISOR || '',
  razonSocial: process.env.SIMPLEFACTURA_RAZON_SOCIAL || '',
  giro: process.env.SIMPLEFACTURA_GIRO || '',
  direccion: process.env.SIMPLEFACTURA_DIRECCION || '',
  comuna: process.env.SIMPLEFACTURA_COMUNA || '',
  ciudad: process.env.SIMPLEFACTURA_CIUDAD || '',
  sucursal: process.env.SIMPLEFACTURA_SUCURSAL_NOMBRE || "Casa Matriz",
  ambiente: parseInt(process.env.SIMPLEFACTURA_AMBIENTE || '0')
};

// Emitir boleta - USANDO LA MISMA ESTRUCTURA QUE FUNCIONA EN EL SCRIPT
export async function emitirBoletaSimpleFactura(productos: any[], receptor: any, total: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const fechaActual = new Date().toISOString().split('T')[0];
    const sucursalEncoded = encodeURIComponent(config.sucursal);
    
    // Calcular neto e IVA
    const neto = Math.round(total / 1.19);
    const iva = total - neto;
    
    // Detalles de productos
    const detalles = productos.map((prod, idx) => ({
      NroLinDet: idx + 1,
      NmbItem: prod.nombre,
      QtyItem: prod.cantidad,
      UnmdItem: "un",
      PrcItem: Math.round(prod.precio),
      MontoItem: Math.round(prod.cantidad * prod.precio)
    }));
    
    // ESTRUCTURA IDÉNTICA A LA DEL SCRIPT FUNCIONAL - SIN wrapper dte
    const datosBoleta = {
        datos: {
          Documento: {
            Encabezado: {
              IdDoc: {
                TipoDTE: 39,
                FchEmis: fechaActual
              },
              Emisor: {
                RUTEmisor: config.rutEmisor,
                RznSoc: config.razonSocial,
                GiroEmis: config.giro,
                DirOrigen: config.direccion,
                CmnaOrigen: config.comuna
              },
              Receptor: {
                RUTRecep: receptor.rut,
                RznSocRecep: receptor.nombre
              },
              Totales: {
                MntTotal: total
              }
            },
            Detalle: detalles
          }
        }
      };
    
    const postData = JSON.stringify(datosBoleta);
    const path = `/documento`;
    
    console.log('📡 Enviando a SimpleFactura:', `https://api.simplefactura.cl${path}`);
    console.log('📦 Datos:', JSON.stringify(datosBoleta, null, 2).substring(0, 500));
    
    const options = {
      method: 'POST',
      hostname: 'api.simplefactura.cl',
      path: path,
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('📊 Status:', res.statusCode);
        console.log('📄 Respuesta:', data.substring(0, 500));
        
        try {
            if (!data || data.trim().startsWith('<')) {
              return reject(new Error(`Respuesta inválida (HTML): ${data.substring(0, 200)}`));
            }

            const response = JSON.parse(data);

            if (response.status === 200) {
              resolve(response);
            } else {
              reject(new Error(response.message || 'Error al emitir boleta'));
            }
          } catch (err) {
          const error = err as Error;
          reject(new Error(`Error al parsear: ${error.message} - Respuesta: ${data.substring(0, 200)}`));
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

// Obtener PDF de boleta - USANDO LA ESTRUCTURA QUE FUNCIONA
export async function obtenerPDFSimpleFactura(folio: string | number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      credenciales: {
        rutEmisor: config.rutEmisor,
        nombreSucursal: config.sucursal
      },
      dteReferenciadoExterno: {
        folio: typeof folio === 'string' ? parseInt(folio) : folio,
        codigoTipoDte: 39,
        ambiente: config.ambiente
      }
    });

    const options = {
      method: 'POST',
      hostname: 'api.simplefactura.cl',
      path: '/getPdf',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log(`📄 Descargando PDF para folio: ${folio}`);
    console.log(`   Sucursal: ${config.sucursal}`);

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
        
        // Verificar si es PDF
        if (result.length > 4 && 
            result[0] === 0x25 && result[1] === 0x50 && 
            result[2] === 0x44 && result[3] === 0x46) {
          resolve(result);
        } else {
          try {
            const text = new TextDecoder().decode(result);
            const errorResponse = JSON.parse(text);
            reject(new Error(errorResponse.message || 'Error al obtener PDF'));
          } catch (err) {
            const error = err as Error;
            reject(new Error(`La respuesta no es un PDF válido: ${error.message}`));
          }
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

// Consultar estado de boleta
export async function consultarBoletaSimpleFactura(folio: string | number): Promise<any> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      credenciales: { rutEmisor: config.rutEmisor },
      dteReferenciadoExterno: {
        folio: typeof folio === 'string' ? parseInt(folio) : folio,
        codigoTipoDte: 39,
        ambiente: config.ambiente
      }
    });

    const options = {
      method: 'POST',
      hostname: 'api.simplefactura.cl',
      path: '/documentIssued',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
            if (!data || data.trim().startsWith('<')) {
              return reject(new Error(`Respuesta inválida (HTML): ${data.substring(0, 200)}`));
            }

            const response = JSON.parse(data);

            if (response.status === 200 && response.data) {
              resolve(response.data);
            } else {
              reject(new Error(response.message || 'Error al consultar'));
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