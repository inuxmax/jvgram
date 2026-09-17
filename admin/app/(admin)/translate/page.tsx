import { saveTranslateSettingsAction } from '@/lib/actions';
import { getTranslateSettings } from '@/lib/data';
import type { TranslateProvider } from '@/lib/types';

const PROVIDERS: Array<{
  id: TranslateProvider;
  title: string;
  hint: string;
}> = [
  { id: 'google', title: 'Google Translate', hint: 'Không cần key' },
  { id: 'mymemory', title: 'MyMemory', hint: 'Email tùy chọn để tăng hạn mức' },
  { id: 'libretranslate', title: 'LibreTranslate', hint: 'Có thể tự host' },
  { id: 'deepl', title: 'DeepL Free', hint: 'Key miễn phí kết thúc bằng :fx' },
];

export default async function TranslatePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const settings = await getTranslateSettings();
  const { saved } = await searchParams;

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Dịch</h1>
        <p className="page-sub">
          Bật/tắt từng nhà cung cấp và điền key riêng. Telegram Air chỉ dùng các nhà cung cấp đang bật.
        </p>
      </header>
      {saved && <p className="alert alert-ok">Đã lưu cấu hình dịch.</p>}
      <form action={saveTranslateSettingsAction} className="card">
        <label className="field">
          <span>Ngôn ngữ đích mặc định</span>
          <input name="targetLang" defaultValue={settings.targetLang} placeholder="vi" />
        </label>
        <p className="section-label">Nhà cung cấp</p>
        {PROVIDERS.map((provider) => (
          <section
            className={`provider-card${settings.enabled[provider.id] ? '' : ' is-off'}`}
            key={provider.id}
          >
            <div className="provider-head">
              <div>
                <strong>{provider.title}</strong>
                <small>{provider.hint}</small>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  name="enabled"
                  value={provider.id}
                  defaultChecked={settings.enabled[provider.id]}
                />
                <span />
              </label>
            </div>
            {provider.id === 'mymemory' && (
              <div className="provider-fields">
                <label className="field">
                  <span>Email</span>
                  <input
                    name="myMemoryEmail"
                    defaultValue={settings.myMemoryEmail}
                    placeholder="email để tăng hạn mức"
                    autoComplete="off"
                  />
                </label>
              </div>
            )}
            {provider.id === 'deepl' && (
              <div className="provider-fields">
                <label className="field">
                  <span>API key</span>
                  <input
                    name="deeplApiKey"
                    type="password"
                    defaultValue={settings.deeplApiKey}
                    placeholder="xxxx:fx"
                    autoComplete="off"
                  />
                </label>
              </div>
            )}
            {provider.id === 'libretranslate' && (
              <div className="provider-fields">
                <label className="field">
                  <span>API key</span>
                  <input
                    name="libreApiKey"
                    type="password"
                    defaultValue={settings.libreApiKey}
                    placeholder="tùy chọn"
                    autoComplete="off"
                  />
                </label>
                <label className="field">
                  <span>URL</span>
                  <input name="libreUrl" defaultValue={settings.libreUrl} />
                </label>
              </div>
            )}
          </section>
        ))}
        <div className="form-actions">
          <button className="btn btn-primary" type="submit">
            Lưu cấu hình
          </button>
        </div>
      </form>
    </>
  );
}
