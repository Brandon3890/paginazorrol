import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, items = [] } = body; // Ahora recibe items para validación completa

    if (!code) {
      return NextResponse.json(
        { error: 'Código de cupón requerido' },
        { status: 400 }
      );
    }

    console.log(`🔍 Validating coupon: ${code}`, { items: items.length });

    // Consulta para validar el cupón
    const coupons = await query(`
      SELECT 
        c.*,
        GROUP_CONCAT(DISTINCT cc.category_id) as category_ids,
        GROUP_CONCAT(DISTINCT cs.subcategory_id) as subcategory_ids,
        GROUP_CONCAT(DISTINCT cp.product_id) as product_ids
      FROM coupons c
      LEFT JOIN coupon_categories cc ON c.id = cc.coupon_id
      LEFT JOIN coupon_subcategories cs ON c.id = cs.coupon_id
      LEFT JOIN coupon_products cp ON c.id = cp.coupon_id
      WHERE c.code = ? AND c.is_active = true
      GROUP BY c.id
    `, [code.toUpperCase()]) as any[];

    if (coupons.length === 0) {
      return NextResponse.json(
        { valid: false, error: 'Cupón no encontrado o inactivo' },
        { status: 200 }
      );
    }

    const coupon = coupons[0];
    const now = new Date();
    const expirationDate = new Date(coupon.expiration_date);

    // Verificar expiración
    if (expirationDate <= now) {
      return NextResponse.json(
        { valid: false, error: 'Cupón expirado' },
        { status: 200 }
      );
    }

    // Verificar usos máximos
    if (coupon.current_uses >= coupon.max_uses) {
      return NextResponse.json(
        { valid: false, error: 'Cupón agotado' },
        { status: 200 }
      );
    }

    // Validar según el tipo de cupón y los items del carrito
    let isValid = false;
    let validationMessage = "";

    switch (coupon.type) {
      case 'global':
        isValid = true;
        validationMessage = "Cupón global aplicado";
        break;

      case 'category':
      if (items && items.length > 0) {
        const categoryIds = coupon.category_ids ? coupon.category_ids.split(',').map((id: string) => parseInt(id)) : [];
        
        console.log('🛒 Validando cupón de categoría:', {
          categoryIds,
          cartItems: items.map((item: any) => ({
            id: item.id,
            categoryId: item.categoryId,
            name: 'item'
          }))
        });
        
        isValid = items.some((item: any) => {
          const applies = item.categoryId && categoryIds.includes(parseInt(item.categoryId));
          
          if (applies) {
            console.log(`✅ Producto ${item.id} aplica para categoría ${item.categoryId}`);
          }
          
          return applies;
        });
        
        validationMessage = isValid 
          ? "Cupón aplicado a productos de categorías válidas" 
          : "No hay productos en tu carrito que apliquen para este cupón de categoría";
      }
      break;

      case 'subcategory':
        if (items && items.length > 0) {
          const subcategoryIds = coupon.subcategory_ids ? coupon.subcategory_ids.split(',').map((id: string) => parseInt(id)) : [];
          isValid = items.some((item: any) => 
            item.subcategoryId && subcategoryIds.includes(parseInt(item.subcategoryId))
          );
          validationMessage = isValid 
            ? "Cupón aplicado a productos de subcategorías válidas" 
            : "No hay productos en tu carrito que apliquen para este cupón de subcategoría";
        } else {
          isValid = true;
          validationMessage = "Cupón de subcategoría válido";
        }
        break;

      case 'product':
        if (items && items.length > 0) {
          const productIds = coupon.product_ids ? coupon.product_ids.split(',').map((id: string) => parseInt(id)) : [];
          isValid = items.some((item: any) => 
            productIds.includes(parseInt(item.id))
          );
          validationMessage = isValid 
            ? "Cupón aplicado a productos válidos" 
            : "No hay productos en tu carrito que apliquen para este cupón de producto";
        } else {
          isValid = true;
          validationMessage = "Cupón de producto válido";
        }
        break;

      case 'multiple':
        // Para múltiples, verificamos que al menos un item cumpla con alguna condición
        if (items && items.length > 0) {
          const categoryIds = coupon.category_ids ? coupon.category_ids.split(',').map((id: string) => parseInt(id)) : [];
          const subcategoryIds = coupon.subcategory_ids ? coupon.subcategory_ids.split(',').map((id: string) => parseInt(id)) : [];
          const productIds = coupon.product_ids ? coupon.product_ids.split(',').map((id: string) => parseInt(id)) : [];
          
          isValid = items.some((item: any) => 
            (item.categoryId && categoryIds.includes(parseInt(item.categoryId))) ||
            (item.subcategoryId && subcategoryIds.includes(parseInt(item.subcategoryId))) ||
            productIds.includes(parseInt(item.id))
          );
          validationMessage = isValid 
            ? "Cupón aplicado a productos válidos" 
            : "No hay productos en tu carrito que apliquen para este cupón múltiple";
        } else {
          isValid = true;
          validationMessage = "Cupón múltiple válido";
        }
        break;

      default:
        isValid = false;
        validationMessage = "Tipo de cupón no soportado";
    }

    if (!isValid) {
      return NextResponse.json(
        { valid: false, error: validationMessage || 'Cupón no válido para los productos en tu carrito' },
        { status: 200 }
      );
    }

    // Cupón válido
    const validCoupon = {
      id: coupon.id,
      code: coupon.code,
      discountPercentage: parseFloat(coupon.discount_percentage),
      type: coupon.type,
      expirationDate: coupon.expiration_date,
      maxUses: coupon.max_uses,
      currentUses: coupon.current_uses,
      categoryIds: coupon.category_ids ? coupon.category_ids.split(',').map((id: string) => parseInt(id)) : [],
      subcategoryIds: coupon.subcategory_ids ? coupon.subcategory_ids.split(',').map((id: string) => parseInt(id)) : [],
      productIds: coupon.product_ids ? coupon.product_ids.split(',').map((id: string) => parseInt(id)) : []
    };

    return NextResponse.json({
      valid: true,
      coupon: validCoupon,
      message: validationMessage
    });

  } catch (error) {
    console.error('❌ Error validating coupon:', error);
    return NextResponse.json(
      { error: 'Error al validar el cupón' },
      { status: 500 }
    );
  }
}