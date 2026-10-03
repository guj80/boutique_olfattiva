import { supabase } from '../../lib/supabase'
import Link from 'next/link'

export const revalidate = 0; // Disabilita la cache per interrogare il database in tempo reale

export default async function Collezione() {
  // Sostituisci 'profumi' con il nome esatto della tua tabella se diverso
  const { data: profumi, error } = await supabase.from('profumi').select('*').order('id', { ascending: false })

  return (
    <main className="min-h-screen p-6 max-w-md mx-auto font-sans flex flex-col">
      <header className="flex items-center justify-between mb-10 mt-4">
        <Link href="/" className="text-[#c5a059] text-xs font-bold uppercase tracking-widest hover:text-white transition-colors">
          ← Home
        </Link>
        <h1 className="text-xl font-serif text-white tracking-widest uppercase">Collezione</h1>
        <div className="w-16"></div> {/* Spaziatore invisibile per centrare il titolo */}
      </header>

      <div className="flex flex-col gap-5">
        {error && <p className="text-red-500 text-sm text-center">Errore: {error.message}</p>}
        
        {!profumi || profumi.length === 0 ? (
          <div className="glass-panel p-8 rounded-3xl text-center mt-10">
            <p className="text-gray-400 text-sm uppercase tracking-widest">Nessun profumo in cassaforte</p>
          </div>
        ) : (
          profumi.map((profumo) => (
            <div key={profumo.id} className="glass-panel p-6 rounded-3xl flex flex-col gap-2 border-l-4 border-l-[#c5a059] hover:bg-white/5 transition-colors cursor-pointer">
              <div className="flex justify-between items-start">
                <h2 className="text-lg font-serif text-white">{profumo.nome}</h2>
                <span className="text-[#c5a059] text-xs font-bold font-mono">€{profumo.prezzo_stimato_euro}</span>
              </div>
              <p className="text-xs text-gray-300 uppercase tracking-widest">{profumo.brand}</p>
              <p className="text-xs text-gray-500 uppercase">{profumo.famiglia_olfattiva}</p>
            </div>
          ))
        )}
      </div>
    </main>
  )
}
