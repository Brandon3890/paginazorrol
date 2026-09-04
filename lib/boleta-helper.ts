import { consultarEstadoBoleta, obtenerPDFApiGateway, listarDocumentosApiGateway } from './apigateway-service';

/**
 * Obtener la fecha real de emisión desde el SII
 */
export async function obtenerFechaRealSII(
  folio: string | number,
  tipoDTE: number = 39
): Promise<string | null> {
  try {
    const fechaActual = new Date();
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - 90);

    const dateFrom = fechaInicio.toISOString().split('T')[0];
    const dateTo = fechaActual.toISOString().split('T')[0];

    console.log(`Buscando boleta folio`);

    const result = await listarDocumentosApiGateway(dateFrom, dateTo, 1, 100);

    if (result.data && Array.isArray(result.data)) {
      const boleta = result.data.find((doc: any) => 
        Number(doc.folio) === Number(folio) && doc.dte === tipoDTE
      );

      if (boleta) {
        const fechaISO = boleta.fecha;
        if (fechaISO) {
          const fechaFormateada = fechaISO.split('T')[0];
          console.log(`Fecha encontrada`);
          return fechaFormateada;
        }
      }
    }

    console.log(` No se encontró en el SII`);
    return null;
  } catch (error) {
    console.error(`Error obteniendo fecha de emisión:`, error);
    return null;
  }
}


export async function esperarBoletaAceptada(
  folio: string | number,
  fecha: string,
  timeoutMs: number = 2 * 60 * 60 * 1000 // 2 horas
): Promise<{ aceptada: boolean; estado?: string; error?: string; fechaUsada?: string }> {
  
  let tiempoTranscurrido = 0;
  let fechaUsada = fecha;
  let intento = 0;

  // Definir los intervalos de espera
  const intervalos = [
    { maxIntentos: 4, espera: 30000 },   // 4 intentos cada 30 segundos
    { maxIntentos: 10, espera: 60000 },  // 10 intentos cada 1 minuto
    { maxIntentos: 10, espera: 120000 }, // 10 intentos cada 2 minutos
    { maxIntentos: 99, espera: 300000 }  // Resto cada 5 minutos (hasta 2 horas)
  ];

  let intervaloActual = 0;
  let intentosEnIntervalo = 0;

  while (tiempoTranscurrido < timeoutMs) {
    intento++;
    const intervalo = intervalos[intervaloActual];
    const maxIntentos = intervalo.maxIntentos;
    const espera = intervalo.espera;

    try {
      console.log(`Verificando estado de boleta `);
      
      const resultado = await consultarEstadoBoleta(folio, fechaUsada);
      console.log(`Estado actual: ${resultado.estado}, Anulada: ${resultado.anulado}`);
      
      if (resultado.anulado) {
        return {
          aceptada: false,
          estado: 'anulada',
          error: 'La boleta ha sido anulada'
        };
      }
      
      // Si está Aceptada o En Proceso, enviar
      if (resultado.estado === 'Aceptada' || resultado.estado === 'En Proceso') {
        console.log(`Boleta en estado "${resultado.estado}" - Enviando...`);
        return {
          aceptada: true,
          estado: resultado.estado,
          fechaUsada: fechaUsada
        };
      }
      
      if (resultado.estado === 'Rechazada') {
        return {
          aceptada: false,
          estado: 'Rechazada',
          error: 'La boleta ha sido rechazada por el SII'
        };
      }
      
      // Mostrar tiempo transcurrido
      const minutos = Math.floor(tiempoTranscurrido / 60000);
      const segundos = Math.floor((tiempoTranscurrido % 60000) / 1000);
      console.log(`Boleta en estado "${resultado.estado}" - Tiempo transcurrido: ${minutos}m ${segundos}s`);

      // Determinar el siguiente intervalo
      intentosEnIntervalo++;
      if (intentosEnIntervalo >= maxIntentos && intervaloActual < intervalos.length - 1) {
        intervaloActual++;
        intentosEnIntervalo = 0;
        const nuevoIntervalo = intervalos[intervaloActual];
        console.log(`Cambiando a espera de ${nuevoIntervalo.espera/1000} segundos...`);
      }

      // Esperar antes del siguiente intento
      await new Promise(resolve => setTimeout(resolve, espera));
      tiempoTranscurrido += espera;
      
    } catch (error: any) {
      console.error(` Error consultando estado (intento ${intento}):`, error.message);
      
      // Esperar antes de reintentar
      await new Promise(resolve => setTimeout(resolve, 30000));
      tiempoTranscurrido += 30000;
    }
  }
  
  // Si se acabó el tiempo (2 horas)
  return {
    aceptada: false,
    error: `La boleta no se aceptó después de 2 horas de espera (${intento} intentos)`
  };
}

