'use client'

import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'
import { Camera, Loader2, Check } from 'lucide-react'

export default function Scanner() {
  const [loading, setLoading] = useState(false)
  const [profumo, setProfumo] = useState(null)
  const [salvato, setSalvato] = useState(false)
  const fileInputRef = useRef(null)

  const scattaFoto = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setLoading(true)
    setProfumo(null)
    setSalvato(false)

    // Converte l'immagine per spedirla a Gemini
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onloadend = async () => {
      const base64data = reader.result.split(',')[1]

      try {
        const res = await fetch('/api/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64data })
        })
        
        const data = await res.json()
        
        // Estrae il JSON dalla risposta di Gemini
        const textResponse = data.candidates[0].content.parts[0].text
        const jsonString = textResponse.replace(/```json/g, '').replace(/```/g, '').trim()
        const risultato = JSON.parse(jsonString)
        
        setProfumo(risultato)
      } catch (err) {
        alert("Errore nel riconoscimento. Riprova con un'altra foto.")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
  }

  const salvaInCollezione = async () => {
    if (!profumo) return
    setLoading(true)
    const { error } = await supabase.from('profumi').insert([
      { 
        brand: profumo.brand, 
        nome: profumo.nome, 
        famiglia_olfattiva: profumo.famiglia_olfattiva, 
        prezzo_stimato_euro: profumo.prezzo_stimato_euro 
      }
    ])
    setLoading(false)
    
    if (error) {
      alert("Errore di salvataggio: " + error.message)
    } else {
      setSalvato(true)
    }
  }

  return (
    <main className="min-h-screen p-6 max-w-md mx-auto font-sans flex flex-col">
      <header className="flex items-center justify-between mb-10 mt-4">
        <Link href="/" className="text-[#c5a059] text-xs font-bold uppercase tracking-widest hover:text-white transition-colors">
          ← Home
        </Link>
        <h1 className="text-xl font-serif text-white tracking-widest uppercase">Scanner</h1>
        <div className="w-16"></div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={scattaFoto}
        />

        {!profumo && !loading && (
          <button 
            onClick={() => fileInputRef.current.click()}
            className="w-full glass-panel rounded-3xl p-12 flex flex-col items-center justify-center gap-4 hover:border-[#c5a059] transition-colors active:scale-95 text-[#c5a059]"
          >
            <Camera className="w-16 h-16" strokeWidth={1} />
            <span className="text-xs font-bold tracking-widest uppercase">Scatta Foto al Profumo</span>
          </button>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-4 text-[#c5a059]">
            <Loader2 className="w-12 h-12 animate-spin" strokeWidth={1} />
            <p className="text-xs uppercase tracking-widest animate-pulse">L'IA sta analizzando...</p>
          </div>
        )}

        {profumo && !loading && (
          <div className="w-full glass-panel p-8 rounded-3xl border border-[#c5a059] flex flex-col gap-4 animate-in fade-in zoom-in duration-500">
            <h2 className="text-2xl font-serif text-white text-center mb-2">{profumo.nome}</h2>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Brand</p>
                <p className="text-white">{profumo.brand}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Famiglia</p>
                <p className="text-white">{profumo.famiglia_olfattiva}</p>
              </div>
            </div>
            
            <div className="mt-2 border-t border-white/10 pt-4">
              <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Valore Stimato</p>
              <p className="text-[#c5a059] font-mono text-xl">€{profumo.prezzo_stimato_euro}</p>
            </div>

            <button 
              onClick={salvaInCollezione}
              disabled={salvato}
              className={`mt-6 w-full font-bold text-xs uppercase tracking-widest py-4 px-8 rounded-full transition-all shadow-lg flex justify-center items-center gap-2 ${
                salvato 
                  ? 'bg-green-500/20 text-green-400 border border-green-500 cursor-not-allowed' 
                  : 'bg-[#c5a059] text-black hover:bg-white hover:shadow-[#c5a059]/30'
              }`}
            >
              {salvato ? <><Check className="w-4 h-4" /> Salvato</> : 'Aggiungi alla Collezione'}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
