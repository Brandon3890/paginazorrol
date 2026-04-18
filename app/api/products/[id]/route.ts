import { NextRequest, NextResponse } from 'next/server'
import { Transaction } from '@/lib/db-transaction'
import fs from 'fs'
import path from 'path'

// Definir tipos para los resultados
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

// Función para guardar imágenes
async function saveImage(file: File, filename: string): Promise<string> {
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'products')
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
  }

  const extension = file.type.split('/')[1] || 'jpg'
  const uniqueFilename = `${filename}-${Date.now()}.${extension}`
  const filepath = path.join(uploadDir, uniqueFilename)

  fs.writeFileSync(filepath, buffer)
  
  return `/uploads/products/${uniqueFilename}`
}

// Función para corregir URL de imagen
function correctImageUrl(imagePath: string | null): string {
  if (!imagePath) {
    return '/diverse-products-still-life.png'
  }
  
  if (imagePath.startsWith('/')) {
    return imagePath
  }
  
  if (imagePath.startsWith('uploads/')) {
    return `/${imagePath}`
  }
  
  if (imagePath.includes('.jpg') || imagePath.includes('.jpeg') || imagePath.includes('.png')) {
    return `/uploads/products/${imagePath}`
  }
  
  return '/diverse-products-still-life.png'
}

// Función para normalizar tags
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

// GET /api/products/[id] - Obtener un producto específico (CON TAGS, BRAND Y GENRE)
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
        { error: 'ID de producto inválido' },
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

    // Procesar las subcategorías
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
      category: product.category_name || 'Sin categoría',
      subcategory: subcategoryNames.length > 0 ? subcategoryNames[0] : 'Sin subcategoría',
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
      createdAt: product.created_at || new Date().toISOString(),
      updatedAt: product.updated_at || new Date().toISOString()
    }

    await transaction.commit()
    return NextResponse.json(productData)

  } catch (error) {
    console.error(`❌ Error fetching product:`, error)
    await transaction.rollback()
    return NextResponse.json(
      { error: 'Error al obtener el producto' },
      { status: 500 }
    )
  }
}

// PUT /api/products/[id] - Actualizar un producto (CON TAGS, BRAND Y GENRE)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const transaction = new Transaction()
  
  try {
    const resolvedParams = await params
    const productId = parseInt(resolvedParams.id)
    
    const formData = await request.formData()
    
    await transaction.begin()
    
    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const price = parseFloat(formData.get('price') as string)
    const originalPrice = formData.get('originalPrice') ? parseFloat(formData.get('originalPrice') as string) : null
    const image = formData.get('image') as string
    const youtubeVideoId = formData.get('youtubeVideoId') as string || ''
    const categoryId = parseInt(formData.get('categoryId') as string)
    const subcategoryIds = formData.getAll('subcategoryIds') as string[]
    const deletedImages = formData.getAll('deletedImages') as string[]
    const recommendedProducts = formData.getAll('recommendedProducts') as string[]
    const tags = formData.get('tags') as string
    const brand = formData.get('brand') as string
    const genre = formData.get('genre') as string
    
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

    if (!name || !price || !categoryId || subcategoryIds.length === 0) {
      await transaction.rollback()
      return NextResponse.json(
        { error: 'Faltan campos requeridos: nombre, precio, categoría y al menos una subcategoría son obligatorios' },
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
        { error: 'Todas las subcategorías deben pertenecer a la categoría seleccionada' },
        { status: 400 }
      )
    }

    const slug = name.toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')

    const updateProductQuery = `
      UPDATE products SET 
        name = ?, slug = ?, description = ?, price = ?, original_price = ?, 
        image = ?, youtube_video_id = ?, category_id = ?, age_min = ?, age_display = ?, 
        players_min = ?, players_max = ?, players_display = ?, 
        duration_min = ?, duration_display = ?, stock = ?, in_stock = ?, is_on_sale = ?,
        tags = ?, brand = ?, genre = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `

    await transaction.query(updateProductQuery, [
      name, slug, description, price, originalPrice, 
      image, youtubeVideoId, categoryId, ageMin, ageDisplay,
      playersMin, playersMax, playersDisplay,
      durationMin, durationDisplay, stock, inStock, isOnSale,
      tags || null,
      brand || 'Devir',
      genre || 'Estrategia, Familiar',
      productId
    ])

    await transaction.query('DELETE FROM product_subcategories WHERE product_id = ?', [productId])
    
    for (let i = 0; i < subcategoryIds.length; i++) {
      const subcatId = subcategoryIds[i]
      const isPrimary = i === 0 ? 1 : 0
      await transaction.query(
        'INSERT INTO product_subcategories (product_id, subcategory_id, is_primary, display_order) VALUES (?, ?, ?, ?)',
        [productId, parseInt(subcatId), isPrimary, i + 1]
      )
    }

    await transaction.query('DELETE FROM product_recommendations WHERE product_id = ?', [productId])
    
    for (const recProductId of recommendedProducts) {
      await transaction.query(
        'INSERT INTO product_recommendations (product_id, recommended_product_id) VALUES (?, ?)',
        [productId, parseInt(recProductId)]
      )
    }

    const mainImageFile = formData.get('mainImage') as File
    if (mainImageFile && mainImageFile.size > 0) {
      const mainImageUrl = await saveImage(mainImageFile, slug)
      await transaction.query('UPDATE products SET image = ? WHERE id = ?', [mainImageUrl, productId])
    }

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
          }
        }
      }
    }

    const additionalImages = formData.getAll('additionalImages') as File[]
    for (let i = 0; i < additionalImages.length; i++) {
      const imageFile = additionalImages[i]
      if (imageFile && imageFile.size > 0) {
        const imageUrl = await saveImage(imageFile, `${slug}-additional-${i + 1}`)
        await transaction.query(
          'INSERT INTO product_images (product_id, image_url, display_order) VALUES (?, ?, ?)',
          [productId, imageUrl, i]
        )
      }
    }

    await transaction.commit()

    return NextResponse.json({ 
      success: true, 
      message: 'Producto actualizado correctamente',
      subcategories: subcategoryIds,
      recommendedProducts: recommendedProducts
    })

  } catch (error) {
    console.error(`❌ Error updating product:`, error)
    await transaction.rollback()
    return NextResponse.json(
      { error: 'Error al actualizar el producto' },
      { status: 500 }
    )
  }
}

// DELETE /api/products/[id] - Desactivar producto (soft delete)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const transaction = new Transaction()
  
  try {
    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json(
        { error: 'ID de producto inválido' },
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
    console.error(`❌ Error deactivating product:`, error)
    await transaction.rollback()
    return NextResponse.json(
      { error: 'Error al desactivar el producto' },
      { status: 500 }
    )
  }
}