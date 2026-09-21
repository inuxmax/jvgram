import { redirect } from 'next/navigation';

import BrandMark from '@/components/BrandMark';
import { setupAdmin } from '@/lib/actions';
import { getSession } from '@/lib/auth';
import { countAdmins } from '@/lib/data';

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  invalid: 'Điền đủ tên, email và mật khẩu tối thiểu 8 ký tự.',
  mongo: 'Không kết nối được. Thử lại sau.',
};

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const hasAdmin = await countAdmins().catch(() => -1);
  if (hasAdmin > 0) {
    redirect('/login');
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
            <p>Tạo tài khoản admin</p>
          </div>
        </div>
        {message && <p className="alert alert-error">{message}</p>}
        {hasAdmin === -1 && (
          <p className="alert alert-error">Không kết nối được. Thử lại sau.</p>
        )}
        <form action={setupAdmin}>
          <label className="field">
            <span>Tên hiển thị</span>
            <input name="name" autoComplete="name" required />
          </label>
          <label className="field">
            <span>Email</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="field">
            <span>Mật khẩu</span>
            <input name="password" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <button className="btn btn-primary btn-block" type="submit">Tạo tài khoản</button>
        </form>
      </div>
    </div>
  );
}
