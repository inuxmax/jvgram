import { redirect } from 'next/navigation';

import Sidebar from '@/components/Sidebar';
import { getSession } from '@/lib/auth';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  return (
    <div className="wallpaper shell">
      <div className="shell-frame">
        <Sidebar name={session.name} email={session.email} />
        <main className="content">
          <div className="panel">{children}</div>
        </main>
      </div>
    </div>
  );
}