/**
 * verificación de estado
 */
export async function obtenerBoletaConVerificacion(
  folio: string | number,
  fecha: string,
  onStatusUpdate?: (estado: string, tiempo: number) => void
): Promise<{ success: boolean; pdfBuffer?: Buffer; estado?: string; error?: string }> {
  
  console.log(`Iniciando verificación de boleta `);

  // PASO 2: Buscar fecha real en el SII
  console.log(` Buscando fecha de la boleta en el SII`);
  const fechaSII = await obtenerFechaRealSII(folio);
  
  let fechaUsada = fecha;
  if (fechaSII) {
    fechaUsada = fechaSII;
    console.log(`Fecha encontrada`);
  } else {
    console.log(`No se encontró la boleta en el SII, usando fecha: ${fecha}`);
  }

  // PASO 3: Esperar estado válido (Aceptada o En Proceso)
  console.log(` Esperando que la boleta esté en estado válido `);
  
  const resultadoEspera = await esperarBoletaAceptada(folio, fechaUsada);
  
  if (!resultadoEspera.aceptada) {
    console.error(`La boleta no está en estado válido:`, resultadoEspera.error);
    return {
      success: false,
      error: resultadoEspera.error || 'La boleta no está en estado válido'
    };
  }
  
  console.log(` Boleta en estado "${resultadoEspera.estado}" - Enviando email...`);

  // PASO 4: Buscar fecha real de nuevo (confirmación)
  console.log(`Buscando fecha real de la boleta ${folio} nuevamente...`);
  const fechaSIIFinal = await obtenerFechaRealSII(folio);
  
  let fechaFinal = fechaUsada;
  if (fechaSIIFinal) {
    fechaFinal = fechaSIIFinal;
    console.log(`Fecha final del SII: ${fechaFinal}`);
  }

  // PASO 5: Descargar PDF
  console.log(`Descargando PDF con fecha ${fechaFinal}...`);
  try {
    const pdfBuffer = await obtenerPDFApiGateway(folio, fechaFinal);
    console.log(`PDF descargado correctamente (${pdfBuffer.length} bytes)`);
    
    return {
      success: true,
      pdfBuffer: pdfBuffer,
      estado: resultadoEspera.estado
    };
  } catch (pdfError: any) {
    console.error(`Error descargando PDF:`, pdfError.message);
    
    // Intentar con la fecha original como fallback
    if (fechaFinal !== fecha) {
      console.log(`Intentando con fecha original ${fecha}...`);
      try {
        const pdfBuffer = await obtenerPDFApiGateway(folio, fecha);
        console.log(`PDF descargado con fecha original (${pdfBuffer.length} bytes)`);
        return {
          success: true,
          pdfBuffer: pdfBuffer,
          estado: resultadoEspera.estado
        };
      } catch (retryError) {
        console.error(`Error en reintento:`, retryError);
      }
    }
    
    return {
      success: false,
      error: `Error al descargar PDF: ${pdfError.message}`
    };
  }
}