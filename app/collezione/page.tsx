'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
import { useAura, resolveAura } from '@/components/AuraProvider';
import { BottlePedestal, SmartBottleImage } from '@/components/BottleImage';
import { useToast } from '@/components/Toast';
import { springSoft, springSnappy } from '@/lib/motion';

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

function normalizeBrandName(raw?: string | null): string {
  const cleaned = (raw || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Maison';

  const low = cleaned
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const BRAND_ALIASES: Record<string, string> = {
    'bois 1920': 'Bois 1920',
    'byredo': 'Byredo',
    'chanel': 'Chanel',
    'cigno nero': 'Cigno Nero Milano',
    'cigno nero milano': 'Cigno Nero Milano',
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
    'marc-antoine barrois': 'Marc-Antoine Barrois',
    'marc antoine barrois': 'Marc-Antoine Barrois',
    'montale': 'Montale',
    'montale paris': 'Montale',
    'tom ford': 'Tom Ford',
    'amouage': 'Amouage',
    'xerjoff': 'Xerjoff',
    'parfums de marly': 'Parfums de Marly',
    'initio': 'Initio Parfums Privés',
    'initio parfums prives': 'Initio Parfums Privés',
    'orto parisi': 'Orto Parisi',
    'nasomatto': 'Nasomatto',
    'lorenzo pazzaglia': 'Lorenzo Pazzaglia',
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
    "penhaligon's": "Penhaligon's",
    'penhaligons': "Penhaligon's",
    'nishane': 'Nishane',
    'bdk': 'BDK Parfums',
    'bdk parfums': 'BDK Parfums',
    'stephane humbert lucas': 'Stéphane Humbert Lucas',
  };

  if (BRAND_ALIASES[low]) return BRAND_ALIASES[low];

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

function canonicalizeNote(rawNote: string): string | null {
  let s = rawNote
    .toLowerCase()
    .replace(/^(note di|nota di|accordo di|assoluta di|olio di|essenza di|estratto di|legno di|fiori di|fiore di|foglie di|foglia di|bacche di)\s+/i, '')
    .replace(/[().]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!s || s.length < 2 || s === '-' || s === 'n/a') return null;

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
  if (s.includes('orange blossom') || (s.includes('arancio') && s.includes('fior'))) return "Fiori d'Arancio";
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
  if (s.includes('sea ') || s.includes('marine') || s.includes('marino') || s.includes('acquat') || s.includes('sale') || s.includes('salt') || s.includes('alghe')) return 'Note Marine';
  if (s.includes('tea') || s === 'te' || s === 'tè' || s.includes('tè ') || s.includes('matcha')) return 'Tè';
  if (s.includes('mint') || s.includes('menta')) return 'Menta';
  if (s.includes('sage') || s.includes('salvia')) return 'Salvia';
  if (s.includes('rosemary') || s.includes('rosmarin')) return 'Rosmarino';
  if (s.includes('juniper') || s.includes('ginepr')) return 'Ginepro';
  if (s.includes('cypress') || s.includes('cipress')) return 'Cipresso';
  if (s.includes('pine') || s === 'pino') return 'Pino';
  if (s.includes('oakmoss') || s.includes('quercia')) return 'Muschio di Quercia';
  if (s.includes('benzoin')) return 'Benzoino';
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

  return s.charAt(0).toUpperCase() + s.slice(1);
}

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

function CollezioneContent() {
  const searchParams = useSearchParams();
  const initialVista = searchParams.get('vista') === 'radar' ? 'radar' : 'collezione';
  const initialSearch = searchParams.get('search') || '';

  const [profumi, setProfumi] = useState<Profumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<'collezione' | 'radar'>(initialVista);
  const [layoutMode, setLayoutMode] = useState<'dettagli' | 'vetrina'>('dettagli');

  const [selectedBrand, setSelectedBrand] = useState<string>('Tutti');
  const [selectedFamily, setSelectedFamily] = useState<string>('Tutte');
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [noteFilterSearch, setNoteFilterSearch] = useState('');
  const [sortBy, setSortBy] = useState<'nome_asc' | 'nome_desc' | 'brand_asc'>('nome_asc');

  const [openBrandPanel, setOpenBrandPanel] = useState(false);
  const [openFamilyPanel, setOpenFamilyPanel] = useState(true);
  const [openNotesPanel, setOpenNotesPanel] = useState(false);

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

  const { showToast } = useToast();
  const { setAuraFromProfumo } = useAura();

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
      const list = (data || []) as Profumo[];
      setProfumi(list);
      if (list.length > 0) {
        setAuraFromProfumo(list[0]);
      }
    } catch (err) {
      console.error('Errore caricamento collezione:', err);
      showToast('Impossibile caricare i profumi.', 'error');
    } finally {
      setLoading(false);
    }
  }

  const collezioneList = useMemo(() => profumi.filter(isCollezioneProfumo), [profumi]);
  const radarList = useMemo(() => profumi.filter(isRadarProfumo), [profumi]);
  const activeList = vista === 'collezione' ? collezioneList : radarList;

  const archiveStats = useMemo(() => {
    const familyCounts: Record<string, number> = {};
    const brandSet = new Set<string>();
    const noteCounts: Record<string, number> = {};
    let totalEuro = 0;
    let needsCleanup = false;

    activeList.forEach((p) => {
      const rawBrand = p.brand || '';
      const cleanBrand = normalizeBrandName(rawBrand);
      brandSet.add(cleanBrand);
      if (rawBrand !== cleanBrand) needsCleanup = true;

      const rawFam = (p.famiglia_olfattiva || '').trim();
      const pure = normalizeToPureFamily(rawFam);
      if (rawFam && !(PURE_FAMILIES as readonly string[]).includes(rawFam)) needsCleanup = true;
      familyCounts[pure] = (familyCounts[pure] || 0) + 1;

      const cNotes = extractCanonicalNotesForPerfume(p);
      cNotes.forEach((n) => {
        noteCounts[n] = (noteCounts[n] || 0) + 1;
      });

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
      showToast('Database allineato con successo.');
    } catch (err: any) {
      showToast(err?.message || 'Errore normalizzazione database.', 'error');
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

  const filteredList = useMemo(() => {
    let base = [...activeList];

    if (selectedBrand !== 'Tutti') {
      base = base.filter((p) => normalizeBrandName(p.brand) === selectedBrand);
    }

    if (selectedFamily !== 'Tutte') {
      base = base.filter(
        (p) => normalizeToPureFamily(p.famiglia_olfattiva) === selectedFamily
      );
    }

    if (selectedNotes.length > 0) {
      base = base.filter((p) => {
        const pNotes = extractCanonicalNotesForPerfume(p);
        return selectedNotes.every((selNote) => pNotes.includes(selNote));
      });
    }

    if (aiRecommendedIds && aiRecommendedIds.length > 0) {
      const map = new Map(base.map((p) => [p.id, p]));
      const ordered = aiRecommendedIds.map((id) => map.get(id)).filter(Boolean) as Profumo[];
      if (ordered.length > 0) return ordered;
    }

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
          p.naso,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
    }

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

  async function handleAskAiEngine() {
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
      showToast('Il sommelier IA ha selezionato i flaconi.');
    } catch (err: any) {
      showToast(err?.message || 'Errore durante la consultazione IA.', 'error');
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
        naso: aiData.naso || p.naso || null,
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
      showToast(`Aggiornato con IA: ${cleanBrand} - ${updatePayload.nome}`);
    } catch (err: any) {
      showToast(err?.message || 'Errore verifica IA.', 'error');
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
        naso: aiData.naso || selectedProfumo.naso || null,
        url_foto_vetrina: aiData.url_foto_vetrina || selectedProfumo.url_foto_vetrina,
        voto_longevita: aiData.voto_longevita ?? selectedProfumo.voto_longevita,
        voto_scia: aiData.voto_scia ?? selectedProfumo.voto_scia,
        voto_proiezione: aiData.voto_proiezione ?? selectedProfumo.voto_proiezione,
        voto_complessita: aiData.voto_complessita ?? selectedProfumo.voto_complessita,
      });
      setOfficialUrlInput('');
      showToast('Dati estratti con successo.');
    } catch (err: any) {
      showToast(err?.message || 'Impossibile estrarre i dati.', 'error');
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
        naso: selectedProfumo.naso || null,
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
      showToast(`Modifiche salvate per ${cleanBrand} - ${cleanNome}`);
    } catch (err: any) {
      showToast(`Errore salvataggio: ${err?.message}`, 'error');
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
      showToast(`${p.nome} spostato in Collezione.`);
    } catch (err: any) {
      showToast(err?.message || 'Errore spostamento.', 'error');
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

      setAuraFromProfumo(wearProfumo);
      showToast(`Oggi indossi ${wearProfumo.nome}.`);
      setWearProfumo(null);
      setNoteGiorno('');
    } catch (err: any) {
      showToast(`Errore registrazione: ${err?.message}`, 'error');
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
      showToast('Profumo eliminato dall’archivio.');
    } catch (err: any) {
      showToast(err?.message || 'Errore eliminazione.', 'error');
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
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-8 py-8 pb-28">
      {/* HEADER DELLA COLLEZIONE */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 pb-6 border-b border-[#D8B995]/20">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            aria-label="Torna alla home"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#D8B995]/30 bg-[#1E1428]/80 text-[#F6EFE4] transition hover:border-[#D8B995]"
          >
            <ArrowLeft className="h-5 w-5 text-[#D8B995]" />
          </Link>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#D8B995]">
              Private Vault &amp; Atelier
            </p>
            <div className="flex flex-wrap items-baseline gap-3 mt-0.5">
              <h1 className="font-serif text-3xl sm:text-4xl text-[#F6EFE4]">
                {vista === 'collezione'
                  ? `Collezione Privata (${collezioneList.length})`
                  : `Radar Testing (${radarList.length})`}
              </h1>
              {vista === 'collezione' && archiveStats.totalEuro > 0 && (
                <span className="font-mono text-xs text-[#B8A9C9]">
                  Valore stimato: €{archiveStats.totalEuro.toLocaleString('it-IT')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Layout Mode Toggle */}
          <div className="flex rounded-full bg-[#1E1428] border border-white/10 p-1">
            <button
              type="button"
              onClick={() => changeLayoutMode('dettagli')}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                layoutMode === 'dettagli'
                  ? 'bg-[#281B35] text-[#F6EFE4] border border-[#D8B995]/40'
                  : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
              }`}
            >
              <List className="h-3.5 w-3.5 text-[#D8B995]" />
              <span>Dettagli</span>
            </button>
            <button
              type="button"
              onClick={() => changeLayoutMode('vetrina')}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                layoutMode === 'vetrina'
                  ? 'bg-[#281B35] text-[#F6EFE4] border border-[#D8B995]/40'
                  : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5 text-[#D8B995]" />
              <span>Vetrina</span>
            </button>
          </div>

          {/* Vista Collezione / Radar */}
          <div className="flex rounded-full bg-[#1E1428] border border-white/10 p-1">
            <button
              type="button"
              onClick={() => {
                setVista('collezione');
                resetAllFilters();
              }}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                vista === 'collezione'
                  ? 'bg-[#D8B995] text-[#140D1C]'
                  : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Collezione</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setVista('radar');
                resetAllFilters();
              }}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                vista === 'radar'
                  ? 'bg-[#D8B995] text-[#140D1C]'
                  : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
              <span>Radar</span>
            </button>
          </div>

          <Link
            href="/scanner"
            className="flex items-center gap-1.5 rounded-full bg-[#D8B995] px-4 py-2 text-xs font-bold text-[#140D1C] transition hover:bg-[#c2a27e]"
          >
            <ScanLine className="h-3.5 w-3.5" />
            <span>Aggiungi</span>
          </Link>
        </div>
      </div>

      {/* CONSOLE DI RICERCA E FILTRI PIEGHEVOLI */}
      <section className="mt-6 rounded-[24px] border border-white/10 bg-[#1E1428]/90 p-5 aura-shadow space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#D8B995]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!e.target.value.trim()) resetAiFilter();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.split(' ').length >= 2) {
                  handleAskAiEngine();
                }
              }}
              placeholder="Cerca profumo, marchio, nota o chiedi all'IA..."
              className="w-full rounded-[16px] border border-white/10 bg-[#140D1C] py-3 pl-11 pr-10 text-sm text-[#F6EFE4] placeholder:text-[#B8A9C9]/50 focus:border-[#D8B995] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  resetAiFilter();
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#B8A9C9] hover:text-[#F6EFE4]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleAskAiEngine}
            disabled={aiLoading || !searchQuery.trim()}
            className="flex items-center justify-center gap-2 rounded-[16px] bg-[#281B35] border border-[#D8B995]/40 px-5 py-3 text-xs font-semibold text-[#F6EFE4] transition hover:border-[#D8B995] disabled:opacity-40"
          >
            {aiLoading ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#D8B995]" />
                <span>Analisi...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 text-[#D8B995]" />
                <span>Chiedi all&apos;IA</span>
              </>
            )}
          </button>
        </div>

        {/* ORDINAMENTO E PULIZIA DB */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10 text-xs">
          <div className="flex items-center gap-2 rounded-[14px] border border-white/10 bg-[#140D1C] px-3 py-2 text-[#B8A9C9]">
            <ArrowDownAZ className="h-4 w-4 text-[#D8B995]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-[#F6EFE4] focus:outline-none cursor-pointer"
            >
              <option value="nome_asc" className="bg-[#140D1C]">Ordina per Nome (A → Z)</option>
              <option value="nome_desc" className="bg-[#140D1C]">Ordina per Nome (Z → A)</option>
              <option value="brand_asc" className="bg-[#140D1C]">Ordina per Marchio (A → Z)</option>
            </select>
          </div>

          {archiveStats.needsCleanup && (
            <button
              type="button"
              onClick={handleNormalizeAllDatabase}
              disabled={normalizingDb}
              className="flex items-center gap-1.5 rounded-[14px] border border-[#D8B995]/30 bg-[#281B35] px-3.5 py-2 text-xs font-medium text-[#F6EFE4] transition hover:border-[#D8B995]"
            >
              {normalizingDb ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-[#D8B995]" />}
              <span>Allinea Marchi e Famiglie nel DB</span>
            </button>
          )}
        </div>

        {/* FILTRO MARCHIO */}
        {archiveStats.sortedBrands.length > 0 && (
          <div className="pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => setOpenBrandPanel((v) => !v)}
              className="flex w-full items-center justify-between py-1 text-left text-xs font-semibold text-[#D8B995]"
            >
              <div className="flex items-center gap-2">
                <Tag className="h-3.5 w-3.5" />
                <span>Marchio {selectedBrand !== 'Tutti' && `(${selectedBrand})`}</span>
              </div>
              {openBrandPanel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {openBrandPanel && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedBrand('Tutti')}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    selectedBrand === 'Tutti'
                      ? 'bg-[#D8B995] text-[#140D1C] font-semibold'
                      : 'border border-white/10 bg-[#140D1C] text-[#B8A9C9] hover:text-[#F6EFE4]'
                  }`}
                >
                  Tutti
                </button>
                {archiveStats.sortedBrands.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setSelectedBrand(selectedBrand === b ? 'Tutti' : b)}
                    className={`rounded-full px-3 py-1 text-xs transition ${
                      selectedBrand === b
                        ? 'bg-[#D8B995] text-[#140D1C] font-semibold'
                        : 'border border-white/10 bg-[#140D1C] text-[#B8A9C9] hover:border-[#D8B995]/40 hover:text-[#F6EFE4]'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* FILTRO FAMIGLIE */}
        {archiveStats.sortedPureFamilies.length > 0 && (
          <div className="pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => setOpenFamilyPanel((v) => !v)}
              className="flex w-full items-center justify-between py-1 text-left text-xs font-semibold text-[#D8B995]"
            >
              <div className="flex items-center gap-2">
                <Droplets className="h-3.5 w-3.5" />
                <span>Famiglie Olfattive {selectedFamily !== 'Tutte' && `(${selectedFamily})`}</span>
              </div>
              {openFamilyPanel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {openFamilyPanel && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedFamily('Tutte')}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    selectedFamily === 'Tutte'
                      ? 'bg-[#D8B995] text-[#140D1C] font-semibold'
                      : 'border border-white/10 bg-[#140D1C] text-[#B8A9C9] hover:text-[#F6EFE4]'
                  }`}
                >
                  Tutte ({activeList.length})
                </button>
                {archiveStats.sortedPureFamilies.map(([fam, count]) => (
                  <button
                    key={fam}
                    type="button"
                    onClick={() => setSelectedFamily(selectedFamily === fam ? 'Tutte' : fam)}
                    className={`rounded-full px-3 py-1 text-xs transition ${
                      selectedFamily === fam
                        ? 'bg-[#D8B995] text-[#140D1C] font-semibold'
                        : 'border border-white/10 bg-[#140D1C] text-[#B8A9C9] hover:border-[#D8B995]/40 hover:text-[#F6EFE4]'
                    }`}
                  >
                    {fam} ({count})
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* FILTRO NOTE MULTI-SELEZIONE */}
        {archiveStats.sortedNotes.length > 0 && (
          <div className="pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => setOpenNotesPanel((v) => !v)}
              className="flex w-full items-center justify-between py-1 text-left text-xs font-semibold text-[#D8B995]"
            >
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5" />
                <span>Note Olfattive (Multi-selezione) {selectedNotes.length > 0 && `(${selectedNotes.length})`}</span>
              </div>
              {openNotesPanel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {openNotesPanel && (
              <div className="mt-2.5 space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={noteFilterSearch}
                    onChange={(e) => setNoteFilterSearch(e.target.value)}
                    placeholder="Filtra nota (es. Vaniglia, Oud, Rosa)..."
                    className="flex-1 rounded-[14px] border border-white/10 bg-[#140D1C] px-3 py-1.5 text-xs text-[#F6EFE4] placeholder:text-[#B8A9C9]/50 focus:border-[#D8B995] focus:outline-none"
                  />
                  {selectedNotes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedNotes([])}
                      className="rounded-[14px] bg-white/5 px-3 py-1.5 text-xs text-[#B8A9C9] hover:text-[#F6EFE4]"
                    >
                      Azzera note
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {displayedNotes.map(([noteName, count]) => {
                    const isSelected = selectedNotes.includes(noteName);
                    return (
                      <button
                        key={noteName}
                        type="button"
                        onClick={() => toggleNoteSelection(noteName)}
                        className={`rounded-full px-3 py-1 text-xs transition ${
                          isSelected
                            ? 'bg-[#D8B995] text-[#140D1C] font-semibold'
                            : 'border border-white/10 bg-[#140D1C] text-[#B8A9C9] hover:border-[#D8B995]/40 hover:text-[#F6EFE4]'
                        }`}
                      >
                        {noteName} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs text-[#B8A9C9]">
            <span>Risultati: <strong className="text-[#F6EFE4]">{filteredList.length}</strong> su {activeList.length}</span>
            <button type="button" onClick={resetAllFilters} className="text-[#D8B995] hover:underline">
              Resetta tutti i filtri
            </button>
          </div>
        )}

        {aiAdvice && (
          <div className="rounded-[18px] border border-[#D8B995]/40 bg-[#140D1C] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#D8B995]">Consiglio del Sommelier IA</span>
              <button type="button" onClick={resetAiFilter} className="text-xs text-[#B8A9C9] hover:text-[#F6EFE4]">Chiudi</button>
            </div>
            <p className="text-xs text-[#F6EFE4] leading-relaxed">{aiAdvice}</p>
          </div>
        )}
      </section>

      {/* GRIGLIA O LISTA PROFILI */}
      <section className="mt-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-64 rounded-[24px] aura-skeleton" />
            ))}
          </div>
        ) : filteredList.length === 0 ? (
          <div className="rounded-[24px] border border-white/10 bg-[#1E1428]/90 p-12 text-center space-y-3">
            <p className="font-serif text-xl text-[#F6EFE4]">Nessun flacone trovato con questi criteri.</p>
            <button type="button" onClick={resetAllFilters} className="rounded-full bg-[#281B35] border border-[#D8B995]/40 px-4 py-2 text-xs font-medium text-[#F6EFE4]">
              Mostra tutta la collezione
            </button>
          </div>
        ) : layoutMode === 'vetrina' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredList.map((p) => {
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
                  className="group relative flex flex-col justify-between rounded-[22px] border border-white/10 bg-[#1E1428]/90 p-4 cursor-pointer transition hover:border-[#D8B995]/50"
                >
                  <div className="mb-3">
                    <BottlePedestal src={imgUrl} alt={p.nome} size="md" className="w-full" />
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[#D8B995] truncate">{cleanBrand}</p>
                    <h2 className="font-serif text-base text-[#F6EFE4] truncate mt-0.5">{p.nome}</h2>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredList.map((p) => {
              const unifiedNotes = getUnifiedNotes(p);
              const aiReason = aiMotivazioni[p.id];
              const isEnriching = enrichingId === p.id;
              const imgUrl = p.url_foto_vetrina || p.immagine_url;
              const pureFamily = normalizeToPureFamily(p.famiglia_olfattiva);
              const cleanBrand = normalizeBrandName(p.brand);

              return (
                <article
                  key={p.id}
                  className="flex flex-col justify-between rounded-[24px] border border-white/10 bg-[#1E1428]/90 p-5 shadow-lg transition hover:border-[#D8B995]/40"
                >
                  <div>
                    <div className="flex items-start gap-4">
                      <div
                        onClick={() => {
                          setSelectedProfumo({
                            ...p,
                            brand: cleanBrand,
                            famiglia_olfattiva: pureFamily,
                          });
                          setOfficialUrlInput('');
                        }}
                        className="h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-[18px] bg-[#140D1C] p-2 flex items-center justify-center border border-white/10"
                      >
                        <SmartBottleImage src={imgUrl} alt={p.nome} iconSize="w-6 h-6" className="w-full h-full object-contain" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-[#D8B995] truncate">
                            {cleanBrand}
                          </span>
                          {p.prezzo_stimato_euro && (
                            <span className="font-mono text-xs text-[#D8B995]">
                              {String(p.prezzo_stimato_euro).startsWith('€') ? p.prezzo_stimato_euro : `€${p.prezzo_stimato_euro}`}
                            </span>
                          )}
                        </div>
                        <h2 className="font-serif text-2xl text-[#F6EFE4] truncate mt-0.5">
                          {p.nome}
                        </h2>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-[#281B35] border border-[#D8B995]/30 px-3 py-0.5 text-xs font-medium text-[#F6EFE4]">
                        {pureFamily}
                      </span>
                      {p.stagione_ideale && (
                        <span className="rounded-full bg-[#140D1C] border border-white/10 px-3 py-0.5 text-xs text-[#B8A9C9]">
                          {p.stagione_ideale}
                        </span>
                      )}
                    </div>

                    {p.naso && (
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-[#281B35]/60 border border-white/10 px-3 py-1 text-xs text-[#D8B995]">
                        <span>Naso: {p.naso}</span>
                      </div>
                    )}

                    {aiReason && (
                      <div className="mt-3 rounded-[16px] bg-[#281B35] border border-[#D8B995]/30 p-3 text-xs text-[#F6EFE4]">
                        {aiReason}
                      </div>
                    )}

                    <div className="mt-3 text-xs text-[#B8A9C9]">
                      {p.note_testa || p.note_cuore || p.note_fondo ? (
                        <div className="space-y-1 rounded-[16px] bg-[#140D1C] p-3 border border-white/5">
                          {p.note_testa && <p><span className="text-[#D8B995] font-mono text-[10px]">TESTA:</span> {p.note_testa}</p>}
                          {p.note_cuore && <p><span className="text-[#D8B995] font-mono text-[10px]">CUORE:</span> {p.note_cuore}</p>}
                          {p.note_fondo && <p><span className="text-[#D8B995] font-mono text-[10px]">FONDO:</span> {p.note_fondo}</p>}
                        </div>
                      ) : unifiedNotes ? (
                        <p className="rounded-[16px] bg-[#140D1C] p-3 border border-white/5 line-clamp-2">
                          <span className="text-[#D8B995] font-mono text-[10px]">NOTE:</span> {unifiedNotes}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEnrichWithAI(p)}
                        disabled={isEnriching}
                        className="flex items-center gap-1 rounded-xl bg-[#281B35] border border-[#D8B995]/30 px-3 py-1.5 text-xs font-medium text-[#F6EFE4] transition hover:border-[#D8B995]"
                      >
                        {isEnriching ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-[#D8B995]" />}
                        <span>IA</span>
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
                        className="flex items-center gap-1 rounded-xl bg-[#281B35] border border-white/10 px-3 py-1.5 text-xs font-medium text-[#F6EFE4] transition hover:border-[#D8B995]/40"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5 text-[#D8B995]" />
                        <span>Scheda</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWearProfumo(p)}
                        className="flex items-center gap-1 rounded-xl bg-[#281B35] border border-white/10 px-3 py-1.5 text-xs font-medium text-[#F6EFE4] transition hover:border-[#D8B995]/40"
                      >
                        <Clock className="h-3.5 w-3.5 text-[#D8B995]" />
                        <span>Indossa</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(p)}
                      title="Elimina"
                      className="p-2 text-[#B8A9C9] hover:text-red-400 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* MODALE DETTAGLIO */}
      {selectedProfumo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#140D1C]/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-[32px] border border-[#D8B995]/30 bg-[#1E1428] p-6 sm:p-8 text-[#F6EFE4] shadow-2xl max-h-[90dvh] overflow-y-auto space-y-6">
            <div className="flex items-start justify-between pb-4 border-b border-white/10">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#D8B995]">Modifica Scheda</p>
                <h3 className="font-serif text-2xl text-[#F6EFE4] mt-0.5">{selectedProfumo.nome}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProfumo(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#281B35] text-[#F6EFE4]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-[20px] bg-[#140D1C] p-4 border border-white/10 space-y-3">
              <label className="block font-mono text-[10px] uppercase tracking-widest text-[#D8B995]">Estrai da Web Ufficiale</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={officialUrlInput}
                  onChange={(e) => setOfficialUrlInput(e.target.value)}
                  placeholder="Incolla URL pagina ufficiale..."
                  className="flex-1 rounded-[14px] border border-white/10 bg-[#1E1428] px-3 py-2 text-xs text-[#F6EFE4] focus:border-[#D8B995] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleModalExtractFromOfficial}
                  disabled={modalExtracting}
                  className="flex items-center gap-1.5 rounded-[14px] bg-[#D8B995] px-4 py-2 text-xs font-bold text-[#140D1C] transition disabled:opacity-50"
                >
                  {modalExtracting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
                  <span>Estrai</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveDetails} className="space-y-4">
              {isRadarProfumo(selectedProfumo) && (
                <div className="flex items-center justify-between rounded-[20px] bg-[#281B35] border border-[#D8B995]/40 p-4">
                  <span className="text-xs font-mono text-[#F6EFE4]">Questo flacone è nel Radar Testing</span>
                  <button
                    type="button"
                    onClick={() => handlePromoteToCollection(selectedProfumo)}
                    className="rounded-[14px] bg-[#D8B995] px-4 py-2 text-xs font-bold text-[#140D1C]"
                  >
                    Promuovi in Collezione
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#D8B995] mb-1">Marchio</label>
                  <input
                    type="text"
                    value={selectedProfumo.brand || ''}
                    onChange={(e) => setSelectedProfumo({ ...selectedProfumo, brand: e.target.value })}
                    className="w-full rounded-[14px] border border-white/10 bg-[#140D1C] px-3 py-2 text-xs text-[#F6EFE4]"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#D8B995] mb-1">Nome</label>
                  <input
                    type="text"
                    value={selectedProfumo.nome || ''}
                    onChange={(e) => setSelectedProfumo({ ...selectedProfumo, nome: e.target.value })}
                    className="w-full rounded-[14px] border border-white/10 bg-[#140D1C] px-3 py-2 text-xs text-[#F6EFE4]"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#D8B995] mb-1">Prezzo stimato (€)</label>
                  <input
                    type="text"
                    value={selectedProfumo.prezzo_stimato_euro || ''}
                    onChange={(e) => setSelectedProfumo({ ...selectedProfumo, prezzo_stimato_euro: e.target.value })}
                    className="w-full rounded-[14px] border border-white/10 bg-[#140D1C] px-3 py-2 text-xs text-[#F6EFE4]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#D8B995] mb-1">Famiglia Olfattiva</label>
                  <select
                    value={normalizeToPureFamily(selectedProfumo.famiglia_olfattiva)}
                    onChange={(e) => setSelectedProfumo({ ...selectedProfumo, famiglia_olfattiva: e.target.value })}
                    className="w-full rounded-[14px] border border-white/10 bg-[#140D1C] px-3 py-2 text-xs text-[#F6EFE4]"
                  >
                    {PURE_FAMILIES.map((f) => (
                      <option key={f} value={f} className="bg-[#140D1C]">{f}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#D8B995] mb-1">Concentrazione</label>
                  <input
                    type="text"
                    value={selectedProfumo.concentrazione || ''}
                    onChange={(e) => setSelectedProfumo({ ...selectedProfumo, concentrazione: e.target.value })}
                    className="w-full rounded-[14px] border border-white/10 bg-[#140D1C] px-3 py-2 text-xs text-[#F6EFE4]"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#D8B995] mb-1">Naso Profumiere</label>
                  <input
                    type="text"
                    value={selectedProfumo.naso || ''}
                    onChange={(e) => setSelectedProfumo({ ...selectedProfumo, naso: e.target.value })}
                    className="w-full rounded-[14px] border border-white/10 bg-[#140D1C] px-3 py-2 text-xs text-[#F6EFE4]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#D8B995] mb-1">Note di Testa</label>
                  <input
                    type="text"
                    value={selectedProfumo.note_testa || ''}
                    onChange={(e) => setSelectedProfumo({ ...selectedProfumo, note_testa: e.target.value })}
                    className="w-full rounded-[14px] border border-white/10 bg-[#140D1C] px-3 py-2 text-xs text-[#F6EFE4]"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#D8B995] mb-1">Note di Cuore</label>
                  <input
                    type="text"
                    value={selectedProfumo.note_cuore || ''}
                    onChange={(e) => setSelectedProfumo({ ...selectedProfumo, note_cuore: e.target.value })}
                    className="w-full rounded-[14px] border border-white/10 bg-[#140D1C] px-3 py-2 text-xs text-[#F6EFE4]"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase text-[#D8B995] mb-1">Note di Fondo</label>
                  <input
                    type="text"
                    value={selectedProfumo.note_fondo || ''}
                    onChange={(e) => setSelectedProfumo({ ...selectedProfumo, note_fondo: e.target.value })}
                    className="w-full rounded-[14px] border border-white/10 bg-[#140D1C] px-3 py-2 text-xs text-[#F6EFE4]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setSelectedProfumo(null)}
                  className="rounded-full px-5 py-2.5 text-xs font-semibold text-[#B8A9C9] hover:text-[#F6EFE4]"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={savingDetail}
                  className="rounded-full bg-[#D8B995] px-6 py-2.5 text-xs font-bold text-[#140D1C] transition hover:bg-[#c2a27e] disabled:opacity-50"
                >
                  {savingDetail ? 'Salvataggio...' : 'Salva Modifiche'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE INDOSSO */}
      {wearProfumo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#140D1C]/80 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-[32px] border border-[#D8B995]/30 bg-[#1E1428] p-6 text-[#F6EFE4] space-y-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#D8B995]">Registra Indosso</p>
                <h3 className="font-serif text-2xl text-[#F6EFE4] mt-0.5">{wearProfumo.nome}</h3>
              </div>
              <button type="button" onClick={() => setWearProfumo(null)} className="text-[#B8A9C9] hover:text-[#F6EFE4]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRecordWear} className="space-y-4">
              <div>
                <label className="block font-mono text-[10px] uppercase text-[#D8B995] mb-1.5">Momento</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Mattina', 'Pomeriggio', 'Sera', 'Notte'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMomentoGiornata(m)}
                      className={`rounded-[12px] py-2 text-xs font-semibold transition ${
                        momentoGiornata === m
                          ? 'bg-[#D8B995] text-[#140D1C]'
                          : 'border border-white/10 bg-[#140D1C] text-[#B8A9C9]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase text-[#D8B995] mb-1">Contesto</label>
                <select
                  value={contestoOutfit}
                  onChange={(e) => setContestoOutfit(e.target.value)}
                  className="w-full rounded-[14px] border border-white/10 bg-[#140D1C] px-3 py-2 text-xs text-[#F6EFE4]"
                >
                  <option value="Ufficio" className="bg-[#140D1C]">Ufficio</option>
                  <option value="Aperitivo" className="bg-[#140D1C]">Aperitivo</option>
                  <option value="Cena" className="bg-[#140D1C]">Cena</option>
                  <option value="Serata" className="bg-[#140D1C]">Serata</option>
                  <option value="Evento" className="bg-[#140D1C]">Evento</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setWearProfumo(null)} className="px-4 py-2 text-xs text-[#B8A9C9]">Annulla</button>
                <button type="submit" disabled={savingWear} className="rounded-full bg-[#D8B995] px-5 py-2 text-xs font-bold text-[#140D1C]">
                  {savingWear ? '...' : 'Conferma'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE CONFERMA ELIMINAZIONE */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#140D1C]/80 backdrop-blur-md">
          <div className="w-full max-w-md rounded-[28px] border border-red-500/30 bg-[#1E1428] p-6 text-[#F6EFE4] space-y-4">
            <h3 className="font-serif text-xl text-[#F6EFE4]">Eliminare definitivamente {deleteTarget.nome}?</h3>
            <p className="text-xs text-[#B8A9C9]">Questa operazione rimuoverà il flacone dall&apos;archivio Supabase.</p>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-xs text-[#B8A9C9]">Annulla</button>
              <button type="button" onClick={confirmDelete} className="rounded-full bg-red-600 px-5 py-2 text-xs font-bold text-white">Conferma Eliminazione</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function CollezionePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-[#D8B995] font-mono text-xs">Caricamento...</div>}>
      <CollezioneContent />
    </Suspense>
  );
}
