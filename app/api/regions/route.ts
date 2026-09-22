import { NextResponse } from 'next/server'
import regionsData from './re.json'

export async function GET() {
  try {
    return NextResponse.json(regionsData)
  } catch (error) {
    return NextResponse.json(
      { error: 'Error loading regions data' },
      { status: 500 }
    )
  }
}