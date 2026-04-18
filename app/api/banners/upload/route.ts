import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getUserIdFromRequest } from '@/lib/auth-utils';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const user = await query('SELECT role FROM users WHERE id = ?', [userId]) as any[];
    if (!user.length || user[0].role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) return NextResponse.json({ error: 'No se proporcionó ningún archivo' }, { status: 400 });
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'El archivo debe ser una imagen' }, { status: 400 });
    if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: 'La imagen no puede superar los 2MB' }, { status: 400 });

    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const fileName = `banner_${timestamp}.${extension}`;
    const relativePath = `/banners/${fileName}`;
    const absolutePath = path.join(process.cwd(), 'public', 'banners', fileName);

    await mkdir(path.dirname(absolutePath), { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(absolutePath, buffer);

    console.log('✅ Imagen guardada en:', absolutePath);

    return NextResponse.json({
      success: true,
      imagePath: relativePath,
      fileName: fileName
    });
  } catch (error) {
    console.error('Error subiendo imagen:', error);
    return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 });
  }
}