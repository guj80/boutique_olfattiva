import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  callGeminiWithFallback,
  extractJsonFromAiText,
  GeminiPart,
} from '@/lib/gemini-engine';
import { formatPerfumeNote } from '@/lib/dictionary';
import { PURE_FAMILIES } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function normalizeFamilyServer(raw?: string | null): string {
  const s = (raw || '').toLowerCase().trim();
  if (!s) return 'Legnosa';
  if (s.includes('marin') || s.includes('acquat') || s.includes('ozon') || s.includes('aquat')) return 'Marina';
  if (s.includes('gourmand') || s.includes('vanigl') || s.includes('dolce') || s.includes('sweet')) return 'Gourmand';
  if (s.includes('cuoi') || s.includes('leather') || s.includes('tabacc')) return 'Cuoiata';
  if (s.includes('musch') || s.includes('pulit') || s.includes('talc') || s.includes('powdery') || s.includes('musk')) return 'Muschiata';
  if (s.includes('speziat') || s.includes('spicy')) return 'Speziata';
  if (s.includes('verd') || s.includes('green')) return 'Verde';
  if (s.includes('fruttat') || s.includes('fruity')) return 'Fruttata';
  if (s.includes('agrum') || s.includes('esperid') || s.includes('citrus')) return 'Agrumata';
  if (s.includes('ambrat') || s.includes('oriental') || s.includes('incens') || s.includes('resin') || s.includes('amber')) return 'Ambrata';
  if (s.includes('floreal') || s.includes('fiorit') || s.includes('floral')) return 'Floreale';
  if (s.includes('aromatic') || s.includes('fouger') || s.includes('fougèr')) return 'Aromatica';
  if (s.includes('legnos') || s.includes('bois') || s.includes('chypre') || s.includes('oud') || s.includes('woody')) return 'Legnosa';
  return 'Legnosa';
}

function getSupabaseServer() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: false } });
  } catch {
    return null;
  }
}

async function searchLivePerfumeEncyclopedia(query: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const jinaSearchBase = ['https:', '', 's.jina.ai'].join('/');
    const searchUrl = `${jinaSearchBase}/${encodeURIComponent(
      `${query} perfume top middle base notes perfumer release year parfumo fragrantica`
    )}`;
    const res = await fetch(searchUrl, {
      signal: controller.signal,
      headers: { Accept: 'text/plain', 'X-Retain-Images': 'none' },
    });
    clearTimeout(timer);

    if (res.ok) {
      const text = await res.text();
      return text.slice(0, 4500);
    }
  } catch {
    // Fallback silenzioso
  }
  return '';
}

