import Link from 'next/link';

import { countAdmins, listQuickReplies, listUpgrades, listUsernames } from '@/lib/data';

export default async function DashboardPage() {
  const [admins, usernames, upgrades, quickReplies] = await Promise.all([
    countAdmins(),
    listUsernames(),
    listUpgrades(),
    listQuickReplies(),
  ]);

  const activeUpgrades = upgrades.filter((item) => item.isActive).length;
  const recentUsernames = usernames.slice(0, 5);

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Tổng quan</h1>
        <p className="page-sub">Theo dõi nhanh cấu hình JVgram và các mục đang quản lý.</p>
      </header>
      <div className="cards">
        <div className="stat">
          <span>Admin</span>
          <strong>{admins}</strong>
        </div>
        <div className="stat">
          <span>Username</span>
          <strong>{usernames.length}</strong>
        </div>
        <div className="stat">
          <span>Gói đang bán</span>
          <strong>{activeUpgrades}</strong>
        </div>
        <div className="stat">
          <span>Quick Reply</span>
          <strong>{quickReplies.length}</strong>
        </div>
      </div>
      <div className="stack-gap">
        <div className="card">
          <h2 className="card-title">Lối tắt</h2>
          <p className="page-sub">Mở nhanh các trang dùng nhiều nhất.</p>
          <div className="quick-links">
            <Link className="quick-link" href="/translate">
              <strong>Dịch</strong>
              <span>Nhà cung cấp và ngôn ngữ mặc định</span>
            </Link>
            <Link className="quick-link" href="/ai">
              <strong>AI</strong>
              <span>Model và system prompt</span>
            </Link>
            <Link className="quick-link" href="/quick-replies">
              <strong>Quick Reply</strong>
              <span>Shortcut /payment, /hello, /price</span>
            </Link>
            <Link className="quick-link" href="/usernames">
              <strong>Username</strong>
              <span>Danh sách từ Telegram và thêm tay</span>
            </Link>
            <Link className="quick-link" href="/upgrades">
              <strong>Nâng cấp</strong>
              <span>Gói premium / boost</span>
            </Link>
          </div>
        </div>
        <div className="card">
          <h2 className="card-title">Username gần đây</h2>
          {recentUsernames.length === 0 ? (
            <p className="muted">Chưa có username nào.</p>
          ) : (
            <div className="stack-gap">
              {recentUsernames.map((row) => (
                <div key={row.id}>
                  <b>{row.username ? `@${row.username}` : row.owner || 'Chưa có username'}</b>
                  <span className="muted">{row.owner || 'Không rõ chủ sở hữu'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
