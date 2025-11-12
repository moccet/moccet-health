import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'moccet - Demo',
  description: 'Health intelligence phone demo',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
  themeColor: '#FFFFFF',
};

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={inter.variable} style={{ width: '100%', height: '100%' }}>
      {children}
    </div>
  );
}
