'use client';

import { useState } from 'react';

import { saveFeatureFlagsAction } from '@/lib/actions';

type Props = {
  enabled: boolean;
};

export default function PriorityGoldCard({ enabled }: Props) {
  const [nextEnabled, setNextEnabled] = useState(enabled);
  const [isConfirming, setIsConfirming] = useState(false);

  if (isConfirming) {
    return (
      <form action={saveFeatureFlagsAction} className="card">
        <input type="hidden" name="priorityGoldTheme" value="0" />
        <h2 className="card-title">Tắt Priority Gold?</h2>
        <p className="page-sub">
          Người dùng đang dùng theme này sẽ tự động quay về giao diện mặc định.
        </p>
        <div className="form-actions">
          <button className="btn" type="button" onClick={() => setIsConfirming(false)}>
            Hủy
          </button>
          <button className="btn btn-danger" type="submit">
            Tắt
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      action={saveFeatureFlagsAction}
      className="card"
      onSubmit={(event) => {
        if (enabled && !nextEnabled) {
          event.preventDefault();
          setIsConfirming(true);
        }
      }}
    >
      <input type="hidden" name="priorityGoldTheme" value={nextEnabled ? '1' : '0'} />
      <div className="provider-head">
        <div>
          <h2 className="card-title">Priority Gold</h2>
          <small>Giao diện đen và vàng cao cấp</small>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={nextEnabled}
            onChange={(event) => setNextEnabled(event.target.checked)}
          />
          <span />
        </label>
      </div>
      <p className="hint">
        {nextEnabled
          ? 'Người dùng có thể chọn theme này trong Settings → Appearance.'
          : 'Người dùng không thể chọn theme này. Ai đang dùng sẽ về giao diện mặc định.'}
      </p>
      <p className="section-label">
        Trạng thái: {nextEnabled ? 'Đang bật' : 'Đã tắt'}
      </p>
      <div className="form-actions">
        <button className="btn btn-primary" type="submit">
          Lưu thay đổi
        </button>
      </div>
    </form>
  );
}
