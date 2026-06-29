import { NextRequest, NextResponse } from 'next/server'
import { Transaction } from '@/lib/db-transaction'
import fs from 'fs'
import path from 'path'
import { sendProductOnSaleEmail } from '@/lib/email-service'
import { normalizeProductName, generateUniqueFilename } from '@/lib/normalize-filename'

interface QueryResult {
  [key: string]: any;
}

interface SubcategoryRow {
  id: number;
  name: string;
  slug: string;
  isPrimary: boolean;
  displayOrder: number;
}

async function saveImage(file: File, productName: string, isAdditional: boolean = false): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'products');
  
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  let extension = file.type.split('/')[1] || 'png';
  if (extension === 'jpeg') extension = 'jpg';
  if (extension === 'svg+xml') extension = 'svg';
  if (extension === 'vnd.microsoft.icon') extension = 'ico';
  
  const baseName = normalizeProductName(productName);
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  const prefix = isAdditional ? `${baseName}-additional` : baseName;
  const uniqueFilename = `${prefix}-${timestamp}-${random}.${extension}`;
  const filepath = path.join(uploadDir, uniqueFilename);

  fs.writeFileSync(filepath, buffer);
  
  return `/uploads/products/${uniqueFilename}`;
}

function correctImageUrl(imagePath: string | null): string {
  if (!imagePath) {
    return '/uploads/products/diverse-products-still-life.png';
  }
  
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  if (imagePath.startsWith('/')) {
    return imagePath;
  }
  
  if (imagePath.startsWith('uploads/')) {
    return `/${imagePath}`;
  }
  
  return '/uploads/products/diverse-products-still-life.png';
}

function normalizeTags(tagsRaw: any): string[] {
  if (!tagsRaw) return [];
  
  if (typeof tagsRaw === 'string') {
    return tagsRaw.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean);
  }
  
  if (Array.isArray(tagsRaw)) {
    return tagsRaw.map((t: any) => {
      if (typeof t === 'string') return t.toLowerCase();
      if (t && typeof t === 'object') return (t.name || t.slug || '').toLowerCase();
      return '';
    }).filter(Boolean);
  }
  
  return [];
}

async function getUsersWithProductInFavorites(productId: number): Promise<any[]> {
  try {
    const { query } = await import('@/lib/db');
    const users = await query(
      `SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name
       FROM user_favorites uf
       LEFT JOIN users u ON uf.user_id = u.id
       WHERE uf.product_id = ? AND u.is_active = 1 AND u.email IS NOT NULL AND u.email != ''`,
      [productId]
    ) as any[];
    return users;
  } catch (error) {
    console.error('Error obteniendo usuarios favoritos:', error);
    return [];
  }
}

