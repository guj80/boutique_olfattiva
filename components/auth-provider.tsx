'use client';

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { Profumo } from '@/lib/supabase';

export interface AuraPair {
  primary: string;
  secondary: string;
  familyLabel: string;
}

const DEFAULT_AURA: AuraPair = {
  primary: '#D8B995',
  secondary: '#3A1F4D',
  familyLabel: 'Atelier',
};

const FAMILY_RULES: Array<{ keywords: string[]; pair: AuraPair }> = [
  {
    keywords: ['legnos', 'ambrat', 'wood', 'amber', 'oud', 'sandal', 'cedr', 'patchouli', 'vetiver'],
    pair: { primary: '#E8893A', secondary: '#8B3A1E', familyLabel: 'Legnoso Ambrato' },
  },
  {
    keywords: ['agrum', 'fresc', 'citr', 'bergamot', 'limon', 'neroli', 'verde', 'pulit'],
    pair: { primary: '#EAD75A', secondary: '#7FBF8E', familyLabel: 'Agrumato Fresco' },
  },
  {
    keywords: ['speziat', 'boozy', 'cald', 'spic', 'rum', 'cognac', 'cannell', 'pepe', 'cardamom', 'tabacc'],
    pair: { primary: '#E5484D', secondary: '#7A1F3D', familyLabel: 'Speziato Caldo' },
  },
  {
    keywords: ['gourmand', 'vanigl', 'dolc', 'caff', 'cioccol', 'caramel', 'mandorl', 'miele', 'fava tonka'],
    pair: { primary: '#F2B07B', secondary: '#B5563A', familyLabel: 'Gourmand' },
  },
  {
    keywords: ['marin', 'aromat', 'acquat', 'sale', 'ozon', 'lavand', 'salvia', 'rosmarin', 'foug'],
    pair: { primary: '#5CC8E8', secondary: '#2F5FD0', familyLabel: 'Marino Aromatico' },
  },
  {
    keywords: ['cuoi', 'incens', 'fumos', 'leath', 'smok', 'resine', 'mirra', 'labdan', 'animal'],
    pair: { primary: '#A58BD6', secondary: '#3A2A5E', familyLabel: 'Cuoiato Incensato' },
  },
  {
    keywords: ['fiorit', 'floreal', 'rosa', 'gelsomin', 'iris', 'tuber', 'peon', 'violett', 'ylang'],
    pair: { primary: '#F59BC0', secondary: '#B84C8F', familyLabel: 'Fiorito' },
  },
];

const FALLBACK_PALETTES: Array<[string, string]> = [
  ['#E8893A', '#8B3A1E'],
  ['#EAD75A', '#7FBF8E'],
  ['#E5484D', '#7A1F3D'],
  ['#F2B07B', '#B5563A'],
  ['#5CC8E8', '#2F5FD0'],
  ['#A58BD6', '#3A2A5E'],
  ['#F59BC0', '#B84C8F'],
  ['#D8B995', '#3A1F4D'],
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

  return DEFAULT_AURA;
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
  aura: DEFAULT_AURA,
  activeProfumo: null,
  setAuraFromProfumo: () => {},
  setCustomAura: () => {},
  hideDock: false,
  setHideDock: () => {},
});

export function AuraProvider({ children }: { children: React.ReactNode }) {
  const [aura, setAura] = useState<AuraPair>(DEFAULT_AURA);
  const [activeProfumo, setActiveProfumo] = useState<Profumo | null>(null);
  const [hideDock, setHideDock] = useState(false);

  const setAuraFromProfumo = useCallback((profumo: Profumo | null) => {
    setActiveProfumo(profumo);
    if (!profumo) {
      setAura(DEFAULT_AURA);
      return;
    }
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
