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
// EMITIR BOLETA 
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
// OBTENER PDF 
// ===============================
export async function obtenerPDFSimpleFactura(folio: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {

    const postData = JSON.stringify({
      credenciales: {
        rutEmisor: config.rutEmisor,
        nombreSucursal: config.sucursal
      },
      dteReferenciadoExterno: {
        folio: Number(folio),
        codigoTipoDte: 39,
        ambiente: config.ambiente
      }
    });

    console.log('📄 Obteniendo PDF para folio:', folio);

    const options = {
      method: 'POST',
      hostname: 'api.simplefactura.cl',

      path: '/pdf',

      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {

      const chunks: Buffer[] = [];

      res.on('data', (chunk) => {
        chunks.push(chunk);
      });

      res.on('end', () => {

        const buffer = Buffer.concat(chunks);

        console.log('📊 PDF Status:', res.statusCode);
        console.log('📄 PDF Content-Type:', res.headers['content-type']);

        // 🔥 MOSTRAR ERROR REAL
        if (res.statusCode !== 200) {

          const text = buffer.toString('utf8');

          console.error('❌ RESPUESTA PDF:', text);

          return reject(
            new Error(`Error al obtener PDF: ${res.statusCode}`)
          );
        }

        // VALIDAR PDF
        if (
          buffer[0] === 0x25 &&
          buffer[1] === 0x50 &&
          buffer[2] === 0x44 &&
          buffer[3] === 0x46
        ) {

          console.log('✅ PDF válido recibido');

          resolve(new Uint8Array(buffer));

        } else {

          console.error('❌ Respuesta no es PDF');
          console.error(buffer.toString('utf8').substring(0, 500));

          reject(new Error('La respuesta no es un PDF válido'));
        }

      });

    });

    req.on('error', (err) => {
      reject(new Error(`Error conexión PDF: ${err.message}`));
    });

    req.write(postData);
    req.end();

  });
}