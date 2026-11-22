// lib/dictionary.ts
// Dizionario tecnico EN -> IT di note olfattive, resine, legni rari, materie prime animaliche
// e accordi dell'alta profumeria e ultra-nicchia, con supporto bidirezionale per ricerca e autocomplete.

const TECHNICAL_NOTES_DICTIONARY: Record<string, string> = {
  // Agrumi & Esperidati
  'calabrian bergamot': 'Bergamotto di Calabria',
  'italian bergamot': 'Bergamotto Italiano',
  'bergamot': 'Bergamotto',
  'sicilian lemon': 'Limone di Sicilia',
  'italian lemon': 'Limone Italiano',
  'lemon zest': 'Scorza di Limone',
  'lemon grass': 'Citronella (Lemongrass)',
  'lemongrass': 'Citronella (Lemongrass)',
  'lemon': 'Limone',
  'mandarin orange': 'Mandarino',
  'green mandarin': 'Mandarino Verde',
  'mandarin': 'Mandarino',
  'tangerine': 'Tangerino',
  'clementine': 'Clementina',
  'blood orange': 'Arancia Rossa',
  'bitter orange': 'Arancia Amara',
  'sweet orange': 'Arancia Dolce',
  'orange blossom absolute': "Assoluta di Fiore d'Arancio",
  'orange blossom': "Fiore d'Arancio",
  'orange': 'Arancia',
  'pink grapefruit': 'Pompelmo Rosa',
  'grapefruit': 'Pompelmo',
  'kaffir lime': 'Lime Kaffir',
  'lime': 'Lime',
  'yuzu': 'Yuzu',
  'sudachi': 'Sudachi',
  'kumquat': 'Kumquat',
  'citron': 'Cedro (Agrume)',
  'moroccan neroli': 'Neroli del Marocco',
  'tunisian neroli': 'Neroli Tunisino',
  'neroli': 'Neroli',
  'petitgrain': 'Petitgrain',
  'vervain': 'Verbena',
  'verbena': 'Verbena',
  'citrus fruits': 'Agrumi',

  // Fiori & Note Cipriate / Iris
  'damask rose': 'Rosa Damascena',
  'bulgarian rose': 'Rosa Bulgara',
  'taif rose': 'Rosa di Taif',
  'turkish rose absolute': 'Assoluta di Rosa Turca',
  'turkish rose': 'Rosa Turca',
  'may rose': 'Rosa di Maggio',
  'grasse jasmine': 'Gelsomino di Grasse',
  'egyptian jasmine absolute': 'Assoluta di Gelsomino Egiziano',
  'egyptian jasmine': 'Gelsomino Egiziano',
  'jasmine sambac': 'Gelsomino Sambac',
  'jasmine absolute': 'Assoluta di Gelsomino',
  'jasmine': 'Gelsomino',
  'white rose': 'Rosa Bianca',
  'black rose': 'Rosa Nera',
  'rose water': 'Acqua di Rose',
  'rose': 'Rosa',
  'indian tuberose': 'Tuberosa Indiana',
  'tuberose': 'Tuberosa',
  'florentine iris': 'Iris Fiorentino',
  'orris root': 'Radice di Iris',
  'orris absolute': 'Assoluta di Iris',
  'orris butter': "Burro d'Iris",
  'orris': "Burro d'Iris (Orris)",
  'iris': 'Iris',
  'parma violet': 'Violetta di Parma',
  'violet leaf': 'Foglia di Violetta',
  'violet': 'Violetta',
  'madagascan ylang-ylang': 'Ylang-Ylang del Madagascar',
  'ylang-ylang': 'Ylang-Ylang',
  'osmanthus absolute': 'Assoluta di Osmanto',
  'osmanthus': 'Osmanto',
  'champaca': 'Champaca',
  'frangipani': 'Frangipani',
  'mimosa bark': 'Corteccia di Mimosa',
  'mimosa': 'Mimosa',
  'heliotrope': 'Eliotropio',
  'peony': 'Peonia',
  'freesia': 'Fresia',
  'gardenia': 'Gardenia',
  'magnolia': 'Magnolia',
  'lily of the valley': 'Mughetto',
  'white lily': 'Giglio Bianco',
  'lily': 'Giglio',
  'lilac': 'Lillà',
  'hyacinth': 'Giacinto',
  'narcissus': 'Narciso',
  'honeysuckle': 'Caprifoglio',
  'mock-orange': 'Filadelfo (Fior d’Angelo)',
  'red orchid': 'Orchidea Rossa',
  'orchid': 'Orchidea',
  'blue lotus': 'Loto Blu',
  'pink lotus': 'Loto Rosa',
  'lotus': 'Loto',
  'water lily': 'Ninfea',
  'carnation': 'Garofano',
  'bulgarian lavender': 'Lavanda Bulgara',
  'italian lavender': 'Lavanda Italiana',
  'provençal lavender': 'Lavanda Provenzale',
  'lavender': 'Lavanda',
  'bourbon geranium': 'Geranio Bourbon',
  'african geranium': 'Geranio Africano',
  'geranium': 'Geranio',
  'white blossoms': 'Fiori Bianchi',
  'exotic blossoms': 'Fiori Esotici',
  'floral notes': 'Note Floreali',
  'blossoms': 'Fiori',

  // Muschi, Note Animaliche & Ambra Grigia
  'white musk': 'Muschio Bianco',
  'kashmiri musk': 'Muschio del Kashmir',
  'deer musk': 'Muschio di Cervo',
  'tonkin musk': 'Muschio Tonkino',
  'siberian musk': 'Muschio Siberiano',
  'musky notes': 'Note Muschiate',
  'musk': 'Muschio',
  'civet': 'Zibetto',
  'castoreum': 'Castoreo',
  'hyraceum': 'Iraceo (Hyraceum)',
  'ambergris': 'Ambra Grigia',
  'choya nakh': 'Conchiglie Arrostite (Choya Nakh)',
  'ecuadorian ambrette seed': "Semi di Ambretta dell'Ecuador",
  'ambrette': 'Ambretta',
  'ambroxan': 'Ambroxan',
  'iso e super': 'Iso E Super',
  'cashmeran': 'Cashmeran',
  'cashmere wood': 'Legno di Cashmere',
  'akigalawood': 'Akigalawood',
  'georgywood': 'Georgywood',

  // Legni, Oud & Radici
  'australian sandalwood': 'Sandalo Australiano',
  'indian sandalwood': 'Sandalo Indiano',
  'mysore sandalwood': 'Sandalo di Mysore',
  'sandalwood': 'Sandalo',
  'atlas cedar': "Cedro dell'Atlante",
  'virginia cedar': 'Cedro della Virginia',
  'white cedar': 'Cedro Bianco',
  'cedarwood': 'Legno di Cedro',
  'cedar': 'Legno di Cedro',
  'gaiac wood': 'Legno di Guaiaco',
  'guaiac wood': 'Legno di Guaiaco',
  'agarwood (oud)': 'Oud (Legno di Agar)',
  'agarwood': 'Oud (Legno di Agar)',
  'cambodian oud': 'Oud Cambogiano',
  'indian oud': 'Oud Indiano',
  'laotian oud': 'Oud Laotiano',
  'white oud': 'Oud Bianco',
  'oud': 'Oud (Legno di Agar)',
  'ebony': 'Ebano',
  'rosewood': 'Palissandro',
  'oak wood': 'Legno di Quercia',
  'oak': 'Quercia',
  'birch tar': 'Catrame di Betulla',
  'birch': 'Betulla',
  'cade oil': 'Olio di Cade',
  'driftwood': 'Legno alla Deriva',
  'blond woods': 'Legni Chiari',
  'woody notes': 'Note Legnose',
  'woods': 'Legni',
  'indonesian patchouli': 'Patchouli Indonesiano',
  'patchouli': 'Patchouli',
  'haitian vetiver': 'Vetiver di Haiti',
  'vetiver': 'Vetiver',
  'cypriol': 'Cipriolo (Nagarmotha)',
  'nagarmotha': 'Cipriolo (Nagarmotha)',
  'papyrus': 'Papiro',
  'oakmoss': 'Muschio di Quercia',
  'tree moss': "Muschio d'Albero",
  'moss': 'Muschio Vegetale',
  'bamboo': 'Bambù',
  'hinoki': 'Cipresso Hinoki',
  'siberian stone pine needle': 'Aghi di Pino Siberiano',
  'cypress': 'Cipresso',
  'pine': 'Pino',
  'balsam fir': 'Abete Balsamico',
  'fir': 'Abete',
  'juniper berry': 'Bacca di Ginepro',
  'juniper berries': 'Bacche di Ginepro',
  'juniper': 'Ginepro',

  // Resine, Incensi & Balsami
  'frankincense': 'Incenso (Olibano)',
  'incense': 'Incenso (Olibano)',
  'olibanum': 'Olibano (Incenso)',
  'myrrh': 'Mirra',
  'opoponax': 'Opoponax',
  'labdanum': 'Labdano',
  'cistus': 'Cisto',
  'benzoin siam': 'Benzoino del Siam',
  'benzoin': 'Benzoino',
  'peru balsam': 'Balsamo del Perù',
  'colombian tolu balm': 'Balsamo del Tolù',
  'tolu balsam': 'Balsamo del Tolù',
  'gurjan balsam': 'Balsamo Gurjum',
  'copaiba balm': 'Balsamo di Copaiba',
  'styrax': 'Storace',
  'elemi resin': 'Resina di Elemi',
  'elemi': 'Resina di Elemi',
  'mastic absolute': 'Assoluta di Mastice',
  'mastic': 'Mastice (Lentisco)',
  'galbanum': 'Galbano',
  'amberwood': "Legno d'Ambra",
  'amber': 'Ambra',
  'resins': 'Resine',
  'resin': 'Resina',

  // Cuoio, Tabacco & Fumo
  'suede': 'Pelle Scamosciata',
  'leather': 'Cuoio',
  'tobacco leaf': 'Foglie di Tabacco',
  'tobacco': 'Tabacco',
  'smoke': 'Fumo',
  'fume': 'Fumo',
  'tar': 'Catrame',
  'charcoal': 'Carbone',
  'ash': 'Cenere',
  'gunpowder': 'Polvere da Sparo',
  'asphalt': 'Asfalto',
  'rubber': 'Gomma / Caucciù',
  'gasoline': 'Benzina',
  'diesel': 'Gasolio',
  'ink': 'Inchiostro',
  'sulfur': 'Zolfo',
  'rust': 'Ruggine',

  // Spezie & Erbe Aromatiche
  'saffron': 'Zafferano',
  'pink pepper': 'Pepe Rosa',
  'black pepper': 'Pepe Nero',
  'sichuan pepper': 'Pepe di Sichuan',
  'aged pepper': 'Pepe Invecchiato',
  'pepper': 'Pepe',
  'guatemala cardamom': 'Cardamomo del Guatemala',
  'cardamom': 'Cardamomo',
  'cinnamon': 'Cannella',
  'nutmeg': 'Noce Moscata',
  'cloves': 'Chiodi di Garofano',
  'clove': 'Chiodi di Garofano',
  'ginger': 'Zenzero',
  'turmeric': 'Curcuma',
  'russian coriander': 'Coriandolo Russo',
  'coriander': 'Coriandolo',
  'cumin': 'Cumino',
  'aniseed': 'Anice',
  'star anise': 'Anice Stellato',
  'fenugreek': 'Fieno Greco',
  'fennel': 'Finocchio',
  'liquorice': 'Liquirizia',
  'licorice': 'Liquirizia',
  'spices': 'Spezie',
  'clary sage': 'Salvia Sclarea',
  'blue sage': 'Salvia Blu',
  'sage': 'Salvia',
  'rosemary': 'Rosmarino',
  'thyme': 'Timo',
  'oregano': 'Origano',
  'basil': 'Basilico',
  'bay leaf': 'Foglia di Alloro',
  'laurel': 'Alloro',
  'myrtle': 'Mirto',
  'tarragon': 'Dragoncello',
  'peppermint': 'Menta Piperita',
  'spearmint': 'Menta Verde',
  'water mint': 'Menta Acquatica',
  'mint': 'Menta',
  'chinese eucalyptus': 'Eucalipto Cinese',
  'eucalyptus': 'Eucalipto',
  'angelica root': 'Radice di Angelica',
  'angelica': 'Angelica',
  'artemisia': 'Artemisia',
  'absinth': 'Assenzio',
  'absinthe': 'Assenzio',
  'wormwood': 'Assenzio',
  'davana': 'Davana',
  'immortelle': 'Elicriso (Immortelle)',
  'cannabis': 'Cannabis',
  'hemp': 'Canapa',
  'ivy': 'Edera',
  'tomato vine': 'Foglia di Pomodoro',
  'dandelion leaf': 'Foglia di Tarassaco',
  'green leaves': 'Foglie Verdi',
  'green notes': 'Note Verdi',
  'hay': 'Fieno',
  'bran': 'Crusca',
  'barley': 'Orzo',

  // Frutta & Bacche
  'blackcurrant bud absolute': 'Assoluta di Gemme di Ribes Nero',
  'blackcurrant': 'Ribes Nero (Cassis)',
  'black currant': 'Ribes Nero (Cassis)',
  'red berries': 'Bacche Rosse',
  'red fruits': 'Frutti Rossi',
  'berries': 'Bacche',
  'raspberry': 'Lampone',
  'blackberry': 'Mora',
  'strawberry': 'Fragola',
  'cherry': 'Ciliegia',
  'sour cherry': 'Amarena',
  'plum': 'Prugna',
  'peach': 'Pesca',
  'white peach': 'Pesca Bianca',
  'nectarine': 'Nettarina',
  'apricot': 'Albicocca',
  'pear sorbet': 'Sorbetto alla Pera',
  'pear': 'Pera',
  'green apple': 'Mela Verde',
  'red apple': 'Mela Rossa',
  'apple': 'Mela',
  'fig leaf': 'Foglia di Fico',
  'fig milk': 'Latte di Fico',
  'fig': 'Fico',
  'pineapple': 'Ananas',
  'mango': 'Mango',
  'passion fruit': 'Frutto della Passione',
  'lychee': 'Litchi',
  'melon': 'Melone',
  'muscat grape': 'Uva Moscato',
  'dried fruits': 'Frutta Secca',

  // Gourmand, Lattoniche & Note Alcoliche
  'bourbon vanilla orpur®': 'Vaniglia Bourbon',
  'bourbon vanilla': 'Vaniglia Bourbon',
  'madagascar vanilla': 'Vaniglia del Madagascar',
  'ugandan vanilla': 'Vaniglia dell’Uganda',
  'vanilla absolute': 'Assoluta di Vaniglia',
  'vanilla': 'Vaniglia',
  'tonka bean': 'Fava Tonka',
  'honey': 'Miele',
  'beeswax': "Cera d'Api",
  'coffee': 'Caffè',
  'cocoa bean': 'Fava di Cacao',
  'cocoa': 'Cacao',
  'cacao': 'Cacao Assoluto',
  'mexican chocolate': 'Cioccolato Messicano',
  'dark chocolate': 'Cioccolato Fondente',
  'chocolate': 'Cioccolato',
  'praline': 'Pralina',
  'praliné': 'Pralina',
  'caramel': 'Caramello',
  'sugar': 'Zucchero',
  'burnt toast': 'Pane Tostato',
  'fermented almond': 'Mandorla Fermentata',
  'bitter almond': 'Mandorla Amara',
  'almond': 'Mandorla',
  'hazelnut': 'Nocciola',
  'coconut milk': 'Latte di Cocco',
  'coconut': 'Cocco',
  'cream': 'Panna / Crema',
  'yogurt': 'Yogurt',
  'jam': 'Confettura',
  'gourmand notes': 'Note Gourmand',
  'green tea': 'Tè Verde',
  'black tea': 'Tè Nero',
  'red tea': 'Tè Rosso (Rooibos)',
  'mate': 'Assoluta di Mate',
  'rum': 'Rum',
  'cognac': 'Cognac',
  'whisky': 'Whisky',
  'whiskey': 'Whisky',
  'red wine': 'Vino Rosso',
  'champagne': 'Champagne',

  // Note Marine, Ozoniche & Minerali
  'marine notes': 'Note Marine',
  'aquatic notes': 'Note Acquatiche',
  'sea notes': 'Note Marine',
  'seaweed': 'Alghe Marine',
  'brine': 'Salamoia / Acqua Salmastra',
  'salt': 'Sale Marino',
  'aldehydes': 'Aldeidi',
  'ozonic notes': 'Note Ozoniche',
  'dust': 'Polvere',
  'damp': 'Terra Umida / Umidità',
  'earth': 'Terra',
};

