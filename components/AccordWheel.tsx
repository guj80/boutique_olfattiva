'use client';

import React, { useMemo, useState } from 'react';
import {
  Search,
  X,
  Pin,
  Layers,
  Disc,
  Compass,
  ArrowUpRight,
} from 'lucide-react';
import { Profumo, Indosso } from '@/lib/supabase';
import {
  buildOlfactiveGraph,
  FAMILY_ORDER,
  NoteLink,
  NoteNode,
  PyramidLayer,
} from '@/lib/olfactive-graph';
import { resolveAura } from './AuraProvider';

export interface AccordWheelProps {
  profumi: Profumo[];
  indossi: Indosso[];
  onSelectProfumo?: (profumo: Profumo) => void;
}

type WheelMode = 'note' | 'accordi' | 'piramide';
type MetricMode = 'count' | 'lift';

interface ArcSegment {
  id: string;
  label: string;
  family: string;
  dominantTier: 0 | 1 | 2;
  color: string;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  count: number;
}

const TIER_COLORS = ['#E6B422', '#E0689A', '#8A6A4F'];
const TIER_NAMES = ['Testa', 'Cuore', 'Fondo'];

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number
): string {
  const safeEnd =
    endAngle - startAngle < 0.008 ? startAngle + 0.008 : endAngle;
  const largeArc = safeEnd - startAngle > Math.PI ? 1 : 0;

  const p1 = polarToCartesian(cx, cy, rOuter, startAngle);
  const p2 = polarToCartesian(cx, cy, rOuter, safeEnd);
  const p3 = polarToCartesian(cx, cy, rInner, safeEnd);
  const p4 = polarToCartesian(cx, cy, rInner, startAngle);

  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

function describeRibbon(
  cx: number,
  cy: number,
  r: number,
  a1: number,
  a2: number,
  b1: number,
  b2: number
): string {
  const s1 = polarToCartesian(cx, cy, r, a1);
  const s2 = polarToCartesian(cx, cy, r, a2);
  const t1 = polarToCartesian(cx, cy, r, b1);
  const t2 = polarToCartesian(cx, cy, r, b2);

  return [
    `M ${s1.x.toFixed(2)} ${s1.y.toFixed(2)}`,
    `A ${r} ${r} 0 0 1 ${s2.x.toFixed(2)} ${s2.y.toFixed(2)}`,
    `Q ${cx} ${cy} ${t1.x.toFixed(2)} ${t1.y.toFixed(2)}`,
    `A ${r} ${r} 0 0 1 ${t2.x.toFixed(2)} ${t2.y.toFixed(2)}`,
    `Q ${cx} ${cy} ${s1.x.toFixed(2)} ${s1.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

function describeHairlineChord(
  cx: number,
  cy: number,
  r: number,
  aMid: number,
  bMid: number
): string {
  const p1 = polarToCartesian(cx, cy, r, aMid);
  const p2 = polarToCartesian(cx, cy, r, bMid);
  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} Q ${cx} ${cy} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
}

function getFamilyColor(family: string): string {
  return resolveAura(family).primary;
}

function getDominantTier(node: NoteNode): 0 | 1 | 2 {
  const { testa, cuore, fondo } = node.layers;
  if (testa >= cuore && testa >= fondo) return 0;
  if (cuore >= testa && cuore >= fondo) return 1;
  return 2;
}

export function AccordWheel({
  profumi,
  indossi,
  onSelectProfumo,
}: AccordWheelProps) {
  const [mode, setMode] = useState<WheelMode>('note');
  const [scope, setScope] = useState<'all' | 'worn'>('all');
  const [metric, setMetric] = useState<MetricMode>('count');
  const [pyramidLayer, setPyramidLayer] = useState<PyramidLayer>('all');

  const [searchQuery, setSearchQuery] = useState('');
  const [minWeight, setMinWeight] = useState<number>(2);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<0 | 1 | 2 | null>(null);

  const [hoveredLink, setHoveredLink] = useState<NoteLink | null>(null);
  const [pinnedLink, setPinnedLink] = useState<NoteLink | null>(null);
  const [hoveredArcId, setHoveredArcId] = useState<string | null>(null);
  const [pinnedNodeId, setPinnedNodeId] = useState<string | null>(null);

  const graph = useMemo(
    () =>
      buildOlfactiveGraph(
        profumi,
        indossi,
        scope,
        mode === 'piramide' ? pyramidLayer : 'all'
      ),
    [profumi, indossi, scope, mode, pyramidLayer]
  );

  const wornPerfumesCount = useMemo(() => {
    const wornIds = new Set(
      (indossi || []).map((i) => i.profumo_id).filter(Boolean)
    );
    return (profumi || []).filter((p) => wornIds.has(p.id)).length;
  }, [profumi, indossi]);

  const maxAvailableWeight = useMemo(() => {
    const sourceLinks = mode === 'accordi' ? graph.familyLinks : graph.links;
    if (sourceLinks.length === 0) return 4;
    const top = sourceLinks[0].weight;
    return Math.max(2, Math.min(12, top));
  }, [graph, mode]);

  const effectiveMinWeight = Math.min(minWeight, maxAvailableWeight);

  const visibleLinks = useMemo(() => {
    const base = mode === 'accordi' ? graph.familyLinks : graph.links;
    const q = searchQuery.trim().toLowerCase();

    let filtered = base.filter((l) => l.weight >= effectiveMinWeight);

    if (selectedFamily) {
      filtered = filtered.filter(
        (l) =>
          l.sourceFamily === selectedFamily || l.targetFamily === selectedFamily
      );
    }

    if (q) {
      filtered = filtered.filter(
        (l) =>
          l.sourceLabel.toLowerCase().includes(q) ||
          l.targetLabel.toLowerCase().includes(q)
      );
    }

    if (metric === 'lift') {
      filtered = filtered
        .slice()
        .sort((a, b) => b.lift - a.lift || b.weight - a.weight);
    } else {
      filtered = filtered
        .slice()
        .sort((a, b) => b.weight - a.weight || b.lift - a.lift);
    }

    return filtered.slice(0, mode === 'accordi' ? 48 : 95);
  }, [graph, mode, effectiveMinWeight, selectedFamily, searchQuery, metric]);

  const { nodeArcs, familyGroupArcs, nodeById } = useMemo(() => {
    const nodesMap = new Map<string, NoteNode>();
    for (let i = 0; i < graph.nodes.length; i++) {
      nodesMap.set(graph.nodes[i].id, graph.nodes[i]);
    }

    if (mode === 'accordi') {
      const fams = graph.families;
      const total = fams.reduce((acc, f) => acc + f.count, 0) || 1;
      const gap = 0.032;
      const available = Math.PI * 2 - gap * fams.length;
      let cursor = -Math.PI / 2;

      const arcs: ArcSegment[] = fams.map((f) => {
        const span = Math.max(0.06, (f.count / total) * available);
        const seg: ArcSegment = {
          id: f.family,
          label: f.family,
          family: f.family,
          dominantTier: 1,
          color: getFamilyColor(f.family),
          startAngle: cursor,
          endAngle: cursor + span,
          midAngle: cursor + span / 2,
          count: f.count,
        };
        cursor += span + gap;
        return seg;
      });

      return { nodeArcs: arcs, familyGroupArcs: arcs, nodeById: nodesMap };
    }

    const nodes = graph.nodes;
    if (nodes.length === 0) {
      return { nodeArcs: [], familyGroupArcs: [], nodeById: nodesMap };
    }

    const totalWeight = nodes.reduce((acc, n) => acc + n.count, 0) || 1;
    const nodeGap = 0.012;
    const familyGap = 0.035;

    let famTransitions = 0;
    for (let i = 1; i < nodes.length; i++) {
      if (nodes[i].family !== nodes[i - 1].family) famTransitions++;
    }

    const totalGaps = nodeGap * nodes.length + familyGap * famTransitions;
    const usableAngle = Math.max(Math.PI, Math.PI * 2 - totalGaps);

    let cursor = -Math.PI / 2;
    const arcs: ArcSegment[] = [];
    const groupMap = new Map<
      string,
      { start: number; end: number; count: number }
    >();

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (i > 0 && n.family !== nodes[i - 1].family) {
        cursor += familyGap;
      }
      const span = Math.max(0.025, (n.count / totalWeight) * usableAngle);
      const startAngle = cursor;
      const endAngle = cursor + span;

      arcs.push({
        id: n.id,
        label: n.label,
        family: n.family,
        dominantTier: getDominantTier(n),
        color: getFamilyColor(n.family),
        startAngle,
        endAngle,
        midAngle: (startAngle + endAngle) / 2,
        count: n.count,
      });

      const grp = groupMap.get(n.family);
      if (!grp) {
        groupMap.set(n.family, { start: startAngle, end: endAngle, count: n.count });
      } else {
        grp.end = endAngle;
        grp.count += n.count;
      }

      cursor = endAngle + nodeGap;
    }

    const groups: ArcSegment[] = FAMILY_ORDER.filter((f) => groupMap.has(f)).map(
      (fam) => {
        const g = groupMap.get(fam)!;
        return {
          id: fam,
          label: fam,
          family: fam,
          dominantTier: 1,
          color: getFamilyColor(fam),
          startAngle: g.start,
          endAngle: g.end,
          midAngle: (g.start + g.end) / 2,
          count: g.count,
        };
      }
    );

    return { nodeArcs: arcs, familyGroupArcs: groups, nodeById: nodesMap };
  }, [graph, mode]);

  const arcById = useMemo(() => {
    const map = new Map<string, ArcSegment>();
    for (let i = 0; i < nodeArcs.length; i++) {
      map.set(nodeArcs[i].id, nodeArcs[i]);
    }
    return map;
  }, [nodeArcs]);

  const activeLink = hoveredLink || pinnedLink;

  const inspectedPerfumes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    if (activeLink) {
      return activeLink.perfumes;
    }

    if (pinnedNodeId) {
      const node = nodeById.get(pinnedNodeId);
      if (node) {
        const idSet = new Set(node.perfumeIds);
        return profumi.filter((p) => {
          if (!idSet.has(p.id)) return false;
          if (selectedFamily) {
            const rawFam = (p.famiglia_olfattiva || '').toLowerCase();
            if (!rawFam.includes(selectedFamily.toLowerCase())) return false;
          }
          return true;
        });
      }
    }

    if (q) {
      return profumi.filter((p) => {
        const hay = `${p.nome} ${p.brand} ${p.note_testa || ''} ${p.note_cuore || ''} ${p.note_fondo || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
        if (selectedFamily) {
          const rawFam = (p.famiglia_olfattiva || '').toLowerCase();
          if (!rawFam.includes(selectedFamily.toLowerCase())) return false;
        }
        return true;
      });
    }

    if (selectedFamily) {
      return profumi.filter((p) =>
        (p.famiglia_olfattiva || '')
          .toLowerCase()
          .includes(selectedFamily.toLowerCase())
      );
    }

    return visibleLinks.length > 0 ? visibleLinks[0].perfumes : [];
  }, [
    activeLink,
    pinnedNodeId,
    nodeById,
    profumi,
    selectedFamily,
    searchQuery,
    visibleLinks,
  ]);

  const inspectorTitle = useMemo(() => {
    if (activeLink) {
      return {
        left: activeLink.sourceLabel,
        right: activeLink.targetLabel,
        badge:
          metric === 'lift'
            ? `${activeLink.lift}× · ${activeLink.weight} creazioni`
            : `${activeLink.weight} ${
                activeLink.weight === 1 ? 'creazione' : 'creazioni'
              }`,
      };
    }
    if (pinnedNodeId) {
      const n = nodeById.get(pinnedNodeId);
      if (n) {
        return {
          left: n.label,
          right: selectedFamily || n.family,
          badge: `${inspectedPerfumes.length} creazioni`,
        };
      }
    }
    if (searchQuery.trim()) {
      return {
        left: `“${searchQuery.trim()}”`,
        right: selectedFamily || 'Tutte le famiglie',
        badge: `${inspectedPerfumes.length} creazioni`,
      };
    }
    if (selectedFamily) {
      return {
        left: selectedFamily,
        right: 'Famiglia',
        badge: `${inspectedPerfumes.length} creazioni`,
      };
    }
    if (visibleLinks.length > 0) {
      return {
        left: visibleLinks[0].sourceLabel,
        right: visibleLinks[0].targetLabel,
        badge: `${visibleLinks[0].weight} creazioni`,
      };
    }
    return {
      left: 'Nessun legame',
      right: 'Soglia',
      badge: 'Riduci filtro',
    };
  }, [
    activeLink,
    pinnedNodeId,
    nodeById,
    selectedFamily,
    searchQuery,
    inspectedPerfumes.length,
    visibleLinks,
    metric,
  ]);

  const maxFamilyCount = useMemo(() => {
    if (graph.families.length === 0) return 1;
    return Math.max.apply(
      null,
      graph.families.map((f) => f.count)
    );
  }, [graph.families]);

  const handleModeSwitch = (next: WheelMode) => {
    setMode(next);
    setPinnedLink(null);
    setHoveredLink(null);
    setPinnedNodeId(null);
    setSelectedTier(null);
    if (next === 'accordi') {
      setMinWeight(1);
    } else {
      setMinWeight(2);
    }
  };

  const clearSelection = () => {
    setPinnedLink(null);
    setHoveredLink(null);
    setPinnedNodeId(null);
    setSelectedTier(null);
  };

  const CX = 260;
  const CY = 260;
  const OUTER_R = 204;
  const MID_R = 190;
  const INNER_R = 176;
  const CHORD_R = mode === 'piramide' ? 173 : 183;

  return (
    <section className="rounded-[28px] border border-white/10 bg-[#08060C]/95 p-5 sm:p-8 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.85)]">
      {/* Barra superiore: 3 Viste + Selettore Perimetro */}
      <div className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div
            role="tablist"
            aria-label="Atlante Olfattivo"
            className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-white/10 bg-[#0E0A16] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'note'}
              onClick={() => handleModeSwitch('note')}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                mode === 'note'
                  ? 'bg-[#EEF2F4] text-[#050308] shadow-sm'
                  : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
              }`}
            >
              <Disc className="h-3.5 w-3.5" />
              <span>Note</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={mode === 'accordi'}
              onClick={() => handleModeSwitch('accordi')}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                mode === 'accordi'
                  ? 'bg-[#EEF2F4] text-[#050308] shadow-sm'
                  : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
              <span>Accordi</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={mode === 'piramide'}
              onClick={() => handleModeSwitch('piramide')}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                mode === 'piramide'
                  ? 'bg-[#EEF2F4] text-[#050308] shadow-sm'
                  : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Piramide</span>
            </button>
          </div>

          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="font-serif text-3xl sm:text-4xl tracking-tight text-[#F6EFE4]">
              {mode === 'note' && 'Note'}
              {mode === 'accordi' && 'Accordi'}
              {mode === 'piramide' && 'Piramide'}
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#B8A9C9]/70">
              {mode === 'note' && `${graph.nodes.length} materie prime · ${visibleLinks.length} legami`}
              {mode === 'accordi' && `${graph.families.length} famiglie · ${visibleLinks.length} sinergie`}
              {mode === 'piramide' && 'Testa · Cuore · Fondo'}
            </span>
          </div>
        </div>

        {/* Toggle Perimetro */}
        <div className="flex items-center self-start lg:self-end rounded-full border border-white/10 bg-[#0E0A16] p-1">
          <button
            type="button"
            onClick={() => setScope('all')}
            className={`rounded-full px-4 py-1.5 text-left transition ${
              scope === 'all'
                ? 'bg-[#EEF2F4] text-[#050308]'
                : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
            }`}
          >
            <span className="block text-[11px] font-bold leading-tight">
              Collezione
            </span>
            <span className="block font-mono text-[9px] opacity-75">
              {profumi.length} flaconi
            </span>
          </button>

          <button
            type="button"
            onClick={() => setScope('worn')}
            disabled={wornPerfumesCount === 0}
            className={`rounded-full px-4 py-1.5 text-left transition disabled:opacity-40 ${
              scope === 'worn'
                ? 'bg-[#EEF2F4] text-[#050308]'
                : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
            }`}
          >
            <span className="block text-[11px] font-bold leading-tight">
              Indossati
            </span>
            <span className="block font-mono text-[9px] opacity-75">
              {wornPerfumesCount} attivi
            </span>
          </button>
        </div>
      </div>

      {/* Griglia Principale: 7 col Ruota + 5 col Ispettore */}
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-6">
        {/* COLONNA SINISTRA: Ricerca + Ruota SVG */}
        <div className="flex flex-col items-center lg:col-span-7">
          <div className="relative mb-5 w-full max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B8A9C9]/60" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPinnedLink(null);
              }}
              placeholder="Cerca nota (es. bergamotto, iris, oud...)"
              className="w-full rounded-full border border-white/10 bg-[#0E0A16] pl-11 pr-10 py-2.5 text-xs sm:text-sm text-[#F6EFE4] placeholder:text-[#B8A9C9]/40 focus:border-white/30 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Cancella ricerca"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#B8A9C9] hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Stage Ruota SVG Quadrata */}
          <div className="relative aspect-square w-full max-w-[360px] sm:max-w-[470px] select-none">
            <svg
              viewBox="0 0 520 520"
              className="h-full w-full overflow-visible"
              onClick={(e) => {
                if (e.target === e.currentTarget) clearSelection();
              }}
            >
              {/* Fili / Nastri interni */}
              <g>
                {visibleLinks.map((link) => {
                  const sArc = arcById.get(link.sourceId);
                  const tArc = arcById.get(link.targetId);
                  if (!sArc || !tArc) return null;

                  const isSelected = activeLink?.id === link.id;
                  const isNodeHighlighted =
                    pinnedNodeId &&
                    (link.sourceId === pinnedNodeId ||
                      link.targetId === pinnedNodeId);
                  const isTierMatch =
                    selectedTier === null ||
                    sArc.dominantTier === selectedTier ||
                    tArc.dominantTier === selectedTier;
                  const isDimmed =
                    (activeLink && !isSelected) ||
                    (pinnedNodeId && !isNodeHighlighted) ||
                    !isTierMatch;

                  if (mode === 'accordi') {
                    const halfW = Math.min(
                      0.09,
                      0.015 +
                        (link.weight / Math.max(1, maxAvailableWeight)) * 0.055
                    );
                    const d = describeRibbon(
                      CX,
                      CY,
                      CHORD_R,
                      sArc.midAngle - halfW,
                      sArc.midAngle + halfW,
                      tArc.midAngle - halfW,
                      tArc.midAngle + halfW
                    );

                    return (
                      <path
                        key={link.id}
                        d={d}
                        fill={isSelected ? '#FFFFFF' : sArc.color}
                        fillOpacity={isSelected ? 0.92 : isDimmed ? 0.07 : 0.42}
                        stroke={isSelected ? '#FFFFFF' : 'none'}
                        strokeWidth={isSelected ? 1 : 0}
                        className="cursor-pointer transition-opacity duration-200"
                        onMouseEnter={() => setHoveredLink(link)}
                        onMouseLeave={() => setHoveredLink(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPinnedNodeId(null);
                          setPinnedLink((prev) =>
                            prev?.id === link.id ? null : link
                          );
                        }}
                      />
                    );
                  }

                  const d = describeHairlineChord(
                    CX,
                    CY,
                    CHORD_R,
                    sArc.midAngle,
                    tArc.midAngle
                  );

                  const strokeColor =
                    mode === 'piramide'
                      ? TIER_COLORS[sArc.dominantTier]
                      : sArc.color;

                  const strokeW = isSelected
                    ? 2.6
                    : Math.min(2.2, 0.75 + link.weight * 0.35);

                  return (
                    <g key={link.id}>
                      <path
                        d={d}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={12}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredLink(link)}
                        onMouseLeave={() => setHoveredLink(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPinnedNodeId(null);
                          setPinnedLink((prev) =>
                            prev?.id === link.id ? null : link
                          );
                        }}
                      />
                      <path
                        d={d}
                        fill="none"
                        stroke={isSelected ? '#FFFFFF' : strokeColor}
                        strokeWidth={strokeW}
                        strokeOpacity={
                          isSelected
                            ? 0.98
                            : isNodeHighlighted
                            ? 0.85
                            : isDimmed
                            ? 0.07
                            : 0.48
                        }
                        className="pointer-events-none transition-opacity duration-200"
                      />
                    </g>
                  );
                })}
              </g>

              {/* In modalità Piramide: Anello interno Piramide (Testa/Cuore/Fondo) + Anello esterno Famiglia */}
              {mode === 'piramide' && (
                <g>
                  {nodeArcs.map((arc) => {
                    const isActive =
                      hoveredArcId === arc.id ||
                      pinnedNodeId === arc.id ||
                      activeLink?.sourceId === arc.id ||
                      activeLink?.targetId === arc.id;
                    const isTierDimmed =
                      selectedTier !== null &&
                      arc.dominantTier !== selectedTier;

                    return (
                      <path
                        key={`tier-band-${arc.id}`}
                        d={describeArc(
                          CX,
                          CY,
                          MID_R - 2,
                          INNER_R,
                          arc.startAngle,
                          arc.endAngle
                        )}
                        fill={TIER_COLORS[arc.dominantTier]}
                        fillOpacity={
                          isTierDimmed ? 0.16 : isActive ? 1 : 0.85
                        }
                        className="cursor-pointer transition-opacity duration-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTier((prev) =>
                            prev === arc.dominantTier ? null : arc.dominantTier
                          );
                        }}
                      />
                    );
                  })}
                </g>
              )}

              {/* Anello esterno principale (Famiglia / Nota) */}
              <g>
                {nodeArcs.map((arc) => {
                  const isActive =
                    hoveredArcId === arc.id ||
                    pinnedNodeId === arc.id ||
                    activeLink?.sourceId === arc.id ||
                    activeLink?.targetId === arc.id;

                  const isFilteredOut =
                    (selectedFamily !== null &&
                      arc.family !== selectedFamily) ||
                    (mode === 'piramide' &&
                      selectedTier !== null &&
                      arc.dominantTier !== selectedTier);

                  const rOut = OUTER_R;
                  const rIn = mode === 'piramide' ? MID_R : 186;

                  return (
                    <path
                      key={arc.id}
                      d={describeArc(
                        CX,
                        CY,
                        rOut,
                        rIn,
                        arc.startAngle,
                        arc.endAngle
                      )}
                      fill={arc.color}
                      fillOpacity={isFilteredOut ? 0.18 : isActive ? 1 : 0.85}
                      stroke={isActive ? '#FFFFFF' : 'none'}
                      strokeWidth={isActive ? 1.2 : 0}
                      className="cursor-pointer transition-opacity duration-200"
                      onMouseEnter={() => setHoveredArcId(arc.id)}
                      onMouseLeave={() => setHoveredArcId(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (mode === 'accordi') {
                          setSelectedFamily((prev) =>
                            prev === arc.family ? null : arc.family
                          );
                        } else {
                          setPinnedLink(null);
                          setPinnedNodeId((prev) =>
                            prev === arc.id ? null : arc.id
                          );
                        }
                      }}
                    />
                  );
                })}
              </g>

              {/* Etichette radiali delle Famiglie */}
              <g className="pointer-events-none">
                {familyGroupArcs.map((grp) => {
                  if (grp.endAngle - grp.startAngle < 0.14) return null;
                  const pos = polarToCartesian(
                    CX,
                    CY,
                    OUTER_R + 18,
                    grp.midAngle
                  );
                  const isLeft = Math.cos(grp.midAngle) < -0.15;
                  const isRight = Math.cos(grp.midAngle) > 0.15;

                  return (
                    <text
                      key={grp.id}
                      x={pos.x}
                      y={pos.y}
                      textAnchor={
                        isLeft ? 'end' : isRight ? 'start' : 'middle'
                      }
                      dominantBaseline="middle"
                      className="fill-[#B8A9C9] font-mono text-[8.5px] font-bold uppercase tracking-[0.14em]"
                    >
                      {grp.label}
                    </text>
                  );
                })}
              </g>

              {/* Readout Centrale */}
              <g className="cursor-pointer" onClick={clearSelection}>
                <circle
                  cx={CX}
                  cy={CY}
                  r={74}
                  fill="#050308"
                  fillOpacity={0.75}
                />
                <text
                  x={CX}
                  y={CY - 6}
                  textAnchor="middle"
                  className="fill-[#F6EFE4] font-serif text-[15px] tracking-tight"
                >
                  {inspectorTitle.left}
                  <tspan className="fill-[#B8A9C9]/70"> × </tspan>
                  {inspectorTitle.right}
                </text>
                <text
                  x={CX}
                  y={CY + 14}
                  textAnchor="middle"
                  className="fill-[#B8A9C9] font-mono text-[8.5px] uppercase tracking-[0.18em]"
                >
                  {inspectorTitle.badge}
                </text>
              </g>
            </svg>
          </div>

          {/* Legenda compatta strati in vista Piramide */}
          {mode === 'piramide' && (
            <div className="mt-2 flex items-center gap-4 font-mono text-[10px] text-[#B8A9C9]">
              {TIER_NAMES.map((lbl, idx) => (
                <button
                  key={lbl}
                  type="button"
                  onClick={() =>
                    setSelectedTier((prev) =>
                      prev === (idx as 0 | 1 | 2) ? null : (idx as 0 | 1 | 2)
                    )
                  }
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 transition ${
                    selectedTier === idx
                      ? 'bg-white/10 text-white'
                      : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  <span
                    style={{ backgroundColor: TIER_COLORS[idx] }}
                    className="h-2 w-2 rounded-full"
                  />
                  <span>{lbl}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* COLONNA DESTRA: Pannello Ispettore */}
        <div className="flex flex-col justify-between space-y-6 border-t border-white/10 pt-6 lg:col-span-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div className="space-y-6">
            {/* Filtro strato Piramide (solo nella vista Piramide) */}
            {mode === 'piramide' && (
              <div className="space-y-2">
                <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#B8A9C9]">
                  Strato Piramide
                </span>
                <div className="grid grid-cols-4 gap-1.5 rounded-full border border-white/10 bg-[#0E0A16] p-1">
                  {(
                    [
                      { id: 'all', label: 'Tutti' },
                      { id: 'testa', label: 'Testa' },
                      { id: 'cuore', label: 'Cuore' },
                      { id: 'fondo', label: 'Fondo' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPyramidLayer(item.id)}
                      className={`rounded-full py-1 text-[11px] font-semibold transition ${
                        pyramidLayer === item.id
                          ? 'bg-[#EEF2F4] text-[#050308]'
                          : 'text-[#B8A9C9] hover:text-[#F6EFE4]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Slider Soglia Minima + Ordinamento */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#B8A9C9]">
                  Soglia minima
                </span>
                <span className="font-mono text-xs font-bold text-[#F6EFE4]">
                  {effectiveMinWeight}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={maxAvailableWeight}
                value={effectiveMinWeight}
                onChange={(e) => {
                  setMinWeight(Number(e.target.value));
                  setPinnedLink(null);
                }}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-[#EEF2F4]"
              />

              <div className="flex items-center justify-between pt-1">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#B8A9C9]/70">
                  Metrica
                </span>
                <div className="inline-flex rounded-full border border-white/10 bg-[#0E0A16] p-0.5">
                  <button
                    type="button"
                    onClick={() => setMetric('count')}
                    className={`rounded-full px-2.5 py-0.5 font-mono text-[9px] uppercase transition ${
                      metric === 'count'
                        ? 'bg-[#EEF2F4] text-[#050308] font-bold'
                        : 'text-[#B8A9C9]'
                    }`}
                  >
                    Frequenza
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetric('lift')}
                    className={`rounded-full px-2.5 py-0.5 font-mono text-[9px] uppercase transition ${
                      metric === 'lift'
                        ? 'bg-[#EEF2F4] text-[#050308] font-bold'
                        : 'text-[#B8A9C9]'
                    }`}
                  >
                    Lift
                  </button>
                </div>
              </div>
            </div>

            {/* Mini-Istogramma Famiglie */}
            <div className="space-y-2.5 border-t border-white/10 pt-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#B8A9C9]">
                  Famiglie
                </span>
                {selectedFamily ? (
                  <button
                    type="button"
                    onClick={() => setSelectedFamily(null)}
                    className="font-mono text-[10px] text-[#EEF2F4] underline underline-offset-2"
                  >
                    Tutte
                  </button>
                ) : (
                  <span className="font-mono text-[10px] text-[#B8A9C9]/70">
                    {graph.families.length}
                  </span>
                )}
              </div>

              <div className="flex h-12 items-end gap-1.5 pt-1">
                {graph.families.map((fam) => {
                  const pct = Math.max(
                    18,
                    Math.round((fam.count / maxFamilyCount) * 100)
                  );
                  const isSelected = selectedFamily === fam.family;
                  const isDimmed = selectedFamily !== null && !isSelected;

                  return (
                    <button
                      key={fam.family}
                      type="button"
                      title={fam.family}
                      onClick={() =>
                        setSelectedFamily((prev) =>
                          prev === fam.family ? null : fam.family
                        )
                      }
                      style={{
                        height: `${pct}%`,
                        backgroundColor: getFamilyColor(fam.family),
                      }}
                      className={`flex-1 rounded-t-sm transition-all duration-200 ${
                        isSelected
                          ? 'ring-2 ring-white opacity-100'
                          : isDimmed
                          ? 'opacity-25 hover:opacity-60'
                          : 'opacity-85 hover:opacity-100'
                      }`}
                    />
                  );
                })}
              </div>
              {selectedFamily && (
                <p className="font-mono text-[10px] text-[#EEF2F4]">
                  {selectedFamily}
                </p>
              )}
            </div>

            {/* Lista Creazioni Abbinate */}
            <div className="space-y-3 border-t border-white/10 pt-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#B8A9C9]">
                  Creazioni
                </span>
                {(pinnedLink || pinnedNodeId || selectedTier !== null) && (
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 font-mono text-[9px] text-[#EEF2F4]"
                  >
                    <Pin className="h-2.5 w-2.5" />
                    <span>Sblocca</span>
                  </button>
                )}
              </div>

              <div>
                <p className="font-serif text-lg text-[#F6EFE4]">
                  {inspectorTitle.left}{' '}
                  <span className="text-[#B8A9C9]/60">×</span>{' '}
                  {inspectorTitle.right}
                </p>
                <p className="font-mono text-[10px] text-[#B8A9C9]/75">
                  {inspectorTitle.badge}
                </p>
              </div>

              {inspectedPerfumes.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-[#0E0A16] px-4 py-3 text-xs text-[#B8A9C9]/75">
                  Nessuna creazione corrispondente.
                </p>
              ) : (
                <ul className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
                  {inspectedPerfumes.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => onSelectProfumo?.(p)}
                        className="group flex w-full items-center justify-between gap-3 rounded-xl border border-transparent bg-[#0E0A16]/75 px-3.5 py-2.5 text-left transition hover:border-white/15 hover:bg-[#140D1C]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-[#F6EFE4] group-hover:text-white">
                            {p.nome}
                          </p>
                          <p className="truncate font-mono text-[10px] text-[#B8A9C9]/80">
                            {p.brand}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <span className="font-mono text-[10px] text-[#B8A9C9]">
                            {p.famiglia_olfattiva}
                          </span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-[#B8A9C9]/50 transition group-hover:text-[#F6EFE4]" />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
