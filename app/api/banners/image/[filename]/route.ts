import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    
    // Validar que el filename no contenga path traversal
    const safeFilename = path.basename(filename);
    const imagePath = path.join(process.cwd(), 'public', 'banners', safeFilename);
    
    // Verificar si el archivo existe
    if (!existsSync(imagePath)) {
      return NextResponse.json({ error: 'Imagen no encontrada' }, { status: 404 });
    }
    
    // Leer el archivo
    const imageBuffer = await readFile(imagePath);
    
    // Determinar el content type por extensión
    const ext = path.extname(safeFilename).toLowerCase();
    const contentType = ext === '.png' ? 'image/png' : 
                        ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 
                        ext === '.webp' ? 'image/webp' : 'image/jpeg';
    
    // Devolver la imagen
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error serving image:', error);
    return NextResponse.json({ error: 'Error al cargar la imagen' }, { status: 500 });
  }
}