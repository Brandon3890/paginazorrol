// app/api/shipping/calculate/route.ts (nuevo endpoint)
import { NextRequest, NextResponse } from "next/server";
import { getShippingRates, getDeliveryDescription } from "@/lib/chilexpress-api";
import { getCountyCode } from "@/lib/chilexpress-geo";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      addressId,
      communeName,      // Desde la BD: user_addresses.commune_name
      regionName,       // Desde la BD: user_addresses.region_name
      items,
      originCountyCode = "STGO" // Origen fijo (puedes cambiarlo según tu bodega)
    } = body;

    if (!communeName) {
      return NextResponse.json(
        { success: false, error: "Falta la comuna de destino" },
        { status: 400 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Se requiere al menos un producto" },
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

    console.log("📍 Calculando envío a:", communeName);
    console.log("📦 Paquete:", packageData);

    // Obtener código de la comuna desde la API de Chilexpress
    let destinationCountyCode: string;
    try {
      destinationCountyCode = await getCountyCode(communeName);
      console.log(`✅ Código encontrado: ${destinationCountyCode} para ${communeName}`);
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: `La comuna "${communeName}" no está en la cobertura de Chilexpress`,
        commune: communeName,
      }, { status: 400 });
    }

    // Cotizar envío
    let rateOptions = [];
    let cheapestOption = null;
    
    try {
      const rates = await getShippingRates({
        originCountyCode,
        destinationCountyCode,
        package: packageData,
        productType: 3, // Encomienda
        declaredWorth: 100000,
        deliveryTime: 0, // Todos los servicios
      });

      rateOptions = rates.data.courierServiceOptions;
      
      // Encontrar el más barato
      cheapestOption = rateOptions.reduce((prev, curr) => 
        parseInt(prev.serviceValue) < parseInt(curr.serviceValue) ? prev : curr
      );

      console.log(`💰 Opción más barata: ${cheapestOption.serviceDescription} - $${cheapestOption.serviceValue}`);
      
    } catch (error) {
      console.error("Error al cotizar:", error);
      return NextResponse.json({
        success: false,
        error: `No se pudo cotizar envío a ${communeName}. ${error instanceof Error ? error.message : ''}`,
      }, { status: 500 });
    }

    // Construir respuesta
    const shippingOptions = rateOptions.map(option => ({
      serviceTypeCode: option.serviceTypeCode,
      name: option.serviceDescription,
      price: parseInt(option.serviceValue, 10),
      priceFormatted: `$${parseInt(option.serviceValue, 10).toLocaleString("es-CL")}`,
      finalWeight: parseFloat(option.finalWeight),
      finalWeightFormatted: `${parseFloat(option.finalWeight).toFixed(2)} kg`,
      volumetricWeightUsed: option.didUseVolumetricWeight,
      deliveryDescription: getDeliveryDescription(option.serviceTypeCode, option.serviceDescription),
    }));

    return NextResponse.json({
      success: true,
      address: {
        commune: communeName,
        region: regionName,
      },
      package: {
        weight: packageData.weight,
        weightFormatted: `${packageData.weight.toFixed(2)} kg`,
        dimensions: `${packageData.height}x${packageData.width}x${packageData.length} cm`,
      },
      cheapestShipping: cheapestOption ? {
        name: cheapestOption.serviceDescription,
        price: parseInt(cheapestOption.serviceValue, 10),
        priceFormatted: `$${parseInt(cheapestOption.serviceValue, 10).toLocaleString("es-CL")}`,
        deliveryDescription: getDeliveryDescription(cheapestOption.serviceTypeCode, cheapestOption.serviceDescription),
      } : null,
      allOptions: shippingOptions,
    });

  } catch (error) {
    console.error("❌ Error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Error al calcular envío"
      },
      { status: 500 }
    );
  }
}