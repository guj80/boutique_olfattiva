'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { buildSourceLinks, StoredSourceUrls } from '@/lib/source-links';

interface Props {
  brand: string;
  nome: string;
  urls?: StoredSourceUrls;
  color: string; // aura.primary
}

/**
 * Riga discreta di fonti esterne: testo piccolo, nessun bordo né pillola,
 * separata da un filo sottile. Si fonde con la scheda invece di farsi notare.
 */
export function SourceLinks({ brand, nome, urls, color }: Props) {
  const links = buildSourceLinks({ brand, nome, ...(urls || {}) });
  return (
    <nav
      aria-label="Fonti esterne"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/5 pt-2.5"
    >
      <span className="font-mono text-[9px] uppercase tracking-widest text-[#B8A9C9]/60">
        Fonti
      </span>
      {links.map((l) => (
        <a
          key={l.key}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-1 font-mono text-[10px] text-[#B8A9C9] transition-colors hover:text-[#F6EFE4]"
        >
          <span
            className="underline decoration-white/10 underline-offset-4 transition-colors group-hover:decoration-current"
            style={l.direct ? { textDecorationColor: `${color}80` } : undefined}
          >
            {l.label}
          </span>
          <ExternalLink className="h-2.5 w-2.5 opacity-40 transition-opacity group-hover:opacity-90" />
        </a>
      ))}
    </nav>
  );
}
