import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';

import './globals.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const roboto = Roboto({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  title: 'JVgram Admin',
  description: 'Admin panel for JVgram extras',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="vi">
      <body className={roboto.className}>{children}</body>
    </html>
  );
}
