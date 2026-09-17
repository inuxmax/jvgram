import { NextResponse } from 'next/server';

import { requireApiAdmin } from '@/lib/apiAuth';
import { addUpgrade, listUpgrades, removeUpgrade, setUpgradeActive } from '@/lib/data';

export async function GET() {
  const { error } = await requireApiAdmin();
  if (error) return error;
  return NextResponse.json({ items: await listUpgrades() });
}

export async function POST(request: Request) {
  const { error } = await requireApiAdmin();
  if (error) return error;
  const body = await request.json().catch(() => ({}));
  try {
    await addUpgrade({
      title: String(body.title || ''),
      price: String(body.price || ''),
      description: String(body.description || ''),
      isActive: Boolean(body.isActive),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'save_failed' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const { error } = await requireApiAdmin();
  if (error) return error;
  const body = await request.json().catch(() => ({}));
  if (!body.id) {
    return NextResponse.json({ error: 'id_required' }, { status: 400 });
  }
  await setUpgradeActive(String(body.id), Boolean(body.isActive));
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { error } = await requireApiAdmin();
  if (error) return error;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id_required' }, { status: 400 });
  }
  await removeUpgrade(id);
  return NextResponse.json({ ok: true });
}
