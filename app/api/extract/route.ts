const KNOWN_OFFICIAL_DOMAINS: Record<string, string> = {
  'lorenzo pazzaglia': 'https://www.lorenzopazzaglia.com',
  'borntostandout': 'https://borntostandout.com',
  'nasomatto': 'https://www.nasomatto.com',
  'orto parisi': 'https://www.ortoparisi.com',
  'xerjoff': 'https://www.xerjoff.com',
  'casamorati': 'https://www.xerjoff.com',
  'ex nihilo': 'https://www.ex-nihilo-paris.com',
  'stephane humbert lucas': 'https://www.stephanehumbertlucas.com',
  'stephane humbert lucas 777': 'https://www.stephanehumbertlucas.com',
  'pekji': 'https://www.pekji.com',
  'rising phoenix perfumery': 'https://www.risingphoenixperfumery.com',
  'francesca bianchi': 'https://francescabianchiperfumes.com',
  'meo fusciuni': 'https://meofusciuni.com',
  'filippo sorcinelli': 'https://filipposorcinelli.com',
  'nishane': 'https://nishane.com',
  'amouage': 'https://www.amouage.com',
  'diptyque': 'https://www.diptyqueparis.com',
  'serge lutens': 'https://sergelutens.com',
  'byredo': 'https://www.byredo.com',
  'le labo': 'https://www.lelabofragrances.com',
  'maison francis kurkdjian': 'https://www.franciskurkdjian.com',
  'parfums de marly': 'https://parfums-de-marly.com',
  'initio': 'https://initioparfums.com',
  'initio parfums prives': 'https://initioparfums.com',
  'creed': 'https://www.creedfragrance.com',
  'frederic malle': 'https://www.fredericmalle.com',
  'profumum roma': 'https://www.profumum.com',
  'mendittorosa': 'https://mendittorosa.com',
  'masque milano': 'https://masquemilano.com',
  'zoologist': 'https://www.zoologistperfumes.com',
  'zoologist perfumes': 'https://www.zoologistperfumes.com',
  'l artisan parfumeur': 'https://www.artisanparfumeur.com',
  'penhaligon s': 'https://www.penhaligons.com',
  'acqua di parma': 'https://www.acquadiparma.com',
  'tom ford': 'https://www.tomfordbeauty.com',
  'guerlain': 'https://www.guerlain.com',
  'dior': 'https://www.dior.com',
  'chanel': 'https://www.chanel.com',
  'hermes': 'https://www.hermes.com',
};

const NON_OFFICIAL_HOSTS = [
  'fragrantica.', 'parfumo.', 'basenotes.', 'wikipedia.', 'youtube.', 'instagram.',
  'facebook.', 'tiktok.', 'reddit.', 'amazon.', 'ebay.', 'notino.', 'sephora.',
  'douglas.', 'pinalli.', '50-ml.', 'luckyscent.', 'jovoyparis.', 'ausliebezumduft.',
  'noseparis.', 'bloomperfume.', 'mazzolari.', 'profumix.', 'olfattorio.',
];

function getKnownOfficialDomain(brand?: string | null): string | null {
  const key = foldText(brand || '');
  if (!key) return null;
  if (KNOWN_OFFICIAL_DOMAINS[key]) return KNOWN_OFFICIAL_DOMAINS[key];
  for (const [k, url] of Object.entries(KNOWN_OFFICIAL_DOMAINS)) {
    if (key.includes(k) || k.includes(key)) return url;
  }
  return null;
}

function pickSourceUrlsFromResults(
  results: Array<{ url: string }>,
  brandHint: string
): { officialUrl: string | null; parfumoUrl: string | null; fragranticaUrl: string | null } {
  let officialUrl: string | null = null;
  let parfumoUrl: string | null = null;
  let fragranticaUrl: string | null = null;

  const brandSlug = foldText(brandHint).replace(/\s+/g, '');

  for (const r of results) {
    const u = r.url;
    const lower = u.toLowerCase();
    if (!parfumoUrl && lower.includes('parfumo.com/perfumes/')) {
      parfumoUrl = u;
      continue;
    }
    if (!fragranticaUrl && /fragrantica\.[a-z.]+\/perfume\//i.test(lower)) {
      fragranticaUrl = u;
      continue;
    }
    if (!officialUrl && !NON_OFFICIAL_HOSTS.some((h) => lower.includes(h))) {
      try {
        const hostClean = new URL(u).hostname.toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9]/g, '');
        if (brandSlug.length >= 3 && hostClean.includes(brandSlug.slice(0, 6))) {
          officialUrl = u;
        }
      } catch {}
    }
  }

  return { officialUrl, parfumoUrl, fragranticaUrl };
}
