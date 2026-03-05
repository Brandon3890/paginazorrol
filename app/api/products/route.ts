import { NextResponse } from 'next/server';
import { Transaction } from '@/lib/db-transaction';
import fs from 'fs';
import path from 'path';

// Función para guardar imágenes
async function saveImage(file: File, filename: string): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  
  // Crear directorio si no existe
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'products');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Generar nombre único
  const extension = file.type.split('/')[1] || 'jpg';
  const uniqueFilename = `${filename}-${Date.now()}.${extension}`;
  const filepath = path.join(uploadDir, uniqueFilename);

  // Guardar archivo
  fs.writeFileSync(filepath, buffer);
  
  return `/uploads/products/${uniqueFilename}`;
}

// Función para corregir URL de imagen
function correctImageUrl(imagePath: string | null): string {
  if (!imagePath) {
    return '/diverse-products-still-life.png';
  }
  
  if (imagePath.startsWith('/')) {
    return imagePath;
  }
  
  if (imagePath.startsWith('uploads/')) {
    return `/${imagePath}`;
  }
  
  if (imagePath.includes('.jpg') || imagePath.includes('.jpeg') || imagePath.includes('.png')) {
    return `/uploads/products/${imagePath}`;
  }
  
  return '/diverse-products-still-life.png';
}

