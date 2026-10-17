import './globals.css';
import type { Metadata } from 'next';
import { Bricolage_Grotesque, Instrument_Serif } from 'next/font/google';
import { AuraProvider } from '@/components/AuraProvider';
import { Aura } from '@/components/Aura';
import { BottomDock } from '@/components/BottomDock';
import { ToastProvider } from '@/components/Toast';
import { SpruzzoProvider } from '@/components/Spruzzo';

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
  title: 'Boutique Olfattiva',
  description: 'La tua collezione di profumi, viva.',
  themeColor: '#140D1C',
  viewport: { width: 'device-width', initialScale: 1, viewportFit: 'cover' },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Boutique Olfattiva',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`dark ${bricolage.variable} ${instrumentSerif.variable}`}>
      <body className="antialiased selection:bg-[#D8B995] selection:text-[#140D1C]">
        <AuraProvider>
          <ToastProvider>
            <SpruzzoProvider>
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
