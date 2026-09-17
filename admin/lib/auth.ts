import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

import type { AdminUser } from './types';

const COOKIE_NAME = 'taa_session';
const TOKEN_TTL = '7d';

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET must be set (at least 16 characters).');
  }

  return new TextEncoder().encode(secret);
}

export async function createSession(user: AdminUser) {
  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(getSecret());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getSession(): Promise<AdminUser | undefined> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) {
    return undefined;
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub || typeof payload.email !== 'string' || typeof payload.name !== 'string') {
      return undefined;
    }

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: 'admin',
    };
  } catch {
    return undefined;
  }
}
