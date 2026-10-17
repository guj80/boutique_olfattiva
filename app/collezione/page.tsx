{/* SCHEDA DETTAGLIO MODALE (EMOTIONAL & FLUIDA) */}
      {selectedProfumo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#140D1C]/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-[32px] border border-[#D8B995]/40 bg-[#1E1428] p-6 sm:p-8 text-[#F6EFE4] space-y-6 shadow-2xl no-scrollbar">
            <button
              onClick={() => setSelectedProfumo(null)}
              className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-[#140D1C] text-[#B8A9C9] hover:text-white border border-white/10 transition"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Focus visivo sul flacone in vetrina */}
            <div className="flex flex-col items-center text-center pt-2">
              <div className="relative mb-4">
                <div
                  className="absolute inset-0 rounded-[36px] blur-2xl opacity-60"
                  style={{ backgroundColor: resolveAura(selectedProfumo.famiglia_olfattiva, selectedProfumo.nome).primary }}
                />
                <BottlePedestal src={selectedProfumo.url_foto_vetrina || selectedProfumo.immagine_url} alt={selectedProfumo.nome} size="xl" className="relative z-10" />
              </div>

              <span className="font-mono text-xs text-[#D8B995] uppercase tracking-widest">{selectedProfumo.brand}</span>
              <h2 className="font-serif text-3xl text-[#F6EFE4] mt-1">{selectedProfumo.nome}</h2>
              <p className="text-xs text-[#B8A9C9] mt-1">{selectedProfumo.concentrazione || 'Eau de Parfum'} • {selectedProfumo.famiglia_olfattiva}</p>
            </div>

            {/* Descrizione Poetica / IA */}
            {selectedProfumo.descrizione_ai && (
              <div className="rounded-[20px] bg-[#140D1C]/60 p-4 border border-white/10">
                <p className="font-serif text-sm italic leading-relaxed text-[#F6EFE4]/90 text-center">
                  &ldquo;{selectedProfumo.descrizione_ai}&rdquo;
                </p>
              </div>
            )}

            {/* Flusso Sensoriale a Micro-Badge (Senza etichette rigide o pesanti) */}
            <div className="space-y-3">
              <h3 className="font-mono text-[11px] uppercase tracking-widest text-[#D8B995]">Evoluzione Olfattiva</h3>
              
              <div className="space-y-2 text-xs">
                {selectedProfumo.note_testa && (
                  <div className="flex items-center justify-between rounded-[16px] bg-[#140D1C] px-4 py-3 border border-white/10">
                    <span className="font-mono text-[10px] text-[#D8B995] uppercase tracking-wider">✦ L&apos;Impatto</span>
                    <span className="text-right text-[#F6EFE4] font-medium">{selectedProfumo.note_testa}</span>
                  </div>
                )}
                {selectedProfumo.note_cuore && (
                  <div className="flex items-center justify-between rounded-[16px] bg-[#140D1C] px-4 py-3 border border-white/10">
                    <span className="font-mono text-[10px] text-[#D8B995] uppercase tracking-wider">◆ L&apos;Anima</span>
                    <span className="text-right text-[#F6EFE4] font-medium">{selectedProfumo.note_cuore}</span>
                  </div>
                )}
                {selectedProfumo.note_fondo && (
                  <div className="flex items-center justify-between rounded-[16px] bg-[#140D1C] px-4 py-3 border border-white/10">
                    <span className="font-mono text-[10px] text-[#D8B995] uppercase tracking-wider">● La Scia</span>
                    <span className="text-right text-[#F6EFE4] font-medium">{selectedProfumo.note_fondo}</span>
                  </div>
                )}
                {!selectedProfumo.note_testa && !selectedProfumo.note_cuore && !selectedProfumo.note_fondo && selectedProfumo.note_olfattive && (
                  <div className="rounded-[16px] bg-[#140D1C] p-4 border border-white/10 text-center text-[#F6EFE4]">
                    {selectedProfumo.note_olfattive}
                  </div>
                )}
              </div>
            </div>

            {/* Azioni modale */}
            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <button
                onClick={() => setDeleteConfirmId(selectedProfumo.id)}
                className="flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition"
              >
                <Trash2 className="h-4 w-4" />
                <span>Elimina flacone</span>
              </button>

              <button
                onClick={() => setSelectedProfumo(null)}
                className="rounded-full bg-[#D8B995] px-6 py-2.5 text-xs font-bold text-[#140D1C] transition hover:bg-[#c2a27e]"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
