'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Sparkles,
  Search,
  ScanLine,
  SlidersHorizontal,
  Clock,
  Trash2,
  RefreshCw,
  Compass,
  ShieldCheck,
  X,
  LayoutGrid,
  List,
  FlaskConical,
  Globe,
  Droplets,
  Check,
  ArrowDownAZ,
  Tag,
  Filter,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  supabase,
  Profumo,
  isCollezioneProfumo,
  isRadarProfumo,
  getUnifiedNotes,
  parsePrezzoEuro,
} from '@/lib/supabase';

const PURE_FAMILIES = [
  'Agrumata',
  'Aromatica',
  'Marina',
  'Floreale',
  'Fruttata',
  'Verde',
  'Speziata',
  'Legnosa',
  'Ambrata',
  'Gourmand',
  'Cuoiata',
  'Muschiata',
] as const;

function normalizeToPureFamily(raw?: string | null): string {
  const s = (raw || '').toLowerCase().trim();
  if (!s) return 'Non classificata';
  for (const pure of PURE_FAMILIES) {
    if (s === pure.toLowerCase()) return pure;
  }
  if (s.includes('marin') || s.includes('acquat') || s.includes('ozon')) return 'Marina';
  if (s.includes('gourmand') || s.includes('vanigl') || s.includes('dolce')) return 'Gourmand';
  if (s.includes('cuoi') || s.includes('leather') || s.includes('tabacc')) return 'Cuoiata';
  if (s.includes('musch') || s.includes('pulit') || s.includes('talc') || s.includes('mineral')) return 'Muschiata';
  if (s.includes('speziat')) return 'Speziata';
  if (s.includes('verd') || s.includes('green')) return 'Verde';
  if (s.includes('fruttat')) return 'Fruttata';
  if (s.includes('agrum') || s.includes('esperid')) return 'Agrumata';
  if (s.includes('ambrat') || s.includes('oriental') || s.includes('incens') || s.includes('resin')) return 'Ambrata';
  if (s.includes('floreal') || s.includes('fiorit')) return 'Floreale';
  if (s.includes('aromatic') || s.includes('fouger') || s.includes('fougèr')) return 'Aromatica';
  if (s.includes('legnos') || s.includes('bois') || s.includes('chypre') || s.includes('oud')) return 'Legnosa';
  return 'Legnosa';
}

/**
 * 1. MOTORE DI PULIZIA E UNIFICAZIONE MARCHI (BRAND)
 * Elimina doppi spazi, spazi finali, refusi di maiuscole/accenti
 */
