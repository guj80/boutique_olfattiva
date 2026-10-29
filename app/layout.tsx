import './globals.css';
import type { Metadata } from 'next';
import { Bricolage_Grotesque, Instrument_Serif } from 'next/font/google';
import { BottomDock } from '@/components/BottomDock';
import { ToastProvider } from '@/components/Toast';
import { SplashIntro } from '@/components/SplashIntro';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  axes: ['opsz', 'wdth'],
  variable: '--font-bricolage',
  display: 'swap',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-instrument',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Atelier LG · Olfactory Boutique',
  description: 'Perifumeria enciclopedica: catalogo profumi, note e piramidi olfattive.',
  themeColor: '#140D1C',
  viewport: { width: 'device-width', initialScale: 1, viewportFit: 'cover' },
  icons: {
    icon: '/LOGO_LG.jpg',
    shortcut: '/LOGO_LG.jpg',
    apple: '/LOGO_LG.jpg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Atelier LG',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="it"
      style={{ backgroundColor: '#140D1C' }}
      className={`dark bg-[#140D1C] ${bricolage.variable} ${instrumentSerif.variable}`}
    >
      <body
        style={{ backgroundColor: '#140D1C' }}
        className="bg-[#140D1C] text-[#F6EFE4] antialiased selection:bg-[#C98A3A] selection:text-[#140D1C]"
      >
        <ToastProvider>
          <div className="app-root">
            {children}
            <BottomDock />
            <SplashIntro />
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
