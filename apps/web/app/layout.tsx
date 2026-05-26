import './globals.css';

export const metadata = {
  title: 'QYS Platform',
  description: 'Youth and sports platform'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
