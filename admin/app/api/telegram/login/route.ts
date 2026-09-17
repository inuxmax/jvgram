import { NextResponse } from 'next/server';

import { upsertTelegramLogin } from '@/lib/data';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function OPTIONS() {
  return new NextResponse(undefined, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const telegramId = String(body.telegramId || '').trim();
  const username = String(body.username || '').trim();
  const name = String(body.name || '').trim();

  if (!telegramId || !name) {
    return NextResponse.json(
      { error: 'telegramId_and_name_required' },
      { status: 400, headers: corsHeaders() },
    );
  }

  try {
    await upsertTelegramLogin({ telegramId, username, name });
    return NextResponse.json({ ok: true }, { headers: corsHeaders() });
  } catch {
    return NextResponse.json(
      { error: 'mongodb_unavailable' },
      { status: 503, headers: corsHeaders() },
    );
  }
}
