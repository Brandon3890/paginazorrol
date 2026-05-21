// app/api/shipping/rate/route.ts - Versión corregida
import { NextRequest, NextResponse } from "next/server";
import { getShippingRates, getDeliveryDescription } from "@/lib/chilexpress-api";
import { getOfficesByCounty, getCountyCode } from "@/lib/chilexpress-geo";

export async function POST(request: NextRequest) {
  console.log("🚀 Cotizando con API de Chilexpress...");
  
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

    console.log("Package:", packageData);
    console.log("Origen:", originCountyCode);
    console.log("Destino comuna:", communeName);

    // Obtener código de la comuna
    let destinationCountyCode: string;
    try {
      destinationCountyCode = await getCountyCode(communeName, regionName);
      console.log(`✅ Código destino: ${destinationCountyCode}`);
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
    console.log("Cotizando envío a domicilio...");
    
    const rateRequest = {
      originCountyCode,
      destinationCountyCode,
      package: packageData,
      productType: productType as 1 | 3,
      declaredWorth,
      deliveryTime: 0 as const, // Usar 'as const' para tipo literal
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
        console.log(`Servicios a domicilio encontrados: ${homeDeliveryOptions.length}`);
        
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
    // 2. RETIRO EN SUCURSAL (SOLO si NO hay envío a domicilio)
    // =============================================
    if (!hasHomeDelivery) {
      console.log("🏢 No hay envío a domicilio, buscando sucursales como alternativa...");
      
      try {
        const offices = await getOfficesByCounty(communeName, 0);
        
        console.log(`🏢 Sucursales encontradas: ${offices.length}`);
        
        if (offices.length > 0) {
          // Precio base fijo para envío a sucursal (calculado con la API)
          let branchBasePrice = 3990; // Precio por defecto
          
          try {
            // Intentamos cotizar con la misma comuna
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
            console.log("No se pudo obtener precio de API para sucursal, usando precio base");
          }
          
          const branchesList = offices.map(office => ({
            id: office.addressId || office.officeCode,
            name: office.officeName,
            address: `${office.streetName} ${office.streetNumber}, ${office.countyName}`,
            telephone: office.telephone || "No disponible",
            latitude: office.latitude,
            longitude: office.longitude,
          }));
          
          shippingOptions.push({
            id: "branch_pickup",
            type: "branch_pickup",
            name: "Retiro en Sucursal Chilexpress",
            price: branchBasePrice,
            priceFormatted: `$${branchBasePrice.toLocaleString("es-CL")}`,
            deliveryDescription: `No hay envío a domicilio disponible en ${communeName}. Puedes retirar tu pedido en una de nuestras sucursales.`,
            conditions: "Presentar cédula de identidad al retirar. Pago contra entrega en sucursal.",
            requiresBranchSelection: true,
            branches: branchesList,
          });
          
          console.log(`✅ Opción de retiro en sucursal agregada (${offices.length} sucursales)`);
        } else {
          shippingOptions.push({
            id: "contact",
            type: "contact",
            name: "📞 Contactar para envío",
            price: 0,
            deliveryDescription: `No hay opciones de envío disponibles para ${communeName}`,
            conditions: "Contáctanos para coordinar una solución alternativa",
            isContactRequired: true,
          });
        }
      } catch (error) {
        console.error("Error obteniendo oficinas:", error);
        shippingOptions.push({
          id: "contact",
          type: "contact",
          name: "📞 Contactar para envío",
          price: 0,
          deliveryDescription: `No hay opciones de envío disponibles para ${communeName}`,
          conditions: "Contáctanos para coordinar una solución alternativa",
          isContactRequired: true,
        });
      }
    }

    if (shippingOptions.length === 0) {
      throw new Error("No hay opciones de envío disponibles");
    }

    // Ordenar opciones
    shippingOptions.sort((a, b) => {
      if (a.isCashOnDelivery) return -1;
      if (b.isCashOnDelivery) return 1;
      return (a.price || 0) - (b.price || 0);
    });

    const cheapestHomeDelivery = shippingOptions.find(opt => opt.type === "home_delivery");

    console.log(`✅ Total opciones: ${shippingOptions.length}`);

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
      cheapestHomeDelivery: cheapestHomeDelivery ? {
        name: cheapestHomeDelivery.name,
        price: cheapestHomeDelivery.price,
        priceFormatted: cheapestHomeDelivery.priceFormatted,
        deliveryDescription: cheapestHomeDelivery.deliveryDescription,
      } : null,
      options: shippingOptions,
    });

  } catch (error) {
    console.error("❌ Error general:", error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Error al cotizar envío",
      },
      { status: 500 }
    );
  }
}