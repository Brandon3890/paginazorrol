// app/api/images/[...path]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params
    const filename = pathSegments.join('/')
    const decodedFilename = decodeURIComponent(filename)
    
    console.log('Buscando imagen')
    
    // Buscar en la carpeta de uploads/products
    const uploadPath = path.join(process.cwd(), 'public', 'uploads', 'products', decodedFilename)
    
    if (fs.existsSync(uploadPath)) {
      const fileBuffer = fs.readFileSync(uploadPath)
      const ext = path.extname(decodedFilename).toLowerCase()
      const contentType: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
      }
      
      console.log('Imagen encontrada')
      
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': contentType[ext] || 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    }
    
    console.warn('Imagen no encontrada')
    
    // Si no se encuentra, devolver la imagen por defecto
    const defaultPath = path.join(process.cwd(), 'public', 'uploads', 'products', 'diverse-products-still-life.png')
    if (fs.existsSync(defaultPath)) {
      const fileBuffer = fs.readFileSync(defaultPath)
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    }
    
    return new NextResponse('Image not found', { status: 404 })
    
  } catch (error) {
    console.error(' Error sirviendo imagen:', error)
    return new NextResponse('Error serving image', { status: 500 })
  }
}