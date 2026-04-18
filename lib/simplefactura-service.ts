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
// FUNCION BASE PARA REQUEST
// ===============================
function hacerRequest(path: string, postData: string): Promise<any> {
  return new Promise((resolve, reject) => {

    const options = {
      method: 'POST',
      hostname: 'api.simplefactura.cl',
      path,
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
        console.log(`📊 [${path}] Status:`, res.statusCode);
        console.log(`📄 [${path}] Resp:`, data.substring(0, 300));

        // 🔥 CASO 1: respuesta vacía
        if (!data) {
          return reject(new Error('Respuesta vacía del servidor'));
        }

        // 🔥 CASO 2: HTML (error típico)
        if (data.trim().startsWith('<')) {
          return reject(new Error(`SimpleFactura devolvió HTML (probable error de API o credenciales)`));
        }

        // 🔥 CASO 3: parse JSON seguro
        let json;
        try {
          json = JSON.parse(data);
        } catch (err: any) {
          return reject(new Error(`JSON inválido: ${err.message}`));
        }

        // 🔥 CASO 4: errores HTTP reales
        if (res.statusCode && res.statusCode >= 400) {
          return reject(new Error(json.message || `HTTP ${res.statusCode}`));
        }

        resolve(json);
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
// EMITIR BOLETA
// ===============================
export async function emitirBoletaSimpleFactura(
  productos: any[],
  receptor: any,
  total: number
): Promise<any> {

  const fechaActual = new Date().toISOString().split('T')[0];

  const detalles = productos.map((prod, idx) => ({
    NroLinDet: idx + 1,
    NmbItem: prod.nombre,
    QtyItem: prod.cantidad,
    UnmdItem: "un",
    PrcItem: Math.round(prod.precio),
    MontoItem: Math.round(prod.cantidad * prod.precio)
  }));

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
            CmnaOrigen: config.comuna,
            CiudadOrigen: config.ciudad
          },
          Receptor: {
            RUTRecep: receptor.rut || "66666666-6",
            RznSocRecep: receptor.nombre || "Cliente"
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

  const response = await hacerRequest('/documento', postData);

  // 🔥 AQUÍ ESTABA TU OTRO ERROR
  if (response.status === 200) {
    return response.data || response;
  }

  throw new Error(response.message || 'Error al emitir boleta');
}

// ===============================
// OBTENER PDF
// ===============================
export async function obtenerPDFSimpleFactura(folio: string | number): Promise<Uint8Array> {

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

  return new Promise((resolve, reject) => {

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

      res.on('data', chunk => chunks.push(chunk));

      res.on('end', () => {
        const buffer = Buffer.concat(chunks);

        // PDF válido
        if (buffer.slice(0, 4).toString() === '%PDF') {
          return resolve(new Uint8Array(buffer));
        }

        // error JSON
        try {
          const json = JSON.parse(buffer.toString());
          return reject(new Error(json.message || 'Error al obtener PDF'));
        } catch {
          return reject(new Error('Respuesta no es PDF ni JSON válido'));
        }
      });
    });

    req.on('error', err => reject(err));

    req.write(postData);
    req.end();
  });
}

// ===============================
// CONSULTAR BOLETA
// ===============================
export async function consultarBoletaSimpleFactura(folio: string | number): Promise<any> {

  const postData = JSON.stringify({
    credenciales: {
      rutEmisor: config.rutEmisor
    },
    dteReferenciadoExterno: {
      folio: Number(folio),
      codigoTipoDte: 39,
      ambiente: config.ambiente
    }
  });

  const response = await hacerRequest('/documentIssued', postData);

  if (response.status === 200 && response.data) {
    return response.data;
  }

  throw new Error(response.message || 'Error al consultar boleta');
}