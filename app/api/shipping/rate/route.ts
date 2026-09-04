// app/api/shipping/rate/route.ts - Versión corregida con siempre retiro en sucursal
import { NextRequest, NextResponse } from "next/server";
import { getShippingRates, getDeliveryDescription } from "@/lib/chilexpress-api";
import { getOfficesByCounty, getCountyCode } from "@/lib/chilexpress-geo";

export async function POST(request: NextRequest) {
  
  try {
    const body = await request.json();
    const { 
      communeName,
      regionName,
      declaredWorth = 100000, 
      productType = 3, 
      items,
      originCountyCode = "STGO"
    } = body;

    // Validaciones
    if (!communeName) {
      return NextResponse.json(
        { success: false, error: "Falta el nombre de la comuna" },
        { status: 400 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Se requiere al menos un producto para cotizar" },
        { status: 400 }
      );
    }

    // Calcular dimensiones del paquete
    let totalWeight = 0;
    let maxHeight = 0;
    let maxWidth = 0;
    let maxLength = 0;

    for (const item of items) {
      const quantity = item.quantity || 1;
      const weight = item.weight || 0.5;
      const height = item.height || 10;
      const width = item.width || 15;
      const length = item.length || 20;

      totalWeight += weight * quantity;
      maxHeight = Math.max(maxHeight, height);
      maxWidth = Math.max(maxWidth, width);
      maxLength = Math.max(maxLength, length);
    }

    const packageData = {
      weight: Math.max(totalWeight, 0.1),
      height: Math.max(maxHeight, 1),
      width: Math.max(maxWidth, 1),
      length: Math.max(maxLength, 1),
    };


    // Obtener código de la comuna
    let destinationCountyCode: string;
    try {
      destinationCountyCode = await getCountyCode(communeName, regionName);
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : `La comuna "${communeName}" no está disponible para envíos`,
      }, { status: 400 });
    }

    const shippingOptions: any[] = [];

    // =============================================
    // 1. COTIZAR ENVÍO A DOMICILIO
    // =============================================
    console.log("Cotizando envío a domicilio");
    
    const rateRequest = {
      originCountyCode,
      destinationCountyCode,
      package: packageData,
      productType: productType as 1 | 3,
      declaredWorth,
      deliveryTime: 0 as const,
    };

    let homeDeliveryOptions: any[] = [];
    let hasHomeDelivery = false;

    try {
      const rates = await getShippingRates(rateRequest);
      const allOptions = rates?.data?.courierServiceOptions || [];
      
      // Filtrar SOLO servicios prioritarios (2) y express (3)
      const allowedServiceCodes = [2, 3];
      
      homeDeliveryOptions = allOptions.filter(opt => 
        allowedServiceCodes.includes(opt.serviceTypeCode)
      );
      
      if (homeDeliveryOptions.length > 0) {
        hasHomeDelivery = true;
        
        // Opción 1: Envío por Pagar (el cliente paga al recibir)
        const cheapestOption = homeDeliveryOptions.reduce((prev, curr) => 
          parseInt(prev.serviceValue) < parseInt(curr.serviceValue) ? prev : curr
        );
        const cheapestPrice = parseInt(cheapestOption.serviceValue, 10);
        
        shippingOptions.push({
          id: "cash_on_delivery",
          type: "cash_on_delivery",
          name: "Envío por Pagar",
          price: 0,
          actualShippingCost: cheapestPrice,
          deliveryDescription: `Paga el envío al recibir`,
          conditions: "El cliente paga el envío a Chilexpress al momento de la entrega",
          isCashOnDelivery: true,
        });
        
        // Opción 2: Envíos a domicilio (PRIORITARIO y EXPRESS)
        for (const option of homeDeliveryOptions) {
          const price = parseInt(option.serviceValue, 10);
          
          shippingOptions.push({
            id: `home_delivery_${option.serviceTypeCode}`,
            type: "home_delivery",
            serviceTypeCode: option.serviceTypeCode,
            name: option.serviceTypeCode === 2 ? "Envío Prioritario" : "Envío Express",
            price: price,
            priceFormatted: `$${price.toLocaleString("es-CL")}`,
            finalWeight: parseFloat(option.finalWeight),
            finalWeightFormatted: `${parseFloat(option.finalWeight).toFixed(2)} kg`,
            didUseVolumetricWeight: option.didUseVolumetricWeight,
            deliveryDescription: getDeliveryDescription(option.serviceTypeCode, option.serviceDescription),
            conditions: "Precio calculado por Chilexpress",
            isHomeDelivery: true,
          });
        }
      } else {
        console.log("No hay servicios de envío a domicilio disponibles para esta comuna");
      }
      
    } catch (error) {
      console.error("Error en cotización a domicilio:", error);
    }

    // =============================================
    // 2. RETIRO EN SUCURSAL - SIEMPRE DISPONIBLE COMO OPCIÓN
    // =============================================
    console.log(" Buscando sucursales ");
    
    try {
      const offices = await getOfficesByCounty(communeName, 0);
      
      console.log(` Sucursales encontradas`);
      
      if (offices.length > 0) {
        // Precio base fijo para envío a sucursal
        let branchBasePrice = 3990;
        
        // Intentar obtener precio real de la API
        try {
          const branchRateRequest = {
            originCountyCode,
            destinationCountyCode,
            package: packageData,
            productType: productType as 1 | 3,
            declaredWorth,
            deliveryTime: 0 as const,
          };
          const rates = await getShippingRates(branchRateRequest);
          const cheapestOption = rates?.data?.courierServiceOptions?.[0];
          if (cheapestOption) {
            branchBasePrice = parseInt(cheapestOption.serviceValue, 10);
          }
        } catch (e) {
          console.log("No se pudo obtener precio de API para sucursal");
        }
        
        const branchesList = offices.map(office => ({
          id: office.addressId || office.officeCode || `branch_${Math.random()}`,
          name: office.officeName || "Sucursal Chilexpress",
          address: `${office.streetName || ""} ${office.streetNumber || ""}, ${office.countyName || communeName}`.trim(),
          telephone: office.telephone || "No disponible",
          latitude: office.latitude,
          longitude: office.longitude,
        }));
        
        // Determinar el mensaje de descripción
        let deliveryDesc = "Retira tu pedido en una sucursal Chilexpress cercana";
        if (hasHomeDelivery) {
          deliveryDesc = "Como alternativa al envío a domicilio, puedes retirar tu pedido en una sucursal Chilexpress";
        } else {
          deliveryDesc = `No hay envío a domicilio disponible en ${communeName}. Puedes retirar tu pedido en una de nuestras sucursales.`;
        }
        
        shippingOptions.push({
          id: "branch_pickup",
          type: "branch_pickup",
          name: "Retiro en Sucursal Chilexpress",
          price: branchBasePrice,
          priceFormatted: `$${branchBasePrice.toLocaleString("es-CL")}`,
          deliveryDescription: deliveryDesc,
          conditions: "Presentar cédula de identidad al retirar. Verificar horario de atención.",
          requiresBranchSelection: true,
          branches: branchesList,
          isBranchPickup: true,
        });
        
        console.log(` Opción de retiro en sucursal agregada (${offices.length} sucursales)`);
      } else {
        console.log("No se encontraron sucursales en esta comuna");
        // Si no hay sucursales, mostrar mensaje de contacto
        if (!hasHomeDelivery) {
          shippingOptions.push({
            id: "contact",
            type: "contact",
            name: "Contactar para envío",
            price: 0,
            deliveryDescription: `No hay opciones de envío disponibles para ${communeName}`,
            conditions: "Contáctanos para coordinar una solución alternativa",
            isContactRequired: true,
          });
        }
      }
    } catch (error) {
      console.error("Error obteniendo oficinas:", error);
      if (!hasHomeDelivery) {
        shippingOptions.push({
          id: "contact",
          type: "contact",
          name: "Contactar para envío",
          price: 0,
          deliveryDescription: `No hay opciones de envío disponibles para ${communeName}`,
          conditions: "Contáctanos para coordinar una solución alternativa",
          isContactRequired: true,
        });
      }
    }

    if (shippingOptions.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No hay opciones de envío disponibles para esta comuna",
      }, { status: 400 });
    }

    // Ordenar opciones: primero envío por pagar, luego las demás por precio
    shippingOptions.sort((a, b) => {
      if (a.isCashOnDelivery) return -1;
      if (b.isCashOnDelivery) return 1;
      if (a.isBranchPickup && b.isHomeDelivery) return 1;
      if (b.isBranchPickup && a.isHomeDelivery) return -1;
      return (a.price || 999999) - (b.price || 999999);
    });

    return NextResponse.json({
      success: true,
      commune: communeName,
      destinationCountyCode,
      hasHomeDelivery,
      packageInfo: {
        weight: packageData.weight,
        weightFormatted: `${packageData.weight.toFixed(2)} kg`,
        dimensions: `${packageData.height}x${packageData.width}x${packageData.length} cm`,
      },
      options: shippingOptions,
    });

  } catch (error) {
    console.error(" Error general:", error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Error al cotizar envío",
      },
      { status: 500 }
    );
  }
}