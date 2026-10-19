async function handleAddIndosso(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProfumoId || saving) return;
    setSaving(true);

    try {
      const payload = {
        profumo_id: selectedProfumoId,
        data_indosso: getLocalDateISO(),
        momento_giornata: selectedMomento,
        note_indosso: noteIndosso.trim() || null,
      };

      const { error } = await supabase.from('indossi').insert([payload]);
      if (error) throw error;

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([20, 40, 20]);
      }
      triggerSpruzzo();
      setNoteIndosso('');
      showToast('Indosso registrato nel Diario', 'default');
      fetchDiarioData();
    } catch (err) {
      showToast('Errore durante la registrazione.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteIndosso(id: string) {
    try {
      const { error } = await supabase.from('indossi').delete().eq('id', id);
      if (error) throw error;
      showToast('Voce rimossa dal Diario', 'default');
      setIndossi((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      showToast('Impossibile rimuovere la voce.', 'error');
    }
  }
