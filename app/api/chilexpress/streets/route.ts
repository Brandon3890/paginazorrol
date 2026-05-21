// app/api/chilexpress/streets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { searchStreets } from "@/lib/chilexpress-geo";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { countyName, streetName, limit } = body;

    if (!countyName || !streetName) {
      return NextResponse.json(
        { success: false, error: "Faltan countyName o streetName" },
        { status: 400 }
      );
    }

    const streets = await searchStreets(countyName, streetName, limit || 20);
    return NextResponse.json({ success: true, streets });
  } catch (error) {
    console.error("Error searching streets:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Error buscando calles" },
      { status: 500 }
    );
  }
}