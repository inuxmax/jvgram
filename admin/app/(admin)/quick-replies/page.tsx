import { createQuickReplyAction, deleteQuickReplyAction } from '@/lib/actions';
import { listQuickReplies } from '@/lib/data';

export default async function QuickRepliesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const rows = await listQuickReplies();
  const { error } = await searchParams;

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Quick Reply</h1>
        <p className="page-sub">
          Gõ shortcut trong composer, ví dụ <code>/payment</code>, để chèn nội dung có sẵn.
        </p>
      </header>
      {error && <p className="alert alert-error">Không lưu được quick reply. Shortcut có thể bị trùng.</p>}
      <form action={createQuickReplyAction} className="card">
        <div className="toolbar">
          <label className="field">
            <span>Shortcut</span>
            <input name="shortcut" placeholder="payment" required />
          </label>
          <label className="field">
            <span>userId</span>
            <input name="userId" placeholder="global" defaultValue="global" />
          </label>
          <label className="field field-grow">
            <span>File / URL đính kèm</span>
            <input name="attachments" placeholder="https://..." />
          </label>
        </div>
        <label className="field">
          <span>Nội dung</span>
          <textarea name="content" placeholder="Vui lòng gửi mã giao dịch..." required />
        </label>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit">
            Thêm
          </button>
        </div>
      </form>
      <div className="list">
        {rows.length === 0 && <div className="empty">Chưa có quick reply nào.</div>}
        {rows.length > 0 && (
          <div className="row-head">
            <span>Shortcut</span>
            <span>Nội dung</span>
            <span>userId</span>
            <span />
          </div>
        )}
        {rows.map((row) => (
          <div className="row" key={row.id}>
            <div>
              <b>/{row.shortcut}</b>
              {row.attachments.length > 0 && (
                <small>{row.attachments.length} file đính kèm</small>
              )}
            </div>
            <div>{row.content}</div>
            <span className="badge badge-active">{row.userId}</span>
            <form action={deleteQuickReplyAction}>
              <input type="hidden" name="id" value={row.id} />
              <button className="btn btn-danger" type="submit">Xóa</button>
            </form>
          </div>
        ))}
      </div>
    </>
  );
}
