// app/api/revalidate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath as revalidate } from 'next/cache';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');
    
    if (!path) {
      return NextResponse.json({ error: 'Path requerido' }, { status: 400 });
    }
    
    revalidate(path);
    
    return NextResponse.json({ 
      success: true, 
      message: `Revalidated: ${path}` 
    });
  } catch (error) {
    console.error('Revalidation error:', error);
    return NextResponse.json(
      { error: 'Error al revalidar' },
      { status: 500 }
    );
  }
}