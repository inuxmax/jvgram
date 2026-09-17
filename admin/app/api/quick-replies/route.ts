import { NextResponse } from 'next/server';

import { requireApiAdmin } from '@/lib/apiAuth';
import { addQuickReply, listQuickReplies, removeQuickReply } from '@/lib/data';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function OPTIONS() {
  return new NextResponse(undefined, { status: 204, headers: corsHeaders() });
}

export async function GET() {
  try {
    const items = await listQuickReplies();
    return NextResponse.json({ items }, { headers: corsHeaders() });
  } catch {
    return NextResponse.json(
      { error: 'mongodb_unavailable' },
      { status: 503, headers: corsHeaders() },
    );
  }
}

export async function POST(request: Request) {
  const { error } = await requireApiAdmin();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  try {
    await addQuickReply({
      userId: String(body.userId || 'global'),
      shortcut: String(body.shortcut || ''),
      content: String(body.content || ''),
      attachments: Array.isArray(body.attachments) ? body.attachments : String(body.attachments || ''),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'save_failed' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const { error } = await requireApiAdmin();
  if (error) return error;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id_required' }, { status: 400 });
  }
  await removeQuickReply(id);
  return NextResponse.json({ ok: true });
}
