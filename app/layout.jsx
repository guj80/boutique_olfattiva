import './globals.css'

export const metadata = {
  title: 'Boutique Olfattiva',
  description: 'Il tuo Pokedex dei profumi',
}

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body className="min-h-screen bg-[#0a0a0a] text-white selection:bg-[#c5a059] selection:text-black antialiased">
        {children}
      </body>
    </html>
  )
}
