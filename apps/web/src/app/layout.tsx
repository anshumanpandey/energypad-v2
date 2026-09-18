import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'EnergiePad · Your energy workspace', template: '%s · EnergiePad' },
  description: 'A shared workspace for energy performance.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
