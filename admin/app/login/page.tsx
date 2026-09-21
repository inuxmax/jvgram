import { redirect } from 'next/navigation';

import BrandMark from '@/components/BrandMark';
import { loginAdmin } from '@/lib/actions';
import { getSession } from '@/lib/auth';
import { countAdmins } from '@/lib/data';

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  invalid: 'Email hoặc mật khẩu không đúng.',
  mongo: 'Không kết nối được. Thử lại sau.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const hasAdmin = await countAdmins().catch(() => 0);
  if (!hasAdmin) {
    redirect('/setup');
  }

  const session = await getSession();
  if (session) {
    redirect('/dashboard');
  }

  const { error } = await searchParams;
  const message = error ? ERRORS[error] : undefined;

  return (
    <div className="wallpaper auth-wrap">
      <div className="auth-card">
        <div className="brand">
          <BrandMark />
          <div>
            <h1>JVgram</h1>
            <p>Đăng nhập admin</p>
          </div>
        </div>
        {message && <p className="alert alert-error">{message}</p>}
        <form action={loginAdmin}>
          <label className="field">
            <span>Email</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="field">
            <span>Mật khẩu</span>
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="btn btn-primary btn-block" type="submit">Đăng nhập</button>
        </form>
      </div>
    </div>
  );
}
