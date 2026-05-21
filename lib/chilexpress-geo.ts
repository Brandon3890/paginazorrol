// lib/chilexpress-geo.ts
const GEO_API_URL = process.env.CHILEXPRESS_GEO_URL;
const GEO_API_KEY = process.env.CHILEXPRESS_GEO_KEY;
const API_VERSION = process.env.CHILEXPRESS_API_VERSION || "1.0";

const getHeaders = () => ({
  "Content-Type": "application/json",
  "Ocp-Apim-Subscription-Key": GEO_API_KEY || "",
});

const buildUrl = (endpoint: string, params?: Record<string, any>): string => {
  let url = `${GEO_API_URL}/api/v${API_VERSION}${endpoint}`;
  
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, value.toString());
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }
  
  return url;
};

// =====================================================
// 1. CONSULTAR REGIONES
// =====================================================
export interface Region {
  regionId: string;
  regionName: string;
  ineRegionCode: number;
}

export async function getRegions(): Promise<Region[]> {
  if (!GEO_API_URL || !GEO_API_KEY) {
    throw new Error('CHILEXPRESS_GEO_URL o CHILEXPRESS_GEO_KEY no configuradas');
  }

  const url = buildUrl('/regions');
  console.log("📡 Fetching regions:", url);
  
  const response = await fetch(url, { headers: getHeaders() });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Error al obtener regiones`);
  }

  const data = await response.json();
  
  if (data.statusCode === 0 && data.regions) {
    return data.regions;
  }
  
  throw new Error(data.statusDescription || "Error al obtener regiones");
}

// =====================================================
// 2. CONSULTAR COBERTURAS (COMUNAS) POR REGIÓN
// =====================================================
export interface CoverageArea {
  countyCode: string;
  countyName: string;
  regionCode: string;
  ineCountyCode: number;
  queryMode: number;
  coverageName: string;
  ind_ppd?: number;
  ind_rd?: number;
}

export async function getCoverageAreas(regionCode: string, type: number = 1): Promise<CoverageArea[]> {
  if (!GEO_API_URL || !GEO_API_KEY) {
    throw new Error('CHILEXPRESS_GEO_URL o CHILEXPRESS_GEO_KEY no configuradas');
  }

  if (!regionCode) {
    throw new Error('Se requiere regionCode para obtener coberturas');
  }

  const params: Record<string, any> = { 
    RegionCode: regionCode,
    type 
  };
  
  const url = buildUrl('/coverage-areas', params);
  console.log("📡 Fetching coverage areas for region:", regionCode, url);
  
  const response = await fetch(url, { headers: getHeaders() });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Error al obtener coberturas para región ${regionCode}`);
  }

  const data = await response.json();
  
  if (data.statusCode === 0 && data.coverageAreas) {
    return data.coverageAreas;
  }
  
  throw new Error(data.statusDescription || "Error al obtener coberturas");
}

// =====================================================
// 3. BUSCAR CALLES
// =====================================================
export interface Street {
  streetId: number;
  streetName: string;
  countyName: string;
  roadType: string;
}

export async function searchStreets(
  countyName: string,
  streetName: string,
  limit: number = 20
): Promise<Street[]> {
  if (!GEO_API_URL || !GEO_API_KEY) {
    throw new Error('CHILEXPRESS_GEO_URL o CHILEXPRESS_GEO_KEY no configuradas');
  }

  const url = buildUrl('/streets/search', { limit });
  console.log("📡 Searching streets:", url);
  
  const response = await fetch(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      countyName: countyName.toUpperCase(),
      streetName: streetName,
      pointsOfInterestEnabled: false,
      streetNameEnabled: true,
      roadType: 0,
    }),
  });

  const data = await response.json();
  
  if (data.statusCode === 0 && data.streets) {
    return data.streets;
  }
  
  throw new Error(data.statusDescription || "Error al buscar calles");
}

// =====================================================
// 4. CONSULTAR NUMERACIONES
// =====================================================
export interface StreetNumber {
  number: number;
  latitude: number;
  longitude: number;
  addressId: number;
}