// 🔥 FUNCIÓN CORREGIDA - Notificar sobre descuento
async function notifyUsersAboutPriceDrop(
  productId: number, 
  oldPrice: number, 
  newPrice: number, 
  productName: string, 
  productImage: string,
  originalPrice: number | null,
  forceNotify: boolean = false
) {
  try {
    console.log('===== INICIANDO NOTIFICACION DE OFERTA =====');
    console.log('Producto ID:', productId);
    console.log('Producto:', productName);
    console.log('Precio anterior:', oldPrice);
    console.log('Nuevo precio:', newPrice);
    console.log('Precio original (de la BD):', originalPrice);
    console.log('Forzar notificacion:', forceNotify);
    
    // Obtener el precio original real
    let realOriginalPrice = originalPrice;
    
    // Si no hay precio original en la BD pero estamos en modo descuento, usar el precio anterior
    if (!realOriginalPrice || realOriginalPrice <= 0) {
      if (oldPrice > newPrice) {
        realOriginalPrice = oldPrice;
        console.log('📊 Usando precio anterior como original:', realOriginalPrice);
      } else {
        console.log('⚠️ No hay precio original válido para calcular descuento');
        return { notified: false, reason: 'Sin precio original válido' };
      }
    }

    // Verificar que el precio original sea mayor que el precio de oferta
    if (realOriginalPrice <= newPrice) {
      return { notified: false, reason: 'Precio original no es mayor que precio de oferta' };
    }

    const users = await getUsersWithProductInFavorites(productId);
    console.log('Usuarios encontrados con este producto en favoritos:', users.length);

    if (users.length === 0) {
      return { notified: false, reason: 'Sin usuarios para notificar', usersFound: 0 };
    }

    const emails = users.map((u: any) => u.email).filter(Boolean);
    
    // CALCULAR EL DESCUENTO REAL
    const discountPercent = Math.round(((realOriginalPrice - newPrice) / realOriginalPrice) * 100);
    
   
    if (emails.length === 0) {
      return { notified: false, reason: 'No hay emails válidos' };
    }

    if (discountPercent <= 0) {
      return { notified: false, reason: 'Descuento inválido' };
    }

    const emailResult = await sendProductOnSaleEmail(
      productName,
      newPrice,
      realOriginalPrice,
      productImage,
      productId,
      emails,
      discountPercent
    );

    console.log('Resultado del envío de email:', emailResult);

    if (emailResult) {
      try {
        const { query } = await import('@/lib/db');
        await query(
          `INSERT INTO price_drop_notifications 
           (product_id, old_price, new_price, users_notified, notified_at, created_at)
           VALUES (?, ?, ?, ?, NOW(), NOW())`,
          [productId, realOriginalPrice, newPrice, users.length]
        );
        console.log('Notificación registrada en base de datos');
      } catch (dbError) {
        console.error('Error registrando notificación:', dbError);
      }
    }

    return { 
      notified: emailResult, 
      usersNotified: users.length,
      emails: emails,
      discountPercent: discountPercent
    };

  } catch (error) {
    console.error('Error en notifyUsersAboutPriceDrop:', error);
    return { notified: false, reason: 'Error interno: ' + (error as Error).message };
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const transaction = new Transaction()
  
  try {
    const resolvedParams = await params
    const productId = parseInt(resolvedParams.id)

    if (isNaN(productId)) {
      return NextResponse.json(
        { error: 'ID de producto invalido' },
        { status: 400 }
      )
    }

    await transaction.begin()

    const productQuery = `
      SELECT 
        p.*,
        c.name as category_name,
        c.id as category_id,
        p.tags as tagsRaw,
        p.brand as brand,
        p.genre as genre,
        p.specs as specs,
        GROUP_CONCAT(DISTINCT ps.subcategory_id) as subcategory_ids,
        GROUP_CONCAT(DISTINCT ps.is_primary) as is_primary_flags,
        GROUP_CONCAT(DISTINCT ps.display_order) as display_orders,
        GROUP_CONCAT(DISTINCT s.name) as subcategory_names,
        GROUP_CONCAT(DISTINCT s.slug) as subcategory_slugs
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_subcategories ps ON p.id = ps.product_id
      LEFT JOIN subcategories s ON ps.subcategory_id = s.id
      WHERE p.id = ?
      GROUP BY p.id
    `

    const products = await transaction.query(productQuery, [productId]) as QueryResult[]
    
    if (products.length === 0) {
      await transaction.rollback()
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    const product = products[0]

    const additionalImagesResult = await transaction.query(
      'SELECT image_url FROM product_images WHERE product_id = ? ORDER BY display_order',
      [productId]
    ) as QueryResult[]

    const recommendedResult = await transaction.query(
      'SELECT recommended_product_id FROM product_recommendations WHERE product_id = ?',
      [productId]
    ) as QueryResult[]

    const recommendedProducts = recommendedResult.map((row: QueryResult) => row.recommended_product_id)

    const subcategoryIds = product.subcategory_ids 
      ? product.subcategory_ids.split(',').map((id: string) => parseInt(id))
      : []
    
    const subcategoryNames = product.subcategory_names
      ? product.subcategory_names.split(',')
      : []

    const subcategorySlugs = product.subcategory_slugs
      ? product.subcategory_slugs.split(',')
      : []

    const isPrimaryFlags = product.is_primary_flags
      ? product.is_primary_flags.split(',').map((flag: string) => parseInt(flag))
      : []

    const displayOrders = product.display_orders
      ? product.display_orders.split(',').map((order: string) => parseInt(order))
      : []

    const subcategories: SubcategoryRow[] = subcategoryIds.map((id: number, index: number) => ({
      id,
      name: subcategoryNames[index] || '',
      slug: subcategorySlugs[index] || '',
      isPrimary: isPrimaryFlags[index] === 1,
      displayOrder: displayOrders[index] || 0
    }))

    subcategories.sort((a: SubcategoryRow, b: SubcategoryRow) => a.displayOrder - b.displayOrder)

    const additionalImages = additionalImagesResult
      .filter((row: QueryResult) => row.image_url !== null && row.image_url !== 'null')
      .map((row: QueryResult) => correctImageUrl(row.image_url))

    const tagsArray = normalizeTags(product.tagsRaw);

    const productData = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description || '',
      price: parseFloat(product.price),
      originalPrice: product.original_price ? parseFloat(product.original_price) : null,
      image: correctImageUrl(product.image),
      youtubeVideoId: product.youtube_video_id || '',
      category: product.category_name || 'Sin categoria',
      subcategory: subcategoryNames.length > 0 ? subcategoryNames[0] : 'Sin subcategoria',
      categoryId: parseInt(product.category_id),
      subcategoryId: subcategoryIds.length > 0 ? subcategoryIds[0] : null,
      subcategoryIds: subcategoryIds.map((id: number) => id.toString()),
      subcategories: subcategories,
      recommendedProducts: recommendedProducts,
      ageMin: parseInt(product.age_min) || 0,
      age: product.age_display || '',
      playersMin: parseInt(product.players_min) || 0,
      playersMax: parseInt(product.players_max) || 0,
      players: product.players_display || '',
      durationMin: parseInt(product.duration_min) || 0,
      duration: product.duration_display || '',
      stock: parseInt(product.stock) || 0,
      inStock: Boolean(product.in_stock),
      isOnSale: Boolean(product.is_on_sale),
      isActive: Boolean(product.is_active),
      additionalImages: additionalImages,
      tags: tagsArray,
      brand: product.brand || 'Devir',
      genre: product.genre || 'Estrategia, Familiar',
      specs: product.specs || null,
      weight: parseFloat(product.weight) || 0.5,
      height: parseInt(product.height) || 10,
      width: parseInt(product.width) || 15,
      length: parseInt(product.length) || 20,
      createdAt: product.created_at || new Date().toISOString(),
      updatedAt: product.updated_at || new Date().toISOString()
    }

    await transaction.commit()
    
    return new NextResponse(JSON.stringify(productData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Error fetching product:', error)
    await transaction.rollback()
    return NextResponse.json(
      { error: 'Error al obtener el producto' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const transaction = new Transaction()
  
  try {
    const resolvedParams = await params
    const productId = parseInt(resolvedParams.id)
    
    if (isNaN(productId)) {
      return NextResponse.json(
        { error: 'ID de producto invalido' },
        { status: 400 }
      )
    }
    
    const formData = await request.formData()
    
    await transaction.begin()
    
    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const price = parseFloat(formData.get('price') as string)
    const originalPrice = formData.get('originalPrice') ? parseFloat(formData.get('originalPrice') as string) : null
    
    const imageFromForm = formData.get('image') as string
    
    const youtubeVideoId = formData.get('youtubeVideoId') as string || ''
    const categoryId = parseInt(formData.get('categoryId') as string)
    const subcategoryIds = formData.getAll('subcategoryIds') as string[]
    const deletedImages = formData.getAll('deletedImages') as string[]
    const recommendedProducts = formData.getAll('recommendedProducts') as string[]
    const tags = formData.get('tags') as string
    const specs = formData.get('specs') as string
    
    const ageMin = parseInt(formData.get('ageMin') as string)
    const ageDisplay = formData.get('ageDisplay') as string
    const playersMin = parseInt(formData.get('playersMin') as string)
    const playersMax = parseInt(formData.get('playersMax') as string)
    const playersDisplay = formData.get('playersDisplay') as string
    const durationMin = parseInt(formData.get('durationMin') as string)
    const durationDisplay = formData.get('durationDisplay') as string
    const stock = parseInt(formData.get('stock') as string)
    const inStock = formData.get('inStock') === 'true'
    const isOnSale = formData.get('isOnSale') === 'true'

    const weight = parseFloat(formData.get('weight') as string) || 0.5
    const height = parseInt(formData.get('height') as string) || 10
    const width = parseInt(formData.get('width') as string) || 15
    const length = parseInt(formData.get('length') as string) || 20

    if (!name || !price || !categoryId || subcategoryIds.length === 0) {
      await transaction.rollback()
      return NextResponse.json(
        { error: 'Faltan campos requeridos: nombre, precio, categoria y al menos una subcategoria son obligatorios' },
        { status: 400 }
      )
    }

    const subcategoryCheckQuery = `
      SELECT COUNT(*) as count FROM subcategories 
      WHERE id IN (${subcategoryIds.map(() => '?').join(',')}) 
      AND category_id = ?
    `
    
    const subcategoryCheckParams = [...subcategoryIds.map(id => parseInt(id)), categoryId]
    const subcategoryCheck = await transaction.query(subcategoryCheckQuery, subcategoryCheckParams) as QueryResult[]
    
    if (subcategoryCheck[0].count !== subcategoryIds.length) {
      await transaction.rollback()
      return NextResponse.json(
        { error: 'Todas las subcategorias deben pertenecer a la categoria seleccionada' },
        { status: 400 }
      )
    }

    const slug = name.toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')

    // Obtener el producto antes de actualizar para notificaciones
    const oldProductData = await transaction.query(
      'SELECT price, original_price, name, image FROM products WHERE id = ?',
      [productId]
    ) as QueryResult[]

    const oldPrice = oldProductData.length > 0 ? parseFloat(oldProductData[0].price) : 0;
    const oldOriginalPrice = oldProductData.length > 0 && oldProductData[0].original_price ? parseFloat(oldProductData[0].original_price) : null;
    
    let finalImage: string;
    
    const mainImageFile = formData.get('mainImage') as File
    
    if (mainImageFile && mainImageFile.size > 0) {
      finalImage = await saveImage(mainImageFile, name, false);
      console.log('✅ Nueva imagen principal guardada:', finalImage);
    } else if (imageFromForm && imageFromForm !== 'null' && imageFromForm !== '') {
      finalImage = imageFromForm;
      console.log('📸 Usando imagen existente del form:', finalImage);
    } else if (oldProductData.length > 0 && oldProductData[0].image) {
      finalImage = oldProductData[0].image;
      console.log('📸 Manteniendo imagen existente de la BD:', finalImage);
    } else {
      finalImage = '/uploads/products/diverse-products-still-life.png';
      console.log('📸 Usando imagen por defecto');
    }

    const updateProductQuery = `
      UPDATE products SET 
        name = ?, slug = ?, description = ?, price = ?, original_price = ?,
        image = ?, youtube_video_id = ?, category_id = ?, age_min = ?, age_display = ?,
        players_min = ?, players_max = ?, players_display = ?,
        duration_min = ?, duration_display = ?, stock = ?, in_stock = ?,
        is_on_sale = ?, tags = ?, specs = ?,
        weight = ?, height = ?, width = ?, length = ?
      WHERE id = ?
    `

    await transaction.query(updateProductQuery, [
      name,
      slug,
      description,
      price,
      originalPrice,
      finalImage,
      youtubeVideoId,
      categoryId,
      ageMin,
      ageDisplay,
      playersMin,
      playersMax,
      playersDisplay,
      durationMin,
      durationDisplay,
      stock,
      inStock,
      isOnSale,
      tags || null,
      specs || null,
      weight,
      height,
      width,
      length,
      productId
    ])

    // Eliminar y recrear subcategorías
    await transaction.query('DELETE FROM product_subcategories WHERE product_id = ?', [productId])
    
    for (let i = 0; i < subcategoryIds.length; i++) {
      const subcatId = subcategoryIds[i]
      const isPrimary = i === 0 ? 1 : 0
      await transaction.query(
        'INSERT INTO product_subcategories (product_id, subcategory_id, is_primary, display_order) VALUES (?, ?, ?, ?)',
        [productId, parseInt(subcatId), isPrimary, i + 1]
      )
    }

    // Eliminar y recrear recomendaciones
    await transaction.query('DELETE FROM product_recommendations WHERE product_id = ?', [productId])
    
    for (const recProductId of recommendedProducts) {
      await transaction.query(
        'INSERT INTO product_recommendations (product_id, recommended_product_id) VALUES (?, ?)',
        [productId, parseInt(recProductId)]
      )
    }

    // Eliminar imágenes marcadas
    if (deletedImages.length > 0) {
      for (const imageUrl of deletedImages) {
        await transaction.query(
          'DELETE FROM product_images WHERE product_id = ? AND image_url = ?', 
          [productId, imageUrl]
        )
        
        const filename = imageUrl.split('/').pop()
        if (filename) {
          const filePath = path.join(process.cwd(), 'public', 'uploads', 'products', filename)
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
            console.log(`🗑️ Imagen eliminada: ${filePath}`)
          }
        }
      }
    }

    // Procesar imágenes adicionales NUEVAS
    const additionalImages = formData.getAll('additionalImages') as File[]
    for (let i = 0; i < additionalImages.length; i++) {
      const imageFile = additionalImages[i]
      if (imageFile && imageFile.size > 0) {
        const imageUrl = await saveImage(imageFile, name, true)
        await transaction.query(
          'INSERT INTO product_images (product_id, image_url, display_order) VALUES (?, ?, ?)',
          [productId, imageUrl, i]
        )
        console.log(`✅ Additional image ${i + 1} saved: ${imageUrl}`)
      }
    }

    await transaction.commit()

    // 🔥 NOTIFICACIONES CORREGIDAS
    try {
      const productName = oldProductData.length > 0 ? oldProductData[0].name : name;
      const productImage = oldProductData.length > 0 ? oldProductData[0].image : finalImage;
      const newPriceValue = price;
      const newOriginalPrice = originalPrice;
      
      const isDiscountTag = tags === 'descuento';
      const isNowOnSale = newOriginalPrice !== null && newOriginalPrice > newPriceValue;
      const priceDrop = newPriceValue < oldPrice;
      const adminSelectedDiscount = isDiscountTag && newOriginalPrice !== null && newOriginalPrice > 0;
      
      const shouldNotify = (isNowOnSale && priceDrop) || adminSelectedDiscount;
      const forceNotify = adminSelectedDiscount;
      
      console.log('🔔 Evaluando notificación:');
      console.log('  isDiscountTag:', isDiscountTag);
      console.log('  isNowOnSale:', isNowOnSale);
      console.log('  priceDrop:', priceDrop);
      console.log('  adminSelectedDiscount:', adminSelectedDiscount);
      console.log('  shouldNotify:', shouldNotify);
      console.log('  forceNotify:', forceNotify);
      console.log('  newOriginalPrice:', newOriginalPrice);
      console.log('  newPriceValue:', newPriceValue);
      
      if (shouldNotify && newOriginalPrice !== null && newOriginalPrice > 0) {
        console.log('📧 Enviando notificaciones de oferta...');
        setTimeout(async () => {
          try {
            const result = await notifyUsersAboutPriceDrop(
              productId, 
              oldPrice, 
              newPriceValue, 
              productName, 
              productImage,
              newOriginalPrice,
              forceNotify
            );
            console.log('📊 Resultado notificación:', result);
          } catch (error) {
            console.error('Error en notificación de oferta:', error);
          }
        }, 1000);
      } else {
        console.log('⏭️ No se enviarán notificaciones (no cumple condiciones)');
      }
    } catch (notifyError) {
      console.error('Error al verificar notificación de oferta:', notifyError);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Producto actualizado correctamente',
      productId: productId
    })

  } catch (error) {
    console.error('Error updating product:', error)
    await transaction.rollback()
    return NextResponse.json(
      { error: 'Error al actualizar el producto: ' + (error instanceof Error ? error.message : 'Error desconocido') },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const transaction = new Transaction()
  
  try {
    const resolvedParams = await params
    const productId = parseInt(resolvedParams.id)

    if (isNaN(productId)) {
      return NextResponse.json(
        { error: 'ID de producto invalido' },
        { status: 400 }
      )
    }

    await transaction.begin()

    const existingProduct = await transaction.query(
      'SELECT * FROM products WHERE id = ?',
      [productId]
    ) as QueryResult[]

    if (existingProduct.length === 0) {
      await transaction.rollback()
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    await transaction.query(
      'UPDATE products SET is_active = 0 WHERE id = ?',
      [productId]
    )

    await transaction.commit()

    return NextResponse.json({ 
      message: 'Producto desactivado correctamente',
      productId: productId
    })
    
  } catch (error) {
    console.error('Error deactivating product:', error)
    await transaction.rollback()
    return NextResponse.json(
      { error: 'Error al desactivar el producto' },
      { status: 500 }
    )
  }
}