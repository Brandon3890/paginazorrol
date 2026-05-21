// app/api/chilexpress/nearby-offices/route.ts
import { NextRequest, NextResponse } from "next/server";
import { georeferenceAddress, getNearbyOffices } from "@/lib/chilexpress-geo";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { countyName, streetName, number, type, radius } = body;

    if (!countyName || !streetName || !number) {
      return NextResponse.json(
        { success: false, error: "Faltan countyName, streetName o number" },
        { status: 400 }
      );
    }

    // Primero georeferenciar la dirección
    const geoResult = await georeferenceAddress(countyName, streetName, number);
    
    if (!geoResult) {
      return NextResponse.json(
        { success: false, error: "No se pudo georeferenciar la dirección" },
        { status: 404 }
      );
    }

    // Buscar oficinas cercanas
    const offices = await getNearbyOffices(
      geoResult.addressId,
      type || 0,
      radius || 5
    );

    return NextResponse.json({
      success: true,
      address: geoResult,
      nearbyOffices: offices,
    });
  } catch (error) {
    console.error("Error getting nearby offices:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Error obteniendo oficinas cercanas" },
      { status: 500 }
    );
  }
}