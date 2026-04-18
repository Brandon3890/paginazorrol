import { NextResponse } from 'next/server';

export let bannersVersion = Date.now();

export function bumpBannersVersion() {
  bannersVersion = Date.now();
}

export async function GET() {
  return NextResponse.json(
    { version: bannersVersion },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    }
  );
}