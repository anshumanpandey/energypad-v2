import { handlers } from '@/server/auth';
import { writesFrozen, freezeResponse } from '@/server/write-freeze';
import type { NextRequest } from 'next/server';
export async function GET(request: NextRequest) {
  return writesFrozen() ? freezeResponse() : handlers.GET(request);
}
export async function POST(request: NextRequest) {
  return writesFrozen() ? freezeResponse() : handlers.POST(request);
}
