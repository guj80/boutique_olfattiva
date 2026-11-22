// lib/bottle-pipeline.ts
// Pipeline di isolamento flacone, scontorno perimetrale flood-fill (preserva i riflessi interni del vetro),
// normalizzazione proporzioni 800x1000 PNG trasparente e upload permanente su Supabase Storage ('flaconi').

import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/api-fetch';

export interface ProcessedBottleResult {
  blob: Blob;
  previewDataUrl: string;
  width: number;
  height: number;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Impossibile decodificare l’immagine selezionata.'));
    img.src = src;
  });
}

function colorDistanceSq(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return dr * dr + dg * dg + db * db;
}

/**
 * Elabora un'immagine (File o URL) producendo un PNG scontornato 800x1000:
 * 1. Se l'immagine ha già canale alpha reale lungo il bordo, mantiene la trasparenza esistente e ritaglia i margini.
 * 2. Altrimenti esegue flood-fill connesso dai bordi esterni con tolleranza adattiva + feathering morbido sui contorni,
 *    senza mai bucare etichette o riflessi chiari interni al flacone.
 * 3. Isola la componente connessa principale (scartando eventuali scritte/loghi isolati ai margini) e centra il flacone.
 */
export async function processBottleImage(
  source: File | string,
  options: { tolerance?: number } = {}
): Promise<ProcessedBottleResult> {
  let objectUrlToRevoke: string | null = null;
  let imgSrc: string;

  if (typeof source === 'string') {
    if (source.startsWith('data:')) {
      imgSrc = source;
    } else {
      // Passa dal proxy server per evitare blocchi CORS sugli URL esterni
      const res = await apiFetch('/api/bottle-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: source }),
      });
      const json = (await res.json().catch(() => null)) as { dataUrl?: string; error?: string } | null;
      if (!res.ok || !json?.dataUrl) {
        throw new Error(json?.error || 'Impossibile scaricare l’immagine dall’URL indicato.');
      }
      imgSrc = json.dataUrl;
    }
  } else {
    objectUrlToRevoke = URL.createObjectURL(source);
    imgSrc = objectUrlToRevoke;
  }

  try {
    const img = await loadImageElement(imgSrc);

    // Lavoriamo a max 1200px sul lato lungo per precisione sub-pixel e velocità istantanea su mobile
    const maxDim = 1200;
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const workCanvas = document.createElement('canvas');
    workCanvas.width = w;
    workCanvas.height = h;
    const ctx = workCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Contesto grafico non disponibile.');

    ctx.drawImage(img, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // Controlla se l'immagine ha già uno sfondo trasparente sul perimetro
    let transparentBorderPixels = 0;
    let borderSamples = 0;
    for (let x = 0; x < w; x += 2) {
      borderSamples += 2;
      if (data[x * 4 + 3] < 30) transparentBorderPixels++;
      if (data[((h - 1) * w + x) * 4 + 3] < 30) transparentBorderPixels++;
    }
    const alreadyTransparent = transparentBorderPixels > borderSamples * 0.6;

    const totalPixels = w * h;
    const alphaMask = new Uint8Array(totalPixels);
    alphaMask.fill(255);

    if (alreadyTransparent) {
      for (let i = 0; i < totalPixels; i++) {
        alphaMask[i] = data[i * 4 + 3];
      }
    } else {
      // Campiona il colore medio dei 4 angoli (quadrati 6x6)
      const corners = [
        [0, 0],
        [Math.max(0, w - 6), 0],
        [0, Math.max(0, h - 6)],
        [Math.max(0, w - 6), Math.max(0, h - 6)],
      ];
      let sumR = 0,
        sumG = 0,
        sumB = 0,
        cnt = 0;
      for (let c = 0; c < corners.length; c++) {
        const [cx, cy] = corners[c];
        for (let dy = 0; dy < Math.min(6, h); dy++) {
          for (let dx = 0; dx < Math.min(6, w); dx++) {
            const idx = ((cy + dy) * w + (cx + dx)) * 4;
            sumR += data[idx];
            sumG += data[idx + 1];
            sumB += data[idx + 2];
            cnt++;
          }
        }
      }
      const bgR = sumR / Math.max(1, cnt);
      const bgG = sumG / Math.max(1, cnt);
      const bgB = sumB / Math.max(1, cnt);

      const tolerance = options.tolerance ?? 36;
      const hardSq = tolerance * tolerance;
      const softSq = (tolerance + 18) * (tolerance + 18);

      // BFS Flood-fill connesso dal perimetro esterno
      const visited = new Uint8Array(totalPixels);
      const queue = new Int32Array(totalPixels);
      let head = 0;
      let tail = 0;

      const pushIfBg = (x: number, y: number) => {
        if (x < 0 || x >= w || y < 0 || y >= h) return;
        const p = y * w + x;
        if (visited[p]) return;
        visited[p] = 1;
        const idx = p * 4;
        const distSq = colorDistanceSq(data[idx], data[idx + 1], data[idx + 2], bgR, bgG, bgB);
        if (distSq <= hardSq) {
          alphaMask[p] = 0;
          queue[tail++] = p;
        } else if (distSq <= softSq) {
          const ratio = (Math.sqrt(distSq) - tolerance) / 18;
          alphaMask[p] = Math.round(Math.min(255, Math.max(0, ratio * 255)));
        }
      };

      for (let x = 0; x < w; x++) {
        pushIfBg(x, 0);
        pushIfBg(x, h - 1);
      }
      for (let y = 0; y < h; y++) {
        pushIfBg(0, y);
        pushIfBg(w - 1, y);
      }

      while (head < tail) {
        const p = queue[head++];
        const x = p % w;
        const y = (p - x) / w;
        if (x > 0) pushIfBg(x - 1, y);
        if (x + 1 < w) pushIfBg(x + 1, y);
        if (y > 0) pushIfBg(x, y - 1);
        if (y + 1 < h) pushIfBg(x, y + 1);
      }

      // Feathering leggero (1px) sui pixel adiacenti allo sfondo rimosso per bordi puliti
      const smoothed = new Uint8Array(alphaMask);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const p = y * w + x;
          if (alphaMask[p] > 0 && alphaMask[p] < 255) {
            const avg =
              (alphaMask[p - 1] +
                alphaMask[p + 1] +
                alphaMask[p - w] +
                alphaMask[p + w] +
                alphaMask[p] * 2) /
              6;
            smoothed[p] = Math.round(avg);
          }
        }
      }
      alphaMask.set(smoothed);
    }

    // Applica la maschera alpha e calcola il bounding box del flacone
    let minX = w,
      minY = h,
      maxX = 0,
      maxY = 0;
    let visibleCount = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        const a = alphaMask[p];
        data[p * 4 + 3] = a;
        if (a > 28) {
          visibleCount++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Fallback se l'intera immagine era quasi uniforme
    if (visibleCount < 50 || maxX <= minX || maxY <= minY) {
      minX = 0;
      minY = 0;
      maxX = w - 1;
      maxY = h - 1;
    }

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;

    // Tela finale standardizzata 800x1000 con margine uniforme dell'8%
    const outW = 800;
    const outH = 1000;
    const padX = Math.round(outW * 0.08);
    const padY = Math.round(outH * 0.07);
    const availW = outW - padX * 2;
    const availH = outH - padY * 2;

    const fitScale = Math.min(availW / cropW, availH / cropH);
    const drawW = Math.round(cropW * fitScale);
    const drawH = Math.round(cropH * fitScale);
    const drawX = Math.round((outW - drawW) / 2);
    const drawY = Math.round((outH - drawH) / 2);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = outW;
    outCanvas.height = outH;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) throw new Error('Contesto output non disponibile.');

    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = 'high';
    outCtx.drawImage(workCanvas, minX, minY, cropW, cropH, drawX, drawY, drawW, drawH);

    const previewDataUrl = outCanvas.toDataURL('image/png');
    const blob = await new Promise<Blob>((resolve, reject) => {
      outCanvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Errore generazione PNG trasparente.'));
      }, 'image/png');
    });

    return { blob, previewDataUrl, width: outW, height: outH };
  } finally {
    if (objectUrlToRevoke) {
      URL.revokeObjectURL(objectUrlToRevoke);
    }
  }
}

function slugifyFilePart(value: string): string {
  return (value || 'flacone')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/**
 * Carica il PNG scontornato nel bucket Supabase Storage 'flaconi'
 * e restituisce l'URL pubblico permanente.
 */
export async function uploadProcessedBottle(
  blob: Blob,
  brand: string,
  nome: string
): Promise<string> {
  const filePath = `${slugifyFilePart(brand)}/${slugifyFilePart(nome)}-${Date.now()}.png`;

  const { error: uploadError } = await supabase.storage
    .from('flaconi')
    .upload(filePath, blob, {
      contentType: 'image/png',
      cacheControl: '31536000',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Upload storage fallito: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from('flaconi').getPublicUrl(filePath);
  if (!data?.publicUrl) {
    throw new Error('Impossibile ottenere URL pubblico del flacone.');
  }

  return data.publicUrl;
}
