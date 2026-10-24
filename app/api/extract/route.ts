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

function isSafePublicUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function resolveImageUrl(candidate: string | null | undefined, pageUrl: string): string | null {
  if (!candidate) return null;
  const cleaned = candidate.replace(/&amp;/g, '&').replace(/^['"]|['"]$/g, '').trim();
  if (!cleaned || cleaned.startsWith('data:')) return null;
  try {
    if (cleaned.startsWith('//')) return `https:${cleaned}`;
    const resolved = new URL(cleaned, pageUrl);
    if (resolved.protocol === 'http:') resolved.protocol = 'https:';
    return resolved.toString();
  } catch {
    return cleaned.startsWith('http') ? cleaned : null;
  }
}

function extractProductImageFromHtml(html: string, pageUrl: string): string | null {
  const metaPatterns = [
    /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:secure_url["']/i,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const regex of metaPatterns) {
    const m = html.match(regex);
    if (m?.[1]) {
      const resolved = resolveImageUrl(m[1], pageUrl);
      if (resolved) return resolved;
    }
  }
  return null;
}

async function searchLivePerfumeData(query: string): Promise<{ webSnippet: string; foundImage: string | null }> {
  let webSnippet = '';
  let foundImage: string | null = null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const jinaSearchBase = ['https:', '', 's.jina.ai'].join('/');
    const searchUrl = `${jinaSearchBase}/${encodeURIComponent(
      `${query} perfume top middle base notes perfumer release year concentration parfumo fragrantica`
    )}`;
    const res = await fetch(searchUrl, {
      signal: controller.signal,
      headers: { Accept: 'text/plain', 'X-Retain-Images': 'none' },
    });
    clearTimeout(timer);

    if (res.ok) {
      const text = await res.text();
      webSnippet = text.slice(0, 5000);
      const urlMatch = text.match(
        /https?:\/\/(?:www\.)?(?:parfumo\.com|fragrantica\.[a-z.]+)\/[^\s)\]"']+/i
      );
      if (urlMatch?.[0] && isSafePublicUrl(urlMatch[0])) {
        const pageRes = await fetch(urlMatch[0], {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        });
        if (pageRes.ok) {
          const html = await pageRes.text();
          foundImage = extractProductImageFromHtml(html, urlMatch[0]);
        }
      }
    }
  } catch {
    // Fallback silenzioso
  }

  return { webSnippet, foundImage };
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
    let officialRenderImage: string | null = null;
    let contextSource = '';

    // Se viene passata una foto, la usiamo SOLO come input visivo per l'AI (Vision Recognition)
    if (imageBase64) {
      contextSource = "Analisi visiva del flacone tramite foto scattata/caricata per identificare con precisione la creazione olfattiva.";
    } else {
      // Ricerca su Supabase (Cache intelligente)
      if (supabase && searchTarget.length >= 2) {
        try {
          const cleanQuery = searchTarget.toLowerCase();
          let query = supabase.from('perfumes').select('*').limit(3);

          if (brand && nome) {
            query = query.ilike('brand', `%${brand}%`).ilike('name', `%${nome}%`);
          } else {
            query = query.or(`name.ilike.%${cleanQuery}%,brand.ilike.%${cleanQuery}%`);
          }

          const { data: matches } = await query;
          if (matches && matches.length > 0) {
            dbVerifiedRecord = matches[0];
            if (dbVerifiedRecord.cached_ai_data && dbVerifiedRecord.cached_ai_data.note_testa) {
              return NextResponse.json(dbVerifiedRecord.cached_ai_data);
            }
          }
        } catch {
          // Prosegue live
        }
      }

      // Ricerca live della scheda tecnica e del render ufficiale del flacone
      if (searchTarget) {
        const liveData = await searchLivePerfumeData(searchTarget);
        officialRenderImage = liveData.foundImage;
        const dbFacts = dbVerifiedRecord
          ? `DATI DATABASE: Nome="${dbVerifiedRecord.name}", Brand="${dbVerifiedRecord.brand}", Anno="${dbVerifiedRecord.release_year}".\n`
          : '';
        contextSource = `${dbFacts}${liveData.webSnippet ? `SCHEDA WEB LIVE:\n${liveData.webSnippet}` : ''}`;
      }
    }

    const systemPrompt = `Sei l'enciclopedia tecnica definitiva dell'alta profumeria artistica e di nicchia per esperti.
Compila la scheda tecnica professionale e rigorosa per il profumo identificato.

${contextSource}

REGOLE TASSATIVE (ZERO ALLUCINAZIONI):
1. Usa ESCLUSIVAMENTE note olfattive reali, naso creatore e anno di lancio ufficiali.
2. "famiglia_olfattiva": Scegli UNA SOLA PAROLA tra: "Agrumata", "Aromatica", "Marina", "Floreale", "Fruttata", "Verde", "Speziata", "Legnosa", "Ambrata", "Gourmand", "Cuoiata", "Muschiata".
3. Restituisci ESCLUSIVAMENTE un oggetto JSON valido con questa struttura esatta:
{
  "nome": "Nome esatto",
  "brand": "Maison",
  "concentrazione": "Eau de Parfum / Extrait de Parfum",
  "anno_lancio": 2021,
  "famiglia_olfattiva": "Famiglia pura",
  "note_testa": "Note di testa",
  "note_cuore": "Note di cuore",
  "note_fondo": "Note di fondo",
  "note_olfattive": "Elenco completo",
  "descrizione_ai": "Analisi tecnica professionale in 2 frasi",
  "prezzo_stimato_euro": "50ml: €165 • 100ml: €230",
  "formato_ml": 100,
  "stagione_ideale": "Stagione",
  "occasione_ideale": "Occasione",
  "naso": "Maître Parfumeur",
  "voto_longevita": 8,
  "voto_scia": 8,
  "voto_proiezione": 8,
  "voto_complessita": 8,
  "url_foto_vetrina": "${officialRenderImage || ''}"
}`;

    const parts: GeminiPart[] = [{ text: systemPrompt }];
    if (imageBase64 && typeof imageBase64 === 'string') {
      parts.push({
        inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 },
      });
    }

    const { text } = await callGeminiWithFallback(parts, {
      temperature: 0.1,
      jsonMode: true,
      timeoutMs: 22000,
    });

    const parsed = extractJsonFromAiText<Record<string, any>>(text);

    const pureFamily = (PURE_FAMILIES as readonly string[]).includes(parsed.famiglia_olfattiva)
      ? parsed.famiglia_olfattiva
      : normalizeFamilyServer(parsed.famiglia_olfattiva);

    const finalPayload = {
      nome: (dbVerifiedRecord?.name || parsed.nome || searchTarget || 'Creazione').trim(),
      brand: (dbVerifiedRecord?.brand || parsed.brand || brand || 'Maison').trim(),
      concentrazione: (dbVerifiedRecord?.concentration || parsed.concentrazione || 'Eau de Parfum').trim(),
      anno_lancio: Number(dbVerifiedRecord?.release_year || parsed.anno_lancio) || 2021,
      famiglia_olfattiva: pureFamily,
      note_testa: parsed.note_testa ? formatPerfumeNote(parsed.note_testa) : '',
      note_cuore: parsed.note_cuore ? formatPerfumeNote(parsed.note_cuore) : '',
      note_fondo: parsed.note_fondo ? formatPerfumeNote(parsed.note_fondo) : '',
      note_olfattive: parsed.note_olfattive ? formatPerfumeNote(parsed.note_olfattive) : '',
      descrizione_ai: (parsed.descrizione_ai || '').trim(),
      prezzo_stimato_euro: (parsed.prezzo_stimato_euro || '').trim(),
      formato_ml: Number(parsed.formato_ml) >= 30 ? Number(parsed.formato_ml) : 100,
      stagione_ideale: (parsed.stagione_ideale || 'Versatile').trim(),
      occasione_ideale: (parsed.occasione_ideale || 'Ogni occasione').trim(),
      naso: parsed.naso && String(parsed.naso).toLowerCase() !== 'non specificato' ? String(parsed.naso).trim() : null,
      voto_longevita: clampVote(parsed.voto_longevita, 8),
      voto_scia: clampVote(parsed.voto_scia, 8),
      voto_proiezione: clampVote(parsed.voto_proiezione, 8),
      voto_complessita: clampVote(parsed.voto_complessita, 8),
      url_foto_vetrina: officialRenderImage || parsed.url_foto_vetrina || null,
    };

    // Cache automatica su Supabase per le ricerche future
    if (supabase && !imageBase64 && finalPayload.note_olfattive) {
      try {
        if (dbVerifiedRecord?.id) {
          await supabase.from('perfumes').update({ cached_ai_data: finalPayload }).eq('id', dbVerifiedRecord.id);
        }
      } catch {
        // Silenzioso
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
