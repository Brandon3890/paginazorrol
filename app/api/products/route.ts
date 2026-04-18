import { NextResponse } from 'next/server';
import { Transaction } from '@/lib/db-transaction';
import fs from 'fs';
import path from 'path';

// Función para guardar imágenes
async function saveImage(file: File, filename: string): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'products');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const extension = file.type.split('/')[1] || 'jpg';
  const uniqueFilename = `${filename}-${Date.now()}.${extension}`;
  const filepath = path.join(uploadDir, uniqueFilename);

  fs.writeFileSync(filepath, buffer);
  
  return `/uploads/products/${uniqueFilename}`;
}

function correctImageUrl(imagePath: string | null): string {
  if (!imagePath) return '/diverse-products-still-life.png';
  if (imagePath.startsWith('/')) return imagePath;
  if (imagePath.startsWith('uploads/')) return `/${imagePath}`;
  if (imagePath.includes('.jpg') || imagePath.includes('.jpeg') || imagePath.includes('.png')) {
    return `/uploads/products/${imagePath}`;
  }
  return '/diverse-products-still-life.png';
}

// GET /api/products - Obtener todos los productos (CON TAGS, BRAND Y GENRE)
export async function GET(request: Request) {
  const transaction = new Transaction();
  
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const isAdmin = searchParams.get('admin') === 'true';

    await transaction.begin();

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
        p.youtube_video_id as youtubeVideoId,
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
        p.tags as tagsRaw,
        p.brand as brand,
        p.genre as genre,
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

    const productsWithAdditionalImages = await Promise.all(
      products.map(async (product) => {
        const additionalImagesResult = await transaction.query(
          'SELECT image_url FROM product_images WHERE product_id = ? ORDER BY display_order',
          [product.id]
        ) as any[];

        const additionalImages = additionalImagesResult.map((row: any) => row.image_url);
        const imageUrl = correctImageUrl(product.image);
        const correctedAdditionalImages = additionalImages.map(correctImageUrl);

        const subcategoryNames = product.subcategory_names ? product.subcategory_names.split(',') : [];
        const subcategoryIds = product.subcategory_ids ? product.subcategory_ids.split(',').map((id: string) => parseInt(id)) : [];
        
        const primarySubcategory = subcategoryNames.length > 0 ? subcategoryNames[0] : 'Sin subcategoría';
        const primarySubcategoryId = subcategoryIds.length > 0 ? subcategoryIds[0] : 0;

        // PROCESAR TAGS desde el campo tagsRaw
        let tagsArray: string[] = [];
        if (product.tagsRaw) {
          if (typeof product.tagsRaw === 'string') {
            tagsArray = product.tagsRaw.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean);
          } else if (Array.isArray(product.tagsRaw)) {
            tagsArray = product.tagsRaw.map((t: any) => {
              if (typeof t === 'string') return t.toLowerCase();
              if (t && typeof t === 'object') return (t.name || t.slug || '').toLowerCase();
              return '';
            }).filter(Boolean);
          }
        }

        return {
          id: product.id,
          name: product.name,
          slug: product.slug || product.name.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-'),
          description: product.description || 'Descripción del producto',
          price: parseFloat(product.price),
          originalPrice: product.originalPrice ? parseFloat(product.originalPrice) : undefined,
          image: imageUrl,
          youtubeVideoId: product.youtubeVideoId || '',
          category: product.category || 'Categoría',
          subcategory: primarySubcategory,
          categoryId: parseInt(product.categoryId),
          subcategoryId: primarySubcategoryId,
          subcategoryIds: subcategoryIds.map((id: number) => id.toString()),
          subcategories: subcategoryNames.map((name: string, index: number) => ({
            id: subcategoryIds[index],
            name: name,
            slug: '',
            isPrimary: index === 0,
            displayOrder: index
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
          tags: tagsArray,
          brand: product.brand || 'Devir',
          genre: product.genre || 'Estrategia, Familiar',
          createdAt: product.createdAt || new Date().toISOString(),
          updatedAt: product.updatedAt || new Date().toISOString()
        };
      })
    );

    await transaction.commit();
    return NextResponse.json(productsWithAdditionalImages);

  } catch (error) {
    console.error('Error en GET /api/products:', error);
    await transaction.rollback();
    return NextResponse.json(
      { error: 'Failed to fetch products', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/products - Crear un nuevo producto (CON TAGS, BRAND Y GENRE)
export async function POST(request: Request) {
  const transaction = new Transaction();
  
  try {
    const formData = await request.formData();
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
    const brand = formData.get('brand') as string;
    const genre = formData.get('genre') as string;
    const youtubeVideoId = formData.get('youtubeVideoId') as string;

    if (!name || !price || !categoryId || subcategoryIds.length === 0) {
      await transaction.rollback();
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    const slug = name.toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    const mainImageFile = formData.get('mainImage') as File;
    let mainImageUrl = '/diverse-products-still-life.png'; 

    if (mainImageFile && mainImageFile.size > 0) {
      mainImageUrl = await saveImage(mainImageFile, slug);
    }

    const result: any = await transaction.query(
      `INSERT INTO products (
        name, slug, description, price, original_price, image, 
        youtube_video_id, category_id, age_min, age_display, 
        players_min, players_max, players_display, 
        duration_min, duration_display, stock, in_stock, is_on_sale, is_active, 
        tags, brand, genre
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true, ?, ?, ?)`,
      [
        name, slug, description, parseFloat(price), 
        originalPrice ? parseFloat(originalPrice) : null,
        mainImageUrl,
        youtubeVideoId || null,
        parseInt(categoryId),
        parseInt(ageMin), ageDisplay, parseInt(playersMin), 
        parseInt(playersMax), playersDisplay, parseInt(durationMin),
        durationDisplay, parseInt(stock), inStock, isOnSale,
        tags || null,
        brand || 'Devir',
        genre || 'Estrategia, Familiar'
      ]
    );

    const productId = result.insertId;

    for (let i = 0; i < subcategoryIds.length; i++) {
      const subcategoryId = subcategoryIds[i];
      const isPrimary = i === 0 ? 1 : 0;
      await transaction.query(
        'INSERT INTO product_subcategories (product_id, subcategory_id, is_primary, display_order) VALUES (?, ?, ?, ?)',
        [productId, parseInt(subcategoryId), isPrimary, i + 1]
      );
    }

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

    await transaction.commit();

    return NextResponse.json({ id: productId, message: 'Producto creado exitosamente' });

  } catch (error) {
    console.error('Error en POST /api/products:', error);
    await transaction.rollback();
    return NextResponse.json(
      { error: 'Error al crear el producto' },
      { status: 500 }
    );
  }
}