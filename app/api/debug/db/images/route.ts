import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const publicDir = path.join(process.cwd(), 'public');
    const uploadsDir = path.join(publicDir, 'uploads', 'products');
    
    const results = {
      publicDir,
      uploadsDirExists: fs.existsSync(uploadsDir),
      imagesInUploads: [] as string[],
      imagesInPublic: [] as string[],
      defaultImageExists: fs.existsSync(path.join(publicDir, 'diverse-products-still-life.png')),
      placeholderExists: fs.existsSync(path.join(publicDir, 'placeholder.svg')),
      error: null as string | null
    };

    // Verificar imágenes en uploads/products
    if (results.uploadsDirExists) {
      try {
        results.imagesInUploads = fs.readdirSync(uploadsDir)
          .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file));
      } catch (error) {
        results.imagesInUploads = [];
      }
    }

    // Verificar imágenes en public
    try {
      results.imagesInPublic = fs.readdirSync(publicDir)
        .filter(file => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file));
    } catch (error) {
      results.imagesInPublic = [];
    }

    console.log('📸 Image debug results:', results);
    
    return NextResponse.json(results);
    
  } catch (error) {
    console.error('❌ Image debug failed:', error);
    return NextResponse.json(
      { error: 'Image debug failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}