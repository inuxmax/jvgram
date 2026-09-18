import { NextResponse } from 'next/server';

import { requireApiAdmin } from '@/lib/apiAuth';
import { getFeatureFlags, saveFeatureFlags } from '@/lib/data';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function asFeatureBody(body: { priorityGoldTheme?: unknown }) {
  return {
    priorityGoldTheme: body.priorityGoldTheme !== false,
  };
}

export async function OPTIONS() {
  return new NextResponse(undefined, { status: 204, headers: corsHeaders() });
}

export async function GET() {
  try {
    const flags = await getFeatureFlags();
    return NextResponse.json(flags, { headers: corsHeaders() });
  } catch {
    return NextResponse.json(
      { error: 'mongodb_unavailable' },
      { status: 503, headers: corsHeaders() },
    );
  }
}

async function updateFlags(request: Request) {
  const { session, error } = await requireApiAdmin();
  if (error || !session) return error || NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const flags = asFeatureBody(body);
  await saveFeatureFlags(flags, session.id);
  return NextResponse.json(flags);
}

export async function POST(request: Request) {
  return updateFlags(request);
}

export async function PATCH(request: Request) {
  return updateFlags(request);
}
