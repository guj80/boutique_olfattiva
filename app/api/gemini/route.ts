import { NextResponse } from 'next/server';
import { callGeminiWithFallback } from '@/lib/gemini-engine';

export const dynamic = 'force-dynamic';

/**
 * Rate limiter in-memory per IP per bloccare abusi sulla rotta legacy /api/gemini (B5 FIX).
 * Nota: in S2 e S3 i suggeritori passeranno alle rotte dedicate /api/ai/wear e /api/ai/scout
 * con prompt costruito esclusivamente lato server.
 */
const RATE_WINDOW_MS = 60 * 1000; // 1 minuto
const MAX_REQ_PER_WINDOW = 15;
const MAX_PROMPT_CHARS = 4000;

const ipBuckets = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'local';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  if (ipBuckets.size > 500) {
    ipBuckets.forEach((val, key) => {
      if (val.resetAt <= now) ipBuckets.delete(key);
    });
  }
  const entry = ipBuckets.get(ip);
  if (!entry || entry.resetAt <= now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_REQ_PER_WINDOW) {
    return false;
  }
  entry.count += 1;
  return true;
}

function isAuthorizedRequest(req: Request): boolean {
  // 1. Se è configurato INTERNAL_API_SECRET e viene fornito nell'header, autorizza
  const internalSecret = (process.env.INTERNAL_API_SECRET || '').trim();
  const headerSecret = (req.headers.get('x-internal-secret') || '').trim();
  if (internalSecret && headerSecret === internalSecret) {
    return true;
  }

  // 2. Richiede una chiamata browser same-origin (blocca curl/bot esterni privi di contesto same-origin)
  const secFetchSite = (req.headers.get('sec-fetch-site') || '').toLowerCase();
  if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'same-site') {
    return false;
  }

  const host = (req.headers.get('host') || '').toLowerCase();
  const origin = (req.headers.get('origin') || '').toLowerCase();
  const referer = (req.headers.get('referer') || '').toLowerCase();

  if (!host) return false;

  const originMatches = origin ? origin.includes(host) : false;
  const refererMatches = referer ? referer.includes(host) : false;

  return originMatches || refererMatches;
}

function sanitizeLegacyPrompt(raw: string): string {
  return raw
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, MAX_PROMPT_CHARS);
}

export async function POST(req: Request) {
  try {
    if (!isAuthorizedRequest(req)) {
      return NextResponse.json(
        { error: 'Accesso non autorizzato a questa risorsa API.' },
        { status: 403 }
      );
    }

    const ip = getClientIp(req);
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Troppe richieste ravvicinate. Riprova tra un minuto.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const rawPrompt = typeof body?.prompt === 'string' ? body.prompt : '';
    const prompt = sanitizeLegacyPrompt(rawPrompt);

    if (!prompt || prompt.length < 5) {
      return NextResponse.json({ error: 'Prompt mancante o non valido.' }, { status: 400 });
    }

    const result = await callGeminiWithFallback([{ text: prompt }], {
      temperature: 0.25,
      maxOutputTokens: 2048,
      timeoutMs: 6000,
      deadline: Date.now() + 15000,
    });

    return NextResponse.json({
      text: result.text,
      modelUsed: result.modelUsed,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Tutti i provider AI esterni sono temporaneamente occupati.' },
      { status: 503 }
    );
  }
}
