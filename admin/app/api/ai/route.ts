import { NextResponse } from 'next/server';

import { requireApiAdmin } from '@/lib/apiAuth';
import { getAiSettings, saveAiSettings } from '@/lib/data';

export async function GET() {
  const { error } = await requireApiAdmin();
  if (error) return error;
  return NextResponse.json(await getAiSettings());
}

export async function PUT(request: Request) {
  const { error } = await requireApiAdmin();
  if (error) return error;
  const body = await request.json().catch(() => ({}));
  await saveAiSettings({
    providerUrl: String(body.providerUrl || ''),
    model: String(body.model || ''),
    systemPrompt: String(body.systemPrompt || ''),
  });
  return NextResponse.json({ ok: true });
}
