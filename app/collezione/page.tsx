const [savingScoutKey, setSavingScoutKey] = useState<string | null>(null);

  async function handleSaveScoutToRadar(item: ScoutProposal) {
    const pairKey = makeScoutPairKey(item.brand, item.nome);
    const alreadyExists = profumi.some(
      (p) => makeScoutPairKey(p.brand, p.nome) === pairKey
    );

    if (alreadyExists) {
      showToast(`${item.brand} — ${item.nome} è già in archivio.`, 'error');
      return;
    }

    setSavingScoutKey(pairKey);
    try {
      // 1. Arricchisce automaticamente da Catalogo + Parfumo + Fragrantica + AI prima di salvare
      let enriched: Record<string, any> = {};
      try {
        const extractRes = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brand: item.brand,
            nome: item.nome,
            concentration: item.concentrazione || '',
            queryName: `${item.brand} ${item.nome}`,
          }),
        });
        if (extractRes.ok) {
          const extData = await extractRes.json();
          if (extData && !extData.error) {
            enriched = extData;
          }
        }
      } catch {
        // Se l'arricchimento web non risponde, salva comunque i dati già estratti dal Trittico
      }

      const noteTesta = enriched.note_testa || item.note_testa || null;
      const noteCuore = enriched.note_cuore || item.note_cuore || null;
      const noteFondo = enriched.note_fondo || item.note_fondo || null;
      const unifiedNotes =
        enriched.note_olfattive ||
        [noteTesta, noteCuore, noteFondo].filter(Boolean).join(', ') ||
        null;

      const payload = {
        brand: enriched.brand || item.brand,
        nome: enriched.nome || item.nome,
        concentrazione: enriched.concentrazione || item.concentrazione || 'Eau de Parfum',
        famiglia_olfattiva:
          normalizeFamily(enriched.famiglia_olfattiva || item.famiglia_olfattiva) || 'Ambrata',
        naso: enriched.naso || item.naso || null,
        anno_lancio: enriched.anno_lancio ? Number(enriched.anno_lancio) || null : null,
        note_testa: noteTesta,
        note_cuore: noteCuore,
        note_fondo: noteFondo,
        note_olfattive: unifiedNotes,
        prezzo_stimato_euro: enriched.prezzo_stimato_euro || null,
        formato_ml: Number(enriched.formato_ml) || 100,
        stagione_ideale: enriched.stagione_ideale || null,
        occasione_ideale: enriched.occasione_ideale || null,
        url_foto_vetrina:
          (typeof enriched.url_foto_vetrina === 'string' &&
          enriched.url_foto_vetrina.startsWith('http')
            ? enriched.url_foto_vetrina
            : null) ||
          item.url_foto_vetrina ||
          null,
        stato: 'radar',
      };

      const { data, error } = await supabase
        .from('profumi')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;

      setProfumi((prev) => [...prev, data as Profumo]);
      setScoutResults((prev) =>
        prev.filter((r) => makeScoutPairKey(r.brand, r.nome) !== pairKey)
      );
      showToast(`${payload.nome} importato con scheda completa nel Radar.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Errore salvataggio.';
      showToast(message, 'error');
    } finally {
      setSavingScoutKey(null);
    }
  }