// GET /api/products - Obtener todos los productos
export async function GET(request: Request) {
  const transaction = new Transaction();
  
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const isAdmin = searchParams.get('admin') === 'true';

    // Iniciar transacción
    await transaction.begin();

    // Construir WHERE clause
    let whereClause = '';
    if (!isAdmin && !includeInactive) {
      whereClause = 'WHERE p.is_active = true';
    } else if (isAdmin) {
      whereClause = '';
    }

    const products = await transaction.query(`
      SELECT 
        p.id,
        p.name,
        p.slug,
        p.description,
        p.price,
        p.original_price as originalPrice,
        p.image,
        c.name as category,
        c.id as categoryId,
        p.age_min as ageMin,
        p.age_display as age,
        p.players_min as playersMin,
        p.players_max as playersMax,
        p.players_display as players,
        p.duration_min as durationMin,
        p.duration_display as duration,
        p.stock,
        p.in_stock as inStock,
        p.is_on_sale as isOnSale,
        p.is_active as isActive,
        p.created_at as createdAt,
        p.updated_at as updatedAt,
        GROUP_CONCAT(DISTINCT s.name) as subcategory_names,
        GROUP_CONCAT(DISTINCT s.id) as subcategory_ids
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_subcategories ps ON p.id = ps.product_id
      LEFT JOIN subcategories s ON ps.subcategory_id = s.id
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `) as any[];

    // Para cada producto, obtener sus imágenes adicionales
    const productsWithAdditionalImages = await Promise.all(
      products.map(async (product) => {
        // Obtener imágenes adicionales para este producto
        const additionalImagesResult = await transaction.query(
          'SELECT image_url FROM product_images WHERE product_id = ? ORDER BY display_order',
          [product.id]
        ) as any[];

        const additionalImages = additionalImagesResult.map((row: any) => row.image_url);

        const imageUrl = correctImageUrl(product.image);
        const correctedAdditionalImages = additionalImages.map(correctImageUrl);

        // Procesar subcategorías
        const subcategoryNames = product.subcategory_names ? product.subcategory_names.split(',') : [];
        const subcategoryIds = product.subcategory_ids ? product.subcategory_ids.split(',').map((id: string) => parseInt(id)) : [];
        
        // La primera subcategoría es la principal (para compatibilidad)
        const primarySubcategory = subcategoryNames.length > 0 ? subcategoryNames[0] : 'Sin subcategoría';
        const primarySubcategoryId = subcategoryIds.length > 0 ? subcategoryIds[0] : 0;

        return {
          id: product.id,
          name: product.name,
          slug: product.slug || product.name.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-'),
          description: product.description || 'Descripción del producto',
          price: parseFloat(product.price),
          originalPrice: product.originalPrice ? parseFloat(product.originalPrice) : undefined,
          image: imageUrl,
          category: product.category || 'Categoría',
          subcategory: primarySubcategory,
          categoryId: parseInt(product.categoryId),
          subcategoryId: primarySubcategoryId,
          subcategoryIds: subcategoryIds,
          subcategories: subcategoryNames.map((name: string, index: number) => ({
            id: subcategoryIds[index],
            name: name
          })),
          ageMin: parseInt(product.ageMin) || 8,
          age: product.age || '8+ años',
          playersMin: parseInt(product.playersMin) || 2,
          playersMax: parseInt(product.playersMax) || 4,
          players: product.players || '2-4 jugadores',
          durationMin: parseInt(product.durationMin) || 30,
          duration: product.duration || '30-45 minutos',
          stock: parseInt(product.stock) || 0,
          inStock: Boolean(product.inStock),
          isOnSale: Boolean(product.isOnSale),
          isActive: Boolean(product.isActive),
          additionalImages: correctedAdditionalImages,
          tags: [],
          createdAt: product.createdAt || new Date().toISOString(),
          updatedAt: product.updatedAt || new Date().toISOString()
        };
      })
    );

    // Confirmar transacción
    await transaction.commit();

    return NextResponse.json(productsWithAdditionalImages);

  } catch (error) {
    console.error('Error en GET /api/products:', error);
    await transaction.rollback();
    return NextResponse.json(
      { 
        error: 'Failed to fetch products',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/products - Crear un nuevo producto
export async function POST(request: Request) {
  const transaction = new Transaction();
  
  try {
    const formData = await request.formData();
    
    // Iniciar transacción
    await transaction.begin();
    
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const price = formData.get('price') as string;
    const originalPrice = formData.get('originalPrice') as string;
    const categoryId = formData.get('categoryId') as string;
    const subcategoryIds = formData.getAll('subcategoryIds') as string[];
    const ageMin = formData.get('ageMin') as string;
    const ageDisplay = formData.get('ageDisplay') as string;
    const playersMin = formData.get('playersMin') as string;
    const playersMax = formData.get('playersMax') as string;
    const playersDisplay = formData.get('playersDisplay') as string;
    const durationMin = formData.get('durationMin') as string;
    const durationDisplay = formData.get('durationDisplay') as string;
    const stock = formData.get('stock') as string;
    const inStock = formData.get('inStock') === 'true';
    const isOnSale = formData.get('isOnSale') === 'true';
    const tags = formData.get('tags') as string;

    // Validaciones básicas
    if (!name || !price || !categoryId || subcategoryIds.length === 0) {
      await transaction.rollback();
      return NextResponse.json(
        { error: 'Faltan campos requeridos: nombre, precio, categoría y al menos una subcategoría son obligatorios' },
        { status: 400 }
      );
    }

    // Generar slug
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    // Procesar imagen principal
    const mainImageFile = formData.get('mainImage') as File;
    let mainImageUrl = '/diverse-products-still-life.png'; 

    if (mainImageFile && mainImageFile.size > 0) {
      mainImageUrl = await saveImage(mainImageFile, slug);
    } else {
      const imageUrl = formData.get('image') as string;
      if (imageUrl && imageUrl !== '/diverse-products-still-life.png') {
        mainImageUrl = imageUrl;
      }
    }

    // Insertar producto
    const result: any = await transaction.query(
      `INSERT INTO products (
        name, slug, description, price, original_price, image, 
        category_id, age_min, age_display, 
        players_min, players_max, players_display, 
        duration_min, duration_display, stock, in_stock, is_on_sale, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true)`,
      [
        name, slug, description, parseFloat(price), 
        originalPrice ? parseFloat(originalPrice) : null,
        mainImageUrl,
        parseInt(categoryId),
        parseInt(ageMin), ageDisplay, parseInt(playersMin), 
        parseInt(playersMax), playersDisplay, parseInt(durationMin),
        durationDisplay, parseInt(stock), inStock, isOnSale
      ]
    );

    const productId = result.insertId;

    // Insertar relaciones con subcategorías
    for (let i = 0; i < subcategoryIds.length; i++) {
      const subcategoryId = subcategoryIds[i];
      const isPrimary = i === 0 ? 1 : 0; // La primera es la principal
      await transaction.query(
        'INSERT INTO product_subcategories (product_id, subcategory_id, is_primary, display_order) VALUES (?, ?, ?, ?)',
        [productId, parseInt(subcategoryId), isPrimary, i + 1]
      );
    }

    // Procesar imágenes adicionales
    const additionalImages = formData.getAll('additionalImages') as File[];
    
    for (let i = 0; i < additionalImages.length; i++) {
      const imageFile = additionalImages[i];
      if (imageFile && imageFile.size > 0) {
        const imageUrl = await saveImage(imageFile, `${slug}-additional-${i + 1}`);
        await transaction.query(
          'INSERT INTO product_images (product_id, image_url, display_order) VALUES (?, ?, ?)',
          [productId, imageUrl, i]
        );
      }
    }

    // Confirmar transacción
    await transaction.commit();

    return NextResponse.json({ 
      id: productId,
      message: 'Producto creado exitosamente' 
    });

  } catch (error) {
    console.error('Error en POST /api/products:', error);
    await transaction.rollback();
    return NextResponse.json(
      { error: 'Error al crear el producto' },
      { status: 500 }
    );
  }
}