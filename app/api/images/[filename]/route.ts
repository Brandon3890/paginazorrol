import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const resolvedParams = await params;
    let filename = resolvedParams.filename;
    
    // Decodificar URL (manejar caracteres especiales como ñ, acentos, espacios)
    filename = decodeURIComponent(filename);
    
    // Limpiar el nombre del archivo (remover parámetros de query)
    const cleanFilename = filename.split('?')[0];
    
    // Buscar en la carpeta uploads/products
    let filePath = path.join(process.cwd(), 'public', 'uploads', 'products', cleanFilename);
    
    
    // Si no existe, buscar con normalización (eliminar caracteres problemáticos)
    if (!fs.existsSync(filePath)) {
      // Intentar encontrar el archivo sin importar mayúsculas/minúsculas
      const dir = path.dirname(filePath);
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        // Buscar archivo que coincida ignorando mayúsculas/minúsculas
        const normalizedFilename = cleanFilename.toLowerCase();
        const matchedFile = files.find(f => f.toLowerCase() === normalizedFilename);
        
        if (matchedFile) {
          filePath = path.join(dir, matchedFile);
        }
      }
    }
    
    // Si no existe, intentar buscar sin caracteres especiales
    if (!fs.existsSync(filePath)) {
      const dir = path.dirname(filePath);
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        // Buscar archivo que coincida sin ñ, acentos, etc.
        const baseName = path.basename(cleanFilename, path.extname(cleanFilename));
        const normalizedSearch = baseName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const similarFiles = files.filter(f => {
          const fName = path.basename(f, path.extname(f));
          const fNormalized = fName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return fNormalized.includes(normalizedSearch) || normalizedSearch.includes(fNormalized);
        });
        
        if (similarFiles.length > 0) {
          filePath = path.join(dir, similarFiles[0]);
        }
      }
    }
    
    if (!fs.existsSync(filePath)) {
      console.error('❌ Imagen no encontrada:', filePath);
      
      // Si no se encuentra, devolver imagen por defecto
      const defaultPath = path.join(process.cwd(), 'public', 'uploads', 'products', 'diverse-products-still-life.png');
      if (fs.existsSync(defaultPath)) {
        const fileBuffer = fs.readFileSync(defaultPath);
        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        });
      }
      
      return new NextResponse('Image not found', { status: 404 });
    }

    // Verificar que el archivo no está vacío
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      console.error('❌ Archivo vacío:', filePath);
      const defaultPath = path.join(process.cwd(), 'public', 'uploads', 'products', 'diverse-products-still-life.png');
      if (fs.existsSync(defaultPath)) {
        const fileBuffer = fs.readFileSync(defaultPath);
        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        });
      }
      return new NextResponse('Image corrupted', { status: 500 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(cleanFilename).toLowerCase();
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
        'Content-Length': stats.size.toString(),
      },
    });
  } catch (error) {
    console.error('❌ Error sirviendo imagen:', error);
    
    // Devolver imagen por defecto en caso de error
    try {
      const defaultPath = path.join(process.cwd(), 'public', 'uploads', 'products', 'diverse-products-still-life.png');
      if (fs.existsSync(defaultPath)) {
        const fileBuffer = fs.readFileSync(defaultPath);
        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        });
      }
    } catch (e) {
      console.error('❌ Error al servir imagen por defecto:', e);
    }
    
    return new NextResponse('Error serving image', { status: 500 });
  }
}