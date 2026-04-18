// app/api/banners/delete-image/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import path from 'path';
import { getUserIdFromRequest } from '@/lib/auth-utils';
import { query } from '@/lib/db';

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const user = await query(
      'SELECT role FROM users WHERE id = ?',
      [userId]
    ) as any[];

    if (!user.length || user[0].role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    let imagePath = searchParams.get('path');

    if (!imagePath) {
      return NextResponse.json({ error: 'Ruta de imagen requerida' }, { status: 400 });
    }

    // Decodificar URL
    imagePath = decodeURIComponent(imagePath);

    // Verificar si es una ruta de archivo válida (no base64)
    // Las rutas válidas comienzan con /banners/ y no contienen data:image
    if (!imagePath.startsWith('/banners/') || imagePath.includes('data:image')) {
      console.log('⚠️ No es una ruta de archivo válida, omitiendo eliminación:', imagePath.substring(0, 100));
      return NextResponse.json({ success: true, message: 'No es un archivo físico' });
    }

    // No eliminar imágenes por defecto
    const defaultImages = ['/banners/witcher.jpg', '/banners/banner2.jpg'];
    if (defaultImages.includes(imagePath)) {
      console.log('📌 Imagen por defecto, no se elimina:', imagePath);
      return NextResponse.json({ success: true, message: 'Imagen por defecto no eliminada' });
    }

    const absolutePath = path.join(process.cwd(), 'public', imagePath);
    
    try {
      await unlink(absolutePath);
      console.log('✅ Imagen eliminada:', absolutePath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log('⚠️ Archivo no existe, continuando:', absolutePath);
      } else {
        throw error;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Error al eliminar la imagen' },
      { status: 500 }
    );
  }
}