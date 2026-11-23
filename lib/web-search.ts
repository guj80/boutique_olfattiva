// lib/web-search.ts
// Client leggero server-side per Tavily REST API (ricerca web reale + estrazione testo da URL).
// Piano free: 1.000 crediti/mese, search_depth "basic" consuma 1 solo credito per chiamata.

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
}

export interface WebSearchResponse {
  results: WebSearchResult[];
  contextText: string;
}

export async function tavilySearch(
  query: string,
  opts?: {
    maxResults?: number;
    includeDomains?: string[];
    timeoutMs?: number;
  }
): Promise<WebSearchResponse | null> {
  const apiKey = (process.env.TAVILY_API_KEY || '').trim();
  if (!apiKey || !query.trim()) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 7000);

  try {
    const body: Record<string, unknown> = {
      query: query.trim(),
      search_depth: 'basic',
      max_results: opts?.maxResults ?? 5,
      include_answer: false,
      include_raw_content: false,
    };

    if (opts?.includeDomains && opts.includeDomains.length > 0) {
      body.include_domains = opts.includeDomains;
    }

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[AtelierLG:Tavily] Search HTTP ${res.status}`);
      return null;
    }

    const json = (await res.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };

    const results: WebSearchResult[] = (json.results || [])
      .filter((r) => Boolean(r?.url && r?.content))
      .map((r) => ({
        title: String(r.title || '').trim(),
        url: String(r.url || '').trim(),
        content: String(r.content || '').trim(),
      }));

    if (results.length === 0) return null;

    const contextText = results
      .map(
        (r, idx) =>
          `[FONTE ${idx + 1}] ${r.title}\nURL: ${r.url}\nCONTENUTO:\n${r.content}`
      )
      .join('\n\n---\n\n');

    return { results, contextText };
  } catch (err) {
    console.warn(
      `[AtelierLG:Tavily] Search error: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function tavilyExtract(
  url: string,
  timeoutMs = 8000
): Promise<string | null> {
  const apiKey = (process.env.TAVILY_API_KEY || '').trim();
  if (!apiKey || !url.trim()) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        urls: [url.trim()],
        extract_depth: 'basic',
        format: 'text',
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[AtelierLG:Tavily] Extract HTTP ${res.status}`);
      return null;
    }

    const json = (await res.json()) as {
      results?: Array<{ raw_content?: string; content?: string }>;
    };

    const text = (
      json.results?.[0]?.raw_content ||
      json.results?.[0]?.content ||
      ''
    ).trim();

    return text.length > 80 ? text.slice(0, 14000) : null;
  } catch (err) {
    console.warn(
      `[AtelierLG:Tavily] Extract error: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}
