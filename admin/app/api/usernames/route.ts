import { NextResponse } from 'next/server';

import { requireApiAdmin } from '@/lib/apiAuth';
import { addUsername, listUsernames, removeUsername } from '@/lib/data';

export async function GET() {
  const { error } = await requireApiAdmin();
  if (error) return error;
  return NextResponse.json({ items: await listUsernames() });
}

export async function POST(request: Request) {
  const { error } = await requireApiAdmin();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  try {
    await addUsername({
      username: String(body.username || ''),
      owner: String(body.owner || ''),
      status: body.status === 'reserved' || body.status === 'premium' ? body.status : 'active',
      note: String(body.note || ''),
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
  await removeUsername(id);
  return NextResponse.json({ ok: true });
}
