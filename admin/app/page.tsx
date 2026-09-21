import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth';
import { countAdmins } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const hasAdmin = await countAdmins().catch(() => 0);
  if (!hasAdmin) {
    redirect('/setup');
  }

  const session = await getSession();
  redirect(session ? '/dashboard' : '/login');
}
