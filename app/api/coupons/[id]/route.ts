import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const resolvedParams = await params;
    const couponId = parseInt(resolvedParams.id);

    console.log(`🔍 Fetching coupon ID: ${couponId}`);

    if (isNaN(couponId)) {
      return NextResponse.json(
        { error: 'ID de cupón inválido' },
        { status: 400 }
      );
    }

    // Consulta para obtener el cupón específico con sus relaciones
    const coupons = await query(`
      SELECT 
        c.*,
        CASE 
          WHEN COUNT(DISTINCT cc.category_id) = 0 THEN '[]'
          ELSE CONCAT(
            '[',
            GROUP_CONCAT(
              DISTINCT CONCAT(
                '"', cat.name, '"'
              )
            ),
            ']'
          )
        END as category_names,
        CASE 
          WHEN COUNT(DISTINCT cs.subcategory_id) = 0 THEN '[]'
          ELSE CONCAT(
            '[',
            GROUP_CONCAT(
              DISTINCT CONCAT(
                '"', sub.name, '"'
              )
            ),
            ']'
          )
        END as subcategory_names,
        CASE 
          WHEN COUNT(DISTINCT cp.product_id) = 0 THEN '[]'
          ELSE CONCAT(
            '[',
            GROUP_CONCAT(
              DISTINCT CONCAT(
                '"', p.name, '"'
              )
            ),
            ']'
          )
        END as product_names,
        CASE 
          WHEN COUNT(DISTINCT cc.category_id) = 0 THEN '[]'
          ELSE CONCAT(
            '[',
            GROUP_CONCAT(
              DISTINCT cc.category_id
            ),
            ']'
          )
        END as category_ids,
        CASE 
          WHEN COUNT(DISTINCT cs.subcategory_id) = 0 THEN '[]'
          ELSE CONCAT(
            '[',
            GROUP_CONCAT(
              DISTINCT cs.subcategory_id
            ),
            ']'
          )
        END as subcategory_ids,
        CASE 
          WHEN COUNT(DISTINCT cp.product_id) = 0 THEN '[]'
          ELSE CONCAT(
            '[',
            GROUP_CONCAT(
              DISTINCT cp.product_id
            ),
            ']'
          )
        END as product_ids
      FROM coupons c
      LEFT JOIN coupon_categories cc ON c.id = cc.coupon_id
      LEFT JOIN categories cat ON cc.category_id = cat.id
      LEFT JOIN coupon_subcategories cs ON c.id = cs.coupon_id
      LEFT JOIN subcategories sub ON cs.subcategory_id = sub.id
      LEFT JOIN coupon_products cp ON c.id = cp.coupon_id
      LEFT JOIN products p ON cp.product_id = p.id
      WHERE c.id = ?
      GROUP BY c.id
    `, [couponId]) as any[];

    if (coupons.length === 0) {
      return NextResponse.json(
        { error: 'Cupón no encontrado' },
        { status: 404 }
      );
    }

    const coupon = coupons[0];

    // Procesar los datos JSON
    let categoryNames = [];
    let subcategoryNames = [];
    let productNames = [];
    let categoryIds = [];
    let subcategoryIds = [];
    let productIds = [];

    try {
      categoryNames = coupon.category_names && coupon.category_names !== '[]' 
        ? JSON.parse(coupon.category_names) 
        : [];
      subcategoryNames = coupon.subcategory_names && coupon.subcategory_names !== '[]' 
        ? JSON.parse(coupon.subcategory_names) 
        : [];
      productNames = coupon.product_names && coupon.product_names !== '[]' 
        ? JSON.parse(coupon.product_names) 
        : [];
      categoryIds = coupon.category_ids && coupon.category_ids !== '[]' 
        ? JSON.parse(`[${coupon.category_ids}]`) 
        : [];
      subcategoryIds = coupon.subcategory_ids && coupon.subcategory_ids !== '[]' 
        ? JSON.parse(`[${coupon.subcategory_ids}]`) 
        : [];
      productIds = coupon.product_ids && coupon.product_ids !== '[]' 
        ? JSON.parse(`[${coupon.product_ids}]`) 
        : [];
    } catch (error) {
      console.error('Error parsing coupon data:', error);
    }

    const couponResponse = {
      id: coupon.id,
      code: coupon.code,
      discountPercentage: parseFloat(coupon.discount_percentage),
      expirationDate: coupon.expiration_date,
      maxUses: coupon.max_uses,
      currentUses: coupon.current_uses,
      type: coupon.type,
      isActive: Boolean(coupon.is_active),
      createdAt: coupon.created_at,
      updatedAt: coupon.updated_at,
      categories: categoryIds,
      subcategories: subcategoryIds,
      products: productIds,
      categoryNames,
      subcategoryNames,
      productNames
    };

    return NextResponse.json(couponResponse);

  } catch (error) {
    console.error('❌ Error fetching coupon:', error);
    return NextResponse.json(
      { error: 'Error al obtener el cupón' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const resolvedParams = await params;
    const couponId = parseInt(resolvedParams.id);
    const body = await request.json();

    console.log(`🔄 Updating coupon ID: ${couponId}`, body);

    if (isNaN(couponId)) {
      return NextResponse.json(
        { error: 'ID de cupón inválido' },
        { status: 400 }
      );
    }

    const {
      code,
      discountPercentage,
      expirationDate,
      maxUses,
      type,
      isActive,
      categories = [],
      subcategories = [],
      products = []
    } = body;

    // Verificar si el cupón existe
    const existingCoupon = await query(
      'SELECT id, code FROM coupons WHERE id = ?',
      [couponId]
    ) as any[];

    if (existingCoupon.length === 0) {
      return NextResponse.json(
        { error: 'Cupón no encontrado' },
        { status: 404 }
      );
    }

    // Validaciones básicas
    if (code && !code.trim()) {
      return NextResponse.json(
        { error: 'El código del cupón no puede estar vacío' },
        { status: 400 }
      );
    }

    if (discountPercentage !== undefined && (discountPercentage < 1 || discountPercentage > 100)) {
      return NextResponse.json(
        { error: 'El porcentaje de descuento debe estar entre 1 y 100' },
        { status: 400 }
      );
    }

    if (maxUses !== undefined && maxUses < 1) {
      return NextResponse.json(
        { error: 'Los usos máximos deben ser al menos 1' },
        { status: 400 }
      );
    }

    // Verificar si el código ya existe (excluyendo el cupón actual)
    if (code) {
      const duplicateCode = await query(
        'SELECT id FROM coupons WHERE code = ? AND id != ?',
        [code.toUpperCase(), couponId]
      ) as any[];

      if (duplicateCode.length > 0) {
        return NextResponse.json(
          { error: 'Ya existe otro cupón con este código' },
          { status: 400 }
        );
      }
    }

    // Construir la consulta de actualización dinámicamente
    const updateFields = [];
    const updateValues = [];

    if (code !== undefined) {
      updateFields.push('code = ?');
      updateValues.push(code.toUpperCase());
    }
    if (discountPercentage !== undefined) {
      updateFields.push('discount_percentage = ?');
      updateValues.push(discountPercentage);
    }
    if (expirationDate !== undefined) {
      updateFields.push('expiration_date = ?');
      updateValues.push(expirationDate);
    }
    if (maxUses !== undefined) {
      updateFields.push('max_uses = ?');
      updateValues.push(maxUses);
    }
    if (type !== undefined) {
      updateFields.push('type = ?');
      updateValues.push(type);
    }
    if (isActive !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(isActive);
    }

    // Siempre actualizar la fecha de modificación
    updateFields.push('updated_at = CURRENT_TIMESTAMP');

    if (updateFields.length > 0) {
      updateValues.push(couponId);
      
      await query(
        `UPDATE coupons SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
    }

    // Actualizar relaciones - siempre procesar incluso si están vacíos
    console.log('📋 Actualizando relaciones:', {
      categories,
      subcategories, 
      products,
      type
    });

    // Eliminar relaciones existentes
    await query('DELETE FROM coupon_categories WHERE coupon_id = ?', [couponId]);
    await query('DELETE FROM coupon_subcategories WHERE coupon_id = ?', [couponId]);
    await query('DELETE FROM coupon_products WHERE coupon_id = ?', [couponId]);

    // Insertar nuevas relaciones según el tipo
    if (type === 'category' || type === 'multiple') {
      console.log(`📂 Insertando ${categories.length} categorías`);
      for (const categoryId of categories) {
        if (categoryId) { // Validar que no sea null/undefined
          await query(
            'INSERT INTO coupon_categories (coupon_id, category_id) VALUES (?, ?)',
            [couponId, categoryId]
          );
        }
      }
    }

    if (type === 'subcategory' || type === 'multiple') {
      console.log(`📂 Insertando ${subcategories.length} subcategorías`);
      for (const subcategoryId of subcategories) {
        if (subcategoryId) { // Validar que no sea null/undefined
          await query(
            'INSERT INTO coupon_subcategories (coupon_id, subcategory_id) VALUES (?, ?)',
            [couponId, subcategoryId]
          );
        }
      }
    }

    if (type === 'product' || type === 'multiple') {
      console.log(`📦 Insertando ${products.length} productos`);
      for (const productId of products) {
        if (productId) { // Validar que no sea null/undefined
          await query(
            'INSERT INTO coupon_products (coupon_id, product_id) VALUES (?, ?)',
            [couponId, productId]
          );
        }
      }
    }

    console.log(`✅ Coupon ${couponId} updated successfully`);

    // Obtener el cupón actualizado con todas las relaciones
    const updatedCouponResponse = await query(`
      SELECT 
        c.*,
        CASE 
          WHEN COUNT(DISTINCT cc.category_id) = 0 THEN '[]'
          ELSE CONCAT(
            '[',
            GROUP_CONCAT(
              DISTINCT CONCAT(
                '"', cat.name, '"'
              )
            ),
            ']'
          )
        END as category_names,
        CASE 
          WHEN COUNT(DISTINCT cs.subcategory_id) = 0 THEN '[]'
          ELSE CONCAT(
            '[',
            GROUP_CONCAT(
              DISTINCT CONCAT(
                '"', sub.name, '"'
              )
            ),
            ']'
          )
        END as subcategory_names,
        CASE 
          WHEN COUNT(DISTINCT cp.product_id) = 0 THEN '[]'
          ELSE CONCAT(
            '[',
            GROUP_CONCAT(
              DISTINCT CONCAT(
                '"', p.name, '"'
              )
            ),
            ']'
          )
        END as product_names,
        CASE 
          WHEN COUNT(DISTINCT cc.category_id) = 0 THEN '[]'
          ELSE CONCAT(
            '[',
            GROUP_CONCAT(
              DISTINCT cc.category_id
            ),
            ']'
          )
        END as category_ids,
        CASE 
          WHEN COUNT(DISTINCT cs.subcategory_id) = 0 THEN '[]'
          ELSE CONCAT(
            '[',
            GROUP_CONCAT(
              DISTINCT cs.subcategory_id
            ),
            ']'
          )
        END as subcategory_ids,
        CASE 
          WHEN COUNT(DISTINCT cp.product_id) = 0 THEN '[]'
          ELSE CONCAT(
            '[',
            GROUP_CONCAT(
              DISTINCT cp.product_id
            ),
            ']'
          )
        END as product_ids
      FROM coupons c
      LEFT JOIN coupon_categories cc ON c.id = cc.coupon_id
      LEFT JOIN categories cat ON cc.category_id = cat.id
      LEFT JOIN coupon_subcategories cs ON c.id = cs.coupon_id
      LEFT JOIN subcategories sub ON cs.subcategory_id = sub.id
      LEFT JOIN coupon_products cp ON c.id = cp.coupon_id
      LEFT JOIN products p ON cp.product_id = p.id
      WHERE c.id = ?
      GROUP BY c.id
    `, [couponId]) as any[];

    const updatedCoupon = updatedCouponResponse[0];

    if (!updatedCoupon) {
      return NextResponse.json(
        { error: 'Error al recuperar el cupón actualizado' },
        { status: 500 }
      );
    }

    // Procesar el cupón para la respuesta
    let categoryNames = [];
    let subcategoryNames = [];
    let productNames = [];
    let categoryIds = [];
    let subcategoryIds = [];
    let productIds = [];

    try {
      categoryNames = updatedCoupon.category_names && updatedCoupon.category_names !== '[]' 
        ? JSON.parse(updatedCoupon.category_names) 
        : [];
      subcategoryNames = updatedCoupon.subcategory_names && updatedCoupon.subcategory_names !== '[]' 
        ? JSON.parse(updatedCoupon.subcategory_names) 
        : [];
      productNames = updatedCoupon.product_names && updatedCoupon.product_names !== '[]' 
        ? JSON.parse(updatedCoupon.product_names) 
        : [];
      categoryIds = updatedCoupon.category_ids && updatedCoupon.category_ids !== '[]' 
        ? JSON.parse(`[${updatedCoupon.category_ids}]`) 
        : [];
      subcategoryIds = updatedCoupon.subcategory_ids && updatedCoupon.subcategory_ids !== '[]' 
        ? JSON.parse(`[${updatedCoupon.subcategory_ids}]`) 
        : [];
      productIds = updatedCoupon.product_ids && updatedCoupon.product_ids !== '[]' 
        ? JSON.parse(`[${updatedCoupon.product_ids}]`) 
        : [];
    } catch (error) {
      console.error('Error parsing updated coupon data:', error);
    }

    const couponResponse = {
      id: updatedCoupon.id,
      code: updatedCoupon.code,
      discountPercentage: parseFloat(updatedCoupon.discount_percentage),
      expirationDate: updatedCoupon.expiration_date,
      maxUses: updatedCoupon.max_uses,
      currentUses: updatedCoupon.current_uses,
      type: updatedCoupon.type,
      isActive: Boolean(updatedCoupon.is_active),
      createdAt: updatedCoupon.created_at,
      updatedAt: updatedCoupon.updated_at,
      categories: categoryIds,
      subcategories: subcategoryIds,
      products: productIds,
      categoryNames,
      subcategoryNames,
      productNames
    };

    console.log(`✅ Coupon ${couponId} fully updated:`, couponResponse);

    return NextResponse.json(couponResponse);

  } catch (error) {
    console.error('❌ Error updating coupon:', error);
    
    // Proporcionar más detalles del error
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return NextResponse.json(
      { 
        error: 'Error al actualizar el cupón',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const resolvedParams = await params;
    const couponId = parseInt(resolvedParams.id);

    console.log(`🗑️ Deleting coupon ID: ${couponId}`);

    if (isNaN(couponId)) {
      return NextResponse.json(
        { error: 'ID de cupón inválido' },
        { status: 400 }
      );
    }

    // Verificar si el cupón existe
    const existingCoupon = await query(
      'SELECT id FROM coupons WHERE id = ?',
      [couponId]
    ) as any[];

    if (existingCoupon.length === 0) {
      return NextResponse.json(
        { error: 'Cupón no encontrado' },
        { status: 404 }
      );
    }

    // Las relaciones se eliminarán automáticamente por CASCADE
    await query('DELETE FROM coupons WHERE id = ?', [couponId]);

    console.log(`✅ Coupon ${couponId} deleted successfully`);

    return NextResponse.json({ 
      message: 'Cupón eliminado exitosamente',
      couponId: couponId
    });

  } catch (error) {
    console.error('❌ Error deleting coupon:', error);
    return NextResponse.json(
      { error: 'Error al eliminar el cupón' },
      { status: 500 }
    );
  }
}