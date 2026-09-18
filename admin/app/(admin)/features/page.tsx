import PriorityGoldCard from '@/components/PriorityGoldCard';
import { getFeatureFlags } from '@/lib/data';

export default async function FeaturesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const flags = await getFeatureFlags();
  const { saved } = await searchParams;

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Giao diện</h1>
        <p className="page-sub">
          Bật hoặc tắt theme Priority Gold cho toàn bộ người dùng Telegram Air.
        </p>
      </header>
      {saved && <p className="alert alert-ok">Đã lưu cấu hình giao diện.</p>}
      <PriorityGoldCard enabled={flags.priorityGoldTheme} />
    </>
  );
}
