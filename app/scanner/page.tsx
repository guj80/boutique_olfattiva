'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Link2,
  Camera,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Compass,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react';
import { supabase, Profumo } from '@/lib/supabase';

export default function ScannerPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'url' | 'photo' | 'name'>('url');

  // Input per le 3 modalità
  const [inputUrl, setInputUrl] = useState('');
  const [inputName, setInputName] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');

  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Scheda di Anteprima Editabile (Review Card)
  const [draft, setDraft] = useState<Partial<Profumo> | null>(null);
  const [modelSource, setModelSource] = useState<string>('');
  const [targetStato, setTargetStato] = useState<'collezione' | 'radar'>('collezione');

  // Compressione immagine lato client per evitare errori 413 Payload Too Large su Vercel
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1200;
        let w = img.width;
        let h = img.height;
        if (w > h && w > maxDim) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else if (
