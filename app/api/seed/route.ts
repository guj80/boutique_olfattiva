import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === ',' && !inQuotes) {
      result.push(current); current = '';
    } else { current += char; }
  }
  result.push(current);
  return result;
}

const cleanText = (val?: string) => (!val || val === 'NA' || val.trim() === '' ? null : val.trim());
const cleanInt = (val?: string) => (!val || val === 'NA' || isNaN(parseInt(val, 10)) ? null : parseInt(val, 10));
const cleanFloat = (val?: string) => (!val || val === 'NA' || isNaN(parseFloat(val)) ? null : parseFloat(val));

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const part = parseInt(url.searchParams.get('part') || '1', 10);

    // Usa ESATTAMENTE le variabili già presenti nel tuo screenshot di Vercel
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    if (part === 1) {
      const { count } = await supabase.from('perfumes').select('*', { count: 'exact', head: true });
      if (count && count > 55000) {
        return NextResponse.json({ status: 'GIÀ PIENO', profumi_presenti: count });
      }
    }

    const csvRes = await fetch('https://raw.githubusercontent.com/rfordatascience/tidytuesday/main/data/2024/2024-12-10/parfumo_data_clean.csv');
    const csvText = await csvRes.text();
    const lines = csvText.split(/\r?\n/);

    const chunkSize = 20000;
    const startLine = 1 + (part - 1) * chunkSize;
    const endLine = Math.min(startLine + chunkSize, lines.length);

    let batch: any[] = [];
    let inserted = 0;

    for (let i = startLine; i < endLine; i++) {
      const line = lines[i];
      if (!line || !line.trim()) continue;
      const cols = parseCSVLine(line);
      const name = cleanText(cols[1]);
      if (!name) continue;

      batch.push({
        number: cleanText(cols[0]),
        name,
        brand: cleanText(cols[2]),
        release_year: cleanInt(cols[3]),
        concentration: cleanText(cols[4]),
        rating_value: cleanFloat(cols[5]),
        rating_count: cleanInt(cols[6]),
        main_accords: cleanText(cols[7]),
        top_notes: cleanText(cols[8]),
        middle_notes: cleanText(cols[9]),
        base_notes: cleanText(cols[10]),
        perfumers: cleanText(cols[11]),
        url: cleanText(cols[12])
      });

      if (batch.length >= 1000) {
        const { error } = await supabase.from('perfumes').insert(batch);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        inserted += batch.length;
        batch = [];
      }
    }

    if (batch.length > 0) {
      const { error } = await supabase.from('perfumes').insert(batch);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      inserted += batch.length;
    }

    if (endLine < lines.length) {
      return NextResponse.json({
        status: `PARTE ${part} DI 3 COMPLETATA (${inserted} profumi caricati)`,
        PROSSIMO_PASSO: `Vai ora a: ${url.origin}/api/seed?part=${part + 1}`
      });
    }

    const { count: finalCount } = await supabase.from('perfumes').select('*', { count: 'exact', head: true });
    return NextResponse.json({ status: 'COMPLETATO AL 100%', totale_profumi_in_supabase: finalCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
