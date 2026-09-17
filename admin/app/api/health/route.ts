import { NextResponse } from 'next/server';

import { countAdmins } from '@/lib/data';

export async function GET() {
  try {
    const admins = await countAdmins();
    return NextResponse.json({
      ok: true,
      port: 3000,
      hasAdmin: admins > 0,
      registrationOpen: admins === 0,
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'mongodb_unavailable' }, { status: 503 });
  }
}
