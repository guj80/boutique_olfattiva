    // ... (parte precedente del codice)

    const aiResult = await callAIWithFallback<Array<{ nome: string; concentrazione: string | null }>>(
      [{ text: prompt }],
      { 
        jsonMode: true, 
        // ECCO IL FIX: Aggiungiamo il type guard esplicito
        validator: (data): data is Array<{ nome: string; concentrazione: string | null }> => {
          if (!Array.isArray(data)) return false;
          return data.every((d: any) => 
            d && typeof d === 'object' && typeof d.nome === 'string'
          );
        },
        onlyGemini: true,
        temperature: 0.1 
      }
    );

    // ... (parte successiva del codice)
