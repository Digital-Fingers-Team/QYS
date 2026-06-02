import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'QYS Platform',
  description: 'Youth and sports platform',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
