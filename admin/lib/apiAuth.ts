import { NextResponse } from 'next/server';

import { getSession } from './auth';

export async function requireApiAdmin() {
  const session = await getSession();
  if (!session) {
    return { session: undefined, error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  }

  return { session, error: undefined };
}