const SORTED_ENTRIES = Object.entries(TECHNICAL_NOTES_DICTIONARY).sort(
  (a, b) => b[0].length - a[0].length
);

// Elenco deduplicato delle etichette italiane pulite per l'autocomplete UI
const CANONICAL_IT_NOTES: string[] = Array.from(
  new Set([
    ...Object.values(TECHNICAL_NOTES_DICTIONARY).map((label) =>
      label.replace(/\s*\([^)]*\)/g, '').trim()
    ),
    'Sangue',
    'Neve',
    'Ghiaccio',
    'Cemento Bagnato',
    'Geosmina',
    'Petrichor',
    'Tartufo',
    'Fungo',
    'Note Metalliche',
    'Note Minerali',
    'Cera di Candela',
    'Libri Antichi',
  ])
).sort((a, b) => a.localeCompare(b, 'it'));

function normalizeTerm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatPerfumeNote(text?: string | null): string {
  if (!text || !text.trim()) return '';

  return text
    .split(',')
    .map((rawNote) => {
      let note = rawNote.trim();
      if (!note) return '';
      for (const [en, it] of SORTED_ENTRIES) {
        const escaped = en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
        note = note.replace(regex, it);
      }
      return note.charAt(0).toUpperCase() + note.slice(1);
    })
    .filter(Boolean)
    .join(', ');
}

