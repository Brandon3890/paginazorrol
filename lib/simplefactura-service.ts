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
  apiUrl: string;
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
  ambiente: parseInt(process.env.SIMPLEFACTURA_AMBIENTE || '0'),
  apiUrl: process.env.SIMPLEFACTURA_API_URL || 'https://api.simplefactura.cl'
};

// 🔥 Helper request robusto
function requestSimpleFactura(path: string, postData: string): Promise<any> {
  return new Promise((resolve, reject) => {

    const options = {
      method: 'POST',
      hostname: 'api.simplefactura.cl',
      path,
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json', // 🔥 CLAVE
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', chunk => data += chunk);

      res.on('end', () => {
        console.log('📊 Status:', res.statusCode);
        console.log('📄 Raw:', data.substring(0, 500));

        // 🔥 detectar HTML (tu error actual)
        if (!data || data.trim().startsWith('<')) {
          return reject(new Error(`❌ API devolvió HTML (endpoint malo, token inválido o IP bloqueada)\n${data.substring(0, 200)}`));
        }

        try {
          const json = JSON.parse(data);

          if (json.status === 200) {
            resolve(json);
          } else {
            reject(new Error(json.message || 'Error API SimpleFactura'));
          }

        } catch (err: any) {
          reject(new Error(`❌ JSON inválido: ${err.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`❌ Error conexión: ${err.message}`));
    });

    req.write(postData);
    req.end();
  });
}

// ✅ EMITIR BOLETA
export async function emitirBoletaSimpleFactura(productos: any[], receptor: any, total: number) {
  const fechaActual = new Date().toISOString().split('T')[0];

  const detalles = productos.map((p, i) => ({
    NroLinDet: i + 1,
    NmbItem: p.nombre,
    QtyItem: p.cantidad,
    UnmdItem: "un",
    PrcItem: Math.round(p.precio),
    MontoItem: Math.round(p.cantidad * p.precio)
  }));

  const body = {
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

  console.log('📄 Emitiendo boleta...');

  return requestSimpleFactura('/v1/documento', JSON.stringify(body));
}

// ✅ CONSULTAR
export async function consultarBoletaSimpleFactura(folio: number) {
  const body = {
    credenciales: {
      rutEmisor: config.rutEmisor
    },
    dteReferenciadoExterno: {
      folio,
      codigoTipoDte: 39,
      ambiente: config.ambiente
    }
  };

  return requestSimpleFactura('/v1/documentIssued', JSON.stringify(body));
}

// ✅ PDF
export async function obtenerPDFSimpleFactura(folio: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {

    const body = JSON.stringify({
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
      path: '/v1/getPdf',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/pdf',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      const chunks: Uint8Array[] = [];

      res.on('data', chunk => chunks.push(chunk));

      res.on('end', () => {
        const buffer = Buffer.concat(chunks);

        if (buffer.slice(0, 4).toString() === '%PDF') {
          resolve(buffer);
        } else {
          reject(new Error('❌ No es PDF válido'));
        }
      });
    });

    req.on('error', err => reject(err));
    req.write(body);
    req.end();
  });
}