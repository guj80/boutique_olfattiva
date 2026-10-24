import './globals.css';
import type { Metadata } from 'next';
import { Bricolage_Grotesque, Instrument_Serif } from 'next/font/google';
import { AuraProvider } from '@/components/AuraProvider';
import { Aura } from '@/components/Aura';
import { BottomDock } from '@/components/BottomDock';
import { ToastProvider } from '@/components/Toast';
import { SpruzzoProvider } from '@/components/Spruzzo';
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
  title: 'Atelier LG',
  description: 'Haute Parfumerie Collection',
  themeColor: '#050308',
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
      style={{ backgroundColor: '#050308' }}
      className={`dark bg-[#050308] ${bricolage.variable} ${instrumentSerif.variable}`}
    >
      <body
        style={{ backgroundColor: '#050308' }}
        className="bg-[#050308] text-[#F6EFE4] antialiased selection:bg-[#10B981] selection:text-[#08060C]"
      >
        <AuraProvider>
          <ToastProvider>
            <SpruzzoProvider>
              <SplashIntro />
              <Aura />
              <div
                style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
                className="relative z-10 flex min-h-[100dvh] w-full flex-col pb-28"
              >
                {children}
              </div>
              <BottomDock />
            </SpruzzoProvider>
          </ToastProvider>
        </AuraProvider>
      </body>
    </html>
  );
}
