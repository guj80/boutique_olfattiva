export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center p-6 max-w-md mx-auto font-sans">
      
      <header className="w-full text-center py-10">
        <h1 className="text-4xl font-serif text-[#c5a059] tracking-widest uppercase">Boutique</h1>
        <p className="text-xs text-gray-500 tracking-[0.3em] mt-3 uppercase">Diario Olfattivo</p>
      </header>

      <section className="w-full glass-panel rounded-3xl p-8 mb-8 mt-2 text-center relative overflow-hidden transition-transform active:scale-95">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#c5a059] to-transparent opacity-40"></div>
        <h2 className="text-xs text-gray-400 uppercase tracking-widest mb-4">Scent of the Day</h2>
        
        <div className="text-2xl font-serif text-white mb-8">Nessun profumo selezionato</div>
        
        <button className="bg-[#c5a059] text-black font-bold text-xs uppercase tracking-widest py-4 px-8 rounded-full hover:bg-white transition-all shadow-[0_0_20px_rgba(197,160,89,0.3)]">
          Scegli dalla collezione
        </button>
      </section>

      <section className="w-full grid grid-cols-2 gap-5 mt-4">
        <div className="glass-panel p-6 rounded-3xl flex flex-col items-center justify-center cursor-pointer transition-colors hover:border-[#c5a059] active:scale-95">
          <span className="text-3xl mb-3">✨</span>
          <span className="text-xs font-bold tracking-widest uppercase text-gray-300">Collezione</span>
        </div>
        
        <div className="glass-panel p-6 rounded-3xl flex flex-col items-center justify-center cursor-pointer transition-colors hover:border-[#c5a059] active:scale-95">
          <span className="text-3xl mb-3">📷</span>
          <span className="text-xs font-bold tracking-widest uppercase text-gray-300">Scanner</span>
        </div>
      </section>
      
    </main>
  )
}
