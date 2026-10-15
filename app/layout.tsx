import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Boutique Olfattiva — Private Olfactory Archive',
  description: 'Private Olfactory Vault & Neural Fragrance Engine.',
  icons: {
    icon: '/logo.jpg',
    apple: '/logo.jpg',
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
