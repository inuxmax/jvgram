import { NextResponse } from 'next/server';

import { createSession } from '@/lib/auth';
import { countAdmins, verifyAdminPassword } from '@/lib/data';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim();
  const password = String(body.password || '');

  try {
    if ((await countAdmins()) === 0) {
      return NextResponse.json({ error: 'setup_required' }, { status: 409 });
    }

    const admin = await verifyAdminPassword(email, password);
    if (!admin) {
      return NextResponse.json({ error: 'invalid' }, { status: 401 });
    }

    await createSession(admin);
    return NextResponse.json({ ok: true, admin: { id: admin.id, email: admin.email, name: admin.name } });
  } catch {
    return NextResponse.json({ error: 'mongodb_unavailable' }, { status: 503 });
  }
}