function normalizeBrandName(raw?: string | null): string {
  const cleaned = (raw || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'Maison';

  const low = cleaned
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const BRAND_ALIASES: Record<string, string> = {
    'bois 1920': 'Bois 1920',
    'byredo': 'Byredo',
    'chanel': 'Chanel',
    'creed': 'Creed',
    'clive christian': 'Clive Christian',
    'dolce & gabbana': 'Dolce & Gabbana',
    'dolce e gabbana': 'Dolce & Gabbana',
    'dolce&gabbana': 'Dolce & Gabbana',
    'd&g': 'Dolce & Gabbana',
    'ex nihilo': 'Ex Nihilo',
    'filippo sorcinelli': 'Filippo Sorcinelli',
    'frederic malle': 'Frédéric Malle',
    'editions de parfums frederic malle': 'Frédéric Malle',
    'giardini di toscana': 'Giardini di Toscana',
    'giorgio armani': 'Giorgio Armani',
    'armani': 'Giorgio Armani',
    'armani prive': 'Giorgio Armani',
    'francis kurkdjian': 'Maison Francis Kurkdjian',
    'maison francis kurkdjian': 'Maison Francis Kurkdjian',
    'mfk': 'Maison Francis Kurkdjian',
    'tom ford': 'Tom Ford',
    'amouage': 'Amouage',
    'xerjoff': 'Xerjoff',
    'parfums de marly': 'Parfums de Marly',
    'initio': 'Initio Parfums Privés',
    'initio parfums prives': 'Initio Parfums Privés',
    'orto parisi': 'Orto Parisi',
    'nasomatto': 'Nasomatto',
    'lorenzo pazzaglia': 'Lorenzo Pazzaglia',
    'montale': 'Montale',
    'mancera': 'Mancera',
    'diptyque': 'Diptyque',
    'le labo': 'Le Labo',
    'kilian': 'By Kilian',
    'by kilian': 'By Kilian',
    'louis vuitton': 'Louis Vuitton',
    'dior': 'Dior',
    'christian dior': 'Dior',
    'guerlain': 'Guerlain',
    'hermes': 'Hermès',
    'penhaligon\'s': 'Penhaligon\'s',
    'penhaligons': 'Penhaligon\'s',
    'nishane': 'Nishane',
    'bdK': 'BDK Parfums',
    'bdk': 'BDK Parfums',
    'bdk parfums': 'BDK Parfums',
    'stephane humbert lucas': 'Stéphane Humbert Lucas',
  };

  if (BRAND_ALIASES[low]) return BRAND_ALIASES[low];

  // Title Case intelligente per qualsiasi altro marchio
  return cleaned
    .split(' ')
    .map((word) => {
      const wLow = word.toLowerCase();
      if (['de', 'di', 'du', 'des', 'la', 'le', 'et', '&', 'of'].includes(wLow)) {
        return wLow;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ')
    .replace(/^([a-z])/, (m) => m.toUpperCase());
}

/**
 * 2. MOTORE DI RAZIONALIZZAZIONE NOTE OLFATTIVE (IT / EN & SINONIMI)
 * Unifica es: "Musk", "White Musk", "Muschio Bianco" -> "Muschio"
 * "Sandalwood", "Legno di Sandalo" -> "Sandalo", ecc.
 */
function canonicalizeNote(rawNote: string): string | null {
  let s = rawNote
    .toLowerCase()
    .replace(/^(note di|nota di|accordo di|assoluta di|olio di|essenza di|estratto di|legno di|fiori di|fiore di|foglie di|foglia di|bacche di)\s+/i, '')
    .replace(/[().]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!s || s.length < 2 || s === '-' || s === 'n/a') return null;

  // Dizionario di unificazione bilingue (Inglese/Italiano e Varianti Regionali)
  if (s.includes('musk') || s.includes('muschi') || s.includes('musc')) return 'Muschio';
  if (s.includes('sandal') || s.includes('sandalo')) return 'Sandalo';
  if (s.includes('bergamot')) return 'Bergamotto';
  if (s.includes('cedar') || s.includes('cedro') || s.includes('cedre')) {
    if (s.includes('agrum') || s.includes('citron')) return 'Cedro (Agrume)';
    return 'Legno di Cedro';
  }
  if (s.includes('ambergris') || s.includes('ambra grigia') || s.includes('ambroxan') || s.includes('ambrox') || s.includes('cetalox')) return 'Ambra Grigia';
  if (s.includes('amber') || s === 'ambra' || s.includes('ambrat') || s.includes('ambra nera')) return 'Ambra';
  if (s.includes('patchoul')) return 'Patchouli';
  if (s.includes('vetiver') || s.includes('vetyver')) return 'Vetiver';
  if (s.includes('oud') || s.includes('agarwood') || s.includes('aquilaria')) return 'Oud';
  if (s.includes('vanill') || s.includes('vanigl')) return 'Vaniglia';
  if (s.includes('tonka')) return 'Fava Tonka';
  if (s.includes('frankincense') || s.includes('oliban') || s.includes('incens')) return 'Incenso / Olibano';
  if (s.includes('leather') || s.includes('cuoio') || s.includes('pelle') || s.includes('suede') || s.includes('scamosciat')) return 'Cuoio';
  if (s.includes('rose') || s === 'rosa' || s.includes('rosa ') || s.includes('damascena') || s.includes('taif')) return 'Rosa';
  if (s.includes('jasmin') || s.includes('gelsomin')) return 'Gelsomino';
  if (s.includes('lavender') || s.includes('lavand')) return 'Lavanda';
  if (s.includes('iris') || s.includes('orris') || s.includes('giaggiolo')) return 'Iris';
  if (s.includes('violet') || s.includes('violett')) return 'Violetta';
  if (s.includes('orange blossom') || s.includes('arancio') && s.includes('fior')) return 'Fiori d\'Arancio';
  if (s.includes('neroli')) return 'Neroli';
  if (s.includes('petitgrain')) return 'Petitgrain';
  if (s.includes('lemon') || s.includes('limon')) return 'Limone';
  if (s.includes('mandarin') || s.includes('tangerin')) return 'Mandarino';
  if (s.includes('grapefruit') || s.includes('pompelm')) return 'Pompelmo';
  if (s.includes('orange') || s.includes('arancia')) return 'Arancia';
  if (s.includes('lime') || s.includes('limetta')) return 'Lime';
  if (s.includes('cardamom')) return 'Cardamomo';
  if (s.includes('saffron') || s.includes('zafferan')) return 'Zafferano';
  if (s.includes('cinnamon') || s.includes('cannell')) return 'Cannella';
  if (s.includes('pink pepper') || s.includes('pepe rosa')) return 'Pepe Rosa';
  if (s.includes('black pepper') || s.includes('pepe nero') || s === 'pepe' || s === 'pepper') return 'Pepe';
  if (s.includes('ginger') || s.includes('zenzer')) return 'Zenzero';
  if (s.includes('nutmeg') || s.includes('noce moscata')) return 'Noce Moscata';
  if (s.includes('clove') || s.includes('garofano')) return 'Chiodi di Garofano';
  if (s.includes('tobacco') || s.includes('tabacc')) return 'Tabacco';
  if (s.includes('coffee') || s.includes('caff')) return 'Caffè';
  if (s.includes('cacao') || s.includes('cocoa') || s.includes('cioccolat') || s.includes('chocolate')) return 'Cacao';
  if (s.includes('caramel')) return 'Caramello';
  if (s.includes('honey') || s.includes('miele')) return 'Miele';
  if (s.includes('almond') || s.includes('mandorl')) return 'Mandorla';
  if (s.includes('coconut') || s.includes('cocco')) return 'Cocco';
  if (s.includes('fig') || s === 'fico' || s.includes('fico ')) return 'Fico';
  if (s.includes('mango')) return 'Mango';
  if (s.includes('pineapple') || s.includes('ananas')) return 'Ananas';
  if (s.includes('peach') || s.includes('pesca')) return 'Pesca';
  if (s.includes('apple') || s === 'mela' || s.includes('mela ')) return 'Mela';
  if (s.includes('plum') || s.includes('prugna') || s.includes('susina')) return 'Prugna';
  if (s.includes('cherry') || s.includes('ciliegi') || s.includes('amarena')) return 'Ciliegia';
  if (s.includes('raspberry') || s.includes('lampon')) return 'Lampone';
  if (s.includes('blackcurrant') || s.includes('ribes') || s.includes('cassis')) return 'Ribes Nero';
  if (s.includes('sea ') || s.includes('marine') || s.includes('marino') || s.includes('marine') || s.includes('acquat') || s.includes('sale') || s.includes('salt') || s.includes('alghe')) return 'Note Marine';
  if (s.includes('tea') || s === 'te' || s === 'tè' || s.includes('tè ') || s.includes('matcha')) return 'Tè';
  if (s.includes('mint') || s.includes('menta')) return 'Menta';
  if (s.includes('sage') || s.includes('salvia')) return 'Salvia';
  if (s.includes('rosemary') || s.includes('rosmarin')) return 'Rosmarino';
  if (s.includes('juniper') || s.includes('ginepr')) return 'Ginepro';
  if (s.includes('cypress') || s.includes('cipress')) return 'Cipresso';
  if (s.includes('pine') || s === 'pino') return 'Pino';
  if (s.includes('oakmoss') || s.includes('quercia')) return 'Muschio di Quercia';
  if (s.includes('benzoin') || s.includes('benzoin')) return 'Benzoino';
  if (s.includes('labdan') || s.includes('ladano')) return 'Labdano';
  if (s.includes('myrrh') || s.includes('mirra')) return 'Mirra';
  if (s.includes('guaiac') || s.includes('gaiac')) return 'Legno di Guaiaco';
  if (s.includes('cashmeran') || s.includes('cashmere')) return 'Cashmeran';
  if (s.includes('iso e super')) return 'Iso E Super';
  if (s.includes('aldehyd') || s.includes('aldeid')) return 'Aldeidi';
  if (s.includes('rum') || s.includes('rhum')) return 'Rum';
  if (s.includes('cognac') || s.includes('whisky') || s.includes('boozy') || s.includes('davana')) return 'Note Liquore / Boozy';
  if (s.includes('tuberosa') || s.includes('tuberose')) return 'Tuberosa';
  if (s.includes('ylang')) return 'Ylang-Ylang';
  if (s.includes('gerani')) return 'Geranio';
  if (s.includes('peon')) return 'Peonia';
  if (s.includes('magnolia')) return 'Magnolia';
  if (s.includes('osmanth') || s.includes('osmant')) return 'Osmanto';
  if (s.includes('heliotrop') || s.includes('eliotrop')) return 'Eliotropio';
  if (s.includes('rhubarb') || s.includes('rabarbar')) return 'Rabarbaro';

  // Capitalizzazione pulita per qualsiasi altra nota specifica
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Estrae l'elenco unico di note razionalizzate di un profumo (Testa + Cuore + Fondo + Generali)
 */
function extractCanonicalNotesForPerfume(p: Profumo): string[] {
  const rawChunks = [
    p.note_testa,
    p.note_cuore,
    p.note_fondo,
    p.note_olfattive,
  ]
    .filter(Boolean)
    .join(',');

  if (!rawChunks.trim()) return [];

  const parts = rawChunks.split(/[,;/•|\n]+/);
  const set = new Set<string>();
  for (const part of parts) {
    const canon = canonicalizeNote(part);
    if (canon) set.add(canon);
  }
  return Array.from(set);
}

/**
 * COMPONENTE CORAZZATO ANTI-CORS & ANTI-HOTLINK (3 LIVELLI)
 */
function SmartBottleImage({
  src,
  alt,
  className,
  iconSize = 'w-10 h-10',
}: {
  src?: string | null;
  alt: string;
  className?: string;
  iconSize?: string;
}) {
  const cleanSrc = (src || '').trim();
  const [stage, setStage] = useState<'direct' | 'proxy' | 'failed'>('direct');

  useEffect(() => {
    setStage('direct');
  }, [cleanSrc]);

  if (!cleanSrc || stage === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center text-zinc-600 group-hover:text-[#C5A059] transition duration-300">
        <FlaskConical className={`${iconSize} stroke-[1.2]`} />
      </div>
    );
  }

  const finalSrc =
    stage === 'direct'
      ? cleanSrc
      : `https://wsrv.nl/?url=${encodeURIComponent(cleanSrc)}&output=webp`;

  return (
    <img
      src={finalSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => {
        if (stage === 'direct') {
          setStage('proxy');
        } else {
          setStage('failed');
        }
      }}
    />
  );
}

function CollezioneContent() {
  const searchParams = useSearchParams();
  const initialVista = searchParams.get('vista') === 'radar' ? 'radar' : 'collezione';
  const initialSearch = searchParams.get('search') || '';

  const [profumi, setProfumi] = useState<Profumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<'collezione' | 'radar'>(initialVista);
  const [layoutMode, setLayoutMode] = useState<'dettagli' | 'vetrina'>('dettagli');

  // NUOVI STATI FILTRI MULTILIVELLO & ORDINAMENTO
  const [selectedBrand, setSelectedBrand] = useState<string>('Tutti');
  const [selectedFamily, setSelectedFamily] = useState<string>('Tutte');
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [noteFilterSearch, setNoteFilterSearch] = useState('');
  const [sortBy, setSortBy] = useState<'nome_asc' | 'nome_desc' | 'brand_asc'>('nome_asc');

  const [normalizingDb, setNormalizingDb] = useState(false);

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [aiRecommendedIds, setAiRecommendedIds] = useState<string[] | null>(null);
  const [aiMotivazioni, setAiMotivazioni] = useState<Record<string, string>>({});

  const [enrichingId, setEnrichingId] = useState<string | null>(null);

  const [selectedProfumo, setSelectedProfumo] = useState<Profumo | null>(null);
  const [officialUrlInput, setOfficialUrlInput] = useState('');
  const [modalExtracting, setModalExtracting] = useState(false);
  const [savingDetail, setSavingDetail] = useState(false);

  const [wearProfumo, setWearProfumo] = useState<Profumo | null>(null);
  const [momentoGiornata, setMomentoGiornata] = useState<'Mattina' | 'Pomeriggio' | 'Sera' | 'Notte'>('Mattina');
  const [contestoOutfit, setContestoOutfit] = useState('Ufficio');
  const [noteGiorno, setNoteGiorno] = useState('');
  const [savingWear, setSavingWear] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Profumo | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  useEffect(() => {
    const savedLayout = localStorage.getItem('boutique_layout_mode');
    if (savedLayout === 'vetrina' || savedLayout === 'dettagli') {
      setLayoutMode(savedLayout);
    }
  }, []);

  function changeLayoutMode(mode: 'dettagli' | 'vetrina') {
    setLayoutMode(mode);
    localStorage.setItem('boutique_layout_mode', mode);
  }

  useEffect(() => {
    const v = searchParams.get('vista');
    if (v === 'radar') setVista('radar');
    else if (v === 'collezione') setVista('collezione');
  }, [searchParams]);

  useEffect(() => {
    fetchProfumi();
  }, []);

  async function fetchProfumi() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profumi')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      setProfumi((data || []) as Profumo[]);
    } catch (err) {
      console.error('Errore caricamento collezione:', err);
    } finally {
      setLoading(false);
    }
  }

  const collezioneList = useMemo(() => profumi.filter(isCollezioneProfumo), [profumi]);
  const radarList = useMemo(() => profumi.filter(isRadarProfumo), [profumi]);
  const activeList = vista === 'collezione' ? collezioneList : radarList;

  // STATISTICHE GLOBALI: MARCHI PULITI, FAMIGLIE OLFATTIVE E NOTE RAZIONALIZZATE
  const archiveStats = useMemo(() => {
    const familyCounts: Record<string, number> = {};
    const brandSet = new Set<string>();
    const noteCounts: Record<string, number> = {};
    let totalEuro = 0;
    let needsCleanup = false;

    activeList.forEach((p) => {
      // 1. Controllo e pulizia Marchio
      const rawBrand = p.brand || '';
      const cleanBrand = normalizeBrandName(rawBrand);
      brandSet.add(cleanBrand);
      if (rawBrand !== cleanBrand) {
        needsCleanup = true;
      }

      // 2. Controllo e conteggio Famiglia Olfattiva
      const rawFam = (p.famiglia_olfattiva || '').trim();
      const pure = normalizeToPureFamily(rawFam);
      if (rawFam && !(PURE_FAMILIES as readonly string[]).includes(rawFam)) {
        needsCleanup = true;
      }
      familyCounts[pure] = (familyCounts[pure] || 0) + 1;

      // 3. Estrazione e conteggio Note Razionalizzate
      const cNotes = extractCanonicalNotesForPerfume(p);
      cNotes.forEach((n) => {
        noteCounts[n] = (noteCounts[n] || 0) + 1;
      });

      // 4. Calcolo valore
      const val = parsePrezzoEuro(p);
      if (val > 0) totalEuro += val;
    });

    const sortedBrands = Array.from(brandSet).sort((a, b) =>
      a.localeCompare(b, 'it', { sensitivity: 'base' })
    );

    const sortedPureFamilies = Object.entries(familyCounts).sort((a, b) => b[1] - a[1]);

    const sortedNotes = Object.entries(noteCounts).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0], 'it');
    });

    return {
      totalEuro: Math.round(totalEuro),
      sortedBrands,
      sortedPureFamilies,
      sortedNotes,
      needsCleanup,
    };
  }, [activeList]);

  async function handleNormalizeAllDatabase() {
    setNormalizingDb(true);
    try {
      const updates = profumi.map(async (p) => {
        const pureFam = normalizeToPureFamily(p.famiglia_olfattiva);
        const cleanBrand = normalizeBrandName(p.brand);
        const cleanNome = (p.nome || '').replace(/\s+/g, ' ').trim();

        if (
          p.famiglia_olfattiva !== pureFam ||
          p.brand !== cleanBrand ||
          p.nome !== cleanNome
        ) {
          await supabase
            .from('profumi')
            .update({
              famiglia_olfattiva: pureFam,
              brand: cleanBrand,
              nome: cleanNome,
            })
            .eq('id', p.id);
        }
        return {
          ...p,
          famiglia_olfattiva: pureFam,
          brand: cleanBrand,
          nome: cleanNome,
        };
      });

      const updatedList = await Promise.all(updates);
      setProfumi(updatedList);
      setStatusBanner('Database allineato: Marchi, Nomi e 12 Famiglie Olfattive ripuliti.');
      setTimeout(() => setStatusBanner(null), 3500);
    } catch (err: any) {
      alert(err?.message || 'Errore normalizzazione database.');
    } finally {
      setNormalizingDb(false);
    }
  }

  function toggleNoteSelection(note: string) {
    setSelectedNotes((prev) =>
      prev.includes(note) ? prev.filter((n) => n !== note) : [...prev, note]
    );
  }

  function resetAllFilters() {
    setSelectedBrand('Tutti');
    setSelectedFamily('Tutte');
    setSelectedNotes([]);
    setSearchQuery('');
    resetAiFilter();
  }

  // FILTRAGGIO MULTILIVELLO + ORDINAMENTO ALFABETICO PER NOME PROFUMO
  const filteredList = useMemo(() => {
    let base = [...activeList];

    // 1. Filtro per Marchio (1° Livello)
    if (selectedBrand !== 'Tutti') {
      base = base.filter((p) => normalizeBrandName(p.brand) === selectedBrand);
    }

    // 2. Filtro per Famiglia Olfattiva (2° Livello)
    if (selectedFamily !== 'Tutte') {
      base = base.filter(
        (p) => normalizeToPureFamily(p.famiglia_olfattiva) === selectedFamily
      );
    }

    // 3. Filtro per Note Olfattive Multi-Selezione (Testa + Cuore + Fondo)
    if (selectedNotes.length > 0) {
      base = base.filter((p) => {
        const pNotes = extractCanonicalNotesForPerfume(p);
        return selectedNotes.every((selNote) => pNotes.includes(selNote));
      });
    }

    // 4. Filtro IA se attivo
    if (aiRecommendedIds && aiRecommendedIds.length > 0) {
      const map = new Map(base.map((p) => [p.id, p]));
      const ordered = aiRecommendedIds.map((id) => map.get(id)).filter(Boolean) as Profumo[];
      if (ordered.length > 0) return ordered;
    }

    // 5. Ricerca testuale libera
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      base = base.filter((p) => {
        const pureFam = normalizeToPureFamily(p.famiglia_olfattiva);
        const cleanBrand = normalizeBrandName(p.brand);
        const canonNotes = extractCanonicalNotesForPerfume(p).join(' ');
        const haystack = [
          p.nome,
          cleanBrand,
          p.brand,
          pureFam,
          p.famiglia_olfattiva,
          canonNotes,
          p.note_testa,
          p.note_cuore,
          p.note_fondo,
          p.note_olfattive,
          p.stagione_ideale,
          p.occasione_ideale,
          p.note_mouche,
          p.note_pelle,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    // 6. Ordinamento Alfabetico (Default: per Nome Profumo A -> Z, non per Marchio)
    base.sort((a, b) => {
      const nomeA = (a.nome || '').trim();
      const nomeB = (b.nome || '').trim();
      const brandA = normalizeBrandName(a.brand);
      const brandB = normalizeBrandName(b.brand);

      if (sortBy === 'nome_asc') {
        return nomeA.localeCompare(nomeB, 'it', { sensitivity: 'base' });
      }
      if (sortBy === 'nome_desc') {
        return nomeB.localeCompare(nomeA, 'it', { sensitivity: 'base' });
      }
      // brand_asc
      const cmpBrand = brandA.localeCompare(brandB, 'it', { sensitivity: 'base' });
      if (cmpBrand !== 0) return cmpBrand;
      return nomeA.localeCompare(nomeB, 'it', { sensitivity: 'base' });
    });

    return base;
  }, [
    activeList,
    selectedBrand,
    selectedFamily,
    selectedNotes,
    searchQuery,
    aiRecommendedIds,
    sortBy,
  ]);

  async function handleAskSommelier() {
    if (!searchQuery.trim()) return;
    setAiLoading(true);
    setAiAdvice(null);
    setAiRecommendedIds(null);
    setAiMotivazioni({});

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          profumi: activeList,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore ricerca IA');

      setAiAdvice(data.sommelierAdvice || null);
      setAiRecommendedIds(data.recommendedIds || []);
      setAiMotivazioni(data.motivazioniPerProfumo || {});
    } catch (err: any) {
      alert(err?.message || 'Errore durante la consultazione IA.');
    } finally {
      setAiLoading(false);
    }
  }

  function resetAiFilter() {
    setAiAdvice(null);
    setAiRecommendedIds(null);
    setAiMotivazioni({});
  }

  async function handleEnrichWithAI(p: Profumo) {
    setEnrichingId(p.id);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: p.brand, nome: p.nome }),
      });
      const aiData = await res.json();
      if (!res.ok) throw new Error(aiData.error || 'Errore verifica IA');

      const pureFam = normalizeToPureFamily(aiData.famiglia_olfattiva || p.famiglia_olfattiva);
      const cleanBrand = normalizeBrandName(aiData.brand || p.brand);

      const updatePayload: Partial<Profumo> = {
        nome: (aiData.nome || p.nome || '').replace(/\s+/g, ' ').trim(),
        brand: cleanBrand,
        concentrazione: aiData.concentrazione || p.concentrazione,
        famiglia_olfattiva: pureFam,
        note_testa: aiData.note_testa || p.note_testa,
        note_cuore: aiData.note_cuore || p.note_cuore,
        note_fondo: aiData.note_fondo || p.note_fondo,
        note_olfattive: aiData.note_olfattive || p.note_olfattive,
        descrizione_ai: aiData.descrizione_ai || p.descrizione_ai,
        prezzo_stimato_euro: aiData.prezzo_stimato_euro || p.prezzo_stimato_euro,
        stagione_ideale: aiData.stagione_ideale || p.stagione_ideale,
        occasione_ideale: aiData.occasione_ideale || p.occasione_ideale,
        url_foto_vetrina: p.url_foto_vetrina || aiData.url_foto_vetrina || null,
        voto_longevita: p.voto_longevita ?? aiData.voto_longevita,
        voto_scia: p.voto_scia ?? aiData.voto_scia,
        voto_proiezione: p.voto_proiezione ?? aiData.voto_proiezione,
        voto_complessita: p.voto_complessita ?? aiData.voto_complessita,
      };

      const { error } = await supabase
        .from('profumi')
        .update(updatePayload)
        .eq('id', p.id);

      if (error) {
        await supabase
          .from('profumi')
          .update({
            nome: updatePayload.nome,
            brand: cleanBrand,
            famiglia_olfattiva: pureFam,
            note_olfattive: updatePayload.note_olfattive,
          })
          .eq('id', p.id);
      }

      setProfumi((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, ...updatePayload } : item))
      );
      setStatusBanner(`Aggiornato: ${updatePayload.brand} - ${updatePayload.nome}`);
      setTimeout(() => setStatusBanner(null), 3500);
    } catch (err: any) {
      alert(err?.message || 'Errore verifica IA.');
    } finally {
      setEnrichingId(null);
    }
  }

  async function handleModalExtractFromOfficial() {
    if (!selectedProfumo) return;
    setModalExtracting(true);
    try {
      const payload = officialUrlInput.trim().startsWith('http')
        ? { url: officialUrlInput.trim() }
        : { brand: selectedProfumo.brand, nome: selectedProfumo.nome };

      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const aiData = await res.json();
      if (!res.ok) throw new Error(aiData.error || 'Errore estrazione dati');

      const pureFam = normalizeToPureFamily(
        aiData.famiglia_olfattiva || selectedProfumo.famiglia_olfattiva
      );

      setSelectedProfumo({
        ...selectedProfumo,
        nome: (aiData.nome || selectedProfumo.nome || '').replace(/\s+/g, ' ').trim(),
        brand: normalizeBrandName(aiData.brand || selectedProfumo.brand),
        concentrazione: aiData.concentrazione || selectedProfumo.concentrazione,
        famiglia_olfattiva: pureFam,
        note_testa: aiData.note_testa || selectedProfumo.note_testa,
        note_cuore: aiData.note_cuore || selectedProfumo.note_cuore,
        note_fondo: aiData.note_fondo || selectedProfumo.note_fondo,
        note_olfattive: aiData.note_olfattive || selectedProfumo.note_olfattive,
        descrizione_ai: aiData.descrizione_ai || selectedProfumo.descrizione_ai,
        prezzo_stimato_euro: aiData.prezzo_stimato_euro || selectedProfumo.prezzo_stimato_euro,
        stagione_ideale: aiData.stagione_ideale || selectedProfumo.stagione_ideale,
        occasione_ideale: aiData.occasione_ideale || selectedProfumo.occasione_ideale,
        url_foto_vetrina: aiData.url_foto_vetrina || selectedProfumo.url_foto_vetrina,
        voto_longevita: aiData.voto_longevita ?? selectedProfumo.voto_longevita,
        voto_scia: aiData.voto_scia ?? selectedProfumo.voto_scia,
        voto_proiezione: aiData.voto_proiezione ?? selectedProfumo.voto_proiezione,
        voto_complessita: aiData.voto_complessita ?? selectedProfumo.voto_complessita,
      });
      setOfficialUrlInput('');
    } catch (err: any) {
      alert(err?.message || 'Impossibile estrarre i dati.');
    } finally {
      setModalExtracting(false);
    }
  }

  async function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProfumo) return;
    setSavingDetail(true);

    try {
      const pureFam = normalizeToPureFamily(selectedProfumo.famiglia_olfattiva);
      const cleanBrand = normalizeBrandName(selectedProfumo.brand);
      const cleanNome = (selectedProfumo.nome || '').replace(/\s+/g, ' ').trim();
      const cleanImg = selectedProfumo.url_foto_vetrina?.trim() || null;

      const payload = {
        nome: cleanNome,
        brand: cleanBrand,
        concentrazione: selectedProfumo.concentrazione,
        famiglia_olfattiva: pureFam,
        note_testa: selectedProfumo.note_testa,
        note_cuore: selectedProfumo.note_cuore,
        note_fondo: selectedProfumo.note_fondo,
        note_olfattive:
          selectedProfumo.note_olfattive || getUnifiedNotes(selectedProfumo),
        descrizione_ai: selectedProfumo.descrizione_ai,
        prezzo_stimato_euro: selectedProfumo.prezzo_stimato_euro,
        url_foto_vetrina: cleanImg,
        stato: selectedProfumo.stato || 'collezione',
        note_mouche: selectedProfumo.note_mouche,
        note_pelle: selectedProfumo.note_pelle,
        voto_longevita: selectedProfumo.voto_longevita,
        voto_scia: selectedProfumo.voto_scia,
        voto_proiezione: selectedProfumo.voto_proiezione,
        voto_complessita: selectedProfumo.voto_complessita,
        stagione_ideale: selectedProfumo.stagione_ideale,
        occasione_ideale: selectedProfumo.occasione_ideale,
      };

      const { error } = await supabase
        .from('profumi')
        .update(payload)
        .eq('id', selectedProfumo.id);

      if (error) throw error;

      setProfumi((prev) =>
        prev.map((item) =>
          item.id === selectedProfumo.id ? { ...item, ...payload } : item
        )
      );
      setSelectedProfumo(null);
      setStatusBanner(`Salvato: ${payload.brand} - ${payload.nome}`);
      setTimeout(() => setStatusBanner(null), 3000);
    } catch (err: any) {
      alert(`Errore salvataggio: ${err?.message}`);
    } finally {
      setSavingDetail(false);
    }
  }

  async function handlePromoteToCollection(p: Profumo) {
    try {
      const { error } = await supabase
        .from('profumi')
        .update({ stato: 'collezione' })
        .eq('id', p.id);

      if (error) throw error;

      setProfumi((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, stato: 'collezione' } : item))
      );
      setSelectedProfumo(null);
      setVista('collezione');
      setStatusBanner(`${p.nome} spostato in Collezione.`);
      setTimeout(() => setStatusBanner(null), 3500);
    } catch (err: any) {
      alert(err?.message || 'Errore spostamento.');
    }
  }

  async function handleRecordWear(e: React.FormEvent) {
    e.preventDefault();
    if (!wearProfumo) return;
    setSavingWear(true);

    try {
      const { error } = await supabase.from('indossi').insert([
        {
          profumo_id: wearProfumo.id,
          momento_giornata: momentoGiornata,
          contesto_outfit: contestoOutfit || null,
          note_giorno: noteGiorno || null,
        },
      ]);

      if (error) throw error;

      setStatusBanner(`Indosso registrato: ${wearProfumo.nome}`);
      setWearProfumo(null);
      setNoteGiorno('');
      setTimeout(() => setStatusBanner(null), 3000);
    } catch (err: any) {
      alert(`Errore registrazione: ${err?.message}`);
    } finally {
      setSavingWear(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from('profumi')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      setProfumi((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      if (selectedProfumo?.id === deleteTarget.id) {
        setSelectedProfumo(null);
      }
      setDeleteTarget(null);
      setStatusBanner(`Eliminato con successo.`);
      setTimeout(() => setStatusBanner(null), 3000);
    } catch (err: any) {
      alert(err?.message || 'Errore eliminazione.');
    }
  }

  const displayedNotes = useMemo(() => {
    const list = archiveStats.sortedNotes;
    if (noteFilterSearch.trim()) {
      const q = noteFilterSearch.toLowerCase().trim();
      return list.filter(([noteName]) => noteName.toLowerCase().includes(q));
    }
    return showAllNotes ? list : list.slice(0, 16);
  }, [archiveStats.sortedNotes, showAllNotes, noteFilterSearch]);

  const hasActiveFilters =
    selectedBrand !== 'Tutti' ||
    selectedFamily !== 'Tutte' ||
    selectedNotes.length > 0 ||
    Boolean(searchQuery.trim());

  return (
    <main className="min-h-screen px-4 sm:px-8 lg:px-12 py-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-[#F7E7CE]/15 animate-fade-in">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2.5 rounded-xl boutique-glass text-[#F7E7CE] hover:border-[#F7E7CE]/40 hover:scale-105 active:scale-95 transition-all duration-200"
            title="Home"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#C5A059]">
              Private Olfactory
            </p>
            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="font-serif text-2xl sm:text-3xl text-white">
                {vista === 'collezione'
                  ? `Collezione Privata (${collezioneList.length})`
                  : `Radar - Testing (${radarList.length})`}
              </h1>
              {vista === 'collezione' && archiveStats.totalEuro > 0 && (
                <span className="font-mono text-xs text-[#C5A059]">
                  Valore stimato: €{archiveStats.totalEuro.toLocaleString('it-IT')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex p-1 rounded-xl bg-[#0D0D11] border border-white/10">
            <button
              type="button"
              onClick={() => changeLayoutMode('dettagli')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all duration-200 ${
                layoutMode === 'dettagli'
                  ? 'bg-gradient-to-r from-[#FF2A95]/20 to-[#7B2CBF]/20 text-[#FF4DA6] border border-[#FF2A95]/30 font-medium'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Dettagli</span>
            </button>
            <button
              type="button"
              onClick={() => changeLayoutMode('vetrina')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all duration-200 ${
                layoutMode === 'vetrina'
                  ? 'bg-gradient-to-r from-[#FF2A95]/20 to-[#7B2CBF]/20 text-[#FF4DA6] border border-[#FF2A95]/30 font-medium'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Vetrina</span>
            </button>
          </div>

          <div className="inline-flex p-1 rounded-xl bg-[#0D0D11] border border-white/10">
            <button
              type="button"
              onClick={() => {
                setVista('collezione');
                resetAllFilters();
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all duration-200 ${
                vista === 'collezione'
                  ? 'bg-gradient-to-r from-[#FF2A95] via-[#7B2CBF] to-[#1FE866] text-white font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Collezione ({collezioneList.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setVista('radar');
                resetAllFilters();
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all duration-200 ${
                vista === 'radar'
                  ? 'bg-gradient-to-r from-[#FF2A95] via-[#7B2CBF] to-[#1FE866] text-white font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Testing ({radarList.length})</span>
            </button>
          </div>

          <Link
            href="/scanner"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF2A95] via-[#7B2CBF] to-[#1FE866] text-white font-semibold text-xs font-mono uppercase tracking-wider shadow-champagne-glow hover:scale-[1.03] active:scale-[0.97] transition-all duration-200"
          >
            <ScanLine className="w-3.5 h-3.5" />
            <span>+ Aggiungi</span>
          </Link>
        </div>
      </div>

      {statusBanner && (
        <div className="mt-5 p-3 rounded-xl bg-[#C5A059]/20 border border-[#F7E7CE]/40 text-[#F7E7CE] flex items-center justify-between text-xs font-mono animate-slide-up">
          <span>{statusBanner}</span>
          <button onClick={() => setStatusBanner(null)} className="hover:scale-110 transition-transform">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* CONSOLE DI RICERCA & FILTRI MULTILIVELLO */}
      <section className="mt-6 boutique-glass rounded-2xl p-4 sm:p-5 space-y-4 animate-fade-in delay-75">
        {/* RIGA 0: BARRA DI RICERCA + ORDINAMENTO ALFABETICO PER NOME + CHIEDI ALL'IA */}
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#C5A059] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!e.target.value.trim()) resetAiFilter();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.split(' ').length >= 3) {
                  handleAskSommelier();
                }
              }}
              placeholder="Cerca profumo, marchio, nota o chiedi all'IA..."
              className="w-full pl-11 pr-10 py-2.5 rounded-xl bg-[#08080A] border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#FF2A95] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  resetAiFilter();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
            {/* SELETTORE ORDINAMENTO ALFABETICO (DEFAULT: NOME PROFUMO A-Z) */}
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#08080A] border border-white/10 text-xs font-mono text-zinc-300 shrink-0">
              <ArrowDownAZ className="w-4 h-4 text-[#1FE866]" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-white font-mono text-xs focus:outline-none cursor-pointer"
                title="Criterio di ordinamento"
              >
                <option value="nome_asc" className="bg-[#08080A] text-white">
                  Ordine: Nome Profumo (A → Z)
                </option>
                <option value="nome_desc" className="bg-[#08080A] text-white">
                  Ordine: Nome Profumo (Z → A)
                </option>
                <option value="brand_asc" className="bg-[#08080A] text-white">
                  Ordine: Marchio (A → Z)
                </option>
              </select>
            </div>

            <button
              onClick={handleAskSommelier}
              disabled={aiLoading || !searchQuery.trim()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FF2A95] via-[#7B2CBF] to-[#1FE866] text-white font-mono text-xs font-semibold uppercase tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-40 shrink-0"
            >
              {aiLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Elaborazione...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Chiedi all&apos;IA</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* LIVELLO 1: MARCHIO (SENZA NUMERI E CON NOMI RIPULITI) */}
        {archiveStats.sortedBrands.length > 0 && (
          <div className="pt-3 border-t border-white/10 flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[#C5A059] mr-1.5 shrink-0">
              <Tag className="w-3 h-3" />
              <span>Marchio:</span>
            </span>

            <button
              type="button"
              onClick={() => setSelectedBrand('Tutti')}
              className={`px-2.5 py-1 rounded-full font-mono text-[11px] transition-all duration-200 ${
                selectedBrand === 'Tutti'
                  ? 'bg-gradient-to-r from-[#FF2A95]/20 to-[#7B2CBF]/20 text-[#FF4DA6] border border-[#FF2A95]/40 font-semibold shadow-sm'
                  : 'bg-[#08080A] text-zinc-400 border border-white/10 hover:text-white'
              }`}
            >
              Tutti
            </button>

            {archiveStats.sortedBrands.map((brandName) => (
              <button
                key={brandName}
                type="button"
                onClick={() =>
                  setSelectedBrand(selectedBrand === brandName ? 'Tutti' : brandName)
                }
                className={`px-2.5 py-1 rounded-full font-mono text-[11px] transition-all duration-200 ${
                  selectedBrand === brandName
                    ? 'bg-gradient-to-r from-[#FF2A95]/20 to-[#7B2CBF]/20 text-[#FF4DA6] border border-[#FF2A95]/40 font-semibold shadow-sm'
                    : 'bg-[#08080A] text-zinc-300 border border-white/10 hover:border-zinc-600'
                }`}
              >
                {brandName}
              </button>
            ))}
          </div>
        )}

        {/* LIVELLO 2: FAMIGLIE OLFATTIVE */}
        {archiveStats.sortedPureFamilies.length > 0 && (
          <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[#C5A059] mr-1.5 shrink-0">
                <Droplets className="w-3 h-3" />
                <span>Famiglie Olfattive:</span>
              </span>

              <button
                type="button"
                onClick={() => setSelectedFamily('Tutte')}
                className={`px-2.5 py-1 rounded-full font-mono text-[11px] transition-all duration-200 ${
                  selectedFamily === 'Tutte'
                    ? 'bg-gradient-to-r from-[#FF2A95]/20 to-[#7B2CBF]/20 text-[#FF4DA6] border border-[#FF2A95]/40 font-semibold shadow-sm'
                    : 'bg-[#08080A] text-zinc-400 border border-white/10 hover:text-white'
                }`}
              >
                Tutte ({activeList.length})
              </button>

              {archiveStats.sortedPureFamilies.map(([fam, count]) => (
                <button
                  key={fam}
                  type="button"
                  onClick={() =>
                    setSelectedFamily(selectedFamily === fam ? 'Tutte' : fam)
                  }
                  className={`px-2.5 py-1 rounded-full font-mono text-[11px] transition-all duration-200 ${
                    selectedFamily === fam
                      ? 'bg-gradient-to-r from-[#FF2A95]/20 to-[#7B2CBF]/20 text-[#FF4DA6] border border-[#FF2A95]/40 font-semibold shadow-sm'
                      : 'bg-[#08080A] text-zinc-300 border border-white/10 hover:border-zinc-600'
                  }`}
                >
                  {fam} ({count})
                </button>
              ))}
            </div>

            {archiveStats.needsCleanup && (
              <button
                type="button"
                onClick={handleNormalizeAllDatabase}
                disabled={normalizingDb}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#C5A059]/15 text-[#F7E7CE] border border-[#C5A059]/30 font-mono text-[10px] uppercase hover:bg-[#C5A059]/30 hover:scale-105 active:scale-95 transition-all shrink-0"
              >
                {normalizingDb ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3 h-3 text-[#C5A059]" />
                )}
                <span>Pulisci Marchi & Famiglie nel DB</span>
              </button>
            )}
          </div>
        )}

        {/* LIVELLO 3: NOTE OLFATTIVE RAZIONALIZZATE (MULTI-SELEZIONE TESTA/CUORE/FONDO) */}
        {archiveStats.sortedNotes.length > 0 && (
          <div className="pt-3 border-t border-white/10 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[#1FE866]">
                  <Filter className="w-3 h-3" />
                  <span>Note Olfattive (Multi-Selezione):</span>
                </span>
                {selectedNotes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedNotes([])}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 text-zinc-300 hover:text-white font-mono text-[10px]"
                  >
                    <span>Azzera note ({selectedNotes.length})</span>
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={noteFilterSearch}
                  onChange={(e) => setNoteFilterSearch(e.target.value)}
                  placeholder="Filtra nota (es. Sandalo, Muschio, Oud)..."
                  className="px-2.5 py-1 rounded-lg bg-[#08080A] border border-white/10 text-[11px] font-mono text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#1FE866] w-full sm:w-64"
                />
                {archiveStats.sortedNotes.length > 16 && !noteFilterSearch.trim() && (
                  <button
                    type="button"
                    onClick={() => setShowAllNotes((v) => !v)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 font-mono text-[10px] uppercase shrink-0"
                  >
                    <span>
                      {showAllNotes
                        ? 'Mostra principali'
                        : `Tutte (${archiveStats.sortedNotes.length})`}
                    </span>
                    {showAllNotes ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {displayedNotes.map(([noteName, count]) => {
                const isSelected = selectedNotes.includes(noteName);
                return (
                  <button
                    key={noteName}
                    type="button"
                    onClick={() => toggleNoteSelection(noteName)}
                    className={`px-2.5 py-1 rounded-full font-mono text-[11px] transition-all duration-200 ${
                      isSelected
                        ? 'bg-[#1FE866]/20 text-[#1FE866] border border-[#1FE866]/60 font-semibold shadow-sm'
                        : 'bg-[#08080A] text-zinc-300 border border-white/10 hover:border-[#1FE866]/40'
                    }`}
                  >
                    {noteName} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* RIEPILOGO FILTRI ATTIVI */}
        {hasActiveFilters && (
          <div className="pt-2.5 border-t border-white/10 flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
            <span className="text-zinc-400">
              Risultati: <strong className="text-white">{filteredList.length}</strong> su{' '}
              {activeList.length} profumi
              {selectedNotes.length > 0 && (
                <span className="text-[#1FE866] ml-2">
                  • Note: {selectedNotes.join(' + ')}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={resetAllFilters}
              className="text-[#FF4DA6] hover:underline text-[11px]"
            >
              Resetta tutti i filtri
            </button>
          </div>
        )}

        {aiAdvice && (
          <div className="p-4 rounded-xl bg-[#08080A]/95 border border-[#C5A059]/40 space-y-1.5 animate-slide-up">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#C5A059]">
                Risposta dell&apos;IA
              </span>
              <button
                onClick={resetAiFilter}
                className="text-xs font-mono text-zinc-400 hover:text-[#F7E7CE]"
              >
                Mostra tutti ({activeList.length})
              </button>
            </div>
            <p className="text-xs text-[#F7E7CE] leading-relaxed">{aiAdvice}</p>
          </div>
        )}
      </section>

      <section className="mt-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-64 rounded-2xl bg-zinc-900/50 border border-white/5 p-6" />
            ))}
          </div>
        ) : filteredList.length === 0 ? (
          <div className="boutique-glass rounded-2xl p-12 text-center animate-fade-in space-y-3">
            <p className="font-serif text-xl text-white">
              Nessun profumo corrisponde ai filtri selezionati
            </p>
            <button
              type="button"
              onClick={resetAllFilters}
              className="px-4 py-2 rounded-xl bg-white/5 text-xs font-mono text-[#FF4DA6] hover:bg-white/10 transition"
            >
              Mostra tutta la collezione
            </button>
          </div>
        ) : layoutMode === 'vetrina' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredList.map((p, idx) => {
              const imgUrl = p.url_foto_vetrina || p.immagine_url;
              const cleanBrand = normalizeBrandName(p.brand);
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedProfumo({
                      ...p,
                      brand: cleanBrand,
                      famiglia_olfattiva: normalizeToPureFamily(p.famiglia_olfattiva),
                    });
                    setOfficialUrlInput('');
                  }}
                  className="boutique-glass boutique-glass-hover rounded-2xl p-4 cursor-pointer flex flex-col justify-between group text-center hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 animate-fade-in"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <div className="w-full aspect-square rounded-xl bg-[#08080A] border border-white/10 flex items-center justify-center overflow-hidden relative mb-4">
                    <SmartBottleImage
                      src={imgUrl}
                      alt={p.nome}
                      className="w-full h-full object-contain p-3 group-hover:scale-[1.04] transition duration-300"
                    />
                    {p.prezzo_stimato_euro && (
                      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded font-mono text-[10px] bg-[#08080A]/90 text-[#1FE866] border border-[#1FE866]/30">
                        {String(p.prezzo_stimato_euro).startsWith('€')
                          ? p.prezzo_stimato_euro
                          : `€${p.prezzo_stimato_euro}`}
                      </span>
                    )}
                  </div>

                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#FF4DA6] truncate">
                      {cleanBrand}
                    </p>
                    <h2 className="font-serif text-lg text-white font-medium mt-0.5 line-clamp-1">
                      {p.nome}
                    </h2>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredList.map((p, idx) => {
              const unifiedNotes = getUnifiedNotes(p);
              const aiReason = aiMotivazioni[p.id];
              const isEnriching = enrichingId === p.id;
              const imgUrl = p.url_foto_vetrina || p.immagine_url;
              const pureFamily = normalizeToPureFamily(p.famiglia_olfattiva);
              const cleanBrand = normalizeBrandName(p.brand);

              return (
                <article
                  key={p.id}
                  className="boutique-glass boutique-glass-hover rounded-2xl p-5 flex flex-col justify-between relative group hover:scale-[1.015] transition-all duration-300 animate-fade-in"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <div>
                    <div className="flex items-start gap-3.5">
                      <div
                        onClick={() => {
                          setSelectedProfumo({
                            ...p,
                            brand: cleanBrand,
                            famiglia_olfattiva: pureFamily,
                          });
                          setOfficialUrlInput('');
                        }}
                        className="w-14 h-14 rounded-xl bg-[#08080A] border border-white/10 shrink-0 overflow-hidden flex items-center justify-center cursor-pointer relative"
                      >
                        <SmartBottleImage
                          src={imgUrl}
                          alt={p.nome}
                          iconSize="w-6 h-6"
                          className="w-full h-full object-contain p-1"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#FF4DA6] truncate">
                            {cleanBrand}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {p.concentrazione && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 text-zinc-300 border border-white/10">
                                {p.concentrazione}
                              </span>
                            )}
                            {p.prezzo_stimato_euro && (
                              <span className="px-2 py-0.5 rounded font-mono text-xs bg-[#1FE866]/10 text-[#1FE866] border border-[#1FE866]/30">
                                {String(p.prezzo_stimato_euro).startsWith('€')
                                  ? p.prezzo_stimato_euro
                                  : `€${p.prezzo_stimato_euro}`}
                              </span>
                            )}
                          </div>
                        </div>

                        <h2 className="font-serif text-xl sm:text-2xl text-white font-semibold mt-1 tracking-tight">
                          {p.nome}
                        </h2>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-3">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-gradient-to-r from-[#FF2A95]/10 to-[#7B2CBF]/10 text-[#FF70B8] border border-[#FF2A95]/30">
                        {pureFamily}
                      </span>
                      {p.stagione_ideale && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-zinc-900 text-zinc-400 border border-white/10">
                          {p.stagione_ideale}
                        </span>
                      )}
                    </div>

                    {aiReason && (
                      <div className="mt-3 p-2.5 rounded-xl bg-[#C5A059]/15 border border-[#C5A059]/40 text-xs text-[#F7E7CE] animate-fade-in">
                        {aiReason}
                      </div>
                    )}

                    <div className="mt-3.5 text-xs">
                      {p.note_testa || p.note_cuore || p.note_fondo ? (
                        <div className="space-y-1 bg-[#08080A]/60 p-3 rounded-xl border border-white/5">
                          {p.note_testa && (
                            <p className="text-zinc-300">
                              <span className="font-mono text-[10px] uppercase text-[#1FE866] mr-1.5">
                                Testa:
                              </span>
                              {p.note_testa}
                            </p>
                          )}
                          {p.note_cuore && (
                            <p className="text-zinc-300">
                              <span className="font-mono text-[10px] uppercase text-[#FF4DA6] mr-1.5">
                                Cuore:
                              </span>
                              {p.note_cuore}
                            </p>
                          )}
                          {p.note_fondo && (
                            <p className="text-zinc-300">
                              <span className="font-mono text-[10px] uppercase text-[#7B2CBF] mr-1.5">
                                Fondo:
                              </span>
                              {p.note_fondo}
                            </p>
                          )}
                        </div>
                      ) : unifiedNotes ? (
                        <p className="text-zinc-300 bg-[#08080A]/60 p-3 rounded-xl border border-white/5 line-clamp-3">
                          <span className="font-mono text-[10px] uppercase text-[#1FE866] mr-1.5">
                            Note:
                          </span>
                          {unifiedNotes}
                        </p>
                      ) : null}
                    </div>

                    {(vista === 'radar' || p.note_mouche || p.note_pelle) && (
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2.5 rounded-lg bg-[#08080A]/80 border border-white/5">
                          <span className="font-mono text-[9px] uppercase tracking-wider text-[#FF4DA6] block">
                            Su Mouche
                          </span>
                          <p className="text-zinc-300 line-clamp-2 mt-0.5">
                            {p.note_mouche || '-'}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-[#08080A]/80 border border-white/5">
                          <span className="font-mono text-[9px] uppercase tracking-wider text-[#FF4DA6] block">
                            Su Pelle
                          </span>
                          <p className="text-zinc-300 line-clamp-2 mt-0.5">
                            {p.note_pelle || '-'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#F7E7CE]/10 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleEnrichWithAI(p)}
                        disabled={isEnriching}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[#FF2A95]/20 to-[#7B2CBF]/20 text-[#FF4DA6] border border-[#FF2A95]/30 font-mono text-[11px] hover:scale-105 active:scale-95 transition-all duration-200"
                      >
                        {isEnriching ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-[#FF2A95]" />
                        )}
                        <span>{isEnriching ? '...' : 'IA'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProfumo({
                            ...p,
                            brand: cleanBrand,
                            famiglia_olfattiva: pureFamily,
                          });
                          setOfficialUrlInput('');
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-200 font-mono text-[11px] hover:scale-105 active:scale-95 transition-all duration-200"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-[#FF4DA6]" />
                        <span>Scheda</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWearProfumo(p)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-200 font-mono text-[11px] hover:scale-105 active:scale-95 transition-all duration-200"
                      >
                        <Clock className="w-3.5 h-3.5 text-[#FF4DA6]" />
                        <span>Indossa</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(p)}
                      title="Elimina"
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 hover:scale-110 active:scale-90 transition-all duration-200"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* MODALE SCHEDA TECNICA */}
      {selectedProfumo && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="boutique-glass rounded-2xl max-w-2xl w-full p-6 sm:p-7 border border-white/15 my-8 max-h-[92vh] overflow-y-auto animate-scale-up">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-xl bg-[#08080A] border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                  <SmartBottleImage
                    src={selectedProfumo.url_foto_vetrina || selectedProfumo.immagine_url}
                    alt={selectedProfumo.nome}
                    iconSize="w-6 h-6"
                    className="w-full h-full object-contain p-1"
                  />
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#FF4DA6]">
                    Scheda Tecnica
                  </p>
                  <h3 className="font-serif text-2xl text-white mt-0.5">
                    {selectedProfumo.nome} - {selectedProfumo.brand}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedProfumo(null)}
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:scale-105 transition-transform"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-[#08080A] border border-[#FF2A95]/30">
              <label className="block font-mono text-[10px] uppercase tracking-wider text-[#FF4DA6] mb-1.5">
                Aggiorna da Link
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={officialUrlInput}
                  onChange={(e) => setOfficialUrlInput(e.target.value)}
                  placeholder="URL pagina prodotto..."
                  className="flex-1 rounded-lg bg-[#0D0D11] border border-white/10 px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-[#FF2A95] transition-all"
                />
                <button
                  type="button"
                  onClick={handleModalExtractFromOfficial}
                  disabled={modalExtracting}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-[#FF2A95] via-[#7B2CBF] to-[#1FE866] text-white font-mono text-xs font-semibold hover:scale-102 transition-all shrink-0"
                >
                  {modalExtracting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>...</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-3.5 h-3.5" />
                      <span>Estrai</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveDetails} className="space-y-4 mt-4">
              {isRadarProfumo(selectedProfumo) && (
                <div className="p-3 rounded-xl bg-[#FF2A95]/15 border border-[#FF2A95]/30 flex items-center justify-between gap-3 animate-fade-in">
                  <span className="text-xs font-mono text-[#FF70B8]">
                    In Testing
                  </span>
                  <button
                    type="button"
                    onClick={() => handlePromoteToCollection(selectedProfumo)}
                    className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#FF2A95] via-[#7B2CBF] to-[#1FE866] text-white font-mono text-xs font-semibold uppercase hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                  >
                    Sposta in Collezione
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#FF4DA6] mb-1">
                    Marchio
                  </label>
                  <input
                    type="text"
                    value={selectedProfumo.brand || ''}
                    onChange={(e) =>
                      setSelectedProfumo({ ...selectedProfumo, brand: e.target.value })
                    }
                    className="w-full rounded-xl bg-[#08080A] border border-white/10 px-3 py-2 text-xs text-white focus:border-[#FF2A95] transition-all"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#FF4DA6] mb-1">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={selectedProfumo.nome || ''}
                    onChange={(e) =>
                      setSelectedProfumo({ ...selectedProfumo, nome: e.target.value })
                    }
                    className="w-full rounded-xl bg-[#08080A] border border-white/10 px-3 py-2 text-xs text-white focus:border-[#FF2A95] transition-all"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#FF4DA6] mb-1">
                    Prezzo (€)
                  </label>
                  <input
                    type="text"
                    value={selectedProfumo.prezzo_stimato_euro || ''}
                    onChange={(e) =>
                      setSelectedProfumo({
                        ...selectedProfumo,
                        prezzo_stimato_euro: e.target.value,
                      })
                    }
                    className="w-full rounded-xl bg-[#08080A] border border-white/10 px-3 py-2 text-xs font-mono text-white focus:border-[#FF2A95] transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#FF4DA6] mb-1">
                    Famiglia Olfattiva (12 Pure)
                  </label>
                  <select
                    value={normalizeToPureFamily(selectedProfumo.famiglia_olfattiva)}
                    onChange={(e) =>
                      setSelectedProfumo({
                        ...selectedProfumo,
                        famiglia_olfattiva: e.target.value,
                      })
                    }
                    className="w-full rounded-xl bg-[#08080A] border border-white/10 px-3 py-2 text-xs text-white focus:border-[#FF2A95] transition-all"
                  >
                    {PURE_FAMILIES.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#FF4DA6] mb-1">
                    Concentrazione
                  </label>
                  <input
                    type="text"
                    value={selectedProfumo.concentrazione || ''}
                    onChange={(e) =>
                      setSelectedProfumo({
                        ...selectedProfumo,
                        concentrazione: e.target.value,
                      })
                    }
                    className="w-full rounded-xl bg-[#08080A] border border-white/10 px-3 py-2 text-xs text-white focus:border-[#FF2A95] transition-all"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#FF4DA6] mb-1">
                    Archivio
                  </label>
                  <select
                    value={isRadarProfumo(selectedProfumo) ? 'radar' : 'collezione'}
                    onChange={(e) =>
                      setSelectedProfumo({ ...selectedProfumo, stato: e.target.value })
                    }
                    className="w-full rounded-xl bg-[#08080A] border border-white/10 px-3 py-2 text-xs text-white focus:border-[#FF2A95] transition-all"
                  >
                    <option value="collezione">Collezione Privata</option>
                    <option value="radar">Radar - Testing</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-[#FF4DA6] mb-1">
                  URL Immagine Flacone
                </label>
                <input
                  type="text"
                  value={selectedProfumo.url_foto_vetrina || ''}
                  onChange={(e) =>
                    setSelectedProfumo({
                      ...selectedProfumo,
                      url_foto_vetrina: e.target.value,
                    })
                  }
                  placeholder="https://..."
                  className="w-full rounded-xl bg-[#08080A] border border-white/10 px-3 py-2 text-xs text-white font-mono focus:border-[#FF2A95] transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#FF4DA6] mb-1">
                    Note di Testa
                  </label>
                  <input
                    type="text"
                    value={selectedProfumo.note_testa || ''}
                    onChange={(e) =>
                      setSelectedProfumo({
                        ...selectedProfumo,
                        note_testa: e.target.value,
                      })
                    }
                    className="w-full rounded-xl bg-[#08080A] border border-white/10 px-3 py-2 text-xs text-white focus:border-[#FF2A95] transition-all"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#FF4DA6] mb-1">
                    Note di Cuore
                  </label>
                  <input
                    type="text"
                    value={selectedProfumo.note_cuore || ''}
                    onChange={(e) =>
                      setSelectedProfumo({
                        ...selectedProfumo,
                        note_cuore: e.target.value,
                      })
                    }
                    className="w-full rounded-xl bg-[#08080A] border border-white/10 px-3 py-2 text-xs text-white focus:border-[#FF2A95] transition-all"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#FF4DA6] mb-1">
                    Note di Fondo
                  </label>
                  <input
                    type="text"
                    value={selectedProfumo.note_fondo || ''}
                    onChange={(e) =>
                      setSelectedProfumo({
                        ...selectedProfumo,
                        note_fondo: e.target.value,
                      })
                    }
                    className="w-full rounded-xl bg-[#08080A] border border-white/10 px-3 py-2 text-xs text-white focus:border-[#FF2A95] transition-all"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#08080A]/90 border border-white/5 space-y-3">
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#FF70B8]">
                  Test Olfattivo
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[10px] text-[#FF4DA6] mb-1">
                      Su Mouche
                    </label>
                    <textarea
                      rows={2}
                      value={selectedProfumo.note_mouche || ''}
                      onChange={(e) =>
                        setSelectedProfumo({
                          ...selectedProfumo,
                          note_mouche: e.target.value,
                        })
                      }
                      className="w-full rounded-xl bg-[#0D0D11] border border-white/10 p-2.5 text-xs text-white focus:border-[#FF2A95] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] text-[#FF4DA6] mb-1">
                      Su Pelle
                    </label>
                    <textarea
                      rows={2}
                      value={selectedProfumo.note_pelle || ''}
                      onChange={(e) =>
                        setSelectedProfumo({
                          ...selectedProfumo,
                          note_pelle: e.target.value,
                        })
                      }
                      className="w-full rounded-xl bg-[#0D0D11] border border-white/10 p-2.5 text-xs text-white focus:border-[#FF2A95] transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#08080A]/70 border border-white/5 animate-fade-in">
                {[
                  { key: 'voto_longevita', label: 'Durata' },
                  { key: 'voto_scia', label: 'Scia' },
                  { key: 'voto_proiezione', label: 'Proiezione' },
                  { key: 'voto_complessita', label: 'Complessità' },
                ].map(({ key, label }) => {
                  const val = Number((selectedProfumo as any)[key] ?? 8);
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-xs font-mono mb-1.5">
                        <span className="text-zinc-300">{label}</span>
                        <span className="text-[#FF70B8] font-semibold">{val}/10</span>
                      </div>
                      <div className="grid grid-cols-10 gap-1">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((step) => (
                          <button
                            key={step}
                            type="button"
                            onClick={() =>
                              setSelectedProfumo({
                                ...selectedProfumo,
                                [key]: step,
                              })
                            }
                            className={`h-2.5 rounded-sm transition-all ${
                              step <= val
                                ? step >= 8
                                  ? 'bg-[#1FE866] shadow-[0_0_8px_rgba(31,232,102,0.3)]'
                                  : 'bg-[#FF2A95]'
                                : 'bg-zinc-800 hover:bg-zinc-700'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(selectedProfumo)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 font-mono text-xs hover:scale-105 active:scale-95 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Elimina Profilo</span>
                </button>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedProfumo(null)}
                    className="px-4 py-2 rounded-xl bg-white/5 text-[#FF70B8] text-xs font-mono uppercase hover:bg-white/10 transition"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={savingDetail}
                    className="px-6 py-2 rounded-xl bg-gradient-to-r from-[#FF2A95] via-[#7B2CBF] to-[#1FE866] text-white font-mono text-xs font-semibold uppercase shadow-champagne-glow hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    {savingDetail ? 'Salvataggio...' : 'Salva Modifiche'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE INDOSSO */}
      {wearProfumo && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="boutique-glass rounded-2xl max-w-md w-full p-6 border border-white/15 space-y-4 animate-scale-up">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#FF4DA6]">
                  Indosso
                </p>
                <h3 className="font-serif text-2xl text-white mt-0.5">
                  {wearProfumo.nome}
                </h3>
              </div>
              <button
                onClick={() => setWearProfumo(null)}
                className="text-zinc-400 hover:text-white hover:scale-105 transition-transform"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordWear} className="space-y-4">
              <div>
                <label className="block font-mono text-[10px] uppercase text-[#FF4DA6] mb-1.5">
                  Momento
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Mattina', 'Pomeriggio', 'Sera', 'Notte'] as const).map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setMomentoGiornata(m)}
                      className={`py-2 rounded-xl font-mono text-xs border transition-all ${
                        momentoGiornata === m
                          ? 'bg-gradient-to-r from-[#FF2A95] via-[#7B2CBF] to-[#1FE866] text-white font-semibold border-transparent'
                          : 'bg-[#08080A] text-zinc-400 border-white/10'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-[#FF4DA6] mb-1">
                  Contesto
                </label>
                <select
                  value={contestoOutfit}
                  onChange={(e) => setContestoOutfit(e.target.value)}
                  className="w-full rounded-xl bg-[#08080A] border border-white/10 px-3 py-2 text-xs text-white focus:border-[#FF2A95] transition-all"
                >
                  <option value="Ufficio">Ufficio</option>
                  <option value="Aperitivo">Aperitivo</option>
                  <option value="Cena">Cena</option>
                  <option value="Serata">Serata</option>
                  <option value="Evento">Evento</option>
                </select>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-[#FF4DA6] mb-1">
                  Note
                </label>
                <textarea
                  rows={2}
                  value={noteGiorno}
                  onChange={(e) => setNoteGiorno(e.target.value)}
                  className="w-full rounded-xl bg-[#08080A] border border-white/10 p-2.5 text-xs text-white focus:border-[#FF2A95] transition-all"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWearProfumo(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-[#FF70B8] text-xs font-mono"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={savingWear}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#FF2A95] via-[#7B2CBF] to-[#1FE866] text-white font-mono text-xs font-semibold"
                >
                  {savingWear ? '...' : 'Conferma'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE CONFERMA ELIMINAZIONE */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="boutique-glass rounded-2xl max-w-md w-full p-6 border border-red-500/30 space-y-4 animate-scale-up">
            <h3 className="font-serif text-xl text-white">
              Eliminare definitivamente {deleteTarget.brand ? `${deleteTarget.brand} - ` : ''}{deleteTarget.nome}?
            </h3>
            <p className="text-xs text-zinc-400">
              Questa operazione cancellerà il profumo dal database Supabase.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl bg-white/5 text-zinc-300 text-xs font-mono"
              >
                Annulla
              </button>
              <button
                onClick={confirmDelete}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-semibold hover:scale-105 active:scale-95 transition-all"
              >
                Conferma Eliminazione
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function CollezionePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-[#FF70B8] font-mono text-xs animate-pulse">
          Caricamento...
        </div>
      }
    >
      <CollezioneContent />
    </Suspense>
  );
}
