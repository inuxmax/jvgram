import { saveAiSettingsAction } from '@/lib/actions';
import { getAiSettings } from '@/lib/data';

export default async function AiPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const settings = await getAiSettings();
  const { saved } = await searchParams;

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">AI</h1>
        <p className="page-sub">Lưu cấu hình model để gắn chatbot / trợ lý sau này.</p>
      </header>
      {saved && <p className="alert alert-ok">Đã lưu cấu hình AI.</p>}
      <form action={saveAiSettingsAction} className="card">
        <label className="field">
          <span>Provider URL</span>
          <input name="providerUrl" defaultValue={settings.providerUrl} />
        </label>
        <label className="field">
          <span>Model</span>
          <input name="model" defaultValue={settings.model} />
        </label>
        <label className="field">
          <span>System prompt</span>
          <textarea name="systemPrompt" defaultValue={settings.systemPrompt} />
        </label>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit">
            Lưu cấu hình
          </button>
        </div>
      </form>
    </>
  );
}
