import { NextResponse } from 'next/server';
import { Transaction } from '@/lib/db-transaction';
import { headers } from 'next/headers';

// ✅ Función para verificar si la petición es interna (desde la misma app)
async function isInternalRequest(request: Request): Promise<boolean> {
  // ✅ USAR AWAIT - headers() es una Promise en Next.js 15
  const headersList = await headers();
  const referer = headersList.get('referer') || '';
  const userAgent = headersList.get('user-agent') || '';
  
  // 🔥 Opción 1: Verificar que viene del mismo dominio
  const isSameOrigin = referer.includes('zorroludico.cl') || 
                       referer.includes('localhost:3000') ||
                       referer === '';
  
  // 🔥 Opción 2: Verificar que NO es un navegador común (petición interna)
  const isNotBrowser = !userAgent.includes('Mozilla') || 
                       userAgent.includes('Node.js') ||
                       userAgent.includes('Next.js');
  
  // 🔥 Opción 3: Verificar token secreto en headers (MÁS SEGURO)
  const internalToken = headersList.get('x-internal-token');
  const isValidToken = internalToken === process.env.INTERNAL_API_TOKEN;
  
  // ✅ Para desarrollo, permitir localhost
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  
  // ✅ En producción, requiere token interno O ser del mismo origen sin navegador
  return isValidToken || (isSameOrigin && isNotBrowser);
}

export async function GET(request: Request) {
  const transaction = new Transaction();
  
  // 🔒 VERIFICAR ACCESO con await
  const isInternal = await isInternalRequest(request);
  
  if (!isInternal) {
    console.warn('⚠️ Acceso denegado a /api/categories desde origen no autorizado');
    return NextResponse.json(
      { error: 'Acceso no autorizado' },
      { status: 403 }
    );
  }
  
  try {
    await transaction.begin();
    
    const categories = await transaction.query(`
      SELECT 
        c.id,
        c.name,
        c.slug,
        c.description,
        c.is_active,
        c.display_order,
        c.created_at,
        c.updated_at,
        COALESCE(
          (
            SELECT JSON_ARRAYAGG(
              JSON_OBJECT(
                'id', s.id,
                'name', s.name,
                'slug', s.slug,
                'category_id', s.category_id,
                'is_active', s.is_active,
                'display_order', s.display_order,
                'created_at', s.created_at,
                'updated_at', s.updated_at
              )
              ORDER BY s.display_order ASC
            )
            FROM subcategories s
            WHERE s.category_id = c.id AND s.is_active = TRUE
          ),
          JSON_ARRAY()
        ) as subcategories
      FROM categories c
      WHERE c.is_active = TRUE
      ORDER BY c.display_order ASC, c.name ASC
    `) as any[];

    await transaction.commit();

    return NextResponse.json(categories);
    
  } catch (error) {
    await transaction.rollback();
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// 🔒 POST protegido - Solo administradores autenticados
export async function POST(request: Request) {
  const transaction = new Transaction();
  
  // 🔒 Verificar autenticación de administrador
  const authToken = request.headers.get('authorization')?.replace('Bearer ', '');
  
  // Obtener token de cookies
  const cookieHeader = request.headers.get('cookie');
  let cookieToken = '';
  if (cookieHeader) {
    const match = cookieHeader.match(/auth_token=([^;]+)/);
    if (match) cookieToken = match[1];
  }
  
  const token = authToken || cookieToken;
  
  if (!token) {
    return NextResponse.json(
      { error: 'No autorizado - Inicia sesión como administrador' },
      { status: 401 }
    );
  }
  
  // ✅ Verificar JWT y rol admin
  try {
    const { jwtVerify } = await import('jose');
    const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    if (payload.role !== 'admin') {
      return NextResponse.json(
        { error: 'Acceso denegado - Se requieren privilegios de administrador' },
        { status: 403 }
      );
    }
  } catch (error) {
    console.error('Error verificando token:', error);
    return NextResponse.json(
      { error: 'Sesión inválida o expirada' },
      { status: 401 }
    );
  }
  
  try {
    const { name, slug, description, is_active = true } = await request.json();

    // Validación estricta de entrada
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Nombre inválido' },
        { status: 400 }
      );
    }
    
    if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: 'Slug inválido (solo minúsculas, números y guiones)' },
        { status: 400 }
      );
    }
    
    if (name.length > 255) {
      return NextResponse.json(
        { error: 'Nombre muy largo (máximo 255 caracteres)' },
        { status: 400 }
      );
    }

    await transaction.begin();

    const result: any = await transaction.query(
      'INSERT INTO categories (name, slug, description, is_active) VALUES (?, ?, ?, ?)',
      [name.trim(), slug.trim(), description || null, is_active ? 1 : 0]
    );

    await transaction.commit();

    return NextResponse.json({ 
      id: result.insertId,
      message: 'Categoría creada exitosamente' 
    });
    
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating category:', error);
    return NextResponse.json(
      { error: 'Error al crear la categoría' },
      { status: 500 }
    );
  }
}