/**
 * Restituisce suggerimenti canonici in italiano per l'autocomplete dell'input note.
 */
export function suggestNotes(prefix: string, limit = 7): string[] {
  const q = normalizeTerm(prefix);
  if (q.length < 2) return [];

  const startsWith: string[] = [];
  const contains: string[] = [];

  for (let i = 0; i < CANONICAL_IT_NOTES.length; i++) {
    const label = CANONICAL_IT_NOTES[i];
    const norm = normalizeTerm(label);
    if (norm === q) {
      startsWith.unshift(label);
    } else if (norm.startsWith(q)) {
      startsWith.push(label);
    } else if (norm.includes(q)) {
      contains.push(label);
    }
  }

  return [...startsWith, ...contains].slice(0, limit);
}

/**
 * Dato un termine inserito dall'utente (IT o EN, es. "Iris" o "Incenso"),
 * restituisce tutte le varianti equivalenti IT + EN normalizzate per interrogare
 * sia il catalogo inglese (perfumes) sia quello italiano (ultranicchia_import).
 */
export function getNoteSearchVariants(rawQuery: string): string[] {
  const q = normalizeTerm(rawQuery);
  if (!q) return [];

  const variants = new Set<string>([q]);

  for (const [en, it] of SORTED_ENTRIES) {
    const enNorm = normalizeTerm(en);
    const itFullNorm = normalizeTerm(it);
    const itBaseNorm = normalizeTerm(it.replace(/\s*\([^)]*\)/g, ''));

    // Match esatto sul termine base (es. "iris" -> "iris", "orris", "orris root", "florentine iris")
    if (
      q === itBaseNorm ||
      q === itFullNorm ||
      q === enNorm ||
      (q.length >= 4 &&
        (itBaseNorm.split(' ').includes(q) || enNorm.split(' ').includes(q)))
    ) {
      variants.add(enNorm);
      variants.add(itBaseNorm);
    }
  }

  return Array.from(variants).filter((v) => v.length >= 2);
}