function clampVote(val: any, fallback: number = 8): number {
  const n = Number(val);
  if (isNaN(n) || n < 1 || n > 10) return fallback;
  return Math.round(n);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { url, imageBase64, mimeType, queryName, brand, nome } = body;

    const searchTarget = (queryName || `${brand || ''} ${nome || ''}`).trim();
    if (!searchTarget && !url && !imageBase64) {
      return NextResponse.json(
        { error: 'Inserisci il nome di un profumo, un link o carica una foto.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    let dbVerifiedRecord: any = null;
    let contextSource = '';

    // SOLUZIONE C: Controlla se il profumo è già nel database da 59.324 elementi
    if (supabase && searchTarget.length >= 2 && !imageBase64 && !url) {
      try {
        const cleanName = (nome || searchTarget).trim();
        const { data: matches } = await supabase
          .from('perfumes')
          .select('*')
          .ilike('name', `%${cleanName}%`)
          .limit(3);

        if (matches && matches.length > 0) {
          dbVerifiedRecord = matches[0];
          if (
            dbVerifiedRecord.cached_ai_data &&
            dbVerifiedRecord.cached_ai_data.note_testa &&
            dbVerifiedRecord.cached_ai_data.prezzo_stimato_euro
          ) {
            return NextResponse.json({
              ...dbVerifiedRecord.cached_ai_data,
              _modelUsed: 'supabase-verified-cache',
            });
          }
        }
      } catch {
        // Prosegue con la ricerca live
      }
    }

    // SOLUZIONE A: Connettore Live Parfumo / Fragrantica se non trovato in cache
    if (searchTarget) {
      const liveWebSnippet = await searchLivePerfumeEncyclopedia(searchTarget);
      const dbFacts = dbVerifiedRecord
        ? `DATI NEL DB: Nome="${dbVerifiedRecord.name || ''}", Brand="${dbVerifiedRecord.brand || ''}", Anno="${dbVerifiedRecord.release_year || ''}", Concentrazione="${dbVerifiedRecord.concentration || ''}".\n`
        : '';

      contextSource = `${dbFacts}${
        liveWebSnippet ? `SCHEDA ENCICLOPEDICA LIVE (PARFUMO / FRAGRANTICA):\n${liveWebSnippet}` : ''
      }`;
    }

    const systemPrompt = `Sei l'enciclopedia tecnica dell'alta profumeria artistica e di nicchia.
Compila la scheda tecnica rigorosa per: "${searchTarget || 'Profumo'}".

${contextSource}

REGOLE TASSATIVE ANTI-ALLUCINAZIONE:
1. Usa ESCLUSIVAMENTE le note olfattive reali, il vero Naso creatore e l'anno di lancio riportati nei dati sopra o nella scheda live. VIETATO inventare note.
2. "famiglia_olfattiva": Scegli ESCLUSIVAMENTE UNA SOLA PAROLA tra queste 12:
   "Agrumata", "Aromatica", "Marina", "Floreale", "Fruttata", "Verde", "Speziata", "Legnosa", "Ambrata", "Gourmand", "Cuoiata", "Muschiata".
3. "prezzo_stimato_euro": Prezzi di listino ufficiali per formato >= 30ml (es. "50ml: €165 • 100ml: €230").

Restituisci ESCLUSIVAMENTE un oggetto JSON valido con questa struttura:
{
  "nome": "Nome ufficiale esatto",
  "brand": "Nome Maison",
  "concentrazione": "Es. Extrait de Parfum, Eau de Parfum",
  "anno_lancio": 2021,
  "famiglia_olfattiva": "Una delle 12 famiglie pure",
  "note_testa": "Note di testa separate da virgola",
  "note_cuore": "Note di cuore separate da virgola",
  "note_fondo": "Note di fondo separate da virgola",
  "note_olfattive": "Elenco completo note separate da virgola",
  "descrizione_ai": "Analisi tecnica oggettiva in 2 frasi",
  "prezzo_stimato_euro": "Es. 50ml: €165 • 100ml: €230",
  "formato_ml": 100,
  "stagione_ideale": "Es. Autunno / Inverno",
  "occasione_ideale": "Es. Serata, Formale",
  "naso": "Nome del Maître Parfumeur",
  "voto_longevita": 8,
  "voto_scia": 8,
  "voto_proiezione": 8,
  "voto_complessita": 8,
  "url_foto_vetrina": ""
}`;

    const parts: GeminiPart[] = [{ text: systemPrompt }];

    if (imageBase64 && typeof imageBase64 === 'string') {
      parts.push({
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: imageBase64,
        },
      });
    }

    const { text, modelUsed } = await callGeminiWithFallback(parts, {
      temperature: 0.1,
      jsonMode: true,
      timeoutMs: 20000,
    });

    const parsed = extractJsonFromAiText<Record<string, any>>(text);

    const pureFamily = (PURE_FAMILIES as readonly string[]).includes(parsed.famiglia_olfattiva)
      ? parsed.famiglia_olfattiva
      : normalizeFamilyServer(parsed.famiglia_olfattiva);

    const normTesta = parsed.note_testa ? formatPerfumeNote(parsed.note_testa) : '';
    const normCuore = parsed.note_cuore ? formatPerfumeNote(parsed.note_cuore) : '';
    const normFondo = parsed.note_fondo ? formatPerfumeNote(parsed.note_fondo) : '';

    const unifiedNotes =
      [normTesta, normCuore, normFondo].filter(Boolean).join(', ') ||
      (parsed.note_olfattive ? formatPerfumeNote(parsed.note_olfattive) : '');

    const finalPayload = {
      nome: (dbVerifiedRecord?.name || parsed.nome || nome || searchTarget || 'Creazione').trim(),
      brand: (dbVerifiedRecord?.brand || parsed.brand || brand || 'Maison').trim(),
      concentrazione: (dbVerifiedRecord?.concentration || parsed.concentrazione || 'Eau de Parfum').trim(),
      anno_lancio: Number(dbVerifiedRecord?.release_year || parsed.anno_lancio) || 2021,
      famiglia_olfattiva: pureFamily,
      note_testa: normTesta,
      note_cuore: normCuore,
      note_fondo: normFondo,
      note_olfattive: unifiedNotes,
      descrizione_ai: (parsed.descrizione_ai || '').trim(),
      prezzo_stimato_euro: (parsed.prezzo_stimato_euro || '').trim(),
      formato_ml: Number(parsed.formato_ml) >= 30 ? Number(parsed.formato_ml) : 100,
      stagione_ideale: (parsed.stagione_ideale || 'Tutte le stagioni').trim(),
      occasione_ideale: (parsed.occasione_ideale || 'Versatile').trim(),
      naso: parsed.naso && String(parsed.naso).toLowerCase() !== 'non specificato' ? String(parsed.naso).trim() : null,
      voto_longevita: clampVote(parsed.voto_longevita, 8),
      voto_scia: clampVote(parsed.voto_scia, 8),
      voto_proiezione: clampVote(parsed.voto_proiezione, 8),
      voto_complessita: clampVote(parsed.voto_complessita, 8),
      url_foto_vetrina: parsed.url_foto_vetrina || null,
      _modelUsed: dbVerifiedRecord ? `soluzione_C_db+${modelUsed}` : `soluzione_A_live+${modelUsed}`,
    };

    // SOLUZIONE C (Auto-Apprendimento): Salva in cache su Supabase la scheda ricavata
    if (supabase && !imageBase64 && finalPayload.note_olfattive) {
      try {
        if (dbVerifiedRecord?.id) {
          await supabase
            .from('perfumes')
            .update({ cached_ai_data: finalPayload })
            .eq('id', dbVerifiedRecord.id);
        } else {
          await supabase.from('perfumes').insert([
            {
              name: finalPayload.nome,
              brand: finalPayload.brand,
              concentration: finalPayload.concentrazione,
              release_year: finalPayload.anno_lancio,
              cached_ai_data: finalPayload,
            },
          ]);
        }
      } catch {
        // Non blocca la risposta
      }
    }

    return NextResponse.json(finalPayload);
  } catch (error: any) {
    console.error('Extraction Error:', error);
    return NextResponse.json(
      { error: error?.message || "Errore durante l'estrazione dei dati." },
      { status: 500 }
    );
  }
}