export async function getStreetNumbers(
  streetNameId: number,
  streetNumber?: string
): Promise<StreetNumber[]> {
  if (!GEO_API_URL || !GEO_API_KEY) {
    throw new Error('CHILEXPRESS_GEO_URL o CHILEXPRESS_GEO_KEY no configuradas');
  }

  const params = streetNumber ? { streetNumber } : undefined;
  const url = buildUrl(`/streets/${streetNameId}/numbers`, params);
  console.log("📡 Getting street numbers:", url);
  
  const response = await fetch(url, { headers: getHeaders() });

  const data = await response.json();
  
  if (data.statusCode === 0 && data.streetNumbers) {
    return data.streetNumbers;
  }
  
  throw new Error(data.statusDescription || "Error al obtener numeraciones");
}

// =====================================================
// 5. GEOREFERENCIAR DIRECCIÓN
// =====================================================
export interface GeoreferenceResult {
  addressId: number;
  latitude: string;
  longitude: string;
}

export async function georeferenceAddress(
  countyName: string,
  streetName: string,
  number: string
): Promise<GeoreferenceResult> {
  if (!GEO_API_URL || !GEO_API_KEY) {
    throw new Error('CHILEXPRESS_GEO_URL o CHILEXPRESS_GEO_KEY no configuradas');
  }

  const url = buildUrl('/addresses/georeference');
  console.log("📡 Georeferencing address:", url);
  
  const response = await fetch(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      countyName: countyName,
      streetName: streetName,
      number: number,
    }),
  });

  const data = await response.json();
  
  if (data.statusCode === 0 && data.data) {
    return data.data;
  }
  
  throw new Error(data.statusDescription || "Error al georeferenciar dirección");
}

// =====================================================
// 6. OFICINAS DE ENTREGA POR COMUNA
// =====================================================
export interface Office {
  regionName: string;
  countyName: string;
  officeName: string;
  officeType: number;
  streetName: string;
  streetNumber: number;
  complement: string;
  addressId: number;
  latitude: string;
  longitude: string;
  telephone: string;
  officeCode: number;
  regionCode: string;
  eMail: string;
  businessHour?: any[];
  officeServices?: any[];
  managerName?: string;
  streetNameId?: number;
  ineCountyId?: number;
}

export async function getOfficesByCounty(
  countyName: string,
  type: number = 0
): Promise<Office[]> {
  if (!GEO_API_URL || !GEO_API_KEY) {
    throw new Error('CHILEXPRESS_GEO_URL o CHILEXPRESS_GEO_KEY no configuradas');
  }

  const params: Record<string, any> = { Type: type };
  if (countyName) {
    params.CountyName = countyName;
  }
  
  const url = buildUrl('/offices', params);
  console.log("📡 Getting offices by county:", url);
  
  const response = await fetch(url, { headers: getHeaders() });

  const data = await response.json();
  
  if (data.statusCode === 0 && data.offices) {
    return data.offices;
  }
  
  if (data.statusDescription?.includes("no existe")) {
    return [];
  }
  
  throw new Error(data.statusDescription || "Error al obtener oficinas");
}

// =====================================================
// 7. OFICINAS CERCANAS
// =====================================================
export interface NearbyOffice {
  distance: string;
  office: Office;
}

export async function getNearbyOffices(
  addressId: number,
  type: number = 0,
  radius: number = 10
): Promise<NearbyOffice[]> {
  if (!GEO_API_URL || !GEO_API_KEY) {
    throw new Error('CHILEXPRESS_GEO_URL o CHILEXPRESS_GEO_KEY no configuradas');
  }

  const params: Record<string, any> = {};
  if (type !== undefined) params.type = type;
  if (radius !== undefined) params.radius = radius;
  
  const url = buildUrl(`/nearby-offices/${addressId}`, params);
  console.log("📡 Getting nearby offices:", url);
  
  const response = await fetch(url, { headers: getHeaders() });

  const data = await response.json();
  
  if (data.statusCode === 0 && data.nearbyOffice) {
    return data.nearbyOffice;
  }
  
  return [];
}

