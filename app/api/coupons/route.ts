import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    console.log('🔍 Fetching coupons from database...');

    // Consulta para obtener todos los cupones con sus relaciones
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
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `) as any[];

    // Procesar los datos JSON
    const processedCoupons = coupons.map(coupon => {
      // Parsear arrays de nombres
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

      return {
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
        // Arrays de IDs
        categories: categoryIds,
        subcategories: subcategoryIds,
        products: productIds,
        // Arrays de nombres para mostrar
        categoryNames,
        subcategoryNames,
        productNames
      };
    });

    console.log(`✅ Found ${processedCoupons.length} coupons`);

    return NextResponse.json(processedCoupons);

  } catch (error) {
    console.error('❌ ERROR in coupons API:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch coupons',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const {
      code,
      discountPercentage,
      expirationDate,
      maxUses,
      type,
      isActive = true,
      categories = [],
      subcategories = [],
      products = []
    } = body;

    // Validaciones básicas
    if (!code || !discountPercentage || !expirationDate || !maxUses || !type) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: código, porcentaje de descuento, fecha de expiración, usos máximos y tipo son obligatorios' },
        { status: 400 }
      );
    }

    if (discountPercentage <= 0 || discountPercentage > 100) {
      return NextResponse.json(
        { error: 'El porcentaje de descuento debe estar entre 1 y 100' },
        { status: 400 }
      );
    }

    if (maxUses <= 0) {
      return NextResponse.json(
        { error: 'Los usos máximos deben ser mayores a 0' },
        { status: 400 }
      );
    }

    // Verificar si el código ya existe
    const existingCoupon = await query(
      'SELECT id FROM coupons WHERE code = ?',
      [code.toUpperCase()]
    ) as any[];

    if (existingCoupon.length > 0) {
      return NextResponse.json(
        { error: 'Ya existe un cupón con este código' },
        { status: 400 }
      );
    }

    // Insertar cupón principal
    const result: any = await query(
      `INSERT INTO coupons (
        code, discount_percentage, expiration_date, max_uses, type, is_active
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        code.toUpperCase(),
        discountPercentage,
        expirationDate,
        maxUses,
        type,
        isActive
      ]
    );

    const couponId = result.insertId;

    // Insertar relaciones según el tipo
    if (type === 'category' || type === 'multiple') {
      for (const categoryId of categories) {
        await query(
          'INSERT INTO coupon_categories (coupon_id, category_id) VALUES (?, ?)',
          [couponId, categoryId]
        );
      }
    }

    if (type === 'subcategory' || type === 'multiple') {
      for (const subcategoryId of subcategories) {
        await query(
          'INSERT INTO coupon_subcategories (coupon_id, subcategory_id) VALUES (?, ?)',
          [couponId, subcategoryId]
        );
      }
    }

    if (type === 'product' || type === 'multiple') {
      for (const productId of products) {
        await query(
          'INSERT INTO coupon_products (coupon_id, product_id) VALUES (?, ?)',
          [couponId, productId]
        );
      }
    }

    console.log(`✅ Coupon created successfully with ID: ${couponId}`);

    // Obtener el cupón recién creado con toda su información
    const newCouponResponse = await query(`
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
        END as product_names
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

    const newCoupon = newCouponResponse[0];

    // Procesar el cupón para la respuesta
    let categoryNames = [];
    let subcategoryNames = [];
    let productNames = [];

    try {
      categoryNames = newCoupon.category_names && newCoupon.category_names !== '[]' 
        ? JSON.parse(newCoupon.category_names) 
        : [];
      subcategoryNames = newCoupon.subcategory_names && newCoupon.subcategory_names !== '[]' 
        ? JSON.parse(newCoupon.subcategory_names) 
        : [];
      productNames = newCoupon.product_names && newCoupon.product_names !== '[]' 
        ? JSON.parse(newCoupon.product_names) 
        : [];
    } catch (error) {
      console.error('Error parsing new coupon data:', error);
    }

    const couponResponse = {
      id: newCoupon.id,
      code: newCoupon.code,
      discountPercentage: parseFloat(newCoupon.discount_percentage),
      expirationDate: newCoupon.expiration_date,
      maxUses: newCoupon.max_uses,
      currentUses: newCoupon.current_uses,
      type: newCoupon.type,
      isActive: Boolean(newCoupon.is_active),
      createdAt: newCoupon.created_at,
      updatedAt: newCoupon.updated_at,
      categoryNames,
      subcategoryNames,
      productNames,
      categories,
      subcategories,
      products
    };

    return NextResponse.json(couponResponse, { status: 201 });

  } catch (error) {
    console.error('❌ Error creating coupon:', error);
    return NextResponse.json(
      { error: 'Error al crear el cupón' },
      { status: 500 }
    );
  }
}