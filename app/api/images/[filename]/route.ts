import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const resolvedParams = await params;
    const filename = resolvedParams.filename;
    
    // Buscar en la carpeta uploads/products
    const filePath = path.join(process.cwd(), 'public', 'uploads', 'products', filename);
    
    console.log('📸 Buscando imagen:', filePath);
    
    if (!fs.existsSync(filePath)) {
      console.error('❌ Imagen no encontrada:', filePath);
      // Intentar buscar sin el timestamp
      const baseName = filename.split('?')[0];
      const basePath = path.join(process.cwd(), 'public', 'uploads', 'products', baseName);
      if (fs.existsSync(basePath)) {
        console.log('✅ Encontrada sin timestamp:', basePath);
        const fileBuffer = fs.readFileSync(basePath);
        const ext = path.extname(baseName).toLowerCase();
        const mimeType = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.webp': 'image/webp',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
        }[ext] || 'application/octet-stream';
        
        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': mimeType,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        });
      }
      
      return new NextResponse('Image not found', { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(filename).toLowerCase();
    const mimeType = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
    }[ext] || 'application/octet-stream';

    console.log('✅ Sirviendo imagen:', filePath, 'MIME:', mimeType);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('❌ Error sirviendo imagen:', error);
    return new NextResponse('Error serving image', { status: 500 });
  }
}