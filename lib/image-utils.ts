import sharp from 'sharp';

export async function processImage(
  file: File, 
  filename: string, 
  width: number = 1024, 
  height: number = 1024
): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Procesar imagen con sharp
  const processedImage = await sharp(buffer)
    .resize(width, height, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: 80 })
    .toBuffer();

  // Guardar en sistema de archivos
  const uploadDir = `${process.cwd()}/public/uploads/products`;
  const uniqueFilename = `${filename}-${Date.now()}.jpg`;
  const filepath = `${uploadDir}/${uniqueFilename}`;

  const fs = require('fs');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  fs.writeFileSync(filepath, processedImage);

  return `/uploads/products/${uniqueFilename}`;
}