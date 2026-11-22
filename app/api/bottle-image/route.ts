import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

const MAX_BYTES = 7 * 1024 * 1024; // 7 MB

function isSafeHttpUrl(raw: string): URL | null {
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.endsWith('.local')
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth.error) return auth.error;

  let body: { url?: string };
  try {
    body = (await req.json()) as { url?: string };
  } catch {
    return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }

  const targetUrl = typeof body.url === 'string' ? isSafeHttpUrl(body.url) : null;
  if (!targetUrl) {
    return NextResponse.json({ error: 'URL immagine non valido.' }, { status: 400 });
  }

  try {
    const res = await fetch(targetUrl.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Il server remoto ha risposto con errore (${res.status}).` },
        { status: 422 }
      );
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Il link indicato non punta direttamente a un file immagine.' },
        { status: 422 }
      );
    }

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > MAX_BYTES) {
      return NextResponse.json(
        { error: 'Immagine vuota o superiore a 7 MB.' },
        { status: 422 }
      );
    }

    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = `data:${contentType.split(';')[0]};base64,${base64}`;

    return NextResponse.json({ dataUrl });
  } catch {
    return NextResponse.json(
      { error: 'Impossibile scaricare l’immagine dal sito remoto.' },
      { status: 502 }
    );
  }
}
