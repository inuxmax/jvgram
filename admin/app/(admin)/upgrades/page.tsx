import { createUpgradeAction, deleteUpgradeAction, toggleUpgradeAction } from '@/lib/actions';
import { listUpgrades } from '@/lib/data';

export default async function UpgradesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const rows = await listUpgrades();
  const { error } = await searchParams;

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Nâng cấp</h1>
        <p className="page-sub">Gói Premium / boost / tính năng bán thêm.</p>
      </header>
      {error && <p className="alert alert-error">Không lưu được gói nâng cấp.</p>}
      <form action={createUpgradeAction} className="card">
        <div className="toolbar">
          <label className="field">
            <span>Tên gói</span>
            <input name="title" placeholder="Air Plus" required />
          </label>
          <label className="field">
            <span>Giá</span>
            <input name="price" placeholder="99.000đ / tháng" />
          </label>
          <div className="field-inline">
            <label className="switch">
              <input name="isActive" type="checkbox" defaultChecked />
              <span />
            </label>
            <span>Đang mở bán</span>
          </div>
        </div>
        <label className="field">
          <span>Mô tả</span>
          <textarea name="description" placeholder="AI, username đẹp, ưu tiên support..." />
        </label>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit">
            Tạo gói
          </button>
        </div>
      </form>
      <div className="upgrade-grid">
        {rows.length === 0 && (
          <div className="card empty">Chưa có gói nâng cấp.</div>
        )}
        {rows.map((row) => (
          <article className="card upgrade-card" key={row.id}>
            <h3>{row.title}</h3>
            <p className="price">{row.price || 'Chưa đặt giá'}</p>
            <p>{row.description || 'Chưa có mô tả'}</p>
            <div className="row-actions">
              <span className={`badge ${row.isActive ? 'badge-on' : 'badge-off'}`}>
                {row.isActive ? 'Đang bán' : 'Tắt'}
              </span>
              <form action={toggleUpgradeAction}>
                <input type="hidden" name="id" value={row.id} />
                <input type="hidden" name="isActive" value={row.isActive ? 'false' : 'true'} />
                <button className="btn btn-ghost" type="submit">
                  {row.isActive ? 'Tắt' : 'Bật'}
                </button>
              </form>
              <form action={deleteUpgradeAction}>
                <input type="hidden" name="id" value={row.id} />
                <button className="btn btn-danger" type="submit">Xóa</button>
              </form>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
