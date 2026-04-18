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

// ===============================
// EMITIR BOLETA (CORREGIDO)
// ===============================
export async function emitirBoletaSimpleFactura(productos: any[], receptor: any, total: number): Promise<any> {
  return new Promise((resolve, reject) => {

    if (!config.token) {
      return reject(new Error('❌ TOKEN SIMPLEFACTURA NO DEFINIDO'));
    }

    const fechaActual = new Date().toISOString().split('T')[0];
    const sucursalEncoded = encodeURIComponent(config.sucursal);

    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    const detalles = productos.map((prod, idx) => ({
      NroLinDet: idx + 1,
      NmbItem: prod.nombre,
      QtyItem: prod.cantidad,
      UnmdItem: "un",
      PrcItem: Math.round(prod.precio),
      MontoItem: Math.round(prod.cantidad * prod.precio)
    }));

    const datosBoleta = {
      Documento: {
        Encabezado: {
          IdDoc: {
            TipoDTE: 39,
            FchEmis: fechaActual
          },
          Emisor: {
            RUTEmisor: config.rutEmisor,
            RznSocEmisor: config.razonSocial,
            GiroEmisor: config.giro,
            DirOrigen: config.direccion,
            CmnaOrigen: config.comuna,
            CiudadOrigen: config.ciudad
          },
          Receptor: {
            RUTRecep: receptor.rut || "55555555-5",
            RznSocRecep: receptor.nombre || "Consumidor Final",
            DirRecep: receptor.direccion || "Santiago",
            CmnaRecep: receptor.comuna || "Santiago",
            CiudadRecep: receptor.ciudad || "Santiago"
          },
          Totales: {
            MntNeto: neto,
            TasaIVA: 19,
            IVA: iva,
            MntTotal: total
          }
        },
        Detalle: detalles
      }
    };

    const postData = JSON.stringify(datosBoleta);

    // 🔥 ENDPOINT CORRECTO
    const path = `/invoiceV2/${sucursalEncoded}`;

    console.log('📡 URL:', `https://api.simplefactura.cl${path}`);
    console.log('🔑 Token:', config.token ? 'OK' : 'VACÍO');

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
        console.log('📄 RAW:', data.substring(0, 300));

        // 🚨 DETECTAR HTML (ERROR REAL)
        if (!data || data.trim().startsWith('<')) {
          return reject(new Error(`❌ API devolvió HTML (endpoint incorrecto o error servidor)`));
        }

        try {
          const response = JSON.parse(data);

          if (response.status === 200) {
            resolve(response);
          } else {
            reject(new Error(response.message || 'Error al emitir boleta'));
          }

        } catch (err: any) {
          reject(new Error(`Error parseando JSON: ${err.message}`));
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

// ===============================
// OBTENER PDF (sin cambios)
// ===============================
export async function obtenerPDFSimpleFactura(folio: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {

    const postData = JSON.stringify({
      credenciales: {
        rutEmisor: config.rutEmisor,
        nombreSucursal: config.sucursal
      },
      dteReferenciadoExterno: {
        folio,
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

    const req = https.request(options, (res) => {
      const chunks: Uint8Array[] = [];

      res.on('data', (chunk) => chunks.push(chunk));

      res.on('end', () => {
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const result = new Uint8Array(totalLength);

        let offset = 0;
        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.length;
        }

        // PDF check
        if (result[0] === 0x25 && result[1] === 0x50) {
          resolve(result);
        } else {
          reject(new Error('No es un PDF válido'));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}