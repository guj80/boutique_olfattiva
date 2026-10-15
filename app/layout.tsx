import './globals.css';
import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  themeColor: '#08080A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'Boutique Olfattiva — Private Olfactory Archive',
  description: 'Private Olfactory Vault & Neural Fragrance Engine.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/logo.jpg', sizes: '512x512', type: 'image/jpeg' },
    ],
    apple: [
      { url: '/logo.jpg', sizes: '512x512', type: 'image/jpeg' },
    ],
  },
  appleWebApp: {
    capable: true,
    title: 'Boutique Olfattiva',
    statusBarStyle: 'black-translucent',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" className="dark">
      <body className="min-h-screen bg-[#08080A] text-white antialiased selection:bg-[#C5A059]/30 selection:text-[#F7E7CE]">
        <div className="fixed inset-0 bg-obsidian-radial pointer-events-none z-0" />
        <div className="relative z-10 min-h-screen flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
