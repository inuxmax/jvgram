import { NextResponse } from 'next/server';

import {
  getTranslateSettings,
  listEnabledTranslateProviders,
  resolveTranslateProvider,
} from '@/lib/data';
import { translateTexts } from '@/lib/translate';

const MAX_TEXTS = 50;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function OPTIONS() {
  return new NextResponse(undefined, { status: 204, headers: corsHeaders() });
}

export async function GET() {
  const stored = await getTranslateSettings();
  return NextResponse.json(
    { providers: listEnabledTranslateProviders(stored) },
    { headers: corsHeaders() },
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const texts = Array.isArray(body.texts)
    ? body.texts.map((item: unknown) => String(item || ''))
    : [];

  if (!texts.length || texts.length > MAX_TEXTS) {
    return NextResponse.json(
      { error: 'invalid_texts' },
      { status: 400, headers: corsHeaders() },
    );
  }

  try {
    const stored = await getTranslateSettings();
    const translations = await translateTexts(texts, {
      ...stored,
      provider: resolveTranslateProvider(body.provider, stored),
      sourceLang: String(body.sourceLang || stored.sourceLang || 'auto'),
      targetLang: String(body.targetLang || stored.targetLang || 'vi'),
    });
    return NextResponse.json({ translations }, { headers: corsHeaders() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'translate_failed';
    const status = message.includes('key_required') || message === 'no_provider' ? 400 : 502;
    return NextResponse.json(
      { error: message },
      { status, headers: corsHeaders() },
    );
  }
}
