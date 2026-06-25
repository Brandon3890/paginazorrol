import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imagePath = searchParams.get('path');
  
  if (!imagePath) {
    return NextResponse.json({ error: 'No path provided' }, { status: 400 });
  }
  
  // Limpiar la ruta
  const cleanPath = imagePath.replace(/^\/+/, '');
  const fullPath = path.join(process.cwd(), 'public', cleanPath);
  
  const exists = fs.existsSync(fullPath);
  const isDirectory = exists ? fs.statSync(fullPath).isDirectory() : false;
  
  // Listar archivos en la carpeta uploads para debugging
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'products');
  let files: string[] = [];
  if (fs.existsSync(uploadsDir)) {
    files = fs.readdirSync(uploadsDir);
  }
  
  return NextResponse.json({
    requestedPath: imagePath,
    fullPath: fullPath,
    exists: exists,
    isDirectory: isDirectory,
    filesInUploads: files,
    uploadsDirExists: fs.existsSync(uploadsDir)
  });
}