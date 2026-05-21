// lib/chilexpress-api.ts
const RATING_API_URL = process.env.CHILEXPRESS_RATING_URL;
const RATING_API_KEY = process.env.CHILEXPRESS_RATING_KEY;
const API_VERSION = process.env.CHILEXPRESS_API_VERSION || "1.0";

export interface ChilexpressRateRequest {
  originCountyCode: string;
  destinationCountyCode: string;
  package: {
    weight: number;
    height: number;
    width: number;
    length: number;
  };
  productType: 1 | 3;
  contentType?: number;
  declaredWorth: number;
  deliveryTime?: 0 | 1 | 2 | 3;
}

export interface CourierServiceOption {
  serviceTypeCode: number;
  serviceDescription: string;
  didUseVolumetricWeight: boolean;
  finalWeight: string;
  serviceValue: string;
  conditions: string;
  deliveryType: number;
  additionalServices: any[];
}

export interface ChilexpressRateResponse {
  data: {
    courierServiceOptions: CourierServiceOption[];
  };
  statusCode: number;
  statusDescription: string;
  errors: string[] | null;
}

const buildRatingUrl = (endpoint: string): string => {
  return `${RATING_API_URL}/api/v${API_VERSION}${endpoint}`;
};

export async function getShippingRates(request: ChilexpressRateRequest): Promise<ChilexpressRateResponse> {
  if (!RATING_API_URL || !RATING_API_KEY) {
    throw new Error('CHILEXPRESS_RATING_URL o CHILEXPRESS_RATING_KEY no configuradas');
  }

  const url = buildRatingUrl('/rates/courier');
  console.log("📡 Rating URL:", url);
  
  const body = {
    originCountyCode: request.originCountyCode,
    destinationCountyCode: request.destinationCountyCode,
    package: {
      weight: request.package.weight.toString(),
      height: request.package.height.toString(),
      width: request.package.width.toString(),
      length: request.package.length.toString(),
    },
    productType: request.productType,
    contentType: request.contentType || 1,
    declaredWorth: request.declaredWorth.toString(),
    deliveryTime: request.deliveryTime ?? 0,
  };

  console.log("📦 Rating request body:", JSON.stringify(body, null, 2));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": RATING_API_KEY,
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  console.log(`📡 Rating response status: ${response.status}`);

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    throw new Error(`Respuesta no válida: ${responseText.substring(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(data.statusDescription || data.message || `Error ${response.status}`);
  }

  if (data.statusCode !== 0) {
    throw new Error(data.statusDescription || data.errors?.join(", ") || "Error desconocido");
  }

  if (!data.data?.courierServiceOptions || data.data.courierServiceOptions.length === 0) {
    throw new Error("No hay servicios de envío disponibles para esta ruta");
  }

  return data;
}

export function getDeliveryDescription(serviceTypeCode: number, serviceDescription: string): string {
  switch (serviceTypeCode) {
    case 2:
      return "Envío PRIORITARIO - Entrega en 1-2 días hábiles";
    case 3:
      return "Envío EXPRESS - Entrega en 2-3 días hábiles";
    case 4:
      return "Envío EXTENDIDO - Entrega en 3-5 días hábiles";
    case 5:
      return "Envío EXTREMOS - Plazos especiales";
    default:
      return serviceDescription || "Tiempo calculado por Chilexpress";
  }
}