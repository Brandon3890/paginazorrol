// lib/simplefactura-service.ts - VERSIÓN CORREGIDA para PDF
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
// OBTENER PDF - VERSIÓN CORREGIDA
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

    console.log('📄 Solicitando PDF para folio:', folio);
    console.log('📄 Ambiente:', config.ambiente);
    console.log('📄 Sucursal:', config.sucursal);

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
      const chunks: Buffer[] = [];

      res.on('data', (chunk) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        
        console.log('📊 Status PDF:', res.statusCode);
        console.log('📊 Content-Type:', res.headers['content-type']);

        // Verificar si es un PDF directamente
        if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
          console.log('✅ PDF recibido directamente');
          return resolve(new Uint8Array(buffer));
        }

        // Intentar parsear como JSON (puede venir en base64)
        try {
          const responseText = buffer.toString('utf8');
          const jsonResponse = JSON.parse(responseText);
          
          // Buscar el PDF en diferentes formatos de respuesta
          let pdfBase64 = null;
          
          if (jsonResponse.data && jsonResponse.data.pdf) {
            pdfBase64 = jsonResponse.data.pdf;
          } else if (jsonResponse.pdf) {
            pdfBase64 = jsonResponse.pdf;
          } else if (jsonResponse.data && typeof jsonResponse.data === 'string') {
            pdfBase64 = jsonResponse.data;
          }
          
          if (pdfBase64) {
            console.log('✅ PDF encontrado en base64, decodificando...');
            const pdfBuffer = Buffer.from(pdfBase64, 'base64');
            console.log(`📄 Tamaño PDF decodificado: ${pdfBuffer.length} bytes`);
            return resolve(new Uint8Array(pdfBuffer));
          }
          
          // Si llegamos aquí, no encontramos el PDF
          console.error('❌ Respuesta sin PDF:', responseText.substring(0, 500));
          reject(new Error('No se encontró PDF en la respuesta'));
          
        } catch (err) {
          console.error('❌ Error parsing respuesta PDF:', err);
          reject(new Error('Formato de respuesta inválido'));
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ Error en petición PDF:', err);
      reject(new Error(`Error de conexión: ${err.message}`));
    });

    req.write(postData);
    req.end();
  });
}