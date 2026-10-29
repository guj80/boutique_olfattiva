export interface MaisonSeed { id: string; name: string; brand: string; country: string; founded: number | null; website: string | null; createdAt: string; updatedAt: string; }
export interface NoteSeed { id: string; name: string; family: string; descriptor: string; }
export interface PerfumeSeed { id: string; name: string; brand: string; maisonId: string; family: string; concentration: string; format: string; priceUsd: number | null; imageUrl: string | null; youtubeId: string | null; description: string | null; sourceUrl: string | null; confidence: number; createdAt: string; updatedAt: string; }
export interface AccordSeed { id: string; perfumeId: string; noteId: string; position: 'top' | 'heart' | 'base'; strength: number; }
export const maisonSeeds: MaisonSeed[] = [];
export const noteSeeds: NoteSeed[] = [];
export const perfumeSeeds: PerfumeSeed[] = [];
export const accordSeeds: AccordSeed[] = [];