// =====================================================
// UTILIDAD: Obtener código de comuna desde nombre y región
// =====================================================
let regionsCache: Region[] | null = null;
let coveragesCache: Map<string, Map<string, string>> = new Map(); // regionCode -> Map<comuna, countyCode>
let cacheTimestamp = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 hora

export async function getCountyCode(communeName: string, regionName?: string): Promise<string> {
  // Primero obtener todas las regiones
  if (!regionsCache) {
    regionsCache = await getRegions();
    console.log(`✅ Regiones cargadas: ${regionsCache.length}`);
  }
  
  // Determinar el código de región
  let targetRegionCode: string | null = null;
  
  if (regionName) {
    // Buscar por nombre de región
    const matchedRegion = regionsCache.find(r => 
      r.regionName.toLowerCase().includes(regionName.toLowerCase()) ||
      regionName.toLowerCase().includes(r.regionName.toLowerCase())
    );
    if (matchedRegion) {
      targetRegionCode = matchedRegion.regionId;
      console.log(`📍 Región encontrada: ${targetRegionCode} para "${regionName}"`);
    }
  }
  
  // Si no se encontró por nombre, buscar en todas las regiones
  if (!targetRegionCode) {
    console.log("🔍 Buscando comuna en todas las regiones...");
    
    for (const region of regionsCache) {
      try {
        const coverages = await getCoverageAreas(region.regionId, 1);
        const cache = new Map<string, string>();
        
        for (const coverage of coverages) {
          const normalizedName = coverage.countyName.toLowerCase().trim();
          cache.set(normalizedName, coverage.countyCode);
          // Sin tildes
          const noAccent = normalizedName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          cache.set(noAccent, coverage.countyCode);
        }
        
        coveragesCache.set(region.regionId, cache);
        
        const normalizedInput = communeName.toLowerCase().trim();
        const noAccentInput = normalizedInput.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        if (cache.has(normalizedInput) || cache.has(noAccentInput)) {
          targetRegionCode = region.regionId;
          console.log(`✅ Comuna "${communeName}" encontrada en región ${targetRegionCode}`);
          break;
        }
      } catch (error) {
        console.warn(`⚠️ Error obteniendo coberturas para región ${region.regionId}:`, error);
      }
    }
  }
  
  if (!targetRegionCode) {
    throw new Error(`No se pudo determinar la región para la comuna: ${communeName}`);
  }
  
  // Obtener el código de la comuna
  let cache = coveragesCache.get(targetRegionCode);
  if (!cache) {
    const coverages = await getCoverageAreas(targetRegionCode, 1);
    cache = new Map();
    for (const coverage of coverages) {
      const normalizedName = coverage.countyName.toLowerCase().trim();
      cache.set(normalizedName, coverage.countyCode);
      const noAccent = normalizedName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      cache.set(noAccent, coverage.countyCode);
    }
    coveragesCache.set(targetRegionCode, cache);
  }
  
  const normalizedInput = communeName.toLowerCase().trim();
  const noAccentInput = normalizedInput.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  const code = cache.get(normalizedInput) || cache.get(noAccentInput);
  
  if (!code) {
    throw new Error(`La comuna "${communeName}" no está en la cobertura de Chilexpress para la región ${targetRegionCode}`);
  }
  
  return code;
}

// =====================================================
// UTILIDAD: Obtener todas las comunas de Chile (todas las regiones)
// =====================================================
export async function getAllCoverageAreas(): Promise<CoverageArea[]> {
  const regions = await getRegions();
  const allCoverages: CoverageArea[] = [];
  
  for (const region of regions) {
    try {
      const coverages = await getCoverageAreas(region.regionId, 1);
      allCoverages.push(...coverages);
      console.log(`📋 Región ${region.regionId}: ${coverages.length} comunas`);
    } catch (error) {
      console.error(`Error obteniendo coberturas para ${region.regionId}:`, error);
    }
  }
  
  console.log(`✅ Total comunas cargadas: ${allCoverages.length}`);
  return allCoverages;
}