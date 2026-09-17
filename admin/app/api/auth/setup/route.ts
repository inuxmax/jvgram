import { NextResponse } from 'next/server';

import { createSession } from '@/lib/auth';
import { createFirstAdmin } from '@/lib/data';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const password = String(body.password || '');

  if (!name || !email || password.length < 8) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }

  try {
    const admin = await createFirstAdmin({ name, email, password });
    await createSession(admin);
    return NextResponse.json({ ok: true, admin: { id: admin.id, email: admin.email, name: admin.name } });
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message.includes('already exists')) {
      return NextResponse.json({ error: 'registration_closed' }, { status: 409 });
    }
    return NextResponse.json({ error: 'mongodb_unavailable' }, { status: 503 });
  }
}
