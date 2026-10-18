'use client';

import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Profumo } from '@/lib/supabase';

export interface AuraPair {
  primary: string;
  secondary: string;
  familyLabel: string;
}

// AMBIENTI CROMATICI DISTINTI PER OGNI SEZIONE DEL MENU
export const SECTION_THEMES: Record<string, AuraPair> = {
  atelier: {
    primary: '#38BDF8',   // Blu Zaffiro / Ciano luminoso
    secondary: '#0F172A', // Blu Notte profondo
    familyLabel: 'Atelier',
  },
  collezione: {
    primary: '#10B981',   // Smeraldo Imperiale
    secondary: '#06281E', // Verde Abissale
    familyLabel: 'Collezione',
  },
  scanner: {
    primary: '#F59E0B',   // Ambra / Oro Scultoreo
    secondary: '#291507', // Mogano Scuro
    familyLabel: 'Scanner',
  },
  radar: {
    primary: '#A855F7',   // Viola Ametista
    secondary: '#240B36', // Indaco Notturno
    familyLabel: 'Radar',
  },
  diario: {
    primary: '#F43F5E',   // Rubino Imperiale
    secondary: '#2D0A16', // Bordeaux Abissale
    familyLabel: 'Diario',
  },
};

const FAMILY_RULES: Array<{ keywords: string[]; pair: AuraPair }> = [
  {
    keywords: ['legnos', 'ambrat', 'wood', 'amber', 'oud', 'sandal', 'cedr', 'patchouli', 'vetiver'],
    pair: { primary: '#E07A38', secondary: '#592212', familyLabel: 'Legnoso Ambrato' },
  },
  {
    keywords: ['agrum', 'fresc', 'citr', 'bergamot', 'limon', 'neroli', 'verde', 'pulit'],
    pair: { primary: '#34D399', secondary: '#114232', familyLabel: 'Agrumato Verde' },
  },
  {
    keywords: ['speziat', 'boozy', 'cald', 'spic', 'rum', 'cognac', 'cannell', 'pepe', 'cardamom', 'tabacc'],
    pair: { primary: '#F43F5E', secondary: '#4C1127', familyLabel: 'Speziato Caldo' },
  },
  {
    keywords: ['gourmand', 'vanigl', 'dolc', 'caff', 'cioccol', 'caramel', 'mandorl', 'miele', 'fava tonka'],
    pair: { primary: '#F59E0B', secondary: '#4A2511', familyLabel: 'Gourmand' },
  },
  {
    keywords: ['marin', 'aromat', 'acquat', 'sale', 'ozon', 'lavand', 'salvia', 'rosmarin', 'foug'],
    pair: { primary: '#38BDF8', secondary: '#172554', familyLabel: 'Marino Aromatico' },
  },
  {
    keywords: ['cuoi', 'incens', 'fumos', 'leath', 'smok', 'resine', 'mirra', 'labdan', 'animal', 'musch'],
    pair: { primary: '#A855F7', secondary: '#2E1065', familyLabel: 'Cuoiato Muschiato' },
  },
  {
    keywords: ['fiorit', 'floreal', 'fruttat', 'rosa', 'gelsomin', 'iris', 'tuber', 'peon', 'violett', 'ylang'],
    pair: { primary: '#EC4899', secondary: '#500724', familyLabel: 'Floreale' },
  },
];

const FALLBACK_PALETTES: Array<[string, string]> = [
  ['#38BDF8', '#172554'],
  ['#10B981', '#06281E'],
  ['#A855F7', '#2E1065'],
  ['#F43F5E', '#4C1127'],
  ['#E07A38', '#592212'],
  ['#F59E0B', '#4A2511'],
  ['#EC4899', '#500724'],
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function shiftHexHue(hex: string, degreeDelta: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }

  h = (h + degreeDelta + 360) % 360;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0,
    g1 = 0,
    b1 = 0;

  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];

  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}

export function resolveAura(famiglia?: string | null, nome?: string | null): AuraPair {
  const raw = `${famiglia || ''}`.toLowerCase().trim();
  const cleanName = (nome || '').trim();
  const nameHash = cleanName ? hashString(cleanName) : 0;
  const hueOffset = cleanName ? (nameHash % 25) - 12 : 0;

  if (raw) {
    for (const rule of FAMILY_RULES) {
      if (rule.keywords.some((k) => raw.includes(k))) {
        return {
          primary: shiftHexHue(rule.pair.primary, hueOffset),
          secondary: shiftHexHue(rule.pair.secondary, hueOffset),
          familyLabel: rule.pair.familyLabel,
        };
      }
    }
  }

  if (cleanName) {
    const [basePrimary, baseSecondary] =
      FALLBACK_PALETTES[Math.abs(nameHash) % FALLBACK_PALETTES.length];
    return {
      primary: shiftHexHue(basePrimary, hueOffset),
      secondary: shiftHexHue(baseSecondary, hueOffset),
      familyLabel: famiglia || 'Collezione',
    };
  }

  return SECTION_THEMES.atelier;
}

interface AuraContextValue {
  aura: AuraPair;
  activeProfumo: Profumo | null;
  setAuraFromProfumo: (profumo: Profumo | null) => void;
  setCustomAura: (pair: AuraPair) => void;
  hideDock: boolean;
  setHideDock: (hide: boolean) => void;
}

const AuraContext = createContext<AuraContextValue>({
  aura: SECTION_THEMES.atelier,
  activeProfumo: null,
  setAuraFromProfumo: () => {},
  setCustomAura: () => {},
  hideDock: false,
  setHideDock: () => {},
});

export function AuraProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [aura, setAura] = useState<AuraPair>(SECTION_THEMES.atelier);
  const [activeProfumo, setActiveProfumo] = useState<Profumo | null>(null);
  const [hideDock, setHideDock] = useState(false);

  // Cambio automatico di ambiente cromatico in base al menu visitato
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const isRadar = params.get('vista') === 'radar';
      if (pathname.startsWith('/collezione') && isRadar) {
        setAura(SECTION_THEMES.radar);
        return;
      }
    }
    if (pathname.startsWith('/collezione')) {
      setAura(SECTION_THEMES.collezione);
    } else if (pathname.startsWith('/scanner')) {
      setAura(SECTION_THEMES.scanner);
    } else if (pathname.startsWith('/diario')) {
      setAura(SECTION_THEMES.diario);
    } else {
      setAura(SECTION_THEMES.atelier);
    }
  }, [pathname]);

  const setAuraFromProfumo = useCallback((profumo: Profumo | null) => {
    setActiveProfumo(profumo);
    if (!profumo) return;
    setAura(resolveAura(profumo.famiglia_olfattiva, profumo.nome));
  }, []);

  const setCustomAura = useCallback((pair: AuraPair) => {
    setAura(pair);
  }, []);

  const value = useMemo(
    () => ({
      aura,
      activeProfumo,
      setAuraFromProfumo,
      setCustomAura,
      hideDock,
      setHideDock,
    }),
    [aura, activeProfumo, setAuraFromProfumo, setCustomAura, hideDock]
  );

  return (
    <AuraContext.Provider value={value}>
      <div
        style={
          {
            '--aura-1': aura.primary,
            '--aura-2': aura.secondary,
          } as React.CSSProperties
        }
        className="min-h-[100dvh] w-full bg-[#140D1C] text-[#F6EFE4] transition-colors duration-700"
      >
        {children}
      </div>
    </AuraContext.Provider>
  );
}

export function useAura() {
  return useContext(AuraContext);
}
