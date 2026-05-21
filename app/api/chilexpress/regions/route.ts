// app/api/chilexpress/regions/route.ts
import { NextResponse } from "next/server";
import { getRegions } from "@/lib/chilexpress-geo";

export async function GET() {
  try {
    const regions = await getRegions();
    return NextResponse.json({ success: true, regions });
  } catch (error) {
    console.error("Error fetching regions:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Error obteniendo regiones" },
      { status: 500 }
    );
  }
}