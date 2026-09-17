import { createUsernameAction, deleteUsernameAction } from '@/lib/actions';
import { listUsernames } from '@/lib/data';

export default async function UsernamesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const rows = await listUsernames();
  const { error } = await searchParams;

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Username</h1>
        <p className="page-sub">
          User đăng nhập Telegram Air sẽ hiện ở đây. Có thể thêm tay username reserved / premium.
        </p>
      </header>
      {error && <p className="alert alert-error">Không lưu được username.</p>}
      <form action={createUsernameAction} className="card">
        <div className="toolbar">
          <label className="field">
            <span>Username</span>
            <input name="username" placeholder="airname" required />
          </label>
          <label className="field">
            <span>Chủ sở hữu</span>
            <input name="owner" placeholder="Jim Jim" />
          </label>
          <label className="field">
            <span>Trạng thái</span>
            <select name="status" defaultValue="active">
              <option value="active">active</option>
              <option value="reserved">reserved</option>
              <option value="premium">premium</option>
            </select>
          </label>
          <label className="field field-grow">
            <span>Ghi chú</span>
            <input name="note" />
          </label>
          <button className="btn btn-primary" type="submit">
            Thêm
          </button>
        </div>
      </form>
      <div className="list">
        {rows.length === 0 && <div className="empty">Chưa có username nào.</div>}
        {rows.length > 0 && (
          <div className="row-head">
            <span>Username</span>
            <span>Chủ sở hữu</span>
            <span>Trạng thái</span>
            <span />
          </div>
        )}
        {rows.map((row) => (
          <div className="row" key={row.id}>
            <div>
              <b>{row.username ? `@${row.username}` : 'Chưa có username'}</b>
              <small>{row.note || 'Không ghi chú'}</small>
            </div>
            <div>{row.owner || '—'}</div>
            <span className={`badge ${row.source === 'telegram' ? 'badge-active' : `badge-${row.status}`}`}>
              {row.source === 'telegram' ? 'Telegram' : row.status}
            </span>
            <form action={deleteUsernameAction}>
              <input type="hidden" name="id" value={row.id} />
              <button className="btn btn-danger" type="submit">Xóa</button>
            </form>
          </div>
        ))}
      </div>
    </>
  );
}
