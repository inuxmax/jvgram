import { NextResponse } from 'next/server';

import { countAdmins } from '@/lib/data';

export async function GET() {
  try {
    const admins = await countAdmins();
    return NextResponse.json({
      hasAdmin: admins > 0,
      registrationOpen: admins === 0,
    });
  } catch {
    return NextResponse.json({ error: 'mongodb_unavailable' }, { status: 503 });
  }
}
